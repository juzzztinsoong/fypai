import type { AIInsightDTO } from '@fypai/types'

export type SegmentedAccent = 'brand' | 'success' | 'summary' | 'action' | 'suggestion' | 'neutral'
export type SegmentedStyle = 'solid' | 'pill'
export type ChipVariant = 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'muted'
export type ChipSize = 'xs' | 'sm' | 'md'
export type ElevationLevel = 'surface' | 'raised' | 'floating' | 'overlay'

type InsightType = AIInsightDTO['type']

const markerDotByType: Record<InsightType, string> = {
  summary: 'bg-sky-500',
  document: 'bg-emerald-500',
  action: 'bg-amber-500',
  suggestion: 'bg-fuchsia-500',
  analysis: 'bg-slate-500',
  code: 'bg-slate-700',
}

const markerIconByType: Record<InsightType, string> = {
  summary: 'text-sky-700',
  document: 'text-emerald-700',
  action: 'text-amber-700',
  suggestion: 'text-fuchsia-700',
  analysis: 'text-slate-700',
  code: 'text-slate-800',
}

export const uiTokens = {
  elevation: {
    surface: 'shadow-[0_1px_3px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.06)]',
    raised: 'shadow-[0_8px_22px_-10px_rgba(15,23,42,0.28),0_3px_8px_rgba(15,23,42,0.12)]',
    floating: 'shadow-[0_18px_42px_-20px_rgba(15,23,42,0.46),0_8px_18px_-10px_rgba(15,23,42,0.2)]',
    overlay: 'shadow-[0_30px_64px_-30px_rgba(15,23,42,0.58),0_14px_28px_-14px_rgba(15,23,42,0.28)]',
  },
  layout: {
    railHeader: 'h-[72px]',
    railFooter: 'h-[112px]',
    railFooterRow: 'h-14',
  },
  text: {
    meta: 'text-xs text-slate-500',
    successMeta: 'text-xs text-emerald-600',
  },
  segmented: {
    row: 'flex items-center gap-1.5',
    rowWrap: 'flex items-center flex-wrap gap-1.5',
    buttonBase: 'h-7 px-2.5 rounded-md text-xs font-medium transition-colors',
    buttonInactive: 'text-slate-600 hover:bg-slate-100',
    buttonActive: {
      brand: 'bg-indigo-100 text-indigo-700',
      success: 'bg-emerald-100 text-emerald-700',
      summary: 'bg-sky-100 text-sky-700',
      action: 'bg-amber-100 text-amber-700',
      suggestion: 'bg-fuchsia-100 text-fuchsia-700',
      neutral: 'bg-slate-200 text-slate-700',
    },
    pillBase: 'text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
    pillInactive: {
      brand: 'border-indigo-300 text-indigo-700 hover:bg-indigo-50',
      success: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
      summary: 'border-sky-300 text-sky-700 hover:bg-sky-50',
      action: 'border-amber-300 text-amber-700 hover:bg-amber-50',
      suggestion: 'border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50',
      neutral: 'border-slate-300 text-slate-700 hover:bg-slate-50',
    },
    pillActive: {
      brand: 'border-indigo-400 bg-indigo-100 text-indigo-800',
      success: 'border-emerald-400 bg-emerald-100 text-emerald-800',
      summary: 'border-sky-400 bg-sky-100 text-sky-800',
      action: 'border-amber-400 bg-amber-100 text-amber-800',
      suggestion: 'border-fuchsia-400 bg-fuchsia-100 text-fuchsia-800',
      neutral: 'border-slate-400 bg-slate-100 text-slate-800',
    },
    count: 'opacity-80',
  },
  marker: {
    base: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    pill: 'border-indigo-200 bg-indigo-100/80 text-indigo-700',
    dotDefault: 'bg-indigo-500',
    iconDefault: 'text-indigo-700',
  },
  chip: {
    base: 'inline-flex items-center rounded border font-medium',
    size: {
      xs: 'text-[10px] px-1.5 py-0.5',
      sm: 'text-xs px-2 py-0.5',
      md: 'text-sm px-2 py-1',
    },
    variant: {
      brand: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      warning: 'bg-amber-100 text-amber-700 border-amber-200',
      danger: 'bg-rose-100 text-rose-700 border-rose-200',
      neutral: 'bg-slate-100 text-slate-600 border-slate-200',
      muted: 'bg-slate-100 text-slate-500 border-slate-200',
    },
  },
  controls: {
    switch: {
      base: 'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
      trackOn: 'bg-indigo-600 hover:bg-indigo-700',
      trackOff: 'bg-slate-300 hover:bg-slate-400',
      thumbBase: 'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
      thumbOn: 'translate-x-4',
      thumbOff: 'translate-x-0',
    },
    button: {
      sm: 'text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
      secondary: 'border-slate-300 text-slate-700 hover:bg-slate-50',
      danger: 'border-rose-300 text-rose-700 hover:bg-rose-50',
      brandSolid: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed',
    },
    link: {
      inline: 'text-xs text-indigo-600 hover:text-indigo-700 font-medium',
    },
  },
} as const

export function getSegmentedBaseClass(style: SegmentedStyle = 'solid'): string {
  return style === 'pill' ? uiTokens.segmented.pillBase : uiTokens.segmented.buttonBase
}

export function getSegmentedInactiveClass(
  accent: SegmentedAccent = 'brand',
  style: SegmentedStyle = 'solid',
): string {
  if (style === 'pill') {
    return uiTokens.segmented.pillInactive[accent]
  }

  return uiTokens.segmented.buttonInactive
}

export function getSegmentedActiveClass(
  accent: SegmentedAccent = 'brand',
  style: SegmentedStyle = 'solid',
): string {
  if (style === 'pill') {
    return uiTokens.segmented.pillActive[accent]
  }

  return uiTokens.segmented.buttonActive[accent]
}

export function getMarkerDotClass(insightType?: InsightType): string {
  if (!insightType) return uiTokens.marker.dotDefault
  return markerDotByType[insightType] || uiTokens.marker.dotDefault
}

export function getMarkerIconClass(insightType?: InsightType): string {
  if (!insightType) return uiTokens.marker.iconDefault
  return markerIconByType[insightType] || uiTokens.marker.iconDefault
}

export function getChipClass(
  variant: ChipVariant = 'neutral',
  size: ChipSize = 'sm',
): string {
  return `${uiTokens.chip.base} ${uiTokens.chip.variant[variant]} ${uiTokens.chip.size[size]}`
}

export function getSwitchTrackClass(isEnabled: boolean): string {
  return isEnabled ? uiTokens.controls.switch.trackOn : uiTokens.controls.switch.trackOff
}

export function getSwitchThumbClass(isEnabled: boolean): string {
  return isEnabled ? uiTokens.controls.switch.thumbOn : uiTokens.controls.switch.thumbOff
}

export function getElevationClass(level: ElevationLevel = 'surface'): string {
  return uiTokens.elevation[level]
}
