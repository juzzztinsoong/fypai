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

const RESEARCH_PATTERNS: RegExp[] = [
  /\bresearch\b/i,
  /\bcompare\b/i,
  /\btrade[-\s]?off(s)?\b/i,
  /\bpros?\s+and\s+cons?\b/i,
  /\bdeep\s+dive\b/i,
  /\bbrief\b/i,
  /\banaly[sz]e\b/i,
  /\boptions?\b/i,
  /\brecommend\b/i,
  /\bwhat\s+should\s+we\s+do\b/i,
]

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

    const hasResearchSignal = RESEARCH_PATTERNS.some((pattern) => pattern.test(trimmedContent))
    if (hasResearchSignal) {
      return {
        mode: 'research',
        confidence: 0.9,
        rationale: 'Matched explicit research-oriented phrasing (compare/trade-off/deep-dive pattern).',
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

    return {
      mode: 'ask',
      confidence: Math.min(1, Math.max(0, syncClassification.confidence)),
      rationale: RESEARCH_INTENT_RATIONALE[syncClassification.intent],
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
