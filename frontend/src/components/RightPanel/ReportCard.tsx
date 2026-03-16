/**
 * ReportCard Component
 * 
 * Displays AI-generated research with an emerald theme and rich markdown formatting.
 */

import type { AIInsightDTO } from '../../types';
import ReactMarkdown from 'react-markdown';
import { InsightFrame } from './InsightFrame';
import { getElevationClass } from '@/styles/uiTokens';
import { sanitizeInsightContent } from '@/utils/insightContent';

interface ReportCardProps {
  insight: AIInsightDTO;
  onJumpToSource?: (messageId: string) => void;
  onJumpToChatMarker?: (insightId: string) => void;
}

export const ReportCard = ({ insight, onJumpToSource, onJumpToChatMarker }: ReportCardProps) => {
  const displayContent = sanitizeInsightContent(insight.content);

  const content = (
    <div className="prose prose-sm max-w-none text-emerald-950/90">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold text-emerald-950 mt-4 mb-2 border-b border-emerald-300 pb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-emerald-900 mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-emerald-800 mt-3 mb-1">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc list-outside pl-5 marker:text-emerald-600 space-y-1.5 my-3">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside pl-5 marker:text-emerald-600 space-y-1.5 my-3">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          p: ({ children }) => <p className="my-2.5 leading-7">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-emerald-950">{children}</strong>,
          em: ({ children }) => <em className="italic text-emerald-900/80">{children}</em>,
          code: ({ children }) => <code className="bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
          hr: () => <hr className="my-4 border-emerald-200" />,
        }}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  );

  return (
    <InsightFrame
      insight={insight}
      title="🔎 Research"
      icon={<span className="text-2xl">🔎</span>}
      containerClassName={`bg-white rounded-lg border border-slate-200 p-5 transition-shadow duration-200 ${getElevationClass('raised')}`}
      titleClassName="font-semibold text-emerald-950"
      content={content}
      onJumpToSource={onJumpToSource}
      onJumpToChatMarker={onJumpToChatMarker}
    />
  );
};
