interface RightPanelHeaderProps {
  teamName: string;
  insightCount: number;
}

export const RightPanelHeader = ({ teamName, insightCount }: RightPanelHeaderProps) => {
  return (
    <div className="px-5 py-4 min-h-[72px] border-b border-gray-200 bg-white flex flex-col justify-center">
      <h2 className="text-lg font-semibold text-gray-800 leading-6">
        AI Insights
      </h2>
      <p className="text-xs text-gray-500 mt-0.5">
        {teamName} • {insightCount} insight{insightCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
};
