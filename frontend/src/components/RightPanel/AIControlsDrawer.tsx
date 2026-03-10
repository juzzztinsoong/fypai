/**
 * AIControlsDrawer — Expandable footer for the RightPanel
 * 
 * Collapsed: Master AI toggle + gear button to expand
 * Expanded:  All the above + full AgentSettingsPanel (personality, proactivity,
 *            response length, model tier segment pickers)
 * 
 * Replaces the old separate AIToggle footer and the
 * sidebar-hosted SettingsModal, consolidating all AI controls in one place.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AgentPreferencesDTO, AgentPersonality, AgentProactivity, AgentResponseLength, AgentModelTier } from '@fypai/types'
import { getAgentPreferences, updateAgentPreferences, resetAgentPreferences } from '@/services/agentPreferencesService'
import { RuleTogglePanel } from './RuleTogglePanel'
import { getSegmentedActiveClass, getSwitchThumbClass, getSwitchTrackClass, uiTokens } from '@/styles/uiTokens'

// ─── Types ──────────────────────────────────────────────────

interface AIControlsDrawerProps {
  teamId: string
  isAIEnabled: boolean
  onToggleAI: () => void
  integrated?: boolean
}

// ─── Compact Segment Picker ─────────────────────────────────

interface PickerOption<T extends string> {
  value: T
  label: string
  emoji: string
}

function CompactPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: PickerOption<T>[]
  value: T
  onChange: (v: T) => void
}) {
  const activeClass = `${getSegmentedActiveClass('brand')} shadow-sm ring-1 ring-indigo-200`

  return (
    <div className="space-y-1">
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="flex bg-slate-100 rounded-md p-0.5 gap-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
              value === opt.value
                ? activeClass
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
            title={opt.label}
          >
            <span className="mr-0.5">{opt.emoji}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export const AIControlsDrawer = ({ teamId, isAIEnabled, onToggleAI, integrated = false }: AIControlsDrawerProps) => {
  const [expanded, setExpanded] = useState(false)
  const [showRules, setShowRules] = useState(false)

  // ── Agent Preferences state ────────────────────────────
  const [prefs, setPrefs] = useState<AgentPreferencesDTO | null>(null)
  const [prefsLoading, setPrefsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load prefs when drawer expands or team changes
  useEffect(() => {
    if (!expanded) return
    let cancelled = false
    const load = async () => {
      setPrefsLoading(true)
      try {
        const p = await getAgentPreferences(teamId)
        if (!cancelled) setPrefs(p)
      } catch {
        // Silently fail — user still has toggle + base controls
      } finally {
        if (!cancelled) setPrefsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [teamId, expanded])

  // Cleanup save timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const debouncedSave = useCallback(
    (updates: Partial<AgentPreferencesDTO>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      setSaving(true)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const updated = await updateAgentPreferences(teamId, updates)
          setPrefs(updated)
          setLastSaved(new Date().toLocaleTimeString())
        } catch { /* ignore */ }
        finally { setSaving(false) }
      }, 500)
    },
    [teamId],
  )

  const handlePrefChange = <K extends keyof AgentPreferencesDTO>(key: K, value: AgentPreferencesDTO[K]) => {
    if (!prefs) return
    setPrefs({ ...prefs, [key]: value })
    debouncedSave({ [key]: value })
  }

  const handleReset = async () => {
    setSaving(true)
    try {
      await resetAgentPreferences(teamId)
      const fresh = await getAgentPreferences(teamId)
      setPrefs(fresh)
      setLastSaved(new Date().toLocaleTimeString())
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  return (
    <div className={`relative flex-shrink-0 bg-white ${integrated ? '' : 'border-t border-gray-200'}`}>
      {/* ── Always-visible row: AI toggle + expand ── */}
      <div className={`${uiTokens.layout.railFooterRow} px-4 flex items-center ${integrated ? 'border-t border-gray-100' : ''}`}>
        {/* Top row: Toggle + gear */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onToggleAI}
              className={`${uiTokens.controls.switch.base} ${getSwitchTrackClass(isAIEnabled)}`}
              role="switch"
              aria-checked={isAIEnabled}
              aria-label="Toggle AI Assistant"
            >
              <span
                className={`${uiTokens.controls.switch.thumbBase} ${getSwitchThumbClass(isAIEnabled)}`}
              />
            </button>
            <span className="text-xs font-medium text-gray-700">
              AI {isAIEnabled ? 'Active' : 'Off'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Save status */}
            {saving && <span className="text-[10px] text-indigo-500 animate-pulse">Saving...</span>}
            {lastSaved && !saving && <span className="text-[10px] text-emerald-500">✓</span>}

            {/* Expand / Collapse button */}
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title={expanded ? 'Collapse settings' : 'Expand settings'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <svg
                className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Expandable Settings Drawer ── */}
      {expanded && (
        <div
          className={
            integrated
              ? 'absolute inset-x-4 bottom-full z-30 mb-2 rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-3 shadow-xl shadow-slate-900/10 max-h-[40vh] overflow-y-auto'
              : 'border-t border-gray-100 px-4 py-3 space-y-3 max-h-[40vh] overflow-y-auto'
          }
        >
          {prefsLoading ? (
            <div className="flex items-center justify-center py-4 text-gray-400 text-xs">
              <svg className="animate-spin h-4 w-4 mr-1.5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading settings...
            </div>
          ) : prefs ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Agent Behavior</span>
                <button
                  onClick={handleReset}
                  className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                >
                  Reset
                </button>
              </div>

              <CompactPicker<AgentPersonality>
                label="Personality"
                options={[
                  { value: 'formal', label: 'Formal', emoji: '👔' },
                  { value: 'balanced', label: 'Balanced', emoji: '⚖️' },
                  { value: 'casual', label: 'Casual', emoji: '😊' },
                ]}
                value={prefs.personality}
                onChange={(v) => handlePrefChange('personality', v)}
              />

              <CompactPicker<AgentProactivity>
                label="Proactivity"
                options={[
                  { value: 'silent', label: 'Silent', emoji: '🤫' },
                  { value: 'helpful', label: 'Helpful', emoji: '💡' },
                  { value: 'proactive', label: 'Proactive', emoji: '🚀' },
                ]}
                value={prefs.proactivity}
                onChange={(v) => handlePrefChange('proactivity', v)}
              />

              <CompactPicker<AgentResponseLength>
                label="Response Length"
                options={[
                  { value: 'concise', label: 'Concise', emoji: '📌' },
                  { value: 'balanced', label: 'Balanced', emoji: '📝' },
                  { value: 'detailed', label: 'Detailed', emoji: '📖' },
                ]}
                value={prefs.responseLength}
                onChange={(v) => handlePrefChange('responseLength', v)}
              />

              <CompactPicker<AgentModelTier>
                label="Model"
                options={[
                  { value: 'auto', label: 'Auto', emoji: '⚡' },
                  { value: 'tier1', label: 'Fast', emoji: '🏎️' },
                  { value: 'tier2', label: 'Smart', emoji: '🧠' },
                ]}
                value={prefs.modelTierOverride}
                onChange={(v) => handlePrefChange('modelTierOverride', v)}
              />

              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => setShowRules(prev => !prev)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Chime Rules</span>
                  <svg
                    className={`w-3 h-3 text-gray-500 transition-transform ${showRules ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showRules && (
                  <div className="mt-2">
                    <RuleTogglePanel teamId={teamId} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">Unable to load settings</p>
          )}
        </div>
      )}
    </div>
  )
}
