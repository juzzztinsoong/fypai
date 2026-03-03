import type { AIInsightDTO } from '../../types';
import { InsightTypeIcon } from './InsightTypeIcon';
import { PriorityBadge } from './PriorityBadge';
import { InsightStatusBadge } from './InsightStatusBadge';
import { InsightActions } from './InsightActions';
import { ActionItemControls } from './ActionItemControls';
import { getInsightTypeColor } from './insightUtils';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import { createInsight } from '@/services/insightService';

interface InsightCardProps {
  insight: AIInsightDTO;
  onJumpToSource?: (messageId: string) => void;
  onJumpToChatMarker?: (insightId: string) => void;
}

export const InsightCard = ({ insight, onJumpToSource, onJumpToChatMarker }: InsightCardProps) => {
  const isDismissed = insight.status === 'dismissed' || insight.status === 'archived';
  const [isPromoting, setIsPromoting] = useState(false);
  const lineageMetadata = insight.metadata as
    | (typeof insight.metadata & {
        sourceInsightId?: string;
        sourceExcerpt?: string;
      })
    | undefined;

  const canPromote = insight.type !== 'action' && insight.type !== 'code';

  const handlePromoteToAction = async () => {
    if (!canPromote || isPromoting) return;

    const excerpt = insight.content.replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!excerpt) return;

    setIsPromoting(true);
    try {
      const actionTitle = excerpt.length > 80 ? `${excerpt.slice(0, 80)}...` : excerpt;
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
      });
    } catch (error) {
      console.error('[InsightCard] Failed to promote insight:', error);
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <div
      id={`insight-${insight.id}`}
      className={`border rounded-lg p-4 bg-white shadow-sm ${getInsightTypeColor(insight.type)} ${
        isDismissed ? 'opacity-60' : ''
      }`}
    >
      {/* Insight Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded ${getInsightTypeColor(insight.type)}`}>
            <InsightTypeIcon type={insight.type} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{insight.title}</h3>
            <p className="text-xs text-gray-500">
              {new Date(insight.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <InsightStatusBadge status={insight.status} />
          <PriorityBadge priority={insight.priority} />
        </div>
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
          {lineageMetadata.sourceExcerpt && (
            <p className="mt-1 text-xs text-purple-800 line-clamp-2">{lineageMetadata.sourceExcerpt}</p>
          )}
          {onJumpToSource && (
            <button
              type="button"
              onClick={() => onJumpToSource(lineageMetadata.sourceInsightId!)}
              className="mt-1 text-xs font-medium text-purple-700 hover:text-purple-900"
            >
              View source research →
            </button>
          )}
        </div>
      )}

      {/* Insight Content */}
      <div className="text-sm text-gray-700">
        {insight.type === 'code' ? (
          <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
            <code>{insight.content}</code>
          </pre>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // Style headers
                h1: ({ children }) => <h1 className="text-lg font-bold text-gray-900 mt-3 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold text-gray-800 mt-2 mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-700 mt-2 mb-1">{children}</h3>,
                // Style lists
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                li: ({ children }) => <li className="ml-4">{children}</li>,
                // Style paragraphs
                p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                // Style bold and italic
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
                // Style code
                code: ({ children }) => <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                // Style blockquotes
                blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2">{children}</blockquote>,
              }}
            >
              {insight.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Tags */}
      {insight.tags && insight.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {insight.tags.map((tag: string) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {(insight.metadata?.model || insight.metadata?.prompt) && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
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

      {/* Action Item Controls (Sprint D - Part 3) */}
      {insight.type === 'action' && (
        <ActionItemControls insight={insight} />
      )}

      {canPromote && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handlePromoteToAction}
            disabled={isPromoting}
            className="rounded border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
          >
            {isPromoting ? 'Promoting...' : 'Promote to Action'}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        {onJumpToChatMarker ? (
          <button
            type="button"
            onClick={() => onJumpToChatMarker(insight.id)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            View marker in chat →
          </button>
        ) : <span />}
        <InsightActions insightId={insight.id} status={insight.status} />
      </div>
    </div>
  );
};
