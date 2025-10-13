import type { AIInsight } from '../../stores/aiInsightsStore';
import { InsightCard } from './InsightCard';

interface InsightsListProps {
  insights: AIInsight[];
}

export const InsightsList = ({ insights }: InsightsListProps) => {
  if (insights.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-2">
          <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        </div>
        <p className="text-gray-500">No insights yet</p>
        <p className="text-sm text-gray-400 mt-1">
          AI will generate insights as the conversation progresses
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
};
