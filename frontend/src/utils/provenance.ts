import type { AIInsightDTO, MessageMetadata } from '@/types'

interface ProvenanceSummary {
  source?: string
  trigger?: string
  createdBy?: string
  detail?: string
}

const SOURCE_LABELS: Record<string, string> = {
  'seed-onboarding': 'Seed Onboarding',
  'ai-generation': 'AI Generation',
  'reactive-chat': 'Reactive Chat',
  'autonomous-rule': 'Autonomous Rule',
  'promoted-content': 'Reply Context',
  'user-request': 'User Request',
  'direct-insight-create': 'Direct Insight',
  system: 'System',
}

const TRIGGER_LABELS: Record<string, string> = {
  'seed-bootstrap': 'Seed Bootstrap',
  'manual-generation': 'Manual Generation',
  'auto-escalation': 'Auto Escalation',
  'chime-rule': 'Chime Rule',
  'promote-iterate': 'Reply + Iterate',
  'explicit-request': 'Explicit Request',
  'api-request': 'API Request',
  unknown: 'Unknown',
}

function sanitizeToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function humanizeToken(token: string): string {
  return token
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function resolveLabel(token: string, labels: Record<string, string>): string {
  return labels[token] || humanizeToken(token)
}

export function getMarkerProvenance(
  metadata?: MessageMetadata,
  fallbackInsightMetadata?: AIInsightDTO['metadata'],
): ProvenanceSummary {
  const sourceToken =
    sanitizeToken(metadata?.markerSource) ||
    sanitizeToken(fallbackInsightMetadata?.provenanceSource)
  const triggerToken =
    sanitizeToken(metadata?.markerTrigger) ||
    sanitizeToken(fallbackInsightMetadata?.provenanceTrigger)
  const createdByToken =
    sanitizeToken(metadata?.markerCreatedBy) ||
    sanitizeToken(fallbackInsightMetadata?.provenanceCreatedBy)
  const detailToken =
    sanitizeToken(metadata?.markerTriggerDetail) ||
    sanitizeToken(fallbackInsightMetadata?.provenanceDetail) ||
    sanitizeToken(fallbackInsightMetadata?.chimeRuleName)

  return {
    source: sourceToken ? resolveLabel(sourceToken, SOURCE_LABELS) : undefined,
    trigger: triggerToken ? resolveLabel(triggerToken, TRIGGER_LABELS) : undefined,
    createdBy: createdByToken ? humanizeToken(createdByToken) : undefined,
    detail: detailToken,
  }
}

export function getInsightProvenance(metadata?: AIInsightDTO['metadata']): ProvenanceSummary {
  const sourceToken = sanitizeToken(metadata?.provenanceSource)
  const triggerToken = sanitizeToken(metadata?.provenanceTrigger)
  const createdByToken = sanitizeToken(metadata?.provenanceCreatedBy)
  const detailToken = sanitizeToken(metadata?.provenanceDetail)

  return {
    source: sourceToken ? resolveLabel(sourceToken, SOURCE_LABELS) : undefined,
    trigger: triggerToken ? resolveLabel(triggerToken, TRIGGER_LABELS) : undefined,
    createdBy: createdByToken ? humanizeToken(createdByToken) : undefined,
    detail: detailToken,
  }
}
