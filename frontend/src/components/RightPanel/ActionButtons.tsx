/**
 * ActionButtons Component
 *
 * Per Refactoring Guide Section 1.3:
 * - Uses UIStore for current team context
 * - Uses EntityStore for team data
 * - Uses insightService for AI generation
 * - No teamStore
 */
import { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useEntityStore } from '@/stores/entityStore';
import * as insightService from '../../services/insightService';

export const ActionButtons = () => {
  const currentTeamId = useUIStore((state) => state.currentTeamId);
  const currentTeam = useEntityStore((state) => 
    currentTeamId ? state.getTeam(currentTeamId) : null
  );
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const handleGenerateSummary = async () => {
    if (!currentTeam) return;
    
    setLoadingSummary(true);
    try {
      await insightService.generateSummary(currentTeam.id);
      console.log('[ActionButtons] Summary insight generated');
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!currentTeam) return;
    
    setLoadingReport(true);
    try {
      await insightService.generateReport(currentTeam.id);
      console.log('[ActionButtons] Report insight generated');
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Summary Button - Active */}
      <button
        onClick={handleGenerateSummary}
        disabled={loadingSummary}
        className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>{loadingSummary ? '⏳' : '📝'}</span>
        <span>{loadingSummary ? 'Generating...' : 'Summary'}</span>
      </button>

      {/* Report Button - Active */}
      <button
        onClick={handleGenerateReport}
        disabled={loadingReport}
        className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>{loadingReport ? '⏳' : '📊'}</span>
        <span>{loadingReport ? 'Generating...' : 'Report'}</span>
      </button>

      {/* Audio Overview - Inactive */}
      <button
        disabled
        className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
      >
        <span>🎤</span>
        <span>Audio</span>
      </button>

      {/* Video Overview - Inactive */}
      <button
        disabled
        className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
      >
        <span>🎥</span>
        <span>Video</span>
      </button>

      {/* Mindmap - Inactive */}
      <button
        disabled
        className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
      >
        <span>🧠</span>
        <span>Mindmap</span>
      </button>

      {/* Share - Inactive */}
      <button
        disabled
        className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
      >
        <span>📤</span>
        <span>Share</span>
      </button>
    </div>
  );
};
