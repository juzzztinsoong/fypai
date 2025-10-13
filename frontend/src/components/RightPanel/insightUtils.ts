import type { AIInsight } from '../../stores/aiInsightsStore';

export const getInsightTypeColor = (type: AIInsight['type']): string => {
  switch (type) {
    case 'summary': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'action-item': return 'bg-green-100 text-green-700 border-green-200';
    case 'suggestion': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'analysis': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'code': return 'bg-gray-100 text-gray-700 border-gray-300';
    case 'document': return 'bg-teal-100 text-teal-700 border-teal-200';
  }
};

export const getInsightTypeCounts = (insights: AIInsight[]) => {
  return {
    all: insights.length,
    summary: insights.filter(i => i.type === 'summary').length,
    'action-item': insights.filter(i => i.type === 'action-item').length,
    suggestion: insights.filter(i => i.type === 'suggestion').length,
    analysis: insights.filter(i => i.type === 'analysis').length,
    code: insights.filter(i => i.type === 'code').length,
    document: insights.filter(i => i.type === 'document').length,
  };
};
