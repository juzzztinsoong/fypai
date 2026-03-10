/**
 * RightPanel Component
 *
 * Tabbed section layout:
 *   1. Fixed header (team name, insight count)
 *   2. Scrollable content area for selected section
 *   3. Bottom tabs (All | Summaries | Research | Actions | Suggestions)
 *   4. Collapsible AI Controls footer (toggle + settings drawer)
 */
import { useEntityStore } from '@/stores/entityStore';
import { useUIStore } from '@/stores/uiStore';
import { socketService } from '@/services';
import { useState, useEffect, useRef, useMemo } from 'react';
import { RightPanelHeader } from './RightPanelHeader';
import { InsightsList } from './InsightsList';
import { AIControlsDrawer } from './AIControlsDrawer';
import { TaskContextCard } from './TaskContextCard';
import { getInsights } from '@/services/insightService';
import { SegmentedControl, type SegmentedControlItem } from '@/components/common/SegmentedControl';
import { type SegmentedAccent, uiTokens } from '@/styles/uiTokens';

type ContentFilter = 'all' | 'summaries' | 'research' | 'actions' | 'suggestions';

const TABS: { key: ContentFilter; label: string; emoji?: string }[] = [
  { key: 'all', label: 'All', emoji: '🧭' },
  { key: 'summaries', label: 'Summaries', emoji: '📝' },
  { key: 'research', label: 'Research', emoji: '🔎' },
  { key: 'actions', label: 'Actions', emoji: '✅' },
  { key: 'suggestions', label: 'Suggestions', emoji: '💡' },
];

const TAB_ACCENTS: Record<ContentFilter, SegmentedAccent> = {
  all: 'brand',
  summaries: 'brand',
  research: 'success',
  actions: 'success',
  suggestions: 'brand',
};

