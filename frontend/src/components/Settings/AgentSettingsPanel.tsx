/**
 * AgentSettingsPanel
 * 
 * Phase 6.5.2: Per-team AI agent behavior customization
 * 
 * Controls:
 *   - Personality: Formal ↔ Balanced ↔ Casual
 *   - Proactivity: Silent / Helpful / Proactive
 *   - Response Length: Concise / Balanced / Detailed
 *   - Model Tier: Auto / Tier 1 (Fast) / Tier 2 (Smart)
 * 
 * Loads preferences on mount, auto-saves on change with debounce.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AgentPreferencesDTO, AgentPersonality, AgentProactivity, AgentResponseLength, AgentModelTier } from '@fypai/types'
import { getAgentPreferences, updateAgentPreferences, resetAgentPreferences } from '@/services/agentPreferencesService'

interface AgentSettingsPanelProps {
  teamId: string
}

// ─── Segment Picker Component ───────────────────────────────

interface SegmentPickerProps<T extends string> {
  label: string
  description: string
  options: { value: T; label: string; emoji?: string }[]
  value: T
  onChange: (value: T) => void
}

function SegmentPicker<T extends string>({ label, description, options, value, onChange }: SegmentPickerProps<T>) {
  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-sm font-medium text-gray-700">{label}</h4>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
              value === option.value
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {option.emoji && <span className="mr-1">{option.emoji}</span>}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export const AgentSettingsPanel = ({ teamId }: AgentSettingsPanelProps) => {
  const [preferences, setPreferences] = useState<AgentPreferencesDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load preferences on mount or team change
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const prefs = await getAgentPreferences(teamId)
        setPreferences(prefs)
      } catch (err) {
        setError('Failed to load agent preferences')
        console.error('[AgentSettingsPanel] Load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [teamId])

  // Debounced save
  const debouncedSave = useCallback(
    (updates: Partial<AgentPreferencesDTO>) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      setSaving(true)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const updated = await updateAgentPreferences(teamId, updates)
          setPreferences(updated)
          setLastSaved(new Date().toLocaleTimeString())
          setError(null)
        } catch (err) {
          setError('Failed to save')
          console.error('[AgentSettingsPanel] Save error:', err)
        } finally {
          setSaving(false)
        }
      }, 500) // 500ms debounce
    },
    [teamId]
  )

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const handleChange = <K extends keyof AgentPreferencesDTO>(key: K, value: AgentPreferencesDTO[K]) => {
    if (!preferences) return
    const updated = { ...preferences, [key]: value }
    setPreferences(updated)
    debouncedSave({ [key]: value })
  }

  const handleReset = async () => {
    try {
      setSaving(true)
      await resetAgentPreferences(teamId)
      const freshPrefs = await getAgentPreferences(teamId)
      setPreferences(freshPrefs)
      setLastSaved(new Date().toLocaleTimeString())
      setError(null)
    } catch (err) {
      setError('Failed to reset')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading preferences...
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="py-4 text-center text-red-500 text-sm">
        {error || 'Unable to load preferences'}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <span>🤖</span> Agent Behavior
        </h3>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-blue-500 animate-pulse">Saving...</span>
          )}
          {lastSaved && !saving && (
            <span className="text-xs text-green-500">✓ Saved {lastSaved}</span>
          )}
          {error && (
            <span className="text-xs text-red-500">{error}</span>
          )}
        </div>
      </div>

      {/* Personality */}
      <SegmentPicker<AgentPersonality>
        label="Personality"
        description="Controls the tone and formality of AI responses"
        options={[
          { value: 'formal', label: 'Formal', emoji: '👔' },
          { value: 'balanced', label: 'Balanced', emoji: '⚖️' },
          { value: 'casual', label: 'Casual', emoji: '😊' },
        ]}
        value={preferences.personality}
        onChange={(v) => handleChange('personality', v)}
      />

      {/* Proactivity */}
      <SegmentPicker<AgentProactivity>
        label="Proactivity"
        description="How often the AI chimes in autonomously"
        options={[
          { value: 'silent', label: 'Silent', emoji: '🤫' },
          { value: 'helpful', label: 'Helpful', emoji: '💡' },
          { value: 'proactive', label: 'Proactive', emoji: '🚀' },
        ]}
        value={preferences.proactivity}
        onChange={(v) => handleChange('proactivity', v)}
      />

      {/* Response Length */}
      <SegmentPicker<AgentResponseLength>
        label="Response Length"
        description="Controls how verbose the AI responses are"
        options={[
          { value: 'concise', label: 'Concise', emoji: '📌' },
          { value: 'balanced', label: 'Balanced', emoji: '📝' },
          { value: 'detailed', label: 'Detailed', emoji: '📖' },
        ]}
        value={preferences.responseLength}
        onChange={(v) => handleChange('responseLength', v)}
      />

      {/* Model Tier */}
      <SegmentPicker<AgentModelTier>
        label="Model Tier"
        description="Force a specific AI model or let the system decide"
        options={[
          { value: 'auto', label: 'Auto', emoji: '⚡' },
          { value: 'tier1', label: 'Fast (Mini)', emoji: '🏎️' },
          { value: 'tier2', label: 'Smart (4o)', emoji: '🧠' },
        ]}
        value={preferences.modelTierOverride}
        onChange={(v) => handleChange('modelTierOverride', v)}
      />

      {/* Reset Button */}
      <div className="pt-2 border-t border-gray-100">
        <button
          onClick={handleReset}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Reset all to defaults
        </button>
      </div>
    </div>
  )
}
