/**
 * RightPanel Component
 *
 * Tabbed section layout:
 *   1. Fixed header (team name, insight count)
 *   2. Scrollable content area for selected section
 *   3. Bottom tabs (All | Summaries | Research | Actions | Help)
 *   4. Collapsible AI Controls footer (toggle + settings drawer)
 */
import { useEntityStore } from '@/stores/entityStore';
import { useUIStore } from '@/stores/uiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { socketService } from '@/services';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RightPanelHeader } from './RightPanelHeader';
import { InsightsList } from './InsightsList';
import { AIControlsDrawer } from './AIControlsDrawer';
import { TaskContextCard } from './TaskContextCard';
import { getInsights } from '@/services/insightService';
import { getTaskContext, setTeamAIEnabled } from '@/services/teamService';
import { trackSessionEvent } from '@/services/analyticsService';
import { SegmentedControl, type SegmentedControlItem } from '@/components/common/SegmentedControl';
import { getSwitchThumbClass, getSwitchTrackClass, type SegmentedAccent, uiTokens } from '@/styles/uiTokens';

type ContentFilter = 'all' | 'summaries' | 'research' | 'actions' | 'suggestions';

const TABS: { key: ContentFilter; label: string; emoji?: string }[] = [
  { key: 'all', label: 'All', emoji: '🧭' },
  { key: 'summaries', label: 'Summaries', emoji: '📝' },
  { key: 'research', label: 'Research', emoji: '🔎' },
  { key: 'actions', label: 'Actions', emoji: '✅' },
  { key: 'suggestions', label: 'Help', emoji: '💡' },
];

const TAB_ACCENTS: Record<ContentFilter, SegmentedAccent> = {
  all: 'neutral',
  summaries: 'summary',
  research: 'success',
  actions: 'action',
  suggestions: 'suggestion',
};

const AUTO_FOLLOW_THRESHOLD_PX = 96;
const CHAT_TO_PANEL_REPEAT_LOCK_MS = 550;
const CHAT_TO_PANEL_SUPPRESS_EMIT_MS = 780;
const CHAT_TO_PANEL_BOTTOM_SUPPRESS_EMIT_MS = 650;
const CHAT_TO_PANEL_RELEASE_MS = 260;
const CHAT_TO_PANEL_CENTER_SNAP_TOLERANCE_PX = 8;
const CHAT_TO_PANEL_FOCUS_DELAY_MS = 40;

