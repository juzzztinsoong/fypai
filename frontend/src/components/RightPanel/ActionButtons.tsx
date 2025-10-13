interface ActionButtonsProps {
  hasInsights: boolean;
  teamName?: string;
  onAudioOverview: () => void;
  onVideoOverview: () => void;
  onGenerateReport: () => void;
  onGenerateMindmap: () => void;
  onExportPDF: () => void;
  onShareInsights: () => void;
}

export const ActionButtons = ({
  hasInsights,
  onAudioOverview,
  onVideoOverview,
  onGenerateReport,
  onGenerateMindmap,
  onExportPDF,
  onShareInsights,
}: ActionButtonsProps) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Audio Overview */}
      <button
        onClick={onAudioOverview}
        disabled={!hasInsights}
        className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          hasInsights
            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
        title={!hasInsights ? 'No insights to generate audio' : 'Generate audio overview'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
        <span>Audio Overview</span>
      </button>

      {/* Video Overview */}
      <button
        onClick={onVideoOverview}
        disabled={!hasInsights}
        className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          hasInsights
            ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
        title={!hasInsights ? 'No insights to generate video' : 'Generate video overview'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
        </svg>
        <span>Video Overview</span>
      </button>

      {/* Generate Report */}
      <button
        onClick={onGenerateReport}
        disabled={!hasInsights}
        className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          hasInsights
            ? 'bg-green-50 text-green-700 hover:bg-green-100'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
        title={!hasInsights ? 'No insights to generate report' : 'Generate detailed report'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
        </svg>
        <span>Report</span>
      </button>

      {/* Generate Mindmap */}
      <button
        onClick={onGenerateMindmap}
        disabled={!hasInsights}
        className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          hasInsights
            ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
        title={!hasInsights ? 'No insights to generate mindmap' : 'Generate mindmap visualization'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>Mindmap</span>
      </button>

      {/* Export PDF */}
      <button
        onClick={onExportPDF}
        disabled={!hasInsights}
        className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          hasInsights
            ? 'bg-red-50 text-red-700 hover:bg-red-100'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
        title={!hasInsights ? 'No insights to export' : 'Export insights as PDF'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z" />
        </svg>
        <span>Export PDF</span>
      </button>

      {/* Share Insights */}
      <button
        onClick={onShareInsights}
        disabled={!hasInsights}
        className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          hasInsights
            ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
        title={!hasInsights ? 'No insights to share' : 'Share insights with team'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
        </svg>
        <span>Share</span>
      </button>
    </div>
  );
};
