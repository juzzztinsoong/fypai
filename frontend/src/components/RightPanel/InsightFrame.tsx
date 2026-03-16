import type { ReactNode } from 'react'
import type { AIInsightDTO } from '../../types'
import { getChipClass } from '@/styles/uiTokens'
import { getInsightProvenance } from '@/utils/provenance'
import { emitDraftPromotion, extractDraftExcerpt } from '@/utils/draftComposer'

interface InsightFrameProps {
  insight: AIInsightDTO
  title: string
  icon: ReactNode
  containerClassName: string
  titleClassName: string
  content: ReactNode
  onJumpToSource?: (messageId: string) => void
  onJumpToChatMarker?: (insightId: string) => void
}

export const InsightFrame = ({
  insight,
  title,
  icon,
  containerClassName,
  titleClassName,
  content,
  onJumpToSource,
  onJumpToChatMarker,
}: InsightFrameProps) => {
  const provenance = getInsightProvenance(insight.metadata)
  const lineageMetadata = insight.metadata as
    | (typeof insight.metadata & {
        sourceInsightId?: string
        sourceExcerpt?: string
      })
    | undefined

  const handleReplyFromInsight = () => {
    const excerpt = extractDraftExcerpt(insight.content || insight.title)
    if (!excerpt) return

    emitDraftPromotion({
      sourceType: 'insight',
      sourceId: insight.id,
      sourceLabel: insight.title,
      excerpt,
      parentMessageId: insight.relatedMessageIds?.[0],
      teamId: insight.teamId,
    })
  }

  return (
    <div
      id={`insight-${insight.id}`}
      data-insight-id={insight.id}
      data-insight-type={insight.type}
      onMouseEnter={() => window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: insight.id, active: true } }))}
      onMouseLeave={() => window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: insight.id, active: false } }))}
      className={containerClassName}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          {icon}
          <div>
            <span className={`${titleClassName} leading-5`}>{title}</span>
          </div>
        </div>
      </div>

      {(provenance.source || provenance.trigger || provenance.createdBy || provenance.detail) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {provenance.source && (
            <span className={getChipClass('neutral', 'xs')}>
              Source: {provenance.source}
            </span>
          )}
          {provenance.trigger && (
            <span className={getChipClass('warning', 'xs')}>
              Trigger: {provenance.trigger}
            </span>
          )}
          {provenance.createdBy && (
            <span className={getChipClass('muted', 'xs')}>
              By: {provenance.createdBy}
            </span>
          )}
          {provenance.detail && (
            <span className={getChipClass('muted', 'xs')}>
              Detail: {provenance.detail}
            </span>
          )}
        </div>
      )}

      {insight.metadata?.chimeRuleName && (
        <div className="mb-4">
          <span className={getChipClass('warning', 'sm')}>
            ⚙️ Rule: {insight.metadata.chimeRuleName}
          </span>
        </div>
      )}

      {insight.type === 'action' && lineageMetadata?.sourceInsightId && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Promoted from Research</div>
          {lineageMetadata?.sourceExcerpt && (
            <p className="mt-1 text-xs text-emerald-800 line-clamp-2">{lineageMetadata.sourceExcerpt}</p>
          )}
          {onJumpToSource && (
            <button
              onClick={() => onJumpToSource(lineageMetadata.sourceInsightId!)}
              className="mt-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
            >
              View source research →
            </button>
          )}
        </div>
      )}

      {content}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleReplyFromInsight}
          className="inline-flex items-center rounded-md border border-indigo-600 bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
        >
          Reply
        </button>
        {onJumpToChatMarker && (
          <button
            type="button"
            onClick={() => onJumpToChatMarker(insight.id)}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            View marker in chat →
          </button>
        )}
      </div>
    </div>
  )
}
