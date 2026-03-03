/**
 * LongFormContentViewer Component
 * 
 * Displays AI-generated long-form content (summaries, code, documents)
 * with metadata, markdown rendering, and link back to source message
 */

import type { AIInsightDTO } from '../../types';
import { SummaryCard } from './SummaryCard';
import { CodeOutputCard } from './CodeOutputCard';
import { InsightFrame } from './InsightFrame';
import ReactMarkdown from 'react-markdown';
import { useEffect, useState } from 'react';
import { createInsight } from '@/services/insightService';

interface LongFormContentViewerProps {
  insights: AIInsightDTO[];
  onJumpToSource?: (messageId: string) => void;
  onJumpToChatMarker?: (insightId: string) => void;
}

export const LongFormContentViewer = ({ insights, onJumpToSource, onJumpToChatMarker }: LongFormContentViewerProps) => {
  const [selectedPromotionByInsight, setSelectedPromotionByInsight] = useState<Record<string, string>>({});
  const [promotedExcerptsByInsight, setPromotedExcerptsByInsight] = useState<Record<string, string[]>>({});
  const [promotingInsightId, setPromotingInsightId] = useState<string | null>(null);
  const [promotionToast, setPromotionToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!promotionToast) return;
    const timeoutId = setTimeout(() => setPromotionToast(null), 2600);
    return () => clearTimeout(timeoutId);
  }, [promotionToast]);

  const flattenText = (children: React.ReactNode): string => {
    if (typeof children === 'string') return children;
    if (typeof children === 'number') return String(children);
    if (Array.isArray(children)) return children.map(flattenText).join(' ');
    if (children && typeof children === 'object' && 'props' in children) {
      return flattenText((children as any).props?.children);
    }
    return '';
  };

  const handlePromoteToAction = async (insight: AIInsightDTO, excerpt: string) => {
    if (!excerpt.trim() || promotingInsightId) return;

    const normalizedExcerpt = excerpt.trim().toLowerCase();
    const alreadyPromoted = (promotedExcerptsByInsight[insight.id] || []).some(
      (item) => item.toLowerCase() === normalizedExcerpt
    );

    if (alreadyPromoted) {
      setPromotionToast({
        type: 'error',
        message: 'This bullet was already promoted in this session.',
      });
      return;
    }

    setPromotingInsightId(insight.id);
    try {
      const trimmedExcerpt = excerpt.trim();
      const maxTitleLength = 80;
      const actionTitle = trimmedExcerpt.length > maxTitleLength
        ? `${trimmedExcerpt.slice(0, maxTitleLength)}...`
        : trimmedExcerpt;

      await createInsight({
        teamId: insight.teamId,
        type: 'action',
        title: `Action: ${actionTitle}`,
        content: `- ${trimmedExcerpt}`,
        priority: 'medium',
        tags: ['promoted-from-research', 'user-requested'],
        relatedMessageIds: insight.relatedMessageIds,
        metadata: {
          ...(insight.metadata || {}),
          sourceInsightId: insight.id,
          sourceExcerpt: trimmedExcerpt,
        } as any,
      });

      setSelectedPromotionByInsight((current) => {
        const next = { ...current };
        delete next[insight.id];
        return next;
      });

      setPromotedExcerptsByInsight((current) => ({
        ...current,
        [insight.id]: [...(current[insight.id] || []), trimmedExcerpt],
      }));

      setPromotionToast({
        type: 'success',
        message: 'Action created from selected research item.',
      });
    } catch (error) {
      console.error('[LongFormContentViewer] Failed to promote bullet to action:', error);
      const status = (error as any)?.response?.status;
      setPromotionToast({
        type: 'error',
        message: status === 409
          ? 'This research item was already promoted.'
          : 'Failed to promote item. Please try again.',
      });
    } finally {
      setPromotingInsightId(null);
    }
  };

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
        <p className="text-xs text-gray-400 mt-1">Use Summary or Research below to generate content</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {promotionToast && (
        <div
          className={`sticky top-2 z-10 rounded-md border px-3 py-2 text-xs font-medium shadow-sm ${
            promotionToast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {promotionToast.message}
        </div>
      )}
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
              onJumpToSource={onJumpToSource}
              onJumpToChatMarker={onJumpToChatMarker}
            />
          );
        }

        // Default: generic long-form content
        const selectedPromotion = selectedPromotionByInsight[insight.id] || '';
        const isAlreadyPromoted = (promotedExcerptsByInsight[insight.id] || []).some(
          (item) => item.toLowerCase() === selectedPromotion.trim().toLowerCase()
        );
        const isPromotingThisInsight = promotingInsightId === insight.id;
        const content = (
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold text-gray-800 mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold text-gray-700 mt-2 mb-1">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                li: ({ children }) => {
                  const itemText = flattenText(children).replace(/\s+/g, ' ').trim();
                  const isResearchItem = insight.type === 'document' && itemText.length > 0;
                  const isSelected = selectedPromotion === itemText;

                  if (!isResearchItem) {
                    return <li>{children}</li>;
                  }

                  return (
                    <li className="my-1 list-none">
                      <div className="flex items-start justify-between gap-2 rounded-md border border-transparent px-2 py-1 hover:border-purple-200 hover:bg-purple-50/40">
                        <div className="min-w-0 flex-1">
                          <div className="text-gray-700">• {children}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPromotionByInsight((current) => ({
                            ...current,
                            [insight.id]: isSelected ? '' : itemText,
                          }))}
                          className={`shrink-0 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                            isSelected
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Promote'}
                        </button>
                      </div>
                    </li>
                  );
                },
                p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
                code: ({ children }) => <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm">{children}</code>,
              }}
            >
              {insight.content}
            </ReactMarkdown>

            {insight.type === 'document' && selectedPromotion && (
              <div className="mt-3 rounded-md border border-purple-200 bg-purple-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-purple-700 truncate">Ready to promote selected item to Actions</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPromotionByInsight((current) => ({ ...current, [insight.id]: '' }))}
                      disabled={isPromotingThisInsight}
                      className="rounded border border-purple-200 px-2 py-1 text-[11px] text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePromoteToAction(insight, selectedPromotion)}
                      disabled={isPromotingThisInsight || isAlreadyPromoted}
                      className="rounded bg-purple-600 px-2 py-1 text-[11px] text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isPromotingThisInsight
                        ? 'Promoting...'
                        : isAlreadyPromoted
                          ? 'Already Promoted'
                          : 'Promote to Action'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

        return (
          <InsightFrame
            key={insight.id}
            insight={insight}
            title={insight.type === 'document' ? 'Research Brief' : 'Document'}
            icon={
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
            }
            containerClassName="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            titleClassName="font-semibold text-gray-900"
            timeClassName="text-xs text-gray-500"
            content={content}
            onJumpToSource={onJumpToSource}
            onJumpToChatMarker={onJumpToChatMarker}
            jumpButtonClassName="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
            metadataClassName="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500"
          />
        );
      })}
    </div>
  );
};
