import { useCurrentTeam } from '../../stores/teamStore';
import { useAIInsightsStore } from '../../stores/aiInsightsStore';
import { useState } from 'react';
import { RightPanelHeader } from './RightPanelHeader';
import { InsightFilters } from './InsightFilters';
import { InsightsList } from './InsightsList';
import { AIToggle } from './AIToggle';
import { ActionButtons } from './ActionButtons';
import { EmptyState } from './EmptyState';
import { getInsightTypeCounts } from './insightUtils';
import { useActionHandlers } from './useActionHandlers';
import type { AIInsight } from '../../stores/aiInsightsStore';

/**
 * RightPanel Component
 *
 * Tech Stack: React (Vite), Zustand for state, Tailwind CSS for styling
 * Purpose: Display AI-generated insights, summaries, and content for current team
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
  const { getTeamInsights, isAIEnabled, toggleAI } = useAIInsightsStore();
  const [selectedType, setSelectedType] = useState<AIInsight['type'] | 'all'>('all');

  // Get action handlers
  const actionHandlers = useActionHandlers(currentTeam?.name);

  // Get insights for current team
  const insights = currentTeam ? getTeamInsights(currentTeam.id) : [];
  
  // Get AI enabled state for current team
  const isTeamAIEnabled = currentTeam ? isAIEnabled(currentTeam.id) : true;

  const handleToggleAI = () => {
    if (currentTeam) {
      toggleAI(currentTeam.id);
      console.log('AI Assistant for', currentTeam.name, ':', !isTeamAIEnabled ? 'enabled' : 'disabled');
    }
  };
  
  // Show empty state when no team selected
  if (!currentTeam) {
    return (
      <EmptyState
        isAIEnabled={isTeamAIEnabled}
        onToggleAI={handleToggleAI}
        onAudioOverview={actionHandlers.handleAudioOverview}
        onVideoOverview={actionHandlers.handleVideoOverview}
        onGenerateReport={actionHandlers.handleGenerateReport}
        onGenerateMindmap={actionHandlers.handleGenerateMindmap}
        onExportPDF={actionHandlers.handleExportPDF}
        onShareInsights={actionHandlers.handleShareInsights}
      />
    );
  }

  // Filter insights by selected type
  const filteredInsights = selectedType === 'all' 
    ? insights 
    : insights.filter(i => i.type === selectedType);

  // Calculate type counts for filter tabs
  const typeCounts = getInsightTypeCounts(insights);

  return (
    <aside className="w-1/2 min-h-screen bg-gray-50 border-l border-gray-200 flex flex-col">
      {/* Header */}
      <RightPanelHeader teamName={currentTeam.name} insightCount={insights.length} />

      {/* Filter Tabs */}
      <InsightFilters
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        typeCounts={typeCounts}
      />

      {/* Insights List */}
      <div className="flex-1 overflow-y-auto p-6">
        <InsightsList insights={filteredInsights} />
      </div>

      {/* Action Buttons Footer */}
      <div className="border-t border-gray-200 bg-white p-4">
        <AIToggle isEnabled={isTeamAIEnabled} onToggle={handleToggleAI} />
        <ActionButtons
          hasInsights={insights.length > 0}
          teamName={currentTeam.name}
          onAudioOverview={actionHandlers.handleAudioOverview}
          onVideoOverview={actionHandlers.handleVideoOverview}
          onGenerateReport={actionHandlers.handleGenerateReport}
          onGenerateMindmap={actionHandlers.handleGenerateMindmap}
          onExportPDF={actionHandlers.handleExportPDF}
          onShareInsights={actionHandlers.handleShareInsights}
        />
      </div>
    </aside>
  );
};