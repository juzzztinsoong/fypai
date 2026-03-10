import type { AIInsightDTO } from '../../types';
import { InsightTypeIcon } from './InsightTypeIcon';
import { InsightStatusBadge } from './InsightStatusBadge';
import { InsightActions } from './InsightActions';
import { getInsightTypeTheme } from './insightUtils';
import ReactMarkdown from 'react-markdown';
import { getChipClass } from '@/styles/uiTokens';
import { sanitizeInsightContent } from '@/utils/insightContent';

interface InsightCardProps {
  insight: AIInsightDTO;
  onJumpToSource?: (messageId: string) => void;
  onJumpToChatMarker?: (insightId: string) => void;
}

export const InsightCard = ({ insight, onJumpToSource, onJumpToChatMarker }: InsightCardProps) => {
  const isDismissed = insight.status === 'dismissed' || insight.status === 'archived';
  const theme = getInsightTypeTheme(insight.type);
  const displayContent = sanitizeInsightContent(insight.content);
  const lineageMetadata = insight.metadata as
    | (typeof insight.metadata & {
        sourceInsightId?: string;
        sourceExcerpt?: string;
      })
    | undefined;

  return (
    <div
      id={`insight-${insight.id}`}
      data-insight-id={insight.id}
      data-insight-type={insight.type}
      onMouseEnter={() => window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: insight.id, active: true } }))}
      onMouseLeave={() => window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: insight.id, active: false } }))}
      className={`border rounded-lg p-5 shadow-sm ${theme.card} ${
        isDismissed ? 'opacity-60' : ''
      }`}
    >
      {/* Insight Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded ${theme.iconShell}`}>
            <div className={theme.icon}>
              <InsightTypeIcon type={insight.type} />
            </div>
          </div>
          <div>
            <h3 className={`font-semibold ${theme.title}`}>{insight.title}</h3>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <InsightStatusBadge status={insight.status} />
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
          {lineageMetadata.sourceExcerpt && (
            <p className="mt-1 text-xs text-emerald-800 line-clamp-2">{lineageMetadata.sourceExcerpt}</p>
          )}
          {onJumpToSource && (
            <button
              type="button"
              onClick={() => onJumpToSource(lineageMetadata.sourceInsightId!)}
              className="mt-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
            >
              View source research →
            </button>
          )}
        </div>
      )}

      {/* Insight Content */}
      <div className="text-sm text-slate-700">
        {insight.type === 'code' ? (
          <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
            <code>{displayContent}</code>
          </pre>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // Style headers
                h1: ({ children }) => <h1 className={`text-lg font-bold mt-3 mb-2 ${theme.title}`}>{children}</h1>,
                h2: ({ children }) => <h2 className={`text-base font-bold mt-2 mb-1 ${theme.title}`}>{children}</h2>,
                h3: ({ children }) => <h3 className={`text-sm font-semibold mt-2 mb-1 ${theme.icon}`}>{children}</h3>,
                // Style lists
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                li: ({ children }) => <li className="ml-4">{children}</li>,
                // Style paragraphs
                p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                // Style bold and italic
                strong: ({ children }) => <strong className={`font-semibold ${theme.title}`}>{children}</strong>,
                em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
                // Style code
                code: ({ children }) => <code className="bg-white/80 border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                // Style blockquotes
                blockquote: ({ children }) => <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-2">{children}</blockquote>,
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        {onJumpToChatMarker ? (
          <button
            type="button"
            onClick={() => onJumpToChatMarker(insight.id)}
            className={`text-xs font-medium ${theme.link}`}
          >
            View marker in chat →
          </button>
        ) : <span />}
        <InsightActions insight={insight} />
      </div>
    </div>
  );
};
