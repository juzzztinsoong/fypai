export type DraftPromotionSourceType = 'insight' | 'message'

export interface DraftPromotionPayload {
  sourceType: DraftPromotionSourceType
  sourceId: string
  sourceLabel: string
  excerpt: string
  parentMessageId?: string
  teamId?: string
}

const DRAFT_PROMOTION_EVENT = 'fypai:promote-to-draft'

function normalizeText(raw: string): string {
  return raw
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractDraftExcerpt(raw: string, maxLength = 220): string {
  const normalized = normalizeText(raw)
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized

  const slice = normalized.slice(0, maxLength + 1)
  const lastSpace = slice.lastIndexOf(' ')
  const cutoff = lastSpace > Math.floor(maxLength * 0.6) ? lastSpace : maxLength
  return `${slice.slice(0, cutoff).trimEnd()}...`
}

export function emitDraftPromotion(payload: DraftPromotionPayload): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<DraftPromotionPayload>(DRAFT_PROMOTION_EVENT, {
      detail: payload,
    }),
  )
}

export function subscribeToDraftPromotion(
  handler: (payload: DraftPromotionPayload) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<DraftPromotionPayload>
    if (!customEvent.detail) return
    handler(customEvent.detail)
  }

  window.addEventListener(DRAFT_PROMOTION_EVENT, listener as EventListener)

  return () => {
    window.removeEventListener(DRAFT_PROMOTION_EVENT, listener as EventListener)
  }
}
