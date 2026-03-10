import { MessageDTO } from '@fypai/types'
import { IntentClassifier, IntentType } from '../ai/core/intentClassifier.js'
import { prisma } from '../db.js'

export type ComposerMode = 'ask' | 'research'

export interface IntentClassificationResponse {
  mode: ComposerMode
  confidence: number
  rationale: string
  classifierIntent: IntentType
}

interface RouteMetadataSnapshot {
  routeMode?: 'ask' | 'research'
  routeConfidence?: number
  routeRationale?: string
  routeSource?: 'manual-override' | 'server-classifier' | 'frontend-fallback'
  routeOverrideUsed?: boolean
}

const STRONG_RESEARCH_PATTERNS: RegExp[] = [
  /\bresearch\b/i,
  /\bcompare\b/i,
  /\btrade[-\s]?off(s)?\b/i,
  /\bpros?\s+and\s+cons?\b/i,
  /\bdeep\s+dive\b/i,
  /\bbrief\b/i,
  /\bliterature\s+review\b/i,
  /\bevidence\b/i,
  /\bbenchmark\b/i,
]

const SOFT_RESEARCH_PATTERNS: RegExp[] = [
  /\banaly[sz]e\b/i,
  /\boptions?\b/i,
  /\brecommend\b/i,
  /\bwhat\s+should\s+we\s+do\b/i,
  /\bbest\s+approach\b/i,
  /\bfeasib(le|ility)\b/i,
  /\bimpact\b/i,
  /\brisk(s)?\b/i,
  /\bstrategy\b/i,
  /\bevaluate\b/i,
]

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function scoreResearchSignal(content: string): { score: number; reasons: string[] } {
  const normalized = content.trim()
  const reasons: string[] = []
  let score = 0

  const strongMatch = STRONG_RESEARCH_PATTERNS.find((pattern) => pattern.test(normalized))
  if (strongMatch) {
    score += 0.7
    reasons.push('Matched explicit research phrasing')
  }

  const softMatches = SOFT_RESEARCH_PATTERNS.filter((pattern) => pattern.test(normalized)).length
  if (softMatches > 0) {
    const softBoost = Math.min(0.24, softMatches * 0.08)
    score += softBoost
    reasons.push(`Matched ${softMatches} planning/evaluation hint(s)`)
  }

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length
  if (tokenCount >= 18) {
    score += 0.08
    reasons.push('Longer query suggests deeper analysis')
  }

  if (/\?/.test(normalized) && /(why|how|should|could|would|which|what)/i.test(normalized)) {
    score += 0.06
    reasons.push('Analytical question structure detected')
  }

  return {
    score: clamp(score),
    reasons,
  }
}

const RESEARCH_INTENT_RATIONALE: Record<IntentType, string> = {
  direct_mention: 'Direct agent mention is best handled as a normal assistant chat response.',
  question: 'General question does not require long-form research output.',
  code_request: 'Code request is best served by direct assistant response first.',
  summary_request: 'Summary requests are handled by assistant summary flow, not research pipeline.',
  casual_chat: 'Casual chat does not need research generation.',
  decision_detected: 'Decision detection is captured by autonomous insights, not research mode.',
  confusion: 'Clarification requests are best handled in assistant chat.',
  action_commitment: 'Commitments map to action tracking, not research generation.',
  blocker: 'Blockers are better handled by direct assistant guidance first.',
  none: 'No strong research signal detected; defaulting to assistant mode.',
}

