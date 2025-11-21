/**
 * RightPanel Component
 *
 * Per Refactoring Guide Section 1.3:
 * - Uses EntityStore for insights data (normalized)
 * - Uses UIStore for current team context and view state (filters)
 * - Uses SessionStore for AI toggle state
 * - No aiInsightsStore, no teamStore, no RealtimeStore
 *
 * Tech Stack: React (Vite), EntityStore, UIStore, SessionStore, Tailwind CSS
 */
import { useEntityStore } from '@/stores/entityStore';
import { useUIStore } from '@/stores/uiStore';
import { socketService } from '@/services';
import { useState, useEffect, useRef, useMemo } from 'react';
import { RightPanelHeader } from './RightPanelHeader';
import { InsightsList } from './InsightsList';
import { LongFormContentViewer } from './LongFormContentViewer';
import { AIToggle } from './AIToggle';
import { ActionButtons } from './ActionButtons';
import { EmptyState } from './EmptyState';
import { getInsights } from '@/services/insightService';

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
  
  const [contentFilter, setContentFilter] = useState<'all' | 'summaries' | 'actions' | 'suggestions'>('all');
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
    // Filter based on selected tab
    switch (contentFilter) {
      case 'summaries':
        return insights.filter(i => i.type === 'summary' || i.type === 'document');
      case 'actions':
        return insights.filter(i => i.type === 'action');
      case 'suggestions':
        return insights.filter(i => i.type === 'suggestion');
      case 'all':
      default:
        return insights;
    }
  }, [insights, contentFilter]);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedContent.length, currentTeamId]);

  // Calculate counts for filter tabs
  const summaryCount = insights.filter(i => i.type === 'summary' || i.type === 'document').length;
  const actionCount = insights.filter(i => i.type === 'action').length;
  const suggestionCount = insights.filter(i => i.type === 'suggestion').length;
  const totalContent = insights.length;

  const handleToggleAI = () => {
    if (!currentTeamId) return;

    // Toggle based on current state
    const newState = !isTeamAIEnabled;

    // Update local state optimistically (will be confirmed by socket broadcast)
    useEntityStore.getState().updateTeam(currentTeamId, { isChimeEnabled: newState });

    // Emit socket event to persist and broadcast to other clients
    socketService.toggleTeamAI(currentTeamId, newState);
  };
  
  // Show empty state when no team selected (AFTER all hooks)
  if (!currentTeamId) {
    return (
      <EmptyState
        isAIEnabled={isTeamAIEnabled}
        onToggleAI={handleToggleAI}
      />
    );
  }

  return (
    <aside className="w-1/2 h-screen bg-gray-50 border-l border-gray-200 flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <RightPanelHeader teamName={teamName} insightCount={totalContent} />
      </div>

      {/* Content Type Tabs */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="flex space-x-1 p-2">
          <button
            onClick={() => setContentFilter('all')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              contentFilter === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All ({totalContent})
          </button>
          <button
            onClick={() => setContentFilter('summaries')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              contentFilter === 'summaries'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📊 Summaries ({summaryCount})
          </button>
          <button
            onClick={() => setContentFilter('actions')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              contentFilter === 'actions'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            ✅ Actions ({actionCount})
          </button>
          <button
            onClick={() => setContentFilter('suggestions')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              contentFilter === 'suggestions'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            � Suggestions ({suggestionCount})
          </button>
        </div>
      </div>

      {/* Scrollable Content Area - Auto-scroll to bottom */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {displayedContent.length > 0 ? (
          displayedContent.map((insight) => {
            // Render summaries and documents with LongFormContentViewer
            if (insight.type === 'summary' || insight.type === 'document') {
              return (
                <LongFormContentViewer 
                  key={insight.id} 
                  insights={[insight]} 
                />
              );
            } else {
              // Render other insights (actions, suggestions, etc.) with InsightsList
              return (
                <InsightsList 
                  key={insight.id} 
                  insights={[insight]} 
                />
              );
            }
          })
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No {contentFilter === 'all' ? 'AI content' : contentFilter} yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Use the buttons below to generate content
            </p>
          </div>
        )}
      </div>

      {/* Fixed Action Buttons Footer */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
        <AIToggle isEnabled={isTeamAIEnabled} onToggle={handleToggleAI} />
        <ActionButtons />
      </div>
    </aside>
  );
};