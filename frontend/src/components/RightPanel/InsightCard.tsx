import type { AIInsightDTO } from '../../types';
import { InsightTypeIcon } from './InsightTypeIcon';
import { PriorityBadge } from './PriorityBadge';
import { getInsightTypeColor } from './insightUtils';

interface InsightCardProps {
  insight: AIInsightDTO;
}

export const InsightCard = ({ insight }: InsightCardProps) => {
  return (
    <div
      className={`border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow ${getInsightTypeColor(insight.type)}`}
    >
      {/* Insight Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded ${getInsightTypeColor(insight.type)}`}>
            <InsightTypeIcon type={insight.type} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{insight.title}</h3>
            <p className="text-xs text-gray-500">
              {new Date(insight.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <PriorityBadge priority={insight.priority} />
      </div>

      {/* Insight Content */}
      <div className="text-sm text-gray-700 whitespace-pre-wrap">
        {insight.type === 'code' ? (
          <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
            <code>{insight.content}</code>
          </pre>
        ) : (
          <div className="prose prose-sm max-w-none">{insight.content}</div>
        )}
      </div>

      {/* Tags */}
      {insight.tags && insight.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {insight.tags.map((tag: string) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