export class IntentController {
  static async classify(content: string, teamId?: string): Promise<IntentClassificationResponse> {
    const trimmedContent = content.trim()

    if (!trimmedContent) {
      return {
        mode: 'ask',
        confidence: 0,
        rationale: 'Empty content cannot be classified; defaulting to assistant mode.',
        classifierIntent: 'none',
      }
    }

    if (trimmedContent.toLowerCase().includes('@agent')) {
      return {
        mode: 'ask',
        confidence: 1,
        rationale: 'Direct @agent mention should route to conversational assistant mode.',
        classifierIntent: 'direct_mention',
      }
    }

    const researchSignal = scoreResearchSignal(trimmedContent)

    if (researchSignal.score >= 0.72) {
      return {
        mode: 'research',
        confidence: researchSignal.score,
        rationale: `${researchSignal.reasons.join('; ')}. Routed to research mode.`,
        classifierIntent: 'none',
      }
    }

    const syntheticMessage: MessageDTO = {
      id: 'intent-preview',
      teamId: teamId || 'intent-preview-team',
      authorId: 'intent-preview-user',
      content: trimmedContent,
      contentType: 'text',
      createdAt: new Date().toISOString(),
    }

    const syncClassification = IntentClassifier.getInstance().classifySync(syntheticMessage)

    if (syncClassification.intent === 'question' && researchSignal.score >= 0.55) {
      return {
        mode: 'research',
        confidence: clamp(Math.max(0.62, researchSignal.score)),
        rationale: `${researchSignal.reasons.join('; ')}. Question appears to need long-form research output.`,
        classifierIntent: syncClassification.intent,
      }
    }

    if (syncClassification.intent === 'none' && researchSignal.score >= 0.6) {
      return {
        mode: 'research',
        confidence: clamp(Math.max(0.6, researchSignal.score - 0.05)),
        rationale: `${researchSignal.reasons.join('; ')}. Routed to research despite weak sync intent match.`,
        classifierIntent: syncClassification.intent,
      }
    }

    return {
      mode: 'ask',
      confidence: Math.min(1, Math.max(0, syncClassification.confidence)),
      rationale:
        researchSignal.score > 0
          ? `${RESEARCH_INTENT_RATIONALE[syncClassification.intent]} Research score=${researchSignal.score.toFixed(2)}.`
          : RESEARCH_INTENT_RATIONALE[syncClassification.intent],
      classifierIntent: syncClassification.intent,
    }
  }

  static async getOverrideRate(teamId: string, hours = 24) {
    const safeHours = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 30) : 24
    const fromDate = new Date(Date.now() - safeHours * 60 * 60 * 1000)

    const messages = await prisma.message.findMany({
      where: {
        teamId,
        contentType: 'text',
        createdAt: {
          gte: fromDate,
        },
      },
      select: {
        metadata: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 2000,
    })

    let routedMessages = 0
    let manualOverrideCount = 0
    let autoCount = 0
    let serverClassifiedCount = 0
    let fallbackCount = 0
    let askCount = 0
    let researchCount = 0

    for (const message of messages) {
      if (!message.metadata) continue
      let parsed: RouteMetadataSnapshot | null = null
      try {
        parsed = JSON.parse(message.metadata) as RouteMetadataSnapshot
      } catch {
        parsed = null
      }

      if (!parsed?.routeMode) continue
      routedMessages += 1

      if (parsed.routeMode === 'research') researchCount += 1
      if (parsed.routeMode === 'ask') askCount += 1

      if (parsed.routeOverrideUsed) {
        manualOverrideCount += 1
      } else {
        autoCount += 1
      }

      if (parsed.routeSource === 'server-classifier') serverClassifiedCount += 1
      if (parsed.routeSource === 'frontend-fallback') fallbackCount += 1
    }

    const overrideRate = routedMessages > 0 ? manualOverrideCount / routedMessages : 0

    return {
      teamId,
      windowHours: safeHours,
      totals: {
        routedMessages,
        manualOverrideCount,
        autoCount,
        askCount,
        researchCount,
      },
      sources: {
        serverClassifier: serverClassifiedCount,
        frontendFallback: fallbackCount,
      },
      metrics: {
        overrideRate,
        autoRate: routedMessages > 0 ? autoCount / routedMessages : 0,
      },
    }
  }
}
