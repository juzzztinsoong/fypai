/**
 * LongFormContentViewer Component
 * 
 * Displays AI-generated long-form content (summaries, code, documents)
 * with metadata, markdown rendering, and link back to source message
 */

import type { AIInsightDTO } from '../../types';
import { SummaryCard } from './SummaryCard';
import { CodeOutputCard } from './CodeOutputCard';
import { ReportCard } from './ReportCard';
import { InsightFrame } from './InsightFrame';
import ReactMarkdown from 'react-markdown';
import { sanitizeInsightContent } from '@/utils/insightContent';
import { getInsightTypeTheme } from './insightUtils';

interface LongFormContentViewerProps {
  insights: AIInsightDTO[];
  onJumpToSource?: (messageId: string) => void;
  onJumpToChatMarker?: (insightId: string) => void;
}

export const LongFormContentViewer = ({ insights, onJumpToSource, onJumpToChatMarker }: LongFormContentViewerProps) => {
  if (insights.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <svg
          className="mx-auto h-10 w-10 text-gray-400"
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
        <p className="mt-2 text-sm font-medium">No AI-generated content yet</p>
        <p className="text-xs text-gray-400 mt-1">Insights will appear as the conversation progresses</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {insights.map((insight) => {
        const longFormType = insight.type;

        if (longFormType === 'summary') {
          return (
            <SummaryCard
              key={insight.id}
              insight={insight}
              onJumpToSource={onJumpToSource}
              onJumpToChatMarker={onJumpToChatMarker}
            />
          );
        }

        if (longFormType === 'code') {
          return (
            <CodeOutputCard
              key={insight.id}
              insight={insight}
              onJumpToChatMarker={onJumpToChatMarker}
            />
          );
        }

        if (longFormType === 'document') {
          return (
            <ReportCard
              key={insight.id}
              insight={insight}
              onJumpToSource={onJumpToSource}
              onJumpToChatMarker={onJumpToChatMarker}
            />
          );
        }

        // Default: generic long-form content
        const displayContent = sanitizeInsightContent(insight.content);
        const theme = getInsightTypeTheme(insight.type);

        const content = (
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className={`text-xl font-bold mt-4 mb-2 ${theme.title}`}>{children}</h1>,
                h2: ({ children }) => <h2 className={`text-lg font-bold mt-3 mb-2 ${theme.title}`}>{children}</h2>,
                h3: ({ children }) => <h3 className={`text-base font-semibold mt-2 mb-1 ${theme.icon}`}>{children}</h3>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className={`font-semibold ${theme.title}`}>{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
                code: ({ children }) => <code className="bg-white/80 border border-slate-200 text-slate-800 px-1 py-0.5 rounded text-sm">{children}</code>,
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        );

        return (
          <InsightFrame
            key={insight.id}
            insight={insight}
            title={insight.type === 'document' ? 'Research Brief' : 'Document'}
            icon={
              <svg
                className={`w-5 h-5 ${theme.icon}`}
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
            containerClassName={`rounded-lg shadow-sm border p-5 ${theme.card}`}
            titleClassName={`font-semibold ${theme.title}`}
            content={content}
            onJumpToSource={onJumpToSource}
            onJumpToChatMarker={onJumpToChatMarker}
          />
        );
      })}
    </div>
  );
};
