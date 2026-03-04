const LINK_PALETTES = [
  {
    marker: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
    pill: 'border-sky-200 bg-sky-100 text-sky-700',
    dot: 'bg-sky-500',
  },
  {
    marker: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
    pill: 'border-violet-200 bg-violet-100 text-violet-700',
    dot: 'bg-violet-500',
  },
  {
    marker: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    pill: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  {
    marker: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
    pill: 'border-amber-200 bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  {
    marker: 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100',
    pill: 'border-pink-200 bg-pink-100 text-pink-700',
    dot: 'bg-pink-500',
  },
] as const

function hashInsightId(insightId: string): number {
  let hash = 0
  for (let index = 0; index < insightId.length; index += 1) {
    hash = (hash * 31 + insightId.charCodeAt(index)) >>> 0
  }
  return hash
}

export function getLinkVisuals(insightId?: string) {
  if (!insightId) {
    return {
      marker: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
      pill: 'border-indigo-200 bg-indigo-100 text-indigo-700',
      dot: 'bg-indigo-500',
    }
  }

  const palette = LINK_PALETTES[hashInsightId(insightId) % LINK_PALETTES.length]
  return palette
}
