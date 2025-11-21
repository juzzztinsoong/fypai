/**
 * ReportCard Component
 * 
 * Displays AI-generated reports with a green theme and markdown formatting
 */

import type { AIInsightDTO } from '../../types';
import ReactMarkdown from 'react-markdown';

interface ReportCardProps {
  insight: AIInsightDTO;
  onJumpToSource?: (messageId: string) => void;
}

export const ReportCard = ({ insight, onJumpToSource }: ReportCardProps) => {
  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-sm border border-green-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">📊</span>
          <span className="font-semibold text-green-900">Team Report</span>
        </div>
        <span className="text-xs text-green-600">
          {new Date(insight.createdAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="prose prose-sm prose-green max-w-none text-gray-800">
        <ReactMarkdown
          components={{
            // Style headers
            h1: ({ children }) => <h1 className="text-xl font-bold text-green-900 mt-4 mb-2 border-b-2 border-green-200 pb-1">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-bold text-green-800 mt-3 mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-semibold text-green-700 mt-2 mb-1">{children}</h3>,
            // Style lists
            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 ml-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 ml-2">{children}</ol>,
            // Style paragraphs
            p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
            // Style bold and italic
            strong: ({ children }) => <strong className="font-semibold text-green-900">{children}</strong>,
            em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
            // Style code
            code: ({ children }) => <code className="bg-green-100 text-green-800 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
          }}
        >
          {insight.content}
        </ReactMarkdown>
      </div>

      {insight.relatedMessageIds?.[0] && onJumpToSource && (
        <button
          onClick={() => onJumpToSource(insight.relatedMessageIds![0])}
          className="mt-4 px-3 py-1.5 text-sm text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors flex items-center space-x-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Jump to source message</span>
        </button>
      )}

      {(insight.metadata?.model || insight.metadata?.prompt) && (
        <div className="mt-4 pt-3 border-t border-green-100 space-y-1">
          {insight.metadata.model && (
            <div className="text-xs text-green-700">
              <span className="font-medium">Model:</span> {insight.metadata.model}
              {insight.metadata.tokensUsed && ` • ${insight.metadata.tokensUsed} tokens`}
            </div>
          )}
          {insight.metadata.prompt && (
            <div className="text-xs text-green-600">
              <span className="font-medium">Prompt:</span> {insight.metadata.prompt}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