export const RightPanel = () => {
  
  // Get current team from UIStore
  const currentTeamId = useUIStore((state) => state.currentTeamId);
  const currentTeam = useEntityStore((state) => 
    currentTeamId ? state.getTeam(currentTeamId) : null
  );
  const currentUser = useSessionStore((state) => state.currentUser);
  const currentUserId = currentUser?.id;
  const enableTimelineSync = useUIStore((state) => state.preferences.enableTimelineSync);
  const storedTaskContext = useEntityStore((state) =>
    currentTeamId ? state.taskContexts[currentTeamId] || null : null
  );
  
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
  const [showArchivedInsights, setShowArchivedInsights] = useState(false);
  const [showCompletedActions, setShowCompletedActions] = useState(false);
  const [showTaskContext, setShowTaskContext] = useState(false);
  const [contextEditToken, setContextEditToken] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const applyingExternalSyncRef = useRef(false);
  const suppressAnchorEmitUntilRef = useRef(0);
  const lastAppliedInsightRef = useRef<{ id: string; at: number } | null>(null);
  const shouldAutoFollowRef = useRef(true);
  const lastLinkHoverTrackRef = useRef<{ insightId: string; at: number } | null>(null);

  const isNearBottom = useCallback((container: HTMLDivElement): boolean => {
    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    return distanceToBottom <= AUTO_FOLLOW_THRESHOLD_PX;
  }, []);

  // Fetch insights when team changes
  useEffect(() => {
    if (!currentTeamId) return;

    let isCancelled = false;
    getInsights(currentTeamId);

    getTaskContext(currentTeamId)
      .then((context) => {
        if (isCancelled) return;
        useEntityStore.getState().setTaskContext(currentTeamId, context);
      })
      .catch((error) => {
        console.error('[RightPanel] Failed to load task context:', error);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentTeamId]);

  const hasProjectContext = Boolean(storedTaskContext?.content?.trim());
  const projectContextPreview = useMemo(() => {
    const content = storedTaskContext?.content?.trim();
    if (!content) return '';

    const normalized = content
      .replace(/^#+\s*/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
  }, [storedTaskContext?.content]);

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

  const archivedCount = archivedInsights.length;

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
      shouldAutoFollowRef.current = true;
    }
  }, [currentTeamId]);

  // Track whether user is near bottom so we preserve reading position when they scroll up.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const updateAutoFollow = () => {
      shouldAutoFollowRef.current = isNearBottom(container);
    };

    updateAutoFollow();
    container.addEventListener('scroll', updateAutoFollow, { passive: true });

    return () => {
      container.removeEventListener('scroll', updateAutoFollow);
    };
  }, [currentTeamId, contentFilter, isNearBottom]);

  // Keep panel bottom-aligned only when user is already near the bottom.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (!shouldAutoFollowRef.current) return;

    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
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
    showArchivedInsights,
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

  const handleToggleAI = async () => {
    if (!currentTeamId) return;
    const newState = !isTeamAIEnabled;

    // Optimistic UI update for immediate feedback.
    useEntityStore.getState().updateTeam(currentTeamId, { isChimeEnabled: newState });

    try {
      await setTeamAIEnabled(currentTeamId, newState);

      // Best effort realtime sync for other connected clients.
      if (socketService.isConnected()) {
        socketService.toggleTeamAI(currentTeamId, newState);
      }
    } catch (error) {
      // Roll back local optimistic state when persistence fails.
      useEntityStore.getState().updateTeam(currentTeamId, { isChimeEnabled: !newState });
      console.error('[RightPanel] Failed to toggle team AI state:', error);
      return;
    }

    trackSessionEvent({
      eventType: 'navigation',
      eventName: 'team_ai_toggle_changed',
      teamId: currentTeamId,
      actorUserId: currentUserId,
      metadata: {
        enabled: newState,
      },
    });
  };

  const handleOpenTaskContextEditor = useCallback(() => {
    setShowTaskContext(true);
    setContextEditToken((token) => token + 1);

    trackSessionEvent({
      eventType: 'navigation',
      eventName: 'task_context_panel_toggled',
      teamId: currentTeamId || undefined,
      actorUserId: currentUserId,
      metadata: {
        visible: true,
        source: 'header-edit-button',
        editMode: true,
      },
    });
  }, [currentTeamId, currentUserId]);

  const handleCloseTaskContext = useCallback(() => {
    setShowTaskContext(false);

    trackSessionEvent({
      eventType: 'navigation',
      eventName: 'task_context_panel_toggled',
      teamId: currentTeamId || undefined,
      actorUserId: currentUserId,
      metadata: {
        visible: false,
        source: 'popover-close',
      },
    });
  }, [currentTeamId, currentUserId]);

  const handleContentFilterChange = (nextFilter: ContentFilter) => {
    if (nextFilter === contentFilter) return;

    trackSessionEvent({
      eventType: 'navigation',
      eventName: 'right_panel_tab_changed',
      teamId: currentTeamId || undefined,
      actorUserId: currentUserId,
      metadata: {
        from: contentFilter,
        to: nextFilter,
      },
    });

    setContentFilter(nextFilter);
  };

  const focusInsightById = (insightId: string, preferredTab: ContentFilter | 'by-type' = 'by-type') => {
    if (!insightId) return;

    const insight = insightsById[insightId];
    if (!insight) return;

    const nextTab: ContentFilter =
      preferredTab === 'all'
        ? 'all'
        : insight.type === 'summary'
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

      if (distanceFromCenter > CHAT_TO_PANEL_CENTER_SNAP_TOLERANCE_PX) {
        insightElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      insightElement.classList.add('fypai-link-highlight');
      setTimeout(() => {
        insightElement.classList.remove('fypai-link-highlight');
      }, 1800);
    }, CHAT_TO_PANEL_FOCUS_DELAY_MS);
  };

  const handleJumpToSource = (sourceId: string) => {
    trackSessionEvent({
      eventType: 'navigation',
      eventName: 'jump_to_insight_marker',
      teamId: currentTeamId || undefined,
      actorUserId: currentUserId,
      insightId: sourceId,
    });

    focusInsightById(sourceId);
  };

  const handleJumpToChatMarker = (insightId: string) => {
    if (!insightId) return;

    trackSessionEvent({
      eventType: 'navigation',
      eventName: 'jump_to_chat_marker',
      teamId: currentTeamId || undefined,
      actorUserId: currentUserId,
      insightId,
    });

    window.dispatchEvent(
      new CustomEvent('fypai:focus-chat-marker', {
        detail: { insightId },
      })
    );
  };

  useEffect(() => {
    const handleFocusInsight = (event: Event) => {
      const customEvent = event as CustomEvent<{
        insightId?: string;
        preferredTab?: ContentFilter;
        source?: 'chat-marker' | 'insight-card' | string;
      }>;
      const insightId = customEvent.detail?.insightId;
      if (!insightId) return;

      const preferredTab = customEvent.detail?.preferredTab === 'all' ? 'all' : 'by-type';
      focusInsightById(insightId, preferredTab);
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

        const now = Date.now();
        const previous = lastLinkHoverTrackRef.current;
        if (!previous || previous.insightId !== insightId || now - previous.at > 750) {
          trackSessionEvent({
            eventType: 'navigation',
            eventName: 'link_hover',
            teamId: currentTeamId || undefined,
            actorUserId: currentUserId,
            insightId,
            metadata: {
              source: 'right-panel',
            },
          });
          lastLinkHoverTrackRef.current = { insightId, at: now };
        }
      } else {
        insightElement.classList.remove('fypai-link-highlight-soft');
      }
    };

    window.addEventListener('fypai:link-hover', handleLinkHover as EventListener);
    return () => {
      window.removeEventListener('fypai:link-hover', handleLinkHover as EventListener);
    };
  }, [currentTeamId, currentUserId]);

  useEffect(() => {
    if (!enableTimelineSync) return;

    const handleAnchorSync = (event: Event) => {
      const customEvent = event as CustomEvent<{
        source?: 'chat' | 'right-panel';
        insightId?: string;
        syncMode?: 'bottom' | 'focus';
      }>;
      if (customEvent.detail?.source !== 'chat') return;

      if (customEvent.detail?.syncMode === 'bottom') {
        const container = scrollRef.current;
        if (!container) return;

        applyingExternalSyncRef.current = true;
        suppressAnchorEmitUntilRef.current = Date.now() + CHAT_TO_PANEL_BOTTOM_SUPPRESS_EMIT_MS;
        shouldAutoFollowRef.current = true;
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        setTimeout(() => {
          applyingExternalSyncRef.current = false;
        }, CHAT_TO_PANEL_RELEASE_MS);
        return;
      }

      const insightId = customEvent.detail.insightId;
      if (!insightId) return;

      if (lastAppliedInsightRef.current?.id === insightId && Date.now() - lastAppliedInsightRef.current.at < CHAT_TO_PANEL_REPEAT_LOCK_MS) {
        return;
      }

      applyingExternalSyncRef.current = true;
      suppressAnchorEmitUntilRef.current = Date.now() + CHAT_TO_PANEL_SUPPRESS_EMIT_MS;
      lastAppliedInsightRef.current = { id: insightId, at: Date.now() };
      // Passive scroll sync should not change active category tab.
      // Only focus items that are already rendered in the current tab.
      focusRenderedInsightOnly(insightId);
      setTimeout(() => {
        applyingExternalSyncRef.current = false;
      }, CHAT_TO_PANEL_RELEASE_MS);
    };

    window.addEventListener('fypai:anchor-sync', handleAnchorSync as EventListener);
    return () => {
      window.removeEventListener('fypai:anchor-sync', handleAnchorSync as EventListener);
    };
  }, [enableTimelineSync, insightsById]);
  
  // Show empty state when no team selected (AFTER all hooks)
  if (!currentTeamId) {
    return (
      <aside className="flex-1 min-w-0 h-screen bg-slate-50/35 flex flex-col">
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
    <aside className="flex-1 min-w-0 h-screen bg-slate-50/35 flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <RightPanelHeader
          isContextVisible={showTaskContext}
          hasProjectContext={hasProjectContext}
          projectContextPreview={projectContextPreview}
          onEditContext={handleOpenTaskContextEditor}
          onCloseContext={handleCloseTaskContext}
        >
          <TaskContextCard
            teamId={currentTeamId}
            mode="embedded"
            openInEditToken={contextEditToken}
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

            {showArchivedInsights && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Archived Insights</h3>
                {archivedInsights.length > 0 ? (
                  <InsightsList insights={archivedInsights} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
                ) : (
                  <p className="text-xs text-gray-500">No archived insights</p>
                )}
              </div>
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

            {showArchivedInsights && (
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
              <p className="text-xs text-gray-500">No research yet</p>
            )}

            {showArchivedInsights && (
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

            {showArchivedInsights && (
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
              <p className="text-xs text-gray-500">No help insights yet</p>
            )}

            {showArchivedInsights && (
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Archived Help</h3>
                {archivedSuggestionInsights.length > 0 ? (
                  <InsightsList insights={archivedSuggestionInsights} onJumpToSource={handleJumpToSource} onJumpToChatMarker={handleJumpToChatMarker} />
                ) : (
                  <p className="text-xs text-gray-500">No archived help</p>
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

      <div
        className={`relative flex-shrink-0 ${uiTokens.layout.railFooter} bg-white border-t border-slate-200 shadow-[0_-10px_20px_-18px_rgba(15,23,42,0.35)]`}
        style={{
          height: 'var(--fypai-chat-footer-height, 136px)',
          minHeight: 'var(--fypai-chat-footer-height, 136px)',
        }}
      >
        {/* Bottom Insight Tabs */}
        <div className={`${uiTokens.layout.railFooterRow} px-4 flex items-center justify-between gap-3 border-b border-slate-100`}>
          <div className="min-w-0 flex-1">
            <SegmentedControl
              items={bottomTabItems}
              activeKey={contentFilter}
              onChange={handleContentFilterChange}
              wrap
              styleVariant="pill"
            />
          </div>

          <div className="shrink-0 inline-flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Archived ({archivedCount})
            </span>
            <button
              onClick={() => setShowArchivedInsights((prev) => !prev)}
              className={`${uiTokens.controls.switch.base} ${getSwitchTrackClass(showArchivedInsights)}`}
              role="switch"
              aria-checked={showArchivedInsights}
              aria-label="Toggle archived insights visibility"
              title={showArchivedInsights ? 'Hide archived insights' : 'Show archived insights'}
            >
              <span
                className={`${uiTokens.controls.switch.thumbBase} ${getSwitchThumbClass(showArchivedInsights)}`}
              />
            </button>
          </div>
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