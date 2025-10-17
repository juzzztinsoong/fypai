import type { AIInsightDTO } from '../../types';

interface InsightFiltersProps {
  selectedType: AIInsightDTO['type'] | 'all';
  onTypeChange: (type: AIInsightDTO['type'] | 'all') => void;
  typeCounts: {
    all: number;
    summary: number;
    action: number;
    suggestion: number;
    analysis: number;
    code: number;
    document: number;
  };
}

export const InsightFilters = ({ selectedType, onTypeChange, typeCounts }: InsightFiltersProps) => {
  return (
    <div className="px-6 py-3 bg-white border-b border-gray-200 overflow-x-auto">
      <div className="flex space-x-2">
        <button
          onClick={() => onTypeChange('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
            selectedType === 'all'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({typeCounts.all})
        </button>
        {typeCounts.summary > 0 && (
          <button
            onClick={() => onTypeChange('summary')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
              selectedType === 'summary'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Summary ({typeCounts.summary})
          </button>
        )}
        {typeCounts.action > 0 && (
          <button
            onClick={() => onTypeChange('action')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
              selectedType === 'action'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Actions ({typeCounts.action})
          </button>
        )}
        {typeCounts.suggestion > 0 && (
          <button
            onClick={() => onTypeChange('suggestion')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
              selectedType === 'suggestion'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Suggestions ({typeCounts.suggestion})
          </button>
        )}
        {typeCounts.code > 0 && (
          <button
            onClick={() => onTypeChange('code')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
              selectedType === 'code'
                ? 'bg-gray-200 text-gray-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Code ({typeCounts.code})
          </button>
        )}
      </div>
    </div>
  );
};
