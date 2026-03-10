import type { AIInsightDTO } from '../../types';

export interface InsightTypeTheme {
  card: string;
  iconShell: string;
  icon: string;
  title: string;
  link: string;
  muted: string;
}

const INSIGHT_THEMES: Record<AIInsightDTO['type'], InsightTypeTheme> = {
  summary: {
    card: 'border-slate-200 bg-white',
    iconShell: 'border border-sky-200 bg-sky-50',
    icon: 'text-sky-800',
    title: 'text-slate-900',
    link: 'text-sky-700 hover:text-sky-900',
    muted: 'text-slate-500',
  },
  document: {
    card: 'border-slate-200 bg-white',
    iconShell: 'border border-emerald-200 bg-emerald-50',
    icon: 'text-emerald-800',
    title: 'text-slate-900',
    link: 'text-emerald-700 hover:text-emerald-900',
    muted: 'text-slate-500',
  },
  action: {
    card: 'border-slate-200 bg-white',
    iconShell: 'border border-amber-200 bg-amber-50',
    icon: 'text-amber-800',
    title: 'text-slate-900',
    link: 'text-amber-700 hover:text-amber-900',
    muted: 'text-slate-500',
  },
  suggestion: {
    card: 'border-slate-200 bg-white',
    iconShell: 'border border-fuchsia-200 bg-fuchsia-50',
    icon: 'text-fuchsia-800',
    title: 'text-slate-900',
    link: 'text-fuchsia-700 hover:text-fuchsia-900',
    muted: 'text-slate-500',
  },
  analysis: {
    card: 'border-slate-200 bg-white',
    iconShell: 'border border-orange-200 bg-orange-50',
    icon: 'text-orange-800',
    title: 'text-slate-900',
    link: 'text-orange-700 hover:text-orange-900',
    muted: 'text-slate-500',
  },
  code: {
    card: 'border-slate-200 bg-white',
    iconShell: 'border border-slate-200 bg-slate-50',
    icon: 'text-slate-800',
    title: 'text-slate-950',
    link: 'text-slate-700 hover:text-slate-900',
    muted: 'text-slate-500',
  },
};

export const getInsightTypeTheme = (type: AIInsightDTO['type']): InsightTypeTheme => INSIGHT_THEMES[type];

export const getInsightTypeColor = (type: AIInsightDTO['type']): string => {
  return INSIGHT_THEMES[type].card;
};

export const getInsightTypeCounts = (insights: AIInsightDTO[]) => {
  return {
    all: insights.length,
    summary: insights.filter(i => i.type === 'summary').length,
    action: insights.filter(i => i.type === 'action').length,
    suggestion: insights.filter(i => i.type === 'suggestion').length,
    analysis: insights.filter(i => i.type === 'analysis').length,
    code: insights.filter(i => i.type === 'code').length,
    document: insights.filter(i => i.type === 'document').length,
  };
};
