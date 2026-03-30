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

export type InsightGenerationType = 'summary' | 'document' | 'action' | 'suggestion'
export type AgentRouteChannel = 'chat_message' | 'insight' | 'silent'

export interface AgentRouteDecision {
  channel: AgentRouteChannel
  confidence: number
  rationale: string
  explicit: boolean
  clarify: boolean
  insightType?: InsightGenerationType
  suggestedInsightType?: InsightGenerationType
  promptOverride?: string
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
  /\bresearch\s+(brief|plan|report|analysis|summary)\b/i,
  /\bresearch\s+(on|about)\b/i,
  /\bresearch\s+this\b/i,
  /\b(?:do|run|perform|conduct)\s+(?:some\s+)?research\b/i,
  /\bcompare\b/i,
  /\btrade[-\s]?off(s)?\b/i,
  /\bpros?\s+and\s+cons?\b/i,
  /\bdeep\s+dive\b/i,
  /\bliterature\s+review\b/i,
  /\bevidence\b/i,
  /\bbenchmark\b/i,
]

const SOFT_RESEARCH_PATTERNS: RegExp[] = [
  /\bresearch\b/i,
  /\bbrief\b/i,
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

const SUMMARY_PATTERNS: RegExp[] = [
  /\bsummar(y|ize|ise)\b/i,
  /\brecap\b/i,
  /\btl;dr\b/i,
  /\bmeeting\s+notes\b/i,
]

const ACTION_PATTERNS: RegExp[] = [
  /\baction\s+items?\b/i,
  /\bto-?do\b/i,
  /\btasks?\b/i,
  /\bnext\s+steps\b/i,
  /\bowner\b/i,
  /\bdeadline\b/i,
]

const SUGGESTION_PATTERNS: RegExp[] = [
  /\bhelp\b/i,
  /\bguidance\b/i,
  /\bsuggest\b/i,
  /\brecommend\b/i,
  /\bideas?\b/i,
  /\bpossible\s+approach\b/i,
  /\bwhat\s+do\s+you\s+think\b/i,
]

const EXPLICIT_REQUEST_CUE_PATTERNS: RegExp[] = [
  /\bplease\b/i,
  /\bcan\s+you\b/i,
  /\bcould\s+you\b/i,
  /\bwould\s+you\b/i,
  /\b(need|want)\s+you\s+to\b/i,
  /\b(summarize|summarise|research|analyze|analyse|generate|create|draft|prepare|produce|extract|list|compile|suggest|recommend)\b/i,
]

const EXPLICIT_SUGGESTION_REQUEST_PATTERNS: RegExp[] = [
  /\bsuggest(?:ions?)?\b/i,
  /\brecommend(?:ation|ations)?\b/i,
  /\bwhat\s+do\s+you\s+recommend\b/i,
  /\bpossible\s+approach(?:es)?\b/i,
  /\boptions?\b/i,
]

const BRAINSTORM_PATTERNS: RegExp[] = [
  /\bbrainstorm(?:ing)?\b/i,
  /\bexplor(e|ing|ation)\b/i,
  /\bidea\s+generation\b/i,
  /\bpossible\s+directions\b/i,
  /\bhelp\s+me\s+out\b/i,
]

const MIN_INFERRED_INSIGHT_CONFIDENCE = clamp(
  Number(process.env.MIN_INFERRED_INSIGHT_CONFIDENCE || '0.72'),
)
const LOW_CONFIDENCE_CLARIFY_FLOOR = clamp(
  Number(process.env.LOW_CONFIDENCE_CLARIFY_FLOOR || '0.55'),
)
const MIN_AUTO_INSIGHT_INPUT_CHARS = Math.max(
  0,
  Number.parseInt(process.env.MIN_AUTO_INSIGHT_INPUT_CHARS || '40', 10),
)
const MIN_EXPLICIT_TEXT_INSIGHT_INPUT_CHARS = Math.max(
  0,
  Number.parseInt(process.env.MIN_EXPLICIT_TEXT_INSIGHT_INPUT_CHARS || '24', 10),
)
const MIN_AUTO_INSIGHT_INPUT_WORDS = Math.max(
  0,
  Number.parseInt(process.env.MIN_AUTO_INSIGHT_INPUT_WORDS || '8', 10),
)
const MIN_EXPLICIT_TEXT_INSIGHT_INPUT_WORDS = Math.max(
  0,
  Number.parseInt(process.env.MIN_EXPLICIT_TEXT_INSIGHT_INPUT_WORDS || '4', 10),
)

interface ExplicitInsightCommand {
  insightType: InsightGenerationType
  promptOverride?: string
  source: 'slash-command' | 'explicit-request'
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
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

function hasPattern(patterns: RegExp[], value: string): boolean {
  return patterns.some((pattern) => pattern.test(value))
}

function hasExplicitRequestCue(value: string): boolean {
  return hasPattern(EXPLICIT_REQUEST_CUE_PATTERNS, value)
}

function parseExplicitInsightCommand(content: string): ExplicitInsightCommand | null {
  const trimmed = content.trim()
  if (!trimmed) return null

  const slash = trimmed.match(/^\/(summary|research|actions?|suggest|help)\b\s*(.*)$/i)
  if (slash) {
    const command = slash[1].toLowerCase()
    const prompt = slash[2]?.trim() || undefined
    if (command === 'summary') return { insightType: 'summary', promptOverride: prompt, source: 'slash-command' }
    if (command === 'research') return { insightType: 'document', promptOverride: prompt, source: 'slash-command' }
    if (command === 'action' || command === 'actions') {
      return { insightType: 'action', promptOverride: prompt, source: 'slash-command' }
    }
    if (command === 'help') return { insightType: 'suggestion', promptOverride: prompt, source: 'slash-command' }
    if (command === 'suggest') return { insightType: 'suggestion', promptOverride: prompt, source: 'slash-command' }
  }

  const lower = trimmed.toLowerCase()
  if (!lower.includes('@agent')) return null

  // Keep @agent conversational by default unless request phrasing clearly asks
  // for a generated long-form insight artifact.
  if (!hasExplicitRequestCue(trimmed)) return null

  if (hasPattern(SUMMARY_PATTERNS, trimmed)) {
    return { insightType: 'summary', source: 'explicit-request' }
  }
  if (hasPattern(STRONG_RESEARCH_PATTERNS, trimmed)) {
    return { insightType: 'document', source: 'explicit-request' }
  }
  if (hasPattern(ACTION_PATTERNS, trimmed)) {
    return { insightType: 'action', source: 'explicit-request' }
  }
  if (hasPattern(EXPLICIT_SUGGESTION_REQUEST_PATTERNS, trimmed)) {
    return { insightType: 'suggestion', source: 'explicit-request' }
  }

  return null
}

function scoreSummarySignal(content: string, classifierIntent: IntentType): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  if (hasPattern(SUMMARY_PATTERNS, content)) {
    score += 0.74
    reasons.push('Matched summary phrasing')
  }

  if (classifierIntent === 'summary_request') {
    score = Math.max(score, 0.82)
    reasons.push('Classifier indicates summary request')
  }

  return { score: clamp(score), reasons }
}

function scoreActionSignal(content: string, classifierIntent: IntentType): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  if (hasPattern(ACTION_PATTERNS, content)) {
    score += 0.7
    reasons.push('Matched action-item phrasing')
  }

  if (classifierIntent === 'action_commitment') {
    score += 0.14
    reasons.push('Classifier detected commitment intent')
  }

  return { score: clamp(score), reasons }
}

