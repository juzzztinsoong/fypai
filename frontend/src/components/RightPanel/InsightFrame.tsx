import type { ReactNode } from 'react'
import type { AIInsightDTO } from '../../types'
import { getChipClass } from '@/styles/uiTokens'
import { getInsightTypeTheme } from './insightUtils'

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
  const theme = getInsightTypeTheme(insight.type)
  const lineageMetadata = insight.metadata as
    | (typeof insight.metadata & {
        sourceInsightId?: string
        sourceExcerpt?: string
      })
    | undefined

  return (
    <div
      id={`insight-${insight.id}`}
      data-insight-id={insight.id}
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

      {onJumpToChatMarker && (
        <button
          type="button"
          onClick={() => onJumpToChatMarker(insight.id)}
          className={`mt-3 text-xs font-medium ${theme.link}`}
        >
          View marker in chat →
        </button>
      )}
    </div>
  )
}
