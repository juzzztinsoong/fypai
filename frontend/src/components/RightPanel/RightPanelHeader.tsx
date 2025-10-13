interface RightPanelHeaderProps {
  teamName: string;
  insightCount: number;
}

export const RightPanelHeader = ({ teamName, insightCount }: RightPanelHeaderProps) => {
  return (
    <div className="p-6 border-b border-gray-200 bg-white">
      <h2 className="text-xl font-semibold text-gray-800 mb-1">
        AI Insights
      </h2>
      <p className="text-sm text-gray-500">
        {teamName} • {insightCount} insight{insightCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
};
