import { useCurrentTeam } from '../../stores/teamStore';
import { useAIInsightsStore } from '../../stores/aiInsightsStore';
import { useRealtimeStore } from '@/core/eventBus/RealtimeStore';
import { socketService } from '@/services';
import { useState, useEffect, useRef, useMemo } from 'react';
import { RightPanelHeader } from './RightPanelHeader';
import { InsightsList } from './InsightsList';
import { LongFormContentViewer } from './LongFormContentViewer';
import { AIToggle } from './AIToggle';
import { ActionButtons } from './ActionButtons';
import { EmptyState } from './EmptyState';

/**
 * RightPanel Component
 *
 * Tech Stack: React (Vite), RealtimeStore for data, Zustand for UI state, Tailwind CSS
 * Purpose: Display AI-generated insights, summaries, and content for current team
 *
 * Architecture:
 *   - Subscribes directly to RealtimeStore for insight data
 *   - Uses aiInsightsStore only for UI state (AI toggle, loading)
 *   - No direct socket dependencies (handled by Socket Bridge)
 *
 * Features:
 *   - Shows AI insights organized by type (summary, action items, suggestions, etc.)
 *   - Filters insights per team/chat
 *   - Displays different insight types with appropriate styling
 *   - Supports code highlighting and markdown content
 *   - Shows priority badges and tags
 *   - Action buttons for audio, video, reports, mindmap, export, and share
 *   - Per-team AI toggle for enabling/disabling AI assistant
 *
 * Components:
 *   - RightPanelHeader: Team name and insight count
 *   - InsightFilters: Filter tabs for insight types
 *   - InsightsList: List of insight cards with empty state
 *   - InsightCard: Individual insight display
 *   - AIToggle: Toggle AI assistant per team
 *   - ActionButtons: Contextual action buttons
 *   - EmptyState: Display when no team selected
 *
 * Usage:
 *   - Used in main layout alongside ChatWindow
 *   - Updates automatically when team switches
 */

export const RightPanel = () => {
  const currentTeam = useCurrentTeam();
  // Extract teamId to use as stable dependency instead of the object
  const teamId = currentTeam?.id;
  const teamName = currentTeam?.name || 'Team';
  
  // UI state from aiInsightsStore - extract only what we need
  const fetchInsights = useAIInsightsStore((state) => state.fetchInsights);
  
  // Get AI enabled state from RealtimeStore (synced across all team members)
  const isTeamAIEnabled = useRealtimeStore((state) => state.isAIEnabled(teamId || ''));
  
  // Subscribe to this team's insights array directly
  // Returns stable EMPTY_INSIGHTS_ARRAY if no insights exist for this team
  const teamInsights = useRealtimeStore((state) => state.getInsights(teamId || ''));
  
  const [contentFilter, setContentFilter] = useState<'all' | 'summaries' | 'actions' | 'suggestions'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const toggleTimeoutRef = useRef<number | null>(null);

  // ✅ Fetch insights when team changes (publishes to Event Bus → RealtimeStore)
  useEffect(() => {
    if (teamId) {
      console.log('[RightPanel] Fetching insights for team:', teamId);
      fetchInsights(teamId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]); // Only re-fetch when teamId changes, not when fetchInsights reference changes

  // ✅ Sort insights by date (memoized to avoid re-sorting on every render)
  const insights = useMemo(() => {
    console.log('[RightPanel] Insights from RealtimeStore, count:', teamInsights.length, 'team:', teamId);
    // CRITICAL: Use slice() to create new array before sorting (avoid mutating original)
    return [...teamInsights].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [teamInsights, teamId]);

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

  // Auto-scroll to bottom when content changes (stable dependencies only)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedContent.length, teamId]);

  // Debug: Log when insights change
  useEffect(() => {
    console.log('[RightPanel] 🔄 Insights updated, count:', displayedContent.length, 'team:', teamId);
  }, [displayedContent.length, teamId]);

  // Calculate counts for filter tabs
  const summaryCount = insights.filter(i => i.type === 'summary' || i.type === 'document').length;
  const actionCount = insights.filter(i => i.type === 'action').length;
  const suggestionCount = insights.filter(i => i.type === 'suggestion').length;
  const totalContent = insights.length;

  const handleToggleAI = () => {
    if (!teamId) return;

    // Optimistic update - update local state immediately
    const newState = !isTeamAIEnabled;
    useRealtimeStore.getState().setAIEnabled(teamId, newState);

    // Debounce socket emission to prevent race conditions (500ms delay)
    if (toggleTimeoutRef.current) {
      clearTimeout(toggleTimeoutRef.current);
    }

    toggleTimeoutRef.current = window.setTimeout(() => {
      socketService.toggleTeamAI(teamId, newState);
      console.log('[RightPanel] 🤖 AI toggled for team', teamId, ':', newState ? 'enabled' : 'disabled');
    }, 500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toggleTimeoutRef.current) {
        clearTimeout(toggleTimeoutRef.current);
      }
    };
  }, []);
  
  // Show empty state when no team selected (AFTER all hooks)
  if (!teamId) {
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
                  messages={[{
                    id: insight.id,
                    teamId: insight.teamId,
                    authorId: 'ai-assistant',
                    content: insight.content,
                    createdAt: insight.createdAt,
                    metadata: {
                      longFormType: insight.type,
                      aiGenerated: true,
                    }
                  } as any]} 
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