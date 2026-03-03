/**
 * RightPanel Component
 *
 * Tabbed section layout:
 *   1. Fixed header (team name, insight count)
 *   2. Section tabs (Summaries | Research | Actions | Suggestions)
 *   3. Scrollable content area for selected section
 *   4. Collapsible AI Controls footer (toggle + action buttons + settings drawer)
 */
import { useEntityStore } from '@/stores/entityStore';
import { useUIStore } from '@/stores/uiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { socketService } from '@/services';
import { useState, useEffect, useRef, useMemo } from 'react';
import { RightPanelHeader } from './RightPanelHeader';
import { InsightsList } from './InsightsList';
import { LongFormContentViewer } from './LongFormContentViewer';
import { AIControlsDrawer } from './AIControlsDrawer';
import { TaskContextCard } from './TaskContextCard';
import { getInsights } from '@/services/insightService';
import { getResearchJobs } from '@/services/researchJobService';

type ContentFilter = 'summaries' | 'research' | 'actions' | 'suggestions';

const TABS: { key: ContentFilter; label: string; emoji?: string }[] = [
  { key: 'summaries', label: 'Summaries', emoji: '📝' },
  { key: 'research', label: 'Research', emoji: '🔎' },
  { key: 'actions', label: 'Actions', emoji: '✅' },
  { key: 'suggestions', label: 'Suggestions', emoji: '💡' },
];

