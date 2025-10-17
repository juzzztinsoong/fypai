/**
 * LongFormContentViewer Component
 * 
 * Displays AI-generated long-form content (summaries, code, documents)
 * with metadata, markdown rendering, and link back to source message
 */

import type { MessageDTO } from '../../types';
import { SummaryCard } from './SummaryCard';
import { CodeOutputCard } from './CodeOutputCard';
import { ReportCard } from './ReportCard';
import ReactMarkdown from 'react-markdown';

interface LongFormContentViewerProps {
  messages: MessageDTO[];
  onJumpToSource?: (messageId: string) => void;
}

export const LongFormContentViewer = ({ messages, onJumpToSource }: LongFormContentViewerProps) => {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
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
        <p className="mt-2">No AI-generated content yet</p>
        <p className="text-sm text-gray-400 mt-1">Click the buttons below to generate summaries or reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const longFormType = message.metadata?.longFormType;

        if (longFormType === 'summary') {
          return (
            <SummaryCard
              key={message.id}
              message={message}
              onJumpToSource={onJumpToSource}
            />
          );
        }

        if (longFormType === 'code') {
          return (
            <CodeOutputCard
              key={message.id}
              message={message}
              onJumpToSource={onJumpToSource}
            />
          );
        }

        if (longFormType === 'document') {
          return (
            <ReportCard
              key={message.id}
              message={message}
              onJumpToSource={onJumpToSource}
            />
          );
        }

        // Default: generic long-form content
        return (
          <div key={message.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <svg
                  className="w-5 h-5 text-gray-600"
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
                <span className="font-semibold text-gray-900">Document</span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(message.createdAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold text-gray-800 mt-3 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-semibold text-gray-700 mt-2 mb-1">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                  em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
                  code: ({ children }) => <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm">{children}</code>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>

            {message.metadata?.parentMessageId && onJumpToSource && (
              <button
                onClick={() => onJumpToSource(message.metadata!.parentMessageId!)}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Jump to source message</span>
              </button>
            )}

            {message.metadata?.model && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                Generated by {message.metadata.model}
                {message.metadata.tokensUsed && ` • ${message.metadata.tokensUsed} tokens`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
