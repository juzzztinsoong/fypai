import type { AIInsightDTO } from '@fypai/types'
import { getMarkerDotClass, getMarkerIconClass, uiTokens } from '@/styles/uiTokens'

type LinkVisualInput =
  | string
  | {
      insightId?: string
      insightType?: AIInsightDTO['type']
    }

type InsightType = AIInsightDTO['type']

const markerByType: Record<InsightType, string> = {
  summary: 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100',
  document: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  action: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
  suggestion: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100',
  analysis: 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100',
  code: 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100',
}

const pillByType: Record<InsightType, string> = {
  summary: 'border-sky-300 bg-sky-100/80 text-sky-800',
  document: 'border-emerald-300 bg-emerald-100/80 text-emerald-800',
  action: 'border-amber-300 bg-amber-100/80 text-amber-800',
  suggestion: 'border-fuchsia-300 bg-fuchsia-100/80 text-fuchsia-800',
  analysis: 'border-orange-300 bg-orange-100/80 text-orange-800',
  code: 'border-slate-300 bg-slate-100/80 text-slate-800',
}

function resolveInput(input?: LinkVisualInput): { insightType?: AIInsightDTO['type'] } {
  if (!input || typeof input === 'string') {
    return {}
  }

  return {
    insightType: input.insightType,
  }
}

export function getLinkVisuals(input?: LinkVisualInput) {
  const { insightType } = resolveInput(input)

  return {
    marker: insightType ? markerByType[insightType] : uiTokens.marker.base,
    pill: insightType ? pillByType[insightType] : uiTokens.marker.pill,
    dot: getMarkerDotClass(insightType),
    icon: getMarkerIconClass(insightType),
  }
}