export const RightPanel = () => {
  
  // Get current team from UIStore
  const currentTeamId = useUIStore((state) => state.currentTeamId);
  const currentTeam = useEntityStore((state) => 
    currentTeamId ? state.getTeam(currentTeamId) : null
  );
  const teamName = currentTeam?.name || 'Team';
  const researchRuns = useSessionStore((state) => state.getResearchRuns(currentTeamId || ''));
  
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
  
  const [contentFilter, setContentFilter] = useState<ContentFilter>('summaries');
  const [showArchivedSummaries, setShowArchivedSummaries] = useState(false);
  const [showArchivedResearch, setShowArchivedResearch] = useState(false);
  const [showArchivedActions, setShowArchivedActions] = useState(false);
  const [showArchivedSuggestions, setShowArchivedSuggestions] = useState(false);
  const [showCompletedActions, setShowCompletedActions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch insights when team changes
  useEffect(() => {
    if (currentTeamId) {
      getInsights(currentTeamId);
      getResearchJobs(currentTeamId).catch((error) => {
        console.error('[RightPanel] Failed to fetch research jobs:', error);
      });
    }
  }, [currentTeamId]);

  // Sort insights by date (newest first)
  const insights = useMemo(() => {
    return [...teamInsights].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [teamInsights, currentTeamId]);

  const activeInsights = useMemo(
    () => insights.filter(i => i.status !== 'dismissed' && i.status !== 'archived'),
    [insights]
  );

  const archivedInsights = useMemo(
    () => insights.filter(i => i.status === 'dismissed' || i.status === 'archived'),
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

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [currentTeamId]);

  const totalContent = activeInsights.length;
  const summaryCount = summaryInsights.length;
  const researchCount = researchInsights.length;
  const actionCount = actionInsights.length;
  const suggestionCount = suggestionInsights.length;
  const visibleResearchRuns = useMemo(() => {
    return [...researchRuns]
      .filter((run) => run.status === 'queued' || run.status === 'running' || run.status === 'failed')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3);
  }, [researchRuns]);

  const getRunStatusStyle = (status: 'queued' | 'running' | 'done' | 'failed') => {
    if (status === 'queued') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status === 'running') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'done') return 'bg-green-100 text-green-700 border-green-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const handleToggleAI = () => {
    if (!currentTeamId) return;
    const newState = !isTeamAIEnabled;
    useEntityStore.getState().updateTeam(currentTeamId, { isChimeEnabled: newState });
    socketService.toggleTeamAI(currentTeamId, newState);
  };
  
  // Show empty state when no team selected (AFTER all hooks)
  if (!currentTeamId) {
    return (
      <aside className="flex-1 min-w-0 h-screen bg-gray-50 border-l border-gray-200 flex flex-col">
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
    <aside className="flex-1 min-w-0 h-screen bg-gray-50 border-l border-gray-200 flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <RightPanelHeader teamName={teamName} insightCount={totalContent} />
        <TaskContextCard teamId={currentTeamId} />
      </div>

      {/* Section Tabs */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center px-5 py-2">
          <div className="flex space-x-1">
            {TABS.map((tab) => {
              const count =
                tab.key === 'summaries'
                  ? summaryCount
                  : tab.key === 'research'
                  ? researchCount
                  : tab.key === 'actions'
                  ? actionCount
                  : suggestionCount;
              const isActive = contentFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setContentFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.emoji && <span className="mr-1">{tab.emoji}</span>}
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-3">
        {contentFilter === 'summaries' && (
          <section className="space-y-3">
            {summaryInsights.length > 0 ? (
              <LongFormContentViewer insights={summaryInsights} />
            ) : (
              <p className="text-xs text-gray-500">No summary yet</p>
            )}

            {archivedSummaryInsights.length > 0 && (
              <button
                onClick={() => setShowArchivedSummaries(prev => !prev)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
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
                  <LongFormContentViewer insights={archivedSummaryInsights} />
                ) : (
                  <p className="text-xs text-gray-500">No archived summaries</p>
                )}
              </div>
            )}
          </section>
        )}

        {contentFilter === 'research' && (
          <section className="space-y-3">
            {visibleResearchRuns.length > 0 && (
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Research Pipeline</h3>
                  <span className="text-[11px] text-gray-500">{visibleResearchRuns.length} active</span>
                </div>
                <div className="space-y-1.5">
                  {visibleResearchRuns.map((run) => (
                    <div key={run.id} className="flex items-start justify-between gap-2">
                      <p className="text-xs text-gray-700 leading-5 truncate">{run.query}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium ${getRunStatusStyle(run.status)}`}>
                        {run.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {researchInsights.length > 0 ? (
              <LongFormContentViewer insights={researchInsights} />
            ) : (
              <p className="text-xs text-gray-500">No research briefs yet</p>
            )}

            {archivedResearchInsights.length > 0 && (
              <button
                onClick={() => setShowArchivedResearch(prev => !prev)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
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
                  <LongFormContentViewer insights={archivedResearchInsights} />
                ) : (
                  <p className="text-xs text-gray-500">No archived research</p>
                )}
              </div>
            )}
          </section>
        )}

        {contentFilter === 'actions' && (
          <section className="space-y-3">
            {openActions.length > 0 ? (
              <InsightsList insights={openActions} />
            ) : (
              <p className="text-xs text-gray-500">No open action items</p>
            )}

            {completedActions.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompletedActions(prev => !prev)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {showCompletedActions
                    ? 'Hide completed actions'
                    : `Show completed actions (${completedActions.length})`}
                </button>
                {showCompletedActions && (
                  <div className="mt-3">
                    <InsightsList insights={completedActions} />
                  </div>
                )}
              </div>
            )}

            {archivedActionInsights.length > 0 && (
              <button
                onClick={() => setShowArchivedActions(prev => !prev)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
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
                  <InsightsList insights={archivedActionInsights} />
                ) : (
                  <p className="text-xs text-gray-500">No archived actions</p>
                )}
              </div>
            )}
          </section>
        )}

        {contentFilter === 'suggestions' && (
          <section className="space-y-3">
            {suggestionInsights.length > 0 ? (
              <InsightsList insights={suggestionInsights} />
            ) : (
              <p className="text-xs text-gray-500">No research suggestions yet</p>
            )}

            {archivedSuggestionInsights.length > 0 && (
              <button
                onClick={() => setShowArchivedSuggestions(prev => !prev)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
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
                  <InsightsList insights={archivedSuggestionInsights} />
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
            <p className="text-xs text-gray-400 mt-1">Use Summary or Research below to generate content</p>
          </div>
        )}
      </div>

      {/* Collapsible AI Controls Footer */}
      <AIControlsDrawer
        teamId={currentTeamId}
        isAIEnabled={isTeamAIEnabled}
        onToggleAI={handleToggleAI}
      />
    </aside>
  );
};