/**
 * RuleTogglePanel — Integrated into RightPanel
 * 
 * Chime rule management grouped by the insight type each rule produces.
 * Rules that generate "action" insights appear under a purple-accented group,
 * "suggestion" rules under orange, "summary" under blue, and chat-only rules
 * under a gray group. This visual linkage lets users see exactly which rules
 * feed which tab (Actions / Suggestions / Summaries).
 * 
 * Endpoints used:
 *   GET   /api/chime/teams/:teamId/rules
 *   PATCH /api/chime/rules/:ruleId/toggle   (inverts enabled server-side)
 *   PATCH /api/chime/rules/:ruleId           (cooldown update)
 */

import { useState, useEffect, useCallback } from 'react'
import { api, getErrorMessage } from '@/services/api'

// ─── Types ──────────────────────────────────────────────────

interface ChimeRule {
  id: string
  name: string
  description: string | null
  type: string       // 'pattern' | 'semantic' | 'intent' | 'schedule'
  execution: string  // 'sync' | 'async'
  enabled: boolean
  priority: number   // 0-100
  cooldownMinutes: number
  teamId: string | null
  action: { type: string; insightType?: string; template: string }
}

interface RuleTogglePanelProps {
  teamId: string
}

// ─── Insight Category Styling ───────────────────────────────

interface CategoryConfig {
  key: string
  label: string
  emoji: string
  accent: string          // border + heading color
  badgeBg: string
  badgeText: string
  match: (rule: ChimeRule) => boolean
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'action',
    label: 'Action Rules',
    emoji: '✅',
    accent: 'border-purple-200',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    match: (r) => r.action?.type === 'insight' && r.action?.insightType === 'action',
  },
  {
    key: 'suggestion',
    label: 'Suggestion Rules',
    emoji: '💡',
    accent: 'border-orange-200',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    match: (r) => r.action?.type === 'insight' && r.action?.insightType === 'suggestion',
  },
  {
    key: 'summary',
    label: 'Summary Rules',
    emoji: '📊',
    accent: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    match: (r) => r.action?.type === 'insight' && r.action?.insightType === 'summary',
  },
  {
    key: 'chat',
    label: 'Chat Response Rules',
    emoji: '💬',
    accent: 'border-gray-200',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-600',
    match: (r) => r.action?.type === 'chat_message',
  },
]

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pattern:  { bg: 'bg-violet-50',  text: 'text-violet-600', label: 'Pattern' },
  semantic: { bg: 'bg-teal-50',    text: 'text-teal-600',   label: 'Semantic' },
  intent:   { bg: 'bg-amber-50',   text: 'text-amber-600',  label: 'Intent' },
  schedule: { bg: 'bg-sky-50',     text: 'text-sky-600',    label: 'Schedule' },
  hybrid:   { bg: 'bg-pink-50',    text: 'text-pink-600',   label: 'Hybrid' },
  threshold:{ bg: 'bg-lime-50',    text: 'text-lime-600',   label: 'Threshold' },
}

// ─── Main Component ─────────────────────────────────────────

