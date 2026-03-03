import type { ReactNode } from 'react'
import type { AIInsightDTO } from '../../types'
import { useState } from 'react'
import { createInsight } from '@/services/insightService'

interface InsightFrameProps {
  insight: AIInsightDTO
  title: string
  icon: ReactNode
  containerClassName: string
  titleClassName: string
  timeClassName: string
  content: ReactNode
  onJumpToSource?: (messageId: string) => void
  onJumpToChatMarker?: (insightId: string) => void
  jumpButtonClassName?: string
  metadataClassName?: string
}

export const InsightFrame = ({
  insight,
  title,
  icon,
  containerClassName,
  titleClassName,
  timeClassName,
  content,
  onJumpToSource,
  onJumpToChatMarker,
  jumpButtonClassName = 'mt-3 text-sm text-blue-700 hover:text-blue-900 font-medium flex items-center space-x-1',
  metadataClassName = 'mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600',
}: InsightFrameProps) => {
  const [isPromoting, setIsPromoting] = useState(false)
  const lineageMetadata = insight.metadata as
    | (typeof insight.metadata & {
        sourceInsightId?: string
        sourceExcerpt?: string
      })
    | undefined

  const canPromote = insight.type !== 'action' && insight.type !== 'code'

  const handlePromoteInsight = async () => {
    if (!canPromote || isPromoting) return

    const excerpt = insight.content.replace(/\s+/g, ' ').trim().slice(0, 500)
    if (!excerpt) return

    setIsPromoting(true)
    try {
      const actionTitle = excerpt.length > 80 ? `${excerpt.slice(0, 80)}...` : excerpt
      await createInsight({
        teamId: insight.teamId,
        type: 'action',
        title: `Action: ${actionTitle}`,
        content: `- ${excerpt}`,
        priority: 'medium',
        tags: ['promoted-from-insight', 'user-requested'],
        relatedMessageIds: insight.relatedMessageIds,
        metadata: {
          ...(insight.metadata || {}),
          sourceInsightId: insight.id,
          sourceExcerpt: excerpt,
        } as any,
      })
    } catch (error) {
      console.error('[InsightFrame] Failed to promote insight to action:', error)
    } finally {
      setIsPromoting(false)
    }
  }

  return (
    <div id={`insight-${insight.id}`} className={containerClassName}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center space-x-2">
          {icon}
          <span className={`${titleClassName} leading-5`}>{title}</span>
        </div>
        <span className={`${timeClassName} whitespace-nowrap`}>{new Date(insight.createdAt).toLocaleTimeString()}</span>
      </div>

      {insight.metadata?.chimeRuleName && (
        <div className="mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
            ⚙️ Rule: {insight.metadata.chimeRuleName}
          </span>
        </div>
      )}

      {insight.type === 'action' && lineageMetadata?.sourceInsightId && (
        <div className="mb-3 rounded-md border border-purple-200 bg-purple-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">Promoted from Research</div>
          {lineageMetadata?.sourceExcerpt && (
            <p className="mt-1 text-xs text-purple-800 line-clamp-2">{lineageMetadata.sourceExcerpt}</p>
          )}
          {onJumpToSource && (
            <button
              onClick={() => onJumpToSource(lineageMetadata.sourceInsightId!)}
              className="mt-1 text-xs font-medium text-purple-700 hover:text-purple-900"
            >
              View source research →
            </button>
          )}
        </div>
      )}

      {content}

      {canPromote && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handlePromoteInsight}
            disabled={isPromoting}
            className="rounded border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
          >
            {isPromoting ? 'Promoting...' : 'Promote to Action'}
          </button>
        </div>
      )}

      {onJumpToChatMarker && (
        <button
          type="button"
          onClick={() => onJumpToChatMarker(insight.id)}
          className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          View marker in chat →
        </button>
      )}

      {insight.relatedMessageIds?.[0] && onJumpToSource && (
        <button
          onClick={() => onJumpToSource(insight.relatedMessageIds![0])}
          className={jumpButtonClassName}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Jump to source message</span>
        </button>
      )}

      {(insight.metadata?.model || insight.metadata?.prompt) && (
        <div className={metadataClassName}>
          {insight.metadata?.model && (
            <div>
              Generated by {insight.metadata.model}
              {insight.metadata.tokensUsed && ` • ${insight.metadata.tokensUsed} tokens`}
            </div>
          )}
          {insight.metadata?.prompt && (
            <div className="mt-1 italic">"{insight.metadata.prompt}"</div>
          )}
        </div>
      )}
    </div>
  )
}
