/**
 * RuleTogglePanel
 * 
 * Phase 6.5.2: UI for enabling/disabling individual chime rules per team
 * 
 * Features:
 *   - Lists all chime rules with descriptions
 *   - Toggle switch for each rule
 *   - Cooldown adjustment
 *   - Shows rule type badge (pattern, semantic, intent)
 * 
 * Uses existing backend endpoints:
 *   GET  /api/chime/teams/:teamId/rules
 *   PATCH /api/chime/rules/:ruleId/toggle
 *   PATCH /api/chime/rules/:ruleId (for cooldown updates)
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
  priority: number
  cooldownMinutes: number
  teamId: string | null
}

interface RuleTogglePanelProps {
  teamId: string
}

// ─── Type Badge Colors ──────────────────────────────────────

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pattern:  { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Pattern' },
  semantic: { bg: 'bg-teal-100',   text: 'text-teal-700',   label: 'Semantic' },
  intent:   { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Intent' },
  schedule: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Schedule' },
}

const EXECUTION_LABELS: Record<string, string> = {
  sync: '⚡ Sync',
  async: '⏳ Async',
}

// ─── Main Component ─────────────────────────────────────────

export const RuleTogglePanel = ({ teamId }: RuleTogglePanelProps) => {
  const [rules, setRules] = useState<ChimeRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // Load rules on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await api.get<{ data: ChimeRule[] }>(
          `/chime/teams/${teamId}/rules`
        )
        // API may return { data: [...] } or just [...]
        const data = Array.isArray(response.data) ? response.data : response.data.data || []
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

  // Toggle a rule
  const handleToggle = useCallback(async (ruleId: string) => {
    setTogglingIds(prev => new Set(prev).add(ruleId))
    try {
      const response = await api.patch(`/chime/rules/${ruleId}/toggle`)
      const updatedRule = response.data.data || response.data
      setRules(prev =>
        prev.map(r => r.id === ruleId ? { ...r, enabled: updatedRule.enabled } : r)
      )
    } catch (err) {
      console.error('[RuleTogglePanel] Toggle error:', getErrorMessage(err))
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(ruleId)
        return next
      })
    }
  }, [])

  // Update cooldown
  const handleCooldownChange = useCallback(async (ruleId: string, cooldownMinutes: number) => {
    try {
      await api.patch(`/chime/rules/${ruleId}`, { cooldownMinutes })
      setRules(prev =>
        prev.map(r => r.id === ruleId ? { ...r, cooldownMinutes } : r)
      )
    } catch (err) {
      console.error('[RuleTogglePanel] Cooldown update error:', getErrorMessage(err))
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading rules...
      </div>
    )
  }

  if (error) {
    return <div className="py-4 text-center text-red-500 text-sm">{error}</div>
  }

  if (rules.length === 0) {
    return (
      <div className="py-6 text-center text-gray-400 text-sm">
        No chime rules configured for this team.
      </div>
    )
  }

  // Sort: enabled first, then by priority descending
  const sortedRules = [...rules].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    return b.priority - a.priority
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <span>📋</span> Chime Rules
        </h3>
        <span className="text-xs text-gray-400">
          {rules.filter(r => r.enabled).length}/{rules.length} active
        </span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {sortedRules.map((rule) => {
          const typeStyle = TYPE_STYLES[rule.type] || TYPE_STYLES.pattern
          const isToggling = togglingIds.has(rule.id)

          return (
            <div
              key={rule.id}
              className={`border rounded-lg p-3 transition-all duration-200 ${
                rule.enabled
                  ? 'border-gray-200 bg-white'
                  : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              {/* Rule Header: Name + Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                    {typeStyle.label}
                  </span>
                  <span className="text-xs font-medium text-gray-700 truncate">
                    {rule.name}
                  </span>
                </div>
                <button
                  onClick={() => handleToggle(rule.id)}
                  disabled={isToggling}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    rule.enabled ? 'bg-blue-600' : 'bg-gray-200'
                  } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={`Toggle ${rule.name}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      rule.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Description */}
              {rule.description && (
                <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                  {rule.description}
                </p>
              )}

              {/* Rule Details: Execution + Cooldown */}
              {rule.enabled && (
                <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">
                  <span>{EXECUTION_LABELS[rule.execution] || rule.execution}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <span>⏱️</span>
                    <select
                      value={rule.cooldownMinutes}
                      onChange={(e) => handleCooldownChange(rule.id, parseInt(e.target.value))}
                      className="bg-transparent border-b border-gray-200 text-gray-500 text-[10px] focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value={5}>5m cooldown</option>
                      <option value={10}>10m cooldown</option>
                      <option value={15}>15m cooldown</option>
                      <option value={30}>30m cooldown</option>
                      <option value={60}>1h cooldown</option>
                      <option value={120}>2h cooldown</option>
                    </select>
                  </div>
                  <span>•</span>
                  <span>Priority: {rule.priority}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
