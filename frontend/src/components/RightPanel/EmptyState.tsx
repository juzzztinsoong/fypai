import { AIToggle } from './AIToggle';
import { ActionButtons } from './ActionButtons';

interface EmptyStateProps {
  isAIEnabled: boolean;
  onToggleAI: () => void;
  onAudioOverview: () => void;
  onVideoOverview: () => void;
  onGenerateReport: () => void;
  onGenerateMindmap: () => void;
  onExportPDF: () => void;
  onShareInsights: () => void;
}

export const EmptyState = ({
  isAIEnabled,
  onToggleAI,
  onAudioOverview,
  onVideoOverview,
  onGenerateReport,
  onGenerateMindmap,
  onExportPDF,
  onShareInsights,
}: EmptyStateProps) => {
  return (
    <aside className="w-1/2 min-h-screen bg-gray-50 border-l border-gray-200 flex flex-col">
      <div className="p-6 flex-1">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          AI Insights
        </h2>
        <p className="text-gray-500">
          Select a team to view AI-generated insights and recommendations
        </p>
      </div>

      {/* Action Buttons Footer - Always visible */}
      <div className="border-t border-gray-200 bg-white p-4">
        <AIToggle isEnabled={isAIEnabled} onToggle={onToggleAI} />
        <ActionButtons
          hasInsights={false}
          onAudioOverview={onAudioOverview}
          onVideoOverview={onVideoOverview}
          onGenerateReport={onGenerateReport}
          onGenerateMindmap={onGenerateMindmap}
          onExportPDF={onExportPDF}
          onShareInsights={onShareInsights}
        />
      </div>
    </aside>
  );
};
