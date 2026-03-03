/**
 * ReportCard Component
 * 
 * Displays AI-generated reports with a green theme and markdown formatting
 */

import type { AIInsightDTO } from '../../types';
import ReactMarkdown from 'react-markdown';
import { InsightFrame } from './InsightFrame';

interface ReportCardProps {
  insight: AIInsightDTO;
  onJumpToSource?: (messageId: string) => void;
}

export const ReportCard = ({ insight, onJumpToSource }: ReportCardProps) => {
  const content = (
    <div className="prose prose-sm prose-green max-w-none text-gray-800">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold text-green-900 mt-4 mb-2 border-b-2 border-green-200 pb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-green-800 mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-green-700 mt-2 mb-1">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 ml-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 ml-2">{children}</ol>,
          p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-green-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
          code: ({ children }) => <code className="bg-green-100 text-green-800 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
        }}
      >
        {insight.content}
      </ReactMarkdown>
    </div>
  );

  return (
    <InsightFrame
      insight={insight}
      title="📊 Team Report"
      icon={<span className="text-2xl">📊</span>}
      containerClassName="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-sm border border-green-200 p-4"
      titleClassName="font-semibold text-green-900"
      timeClassName="text-xs text-green-600"
      content={content}
      onJumpToSource={onJumpToSource}
      jumpButtonClassName="mt-3 px-3 py-1.5 text-sm text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors flex items-center space-x-1"
      metadataClassName="mt-3 pt-3 border-t border-green-100 text-xs text-green-700"
    />
  );
};
