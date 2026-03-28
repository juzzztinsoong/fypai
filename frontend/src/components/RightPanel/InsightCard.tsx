import { useEffect, useRef, useState } from 'react';
import type { AIInsightDTO } from '../../types';
import { InsightTypeIcon } from './InsightTypeIcon';
import { InsightStatusBadge } from './InsightStatusBadge';
import { InsightActions } from './InsightActions';
import { getInsightTypeTheme } from './insightUtils';
import ReactMarkdown from 'react-markdown';
import { getElevationClass } from '@/styles/uiTokens';
import { sanitizeInsightContent } from '@/utils/insightContent';
import { emitDraftPromotion, extractDraftExcerpt } from '@/utils/draftComposer';
import remarkGfm from 'remark-gfm';

interface InsightCardProps {
  insight: AIInsightDTO;
  onJumpToSource?: (messageId: string) => void;
  onJumpToChatMarker?: (insightId: string) => void;
}

export const InsightCard = ({ insight, onJumpToSource, onJumpToChatMarker }: InsightCardProps) => {
  const isDismissed = insight.status === 'dismissed' || insight.status === 'archived';
  const theme = getInsightTypeTheme(insight.type);
  const displayContent = sanitizeInsightContent(insight.content);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExpandable, setIsExpandable] = useState(false);
  const [collapsedMaxHeight, setCollapsedMaxHeight] = useState(360);
  const lineageMetadata = insight.metadata as
    | (typeof insight.metadata & {
        sourceInsightId?: string;
        sourceExcerpt?: string;
      })
    | undefined;

  const handleReplyFromInsight = () => {
    const excerpt = extractDraftExcerpt(displayContent || insight.title)
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

  useEffect(() => {
    const updateMaxHeight = () => {
      const viewportTarget = Math.floor(window.innerHeight * 0.4);
      // Keep a sensible floor so short viewports still show useful content.
      setCollapsedMaxHeight(Math.max(260, viewportTarget));
    };

    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    return () => window.removeEventListener('resize', updateMaxHeight);
  }, []);

  useEffect(() => {
    const measure = () => {
      const contentElement = contentRef.current;
      if (!contentElement) return;

      const shouldCollapse = contentElement.scrollHeight > collapsedMaxHeight + 8;
      setIsExpandable(shouldCollapse);
      if (!shouldCollapse) {
        setIsExpanded(false);
      }
    };

    measure();

    const contentElement = contentRef.current;
    if (!contentElement || typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });
    resizeObserver.observe(contentElement);

    return () => resizeObserver.disconnect();
  }, [displayContent, collapsedMaxHeight, insight.type]);

  return (
    <div
      id={`insight-${insight.id}`}
      data-insight-id={insight.id}
      data-insight-type={insight.type}
      onMouseEnter={() => window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: insight.id, active: true } }))}
      onMouseLeave={() => window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: insight.id, active: false } }))}
      className={`border rounded-lg p-5 transition-shadow duration-200 ${getElevationClass('raised')} ${theme.card} ${
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
          <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
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
        <div
          ref={contentRef}
          className={`relative ${isExpandable && !isExpanded ? 'overflow-hidden' : ''}`}
          style={isExpandable && !isExpanded ? { maxHeight: `${collapsedMaxHeight}px` } : undefined}
        >
          {insight.type === 'code' ? (
            <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
              <code>{displayContent}</code>
            </pre>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
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
                  table: ({ children }) => (
                    <div className="my-3 overflow-x-auto rounded-md border border-slate-200">
                      <table className="min-w-full border-collapse text-xs">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
                  tbody: ({ children }) => <tbody className="divide-y divide-slate-200">{children}</tbody>,
                  tr: ({ children }) => <tr className="align-top">{children}</tr>,
                  th: ({ children }) => <th className="border-b border-slate-200 px-2.5 py-1.5 text-left font-semibold text-slate-700">{children}</th>,
                  td: ({ children }) => <td className="px-2.5 py-1.5 text-slate-700">{children}</td>,
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-3 justify-self-start">
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

        <div className="justify-self-center">
          {isExpandable && (
            <button
              type="button"
              onClick={() => setIsExpanded((previous) => !previous)}
              className="inline-flex items-center justify-center p-1 text-slate-500 transition hover:text-slate-700"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Minimize insight content' : 'Expand insight content'}
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              <svg
                className={`h-7 w-7 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.124l3.71-3.893a.75.75 0 111.08 1.04l-4.25 4.46a.75.75 0 01-1.08 0l-4.25-4.46a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="justify-self-end">
          <InsightActions insight={insight} />
        </div>
      </div>
    </div>
  );
};