export const RightPanel = () => {
  
  // Get current team from UIStore
  const currentTeamId = useUIStore((state) => state.currentTeamId);
  const currentTeam = useEntityStore((state) => 
    currentTeamId ? state.getTeam(currentTeamId) : null
  );
  const enableTimelineSync = useUIStore((state) => state.preferences.enableTimelineSync);
  
  // Get insight IDs (stable array reference)
  const insightIds = useEntityStore((state) => state.getTeamInsights(currentTeamId || ''));
  const insightsById = useEntityStore((state) => state.entities.insights);
  
  // Map to data in useMemo to prevent re-renders
  const teamInsights = useMemo(() => {
    return (insightIds as string[])
      .map(id => insightsById[id])
      .filter(Boolean);
  }, [insightIds, insightsById]);
  
  // AI enabled state from team settings
  const isTeamAIEnabled = currentTeam?.isChimeEnabled ?? true;
  
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [showArchivedSummaries, setShowArchivedSummaries] = useState(false);
  const [showArchivedResearch, setShowArchivedResearch] = useState(false);
  const [showArchivedActions, setShowArchivedActions] = useState(false);
  const [showArchivedSuggestions, setShowArchivedSuggestions] = useState(false);
  const [showCompletedActions, setShowCompletedActions] = useState(false);
  const [showTaskContext, setShowTaskContext] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const applyingExternalSyncRef = useRef(false);
  const lastSyncEmitAtRef = useRef(0);
  const suppressAnchorEmitUntilRef = useRef(0);
  const lastAppliedInsightRef = useRef<{ id: string; at: number } | null>(null);

  // Fetch insights when team changes
  useEffect(() => {
    if (currentTeamId) {
      getInsights(currentTeamId);
    }
  }, [currentTeamId]);

  // Sort insights by date (oldest first, newest at bottom like chat)
  const insights = useMemo(() => {
    return [...teamInsights].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [teamInsights, currentTeamId]);

  const activeInsights = useMemo(
    () => insights.filter((insight) => {
      if (insight.status === 'archived') return false;

      // Keep dismissed action items visible until the user marks them complete.
      if (insight.status === 'dismissed' && insight.type !== 'action') return false;

      return true;
    }),
    [insights]
  );

  const archivedInsights = useMemo(
    () =>
      insights.filter((insight) => {
        if (insight.status === 'archived') return true;

        // Non-action dismissed insights remain archived/dismissed bucket.
        if (insight.status === 'dismissed' && insight.type !== 'action') return true;

        return false;
      }),
    [insights]
  );

  const archivedSummaryInsights = useMemo(
    () => archivedInsights.filter(i => i.type === 'summary'),
    [archivedInsights]
  );

  const archivedResearchInsights = useMemo(
    () => archivedInsights.filter(i => i.type === 'document'),
    [archivedInsights]
  );

  const archivedActionInsights = useMemo(
    () => archivedInsights.filter(i => i.type === 'action'),
    [archivedInsights]
  );

  const archivedSuggestionInsights = useMemo(
    () => archivedInsights.filter(i => i.type === 'suggestion'),
    [archivedInsights]
  );

  const summaryInsights = useMemo(
    () => activeInsights.filter(i => i.type === 'summary'),
    [activeInsights]
  );

  const researchInsights = useMemo(
    () => activeInsights.filter(i => i.type === 'document'),
    [activeInsights]
  );

  const actionInsights = useMemo(
    () => activeInsights.filter(i => i.type === 'action'),
    [activeInsights]
  );

  const openActions = useMemo(
    () => actionInsights.filter(i => !i.completedAt),
    [actionInsights]
  );

  const completedActions = useMemo(
    () => actionInsights.filter(i => !!i.completedAt),
    [actionInsights]
  );

  const suggestionInsights = useMemo(
    () => activeInsights.filter(i => i.type === 'suggestion'),
    [activeInsights]
  );

  // Bottom anchor on team switch
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentTeamId]);

  // Keep panel chronologically bottom-aligned (like chat)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [
    contentFilter,
    summaryInsights.length,
    researchInsights.length,
    actionInsights.length,
    suggestionInsights.length,
    archivedSummaryInsights.length,
    archivedResearchInsights.length,
    archivedActionInsights.length,
    archivedSuggestionInsights.length,
    showArchivedSummaries,
    showArchivedResearch,
    showArchivedActions,
    showArchivedSuggestions,
    showCompletedActions,
  ]);

  const allCount = activeInsights.length;
  const summaryCount = summaryInsights.length;
  const researchCount = researchInsights.length;
  const actionCount = actionInsights.length;
  const suggestionCount = suggestionInsights.length;
  const bottomTabItems = useMemo<SegmentedControlItem<ContentFilter>[]>(() => {
    return TABS.map((tab) => {
      const count =
        tab.key === 'all'
          ? allCount
          : tab.key === 'summaries'
          ? summaryCount
          : tab.key === 'research'
          ? researchCount
          : tab.key === 'actions'
          ? actionCount
          : suggestionCount;

      return {
        key: tab.key,
        label: tab.label,
        emoji: tab.emoji,
        count,
        accent: TAB_ACCENTS[tab.key],
      };
    });
  }, [allCount, summaryCount, researchCount, actionCount, suggestionCount]);

  const handleToggleAI = () => {
    if (!currentTeamId) return;
    const newState = !isTeamAIEnabled;
    useEntityStore.getState().updateTeam(currentTeamId, { isChimeEnabled: newState });
    socketService.toggleTeamAI(currentTeamId, newState);
  };

  const focusInsightById = (insightId: string) => {
    if (!insightId) return;

    const insight = insightsById[insightId];
    if (!insight) return;

    const nextTab: ContentFilter =
      insight.type === 'summary'
        ? 'summaries'
        : insight.type === 'document'
        ? 'research'
        : insight.type === 'action'
        ? 'actions'
        : 'suggestions';

    setContentFilter(nextTab);

    setTimeout(() => {
      const insightElement = document.getElementById(`insight-${insightId}`);
      if (!insightElement) return;

      insightElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      insightElement.classList.add('fypai-link-highlight');
      setTimeout(() => {
        insightElement.classList.remove('fypai-link-highlight');
      }, 1800);
    }, 120);
  };

  const focusRenderedInsightOnly = (insightId: string) => {
    if (!insightId) return;

    setTimeout(() => {
      const insightElement = document.getElementById(`insight-${insightId}`);
      if (!insightElement) return;

      const container = scrollRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const elementRect = insightElement.getBoundingClientRect();
      const distanceFromCenter = Math.abs((elementRect.top + elementRect.height / 2) - (containerRect.top + container.clientHeight / 2));

      if (distanceFromCenter > 24) {
        insightElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      insightElement.classList.add('fypai-link-highlight');
      setTimeout(() => {
        insightElement.classList.remove('fypai-link-highlight');
      }, 1800);
    }, 80);
  };

  const handleJumpToSource = (sourceId: string) => {
    focusInsightById(sourceId);
  };

  const handleJumpToChatMarker = (insightId: string) => {
    if (!insightId) return;
    window.dispatchEvent(
      new CustomEvent('fypai:focus-chat-marker', {
        detail: { insightId },
      })
    );
  };

  useEffect(() => {
    const handleFocusInsight = (event: Event) => {
      const customEvent = event as CustomEvent<{ insightId?: string }>;
      const insightId = customEvent.detail?.insightId;
      if (!insightId) return;
      focusInsightById(insightId);
    };

    window.addEventListener('fypai:focus-insight', handleFocusInsight as EventListener);
    return () => {
      window.removeEventListener('fypai:focus-insight', handleFocusInsight as EventListener);
    };
  }, [insightsById]);

  useEffect(() => {
    const handleLinkHover = (event: Event) => {
      const customEvent = event as CustomEvent<{ insightId?: string; active?: boolean }>;
      const insightId = customEvent.detail?.insightId;
      if (!insightId) return;

      const insightElement = document.getElementById(`insight-${insightId}`);
      if (!insightElement) return;

      if (customEvent.detail?.active) {
        insightElement.classList.add('fypai-link-highlight-soft');
      } else {
        insightElement.classList.remove('fypai-link-highlight-soft');
      }
    };

    window.addEventListener('fypai:link-hover', handleLinkHover as EventListener);
    return () => {
      window.removeEventListener('fypai:link-hover', handleLinkHover as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!enableTimelineSync) return;

    const container = scrollRef.current;
    if (!container) return;

    const onScroll = () => {
      if (applyingExternalSyncRef.current) return;
      if (Date.now() < suppressAnchorEmitUntilRef.current) return;

      const now = Date.now();
      if (now - lastSyncEmitAtRef.current < 80) return;
      lastSyncEmitAtRef.current = now;

      const cards = Array.from(container.querySelectorAll<HTMLElement>('[id^="insight-"]'));
      if (!cards.length) return;

      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + container.clientHeight / 2;

      let bestInsightId: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const card of cards) {
        const cardRect = card.getBoundingClientRect();
        const cardCenterY = cardRect.top + cardRect.height / 2;
        const distance = Math.abs(cardCenterY - centerY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestInsightId = card.id.replace('insight-', '');
        }
      }

      if (!bestInsightId) return;

      window.dispatchEvent(
        new CustomEvent('fypai:anchor-sync', {
          detail: {
            source: 'right-panel',
            insightId: bestInsightId,
          },
        })
      );
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
    };
  }, [enableTimelineSync, contentFilter, currentTeamId, activeInsights.length]);

  useEffect(() => {
    if (!enableTimelineSync) return;

    const handleAnchorSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ source?: 'chat' | 'right-panel'; insightId?: string }>;
      if (customEvent.detail?.source !== 'chat') return;

      const insightId = customEvent.detail.insightId;
      if (!insightId) return;

      if (lastAppliedInsightRef.current?.id === insightId && Date.now() - lastAppliedInsightRef.current.at < 1400) {
        return;
      }

      applyingExternalSyncRef.current = true;
      suppressAnchorEmitUntilRef.current = Date.now() + 1600;
      lastAppliedInsightRef.current = { id: insightId, at: Date.now() };
      // Passive scroll sync should not change active category tab.
      // Only focus items that are already rendered in the current tab.
      focusRenderedInsightOnly(insightId);
      setTimeout(() => {
        applyingExternalSyncRef.current = false;
      }, 420);
    };

    window.addEventListener('fypai:anchor-sync', handleAnchorSync as EventListener);
    return () => {
      window.removeEventListener('fypai:anchor-sync', handleAnchorSync as EventListener);
    };
  }, [enableTimelineSync, insightsById]);
  
  // Show empty state when no team selected (AFTER all hooks)
  if (!currentTeamId) {
    return (
      <aside className="flex-1 min-w-0 h-screen bg-gray-50 flex flex-col">
        <div className="p-6 flex-1">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">AI Insights</h2>
          <p className="text-gray-500">
            Select a team to view AI-generated insights and recommendations
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex-1 min-w-0 h-screen bg-gray-50 flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <RightPanelHeader
          isContextVisible={showTaskContext}
          onToggleContext={() => setShowTaskContext((prev) => !prev)}
        >
          <TaskContextCard
            teamId={currentTeamId}
            mode="embedded"
            onClose={() => setShowTaskContext(false)}
          />
        </RightPanelHeader>
      </div>

      {/* Scrollable Content Area */}
      <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-4">
        {contentFilter === 'all' && (
          <section className="space-y-4">
            {activeInsights.length > 0 ? (
              <InsightsList insights={activeInsights} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
            ) : (
              <p className="text-xs text-gray-500">No AI content yet</p>
            )}
          </section>
        )}

        {contentFilter === 'summaries' && (
          <section className="space-y-4">
            {summaryInsights.length > 0 ? (
              <InsightsList insights={summaryInsights} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
            ) : (
              <p className="text-xs text-gray-500">No summary yet</p>
            )}

            {archivedSummaryInsights.length > 0 && (
              <button
                onClick={() => setShowArchivedSummaries(prev => !prev)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {showArchivedSummaries
                  ? 'Hide archived summaries'
                  : `Show archived summaries (${archivedSummaryInsights.length})`}
              </button>
            )}

            {showArchivedSummaries && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Archived Summaries</h3>
                {archivedSummaryInsights.length > 0 ? (
                  <InsightsList insights={archivedSummaryInsights} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
                ) : (
                  <p className="text-xs text-gray-500">No archived summaries</p>
                )}
              </div>
            )}
          </section>
        )}

        {contentFilter === 'research' && (
          <section className="space-y-4">
            {researchInsights.length > 0 ? (
              <InsightsList insights={researchInsights} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
            ) : (
              <p className="text-xs text-gray-500">No research briefs yet</p>
            )}

            {archivedResearchInsights.length > 0 && (
              <button
                onClick={() => setShowArchivedResearch(prev => !prev)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {showArchivedResearch
                  ? 'Hide archived research'
                  : `Show archived research (${archivedResearchInsights.length})`}
              </button>
            )}

            {showArchivedResearch && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Archived Research</h3>
                {archivedResearchInsights.length > 0 ? (
                  <InsightsList insights={archivedResearchInsights} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
                ) : (
                  <p className="text-xs text-gray-500">No archived research</p>
                )}
              </div>
            )}
          </section>
        )}

        {contentFilter === 'actions' && (
          <section className="space-y-4">
            {openActions.length > 0 ? (
              <InsightsList insights={openActions} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
            ) : (
              <p className="text-xs text-gray-500">No open action items</p>
            )}

            {completedActions.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompletedActions(prev => !prev)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {showCompletedActions
                    ? 'Hide completed actions'
                    : `Show completed actions (${completedActions.length})`}
                </button>
                {showCompletedActions && (
                  <div className="mt-3">
                    <InsightsList insights={completedActions} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
                  </div>
                )}
              </div>
            )}

            {archivedActionInsights.length > 0 && (
              <button
                onClick={() => setShowArchivedActions(prev => !prev)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {showArchivedActions
                  ? 'Hide archived actions'
                  : `Show archived actions (${archivedActionInsights.length})`}
              </button>
            )}

            {showArchivedActions && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Archived Actions</h3>
                {archivedActionInsights.length > 0 ? (
                  <InsightsList insights={archivedActionInsights} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
                ) : (
                  <p className="text-xs text-gray-500">No archived actions</p>
                )}
              </div>
            )}
          </section>
        )}

        {contentFilter === 'suggestions' && (
          <section className="space-y-4">
            {suggestionInsights.length > 0 ? (
              <InsightsList insights={suggestionInsights} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
            ) : (
              <p className="text-xs text-gray-500">No research suggestions yet</p>
            )}

            {archivedSuggestionInsights.length > 0 && (
              <button
                onClick={() => setShowArchivedSuggestions(prev => !prev)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {showArchivedSuggestions
                  ? 'Hide archived suggestions'
                  : `Show archived suggestions (${archivedSuggestionInsights.length})`}
              </button>
            )}

            {showArchivedSuggestions && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Archived Suggestions</h3>
                {archivedSuggestionInsights.length > 0 ? (
                  <InsightsList insights={archivedSuggestionInsights} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
                ) : (
                  <p className="text-xs text-gray-500">No archived suggestions</p>
                )}
              </div>
            )}
          </section>
        )}

        {activeInsights.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            <p className="text-sm font-medium">No active AI content yet</p>
            <p className="text-xs text-gray-400 mt-1">Insights will appear as the conversation progresses</p>
          </div>
        )}
      </div>

      <div className={`relative flex-shrink-0 ${uiTokens.layout.railFooter} bg-white`}>
        {/* Bottom Insight Tabs */}
        <div className={`${uiTokens.layout.railFooterRow} px-4 flex items-center border-t border-gray-200`}>
          <SegmentedControl
            items={bottomTabItems}
            activeKey={contentFilter}
            onChange={setContentFilter}
            wrap
          />
        </div>

        {/* Collapsible AI Controls Footer */}
        <AIControlsDrawer
          teamId={currentTeamId}
          isAIEnabled={isTeamAIEnabled}
          onToggleAI={handleToggleAI}
          integrated
        />
      </div>
    </aside>
  );
};