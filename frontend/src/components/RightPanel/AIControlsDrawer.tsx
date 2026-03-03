/**
 * AIControlsDrawer — Expandable footer for the RightPanel
 * 
 * Collapsed: Master AI toggle + gear button to expand + action buttons row
 * Expanded:  All the above + full AgentSettingsPanel (personality, proactivity,
 *            response length, model tier segment pickers)
 * 
 * Replaces the old separate AIToggle + ActionButtons footer and the
 * sidebar-hosted SettingsModal, consolidating all AI controls in one place.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AgentPreferencesDTO, AgentPersonality, AgentProactivity, AgentResponseLength, AgentModelTier } from '@fypai/types'
import { getAgentPreferences, updateAgentPreferences, resetAgentPreferences } from '@/services/agentPreferencesService'
import { useEntityStore } from '@/stores/entityStore'
import * as insightService from '@/services/insightService'
import { RuleTogglePanel } from './RuleTogglePanel'

// ─── Types ──────────────────────────────────────────────────

interface AIControlsDrawerProps {
  teamId: string
  isAIEnabled: boolean
  onToggleAI: () => void
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
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="flex bg-gray-100 rounded-md p-0.5 gap-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
              value === opt.value
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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

export const AIControlsDrawer = ({ teamId, isAIEnabled, onToggleAI }: AIControlsDrawerProps) => {
  const [expanded, setExpanded] = useState(false)
  const [showRules, setShowRules] = useState(false)

  // ── Agent Preferences state ────────────────────────────
  const [prefs, setPrefs] = useState<AgentPreferencesDTO | null>(null)
  const [prefsLoading, setPrefsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Action Buttons state ───────────────────────────────
  const currentTeam = useEntityStore((state) => teamId ? state.getTeam(teamId) : null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)

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
        // Silently fail — user still has toggle + action buttons
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

  // ── Action Button handlers ─────────────────────────────
  const isGenerating = loadingSummary || loadingReport

  const handleGenerateSummary = async () => {
    if (!currentTeam || isGenerating) return
    setLoadingSummary(true)
    try {
      await insightService.generateSummary(currentTeam.id)
    } catch (err) {
      console.error('Failed to generate summary:', err)
    } finally {
      setLoadingSummary(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!currentTeam || isGenerating) return
    setLoadingReport(true)
    try {
      await insightService.generateReport(currentTeam.id)
    } catch (err) {
      console.error('Failed to generate report:', err)
    } finally {
      setLoadingReport(false)
    }
  }

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white">
      {/* ── Always-visible row: AI toggle + expand + action buttons ── */}
      <div className="px-4 py-3">
        {/* Top row: Toggle + gear */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onToggleAI}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                isAIEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 hover:bg-gray-400'
              }`}
              role="switch"
              aria-checked={isAIEnabled}
              aria-label="Toggle AI Assistant"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                  isAIEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                } mt-0.5`}
              />
            </button>
            <span className="text-xs font-medium text-gray-700">
              AI {isAIEnabled ? 'Active' : 'Off'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Save status */}
            {saving && <span className="text-[10px] text-blue-500 animate-pulse">Saving...</span>}
            {lastSaved && !saving && <span className="text-[10px] text-green-500">✓</span>}

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

        {/* Action Buttons Row — always visible */}
        <div className="flex gap-1.5">
          <button
            onClick={handleGenerateSummary}
            disabled={isGenerating}
            className="flex-1 h-10 flex items-center justify-center gap-1.5 px-2 rounded-md text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span>{loadingSummary ? '⏳' : '📝'}</span>
            <span>{loadingSummary ? '...' : 'Summary'}</span>
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="flex-1 h-10 flex items-center justify-center gap-1.5 px-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span>{loadingReport ? '⏳' : '📊'}</span>
            <span>{loadingReport ? '...' : 'Report'}</span>
          </button>
        </div>
      </div>

      {/* ── Expandable Settings Drawer ── */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 max-h-[40vh] overflow-y-auto">
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
