/**
 * SummaryCard Component
 * 
 * Displays AI-generated conversation summaries with structured formatting
 * Shows key points, decisions, and action items with markdown rendering
 */

import type { AIInsightDTO } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { InsightFrame } from './InsightFrame';
import { getElevationClass } from '@/styles/uiTokens';
import { sanitizeInsightContent } from '@/utils/insightContent';

interface SummaryCardProps {
  insight: AIInsightDTO;
  onJumpToSource?: (messageId: string) => void;
  onJumpToChatMarker?: (insightId: string) => void;
}

export const SummaryCard = ({ insight, onJumpToSource, onJumpToChatMarker }: SummaryCardProps) => {
  const displayContent = sanitizeInsightContent(insight.content);

  const content = (
    <div className="prose prose-sm max-w-none text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold text-sky-950 mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-sky-900 mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-sky-800 mt-2 mb-1">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
          p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-sky-950">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
          code: ({ children }) => <code className="bg-sky-100 text-sky-800 px-1 py-0.5 rounded text-sm">{children}</code>,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-md border border-sky-200">
              <table className="min-w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-sky-50">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-sky-100">{children}</tbody>,
          tr: ({ children }) => <tr className="align-top">{children}</tr>,
          th: ({ children }) => <th className="border-b border-sky-200 px-2.5 py-1.5 text-left font-semibold text-sky-900">{children}</th>,
          td: ({ children }) => <td className="px-2.5 py-1.5 text-slate-800">{children}</td>,
        }}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  );

  return (
    <InsightFrame
      insight={insight}
      title="📊 Conversation Summary"
      icon={
        <svg
          className="w-5 h-5 text-sky-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      }
      containerClassName={`bg-white rounded-lg border border-slate-200 p-5 transition-shadow duration-200 ${getElevationClass('raised')}`}
      titleClassName="font-semibold text-sky-950"
      content={content}
      onJumpToSource={onJumpToSource}
      onJumpToChatMarker={onJumpToChatMarker}
    />
  );
};
