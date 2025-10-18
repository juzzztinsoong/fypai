import type { AIInsightDTO } from '../../types';
import { InsightTypeIcon } from './InsightTypeIcon';
import { PriorityBadge } from './PriorityBadge';
import { getInsightTypeColor } from './insightUtils';
import ReactMarkdown from 'react-markdown';

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
      <div className="text-sm text-gray-700">
        {insight.type === 'code' ? (
          <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
            <code>{insight.content}</code>
          </pre>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // Style headers
                h1: ({ children }) => <h1 className="text-lg font-bold text-gray-900 mt-3 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold text-gray-800 mt-2 mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-700 mt-2 mb-1">{children}</h3>,
                // Style lists
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                li: ({ children }) => <li className="ml-4">{children}</li>,
                // Style paragraphs
                p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                // Style bold and italic
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
                // Style code
                code: ({ children }) => <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                // Style blockquotes
                blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2">{children}</blockquote>,
              }}
            >
              {insight.content}
            </ReactMarkdown>
          </div>
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
