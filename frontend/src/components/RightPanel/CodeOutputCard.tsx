/**
 * CodeOutputCard Component
 * 
 * Displays AI-generated code with syntax highlighting and copy functionality
 */

import { useState } from 'react';
import type { AIInsightDTO } from '../../types';

interface CodeOutputCardProps {
  insight: AIInsightDTO;
  onJumpToChatMarker?: (insightId: string) => void;
}

export const CodeOutputCard = ({ insight, onJumpToChatMarker }: CodeOutputCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(insight.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract language from code block if present (```language\n...)
  const extractLanguage = (content: string): string | null => {
    const match = content.match(/^```(\w+)/);
    return match ? match[1] : null;
  };

  // Remove code fence markers if present
  const cleanCode = (content: string): string => {
    return content.replace(/^```\w*\n/, '').replace(/\n```$/, '');
  };

  const language = extractLanguage(insight.content);
  const cleanedCode = cleanCode(insight.content);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <svg
            className="w-5 h-5 text-emerald-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          <span className="text-sm font-semibold text-slate-900 leading-5">💻 Generated Code</span>
          {language && (
            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono rounded">
              {language}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 hover:text-slate-800 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="bg-gray-950 rounded-md p-5 overflow-x-auto">
        <pre className="text-sm leading-6 text-gray-200 font-mono whitespace-pre-wrap">
          <code>{cleanedCode}</code>
        </pre>
      </div>

      {onJumpToChatMarker && (
        <button
          type="button"
          onClick={() => onJumpToChatMarker(insight.id)}
          className="mt-3 text-sm text-indigo-700 hover:text-indigo-900 font-medium"
        >
          View marker in chat →
        </button>
      )}

    </div>
  );
};