export const RuleTogglePanel = ({ teamId }: RuleTogglePanelProps) => {
  const [rules, setRules] = useState<ChimeRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // Load rules on mount / team change
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await api.get(`/chime/teams/${teamId}/rules`)
        const data = Array.isArray(response.data) ? response.data : response.data?.data || []
        setRules(data)
      } catch (err) {
        setError('Failed to load chime rules')
        console.error('[RuleTogglePanel] Load error:', getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [teamId])

  // Toggle — backend inverts enabled when no body is sent
  const handleToggle = useCallback(async (ruleId: string) => {
    // Optimistic update
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ))
    setTogglingIds(prev => new Set(prev).add(ruleId))
    try {
      const res = await api.patch(`/chime/rules/${ruleId}/toggle`)
      const updated = res.data?.data || res.data
      // Reconcile with server truth
      setRules(prev => prev.map(r =>
        r.id === ruleId ? { ...r, enabled: updated.enabled } : r
      ))
    } catch (err) {
      // Revert optimistic update
      setRules(prev => prev.map(r =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ))
      console.error('[RuleTogglePanel] Toggle error:', getErrorMessage(err))
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(ruleId)
        return next
      })
    }
  }, [])

  // Cooldown update
  const handleCooldownChange = useCallback(async (ruleId: string, cooldownMinutes: number) => {
    try {
      await api.patch(`/chime/rules/${ruleId}`, { cooldownMinutes })
      setRules(prev => prev.map(r =>
        r.id === ruleId ? { ...r, cooldownMinutes } : r
      ))
    } catch (err) {
      console.error('[RuleTogglePanel] Cooldown error:', getErrorMessage(err))
    }
  }, [])

  // ─── Render states ──────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading rules...
      </div>
    )
  }

  if (error) {
    return <div className="py-6 text-center text-red-500 text-sm">{error}</div>
  }

  if (rules.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        No chime rules configured for this team.
      </div>
    )
  }

  const enabledCount = rules.filter(r => r.enabled).length

  // ─── Group rules into categories ────────────────────────

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    rules: rules
      .filter(cat.match)
      .sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
        return b.priority - a.priority
      }),
  })).filter(g => g.rules.length > 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Chime Rules
        </span>
        <span className="text-xs text-gray-400">
          {enabledCount}/{rules.length} active
        </span>
      </div>

      {/* Grouped rule list */}
      {grouped.map(group => (
        <div key={group.key} className={`border rounded-lg overflow-hidden ${group.accent}`}>
          {/* Group header */}
          <div className={`px-3 py-2 ${group.badgeBg} flex items-center justify-between`}>
            <span className={`text-xs font-semibold ${group.badgeText} flex items-center gap-1.5`}>
              <span>{group.emoji}</span> {group.label}
            </span>
            <span className={`text-[10px] ${group.badgeText}`}>
              {group.rules.filter(r => r.enabled).length}/{group.rules.length}
            </span>
          </div>

          {/* Rules in group */}
          <div className="divide-y divide-gray-100">
            {group.rules.map(rule => {
              const badge = TYPE_BADGE[rule.type] || TYPE_BADGE.pattern
              const toggling = togglingIds.has(rule.id)

              return (
                <div
                  key={rule.id}
                  className={`px-3 py-2.5 transition-opacity ${
                    rule.enabled ? '' : 'opacity-50'
                  }`}
                >
                  {/* Row 1: Name + Toggle */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className={`shrink-0 inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs font-medium text-gray-700 truncate">
                        {rule.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggle(rule.id)}
                      disabled={toggling}
                      className={`shrink-0 relative inline-flex h-[18px] w-8 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                        rule.enabled ? 'bg-blue-600' : 'bg-gray-200'
                      } ${toggling ? 'opacity-50 cursor-wait' : ''}`}
                      role="switch"
                      aria-checked={rule.enabled}
                      aria-label={`Toggle ${rule.name}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
                          rule.enabled ? 'translate-x-3.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Row 2: Description */}
                  {rule.description && (
                    <p className="mt-0.5 text-[10px] text-gray-400 leading-snug">
                      {rule.description}
                    </p>
                  )}

                  {/* Row 3: Metadata (only when enabled) */}
                  {rule.enabled && (
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-400">
                      <span>{rule.execution === 'async' ? '⏳ Async' : '⚡ Sync'}</span>
                      <span className="text-gray-200">•</span>
                      <div className="flex items-center gap-1">
                        <span>⏱️</span>
                        <select
                          value={rule.cooldownMinutes}
                          onChange={(e) => handleCooldownChange(rule.id, parseInt(e.target.value))}
                          className="bg-transparent border-b border-gray-200 text-gray-500 text-[10px] focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value={0}>No cooldown</option>
                          <option value={5}>5m</option>
                          <option value={10}>10m</option>
                          <option value={15}>15m</option>
                          <option value={20}>20m</option>
                          <option value={30}>30m</option>
                          <option value={60}>1h</option>
                          <option value={120}>2h</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
