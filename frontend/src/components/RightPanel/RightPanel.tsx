/**
 * RightPanel Component
 *
 * Three-section layout:
 *   1. Fixed header (team name, insight count)
 *   2. Filter tabs: All | Summaries | Actions | Suggestions
 *   3. Scrollable content area (insights)
 *   4. Collapsible AI Controls footer (toggle + action buttons + settings drawer)
 */
import { useEntityStore } from '@/stores/entityStore';
import { useUIStore } from '@/stores/uiStore';
import { socketService } from '@/services';
import { useState, useEffect, useRef, useMemo } from 'react';
import { RightPanelHeader } from './RightPanelHeader';
import { InsightsList } from './InsightsList';
import { LongFormContentViewer } from './LongFormContentViewer';
import { AIControlsDrawer } from './AIControlsDrawer';
import { TaskContextCard } from './TaskContextCard';
import { getInsights } from '@/services/insightService';

type ContentFilter = 'all' | 'summaries' | 'actions' | 'suggestions';

// ── Filter tab config ──────────────────────────────────────

const TABS: { key: ContentFilter; label: string; emoji?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'summaries', label: 'Summaries', emoji: '📊' },
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
  const [showDismissed, setShowDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch insights when team changes
  useEffect(() => {
    if (currentTeamId) {
      getInsights(currentTeamId);
    }
  }, [currentTeamId]);

  // Sort insights by date (memoized)
  const insights = useMemo(() => {
    return [...teamInsights].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [teamInsights, currentTeamId]);

  // Combine and sort all content by date (oldest first, latest at bottom) - MEMOIZED
  // Now all content comes from insights store
  const displayedContent = useMemo(() => {
    // Filter by status: hide dismissed/archived by default
    let filtered = showDismissed
      ? insights
      : insights.filter(i => i.status !== 'dismissed' && i.status !== 'archived');

    // Filter based on selected tab
    switch (contentFilter) {
      case 'summaries':
        return filtered.filter(i => i.type === 'summary' || i.type === 'document');
      case 'actions':
        return filtered.filter(i => i.type === 'action');
      case 'suggestions':
        return filtered.filter(i => i.type === 'suggestion');
      case 'all':
      default:
        return filtered;
    }
  }, [insights, contentFilter, showDismissed]);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedContent.length, currentTeamId]);

  // Calculate counts for filter tabs (based on visible insights)
  const visibleInsights = showDismissed
    ? insights
    : insights.filter(i => i.status !== 'dismissed' && i.status !== 'archived');
  const summaryCount = visibleInsights.filter(i => i.type === 'summary' || i.type === 'document').length;
  const actionCount = visibleInsights.filter(i => i.type === 'action').length;
  const suggestionCount = visibleInsights.filter(i => i.type === 'suggestion').length;
  const totalContent = visibleInsights.length;

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

  const countForTab = (key: ContentFilter): number | null => {
    switch (key) {
      case 'all': return totalContent;
      case 'summaries': return summaryCount;
      case 'actions': return actionCount;
      case 'suggestions': return suggestionCount;
      default: return null; // rules tab has no count badge
    }
  };

  return (
    <aside className="flex-1 min-w-0 h-screen bg-gray-50 border-l border-gray-200 flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <RightPanelHeader teamName={teamName} insightCount={totalContent} />
        <TaskContextCard teamId={currentTeamId} />
      </div>

      {/* Content Type Tabs */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-5 py-2">
          <div className="flex space-x-1">
            {TABS.map((tab) => {
              const count = countForTab(tab.key);
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
                  {tab.label}
                  {count !== null && ` (${count})`}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowDismissed(prev => !prev)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              showDismissed ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600'
            }`}
            title={showDismissed ? 'Hide dismissed' : 'Show dismissed'}
          >
            {showDismissed ? '👁 All' : '👁‍🗨 Active'}
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-3">
        {displayedContent.length > 0 ? (
          displayedContent.map((insight) => {
            if (insight.type === 'summary' || insight.type === 'document') {
              return (
                <LongFormContentViewer 
                  key={insight.id} 
                  insights={[insight]} 
                />
              );
            } else {
              return (
                <InsightsList 
                  key={insight.id} 
                  insights={[insight]} 
                />
              );
            }
          })
        ) : (
          <div className="text-center py-10 text-gray-500">
            <p className="text-sm font-medium">No {contentFilter === 'all' ? 'AI content' : contentFilter} yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Use the buttons below to generate content
            </p>
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