function scoreSuggestionSignal(
  content: string,
  classifierIntent: IntentType,
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  if (hasPattern(SUGGESTION_PATTERNS, content)) {
    score += 0.68
    reasons.push('Matched suggestion phrasing')
  }

  if (classifierIntent === 'question') {
    score += 0.08
    reasons.push('Question intent can map to recommendations')
  }

  if (hasPattern(BRAINSTORM_PATTERNS, content)) {
    score += 0.18
    reasons.push('Brainstorm/exploration language maps to Help recommendations')
  }

  return { score: clamp(score), reasons }
}

function scoreDocumentSignal(
  content: string,
  classifierIntent: IntentType,
  researchSignal: { score: number; reasons: string[] },
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = researchSignal.score

  if (researchSignal.reasons.length > 0) {
    reasons.push(...researchSignal.reasons)
  }

  if (classifierIntent === 'question' && researchSignal.score >= 0.55) {
    score += 0.05
    reasons.push('Question intent reinforced research score')
  }

  if (hasPattern(BRAINSTORM_PATTERNS, content) && score < 0.9) {
    score = Math.max(0, score - 0.12)
    reasons.push('Brainstorm intent reduced pure research routing confidence')
  }

  return { score: clamp(score), reasons }
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
  static hasExplicitInsightCommand(content: string): boolean {
    return parseExplicitInsightCommand(content) !== null
  }

  static async decideAgentRoute(content: string, teamId?: string): Promise<AgentRouteDecision> {
    const trimmedContent = content.trim()

    if (!trimmedContent) {
      return {
        channel: 'silent',
        confidence: 0,
        rationale: 'Empty content',
        explicit: false,
        clarify: false,
        classifierIntent: 'none',
      }
    }

    const explicit = parseExplicitInsightCommand(trimmedContent)
    if (explicit) {
      if (explicit.source === 'slash-command') {
        return {
          channel: 'insight',
          confidence: 1,
          rationale: 'Matched explicit slash insight command.',
          explicit: true,
          clarify: false,
          insightType: explicit.insightType,
          suggestedInsightType: explicit.insightType,
          promptOverride: explicit.promptOverride,
          classifierIntent: 'direct_mention',
        }
      }

      const explicitWordCount = countWords(trimmedContent)
      const explicitTooShort =
        trimmedContent.length < MIN_EXPLICIT_TEXT_INSIGHT_INPUT_CHARS ||
        explicitWordCount < MIN_EXPLICIT_TEXT_INSIGHT_INPUT_WORDS

      if (explicitTooShort) {
        return {
          channel: 'chat_message',
          confidence: 0.65,
          rationale:
            `Explicit insight request is too short for long-form output ` +
            `(min ${MIN_EXPLICIT_TEXT_INSIGHT_INPUT_CHARS} chars and ${MIN_EXPLICIT_TEXT_INSIGHT_INPUT_WORDS} words). Clarification required.`,
          explicit: true,
          clarify: true,
          suggestedInsightType: explicit.insightType,
          promptOverride: explicit.promptOverride,
          classifierIntent: 'direct_mention',
        }
      }

      return {
        channel: 'insight',
        confidence: 1,
        rationale: 'Matched explicit @agent insight request with sufficient context.',
        explicit: true,
        clarify: false,
        insightType: explicit.insightType,
        suggestedInsightType: explicit.insightType,
        promptOverride: explicit.promptOverride,
        classifierIntent: 'direct_mention',
      }
    }

    const nonExplicitWordCount = countWords(trimmedContent)
    if (nonExplicitWordCount <= 1) {
      return {
        channel: 'chat_message',
        confidence: 0.2,
        rationale: 'Single-word non-explicit input stays conversational.',
        explicit: false,
        clarify: false,
        classifierIntent: 'none',
      }
    }

    const syntheticMessage: MessageDTO = {
      id: 'intent-route-preview',
      teamId: teamId || 'intent-route-preview-team',
      authorId: 'intent-route-preview-user',
      content: trimmedContent,
      contentType: 'text',
      createdAt: new Date().toISOString(),
    }

    const syncClassification = IntentClassifier.getInstance().classifySync(syntheticMessage)
    const researchSignal = scoreResearchSignal(trimmedContent)

    const summarySignal = scoreSummarySignal(trimmedContent, syncClassification.intent)
    const actionSignal = scoreActionSignal(trimmedContent, syncClassification.intent)
    const suggestionSignal = scoreSuggestionSignal(trimmedContent, syncClassification.intent)
    const documentSignal = scoreDocumentSignal(trimmedContent, syncClassification.intent, researchSignal)

    const categoryScores: Array<{
      type: InsightGenerationType
      score: number
      reasons: string[]
    }> = [
      { type: 'summary', score: summarySignal.score, reasons: summarySignal.reasons },
      { type: 'document', score: documentSignal.score, reasons: documentSignal.reasons },
      { type: 'action', score: actionSignal.score, reasons: actionSignal.reasons },
      { type: 'suggestion', score: suggestionSignal.score, reasons: suggestionSignal.reasons },
    ]

    categoryScores.sort((a, b) => b.score - a.score)
    const top = categoryScores[0]

    const inferredWordCount = countWords(trimmedContent)
    const inferredTooShort =
      trimmedContent.length < MIN_AUTO_INSIGHT_INPUT_CHARS ||
      inferredWordCount < MIN_AUTO_INSIGHT_INPUT_WORDS

    if (top && top.score >= MIN_INFERRED_INSIGHT_CONFIDENCE && inferredTooShort) {
      return {
        channel: 'chat_message',
        confidence: top.score,
        rationale:
          `Inferred insight category found but input is too short for long-form output ` +
          `(min ${MIN_AUTO_INSIGHT_INPUT_CHARS} chars and ${MIN_AUTO_INSIGHT_INPUT_WORDS} words). Clarification required.`,
        explicit: false,
        clarify: true,
        suggestedInsightType: top.type,
        classifierIntent: syncClassification.intent,
      }
    }

    if (top && top.score >= MIN_INFERRED_INSIGHT_CONFIDENCE) {
      return {
        channel: 'insight',
        confidence: top.score,
        rationale: top.reasons.join('; ') || 'Inferred high-confidence insight category.',
        explicit: false,
        clarify: false,
        insightType: top.type,
        suggestedInsightType: top.type,
        classifierIntent: syncClassification.intent,
      }
    }

    if (top && top.score >= LOW_CONFIDENCE_CLARIFY_FLOOR) {
      return {
        channel: 'chat_message',
        confidence: top.score,
        rationale: `${top.reasons.join('; ') || 'Inferred category with medium confidence'}. Clarification required.`,
        explicit: false,
        clarify: true,
        suggestedInsightType: top.type,
        classifierIntent: syncClassification.intent,
      }
    }

    return {
      channel: 'chat_message',
      confidence: Math.min(1, Math.max(0, syncClassification.confidence)),
      rationale: 'No strong insight-category signal; remain conversational.',
      explicit: false,
      clarify: false,
      suggestedInsightType: top?.type,
      classifierIntent: syncClassification.intent,
    }
  }

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

    if (countWords(trimmedContent) <= 1) {
      return {
        mode: 'ask',
        confidence: 0.2,
        rationale: 'Single-word non-explicit input stays in ask mode.',
        classifierIntent: 'none',
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
