/**
 * SettingsModal
 * 
 * Phase 6.5.2: Main settings overlay with tabbed navigation
 * 
 * Tabs:
 *   - Agent: Personality, proactivity, response length, model tier (AgentSettingsPanel)
 *   - Rules: Chime rule toggle dashboard (RuleTogglePanel)
 * 
 * Opens as a full-screen overlay accessible from the sidebar gear icon.
 */

import { useState, useEffect, useCallback } from 'react'
import { AgentSettingsPanel } from './AgentSettingsPanel'
import { RuleTogglePanel } from './RuleTogglePanel'

interface SettingsModalProps {
  teamId: string
  isOpen: boolean
  onClose: () => void
}

type SettingsTab = 'agent' | 'rules'

const TABS: { id: SettingsTab; label: string; emoji: string }[] = [
  { id: 'agent', label: 'Agent', emoji: '🤖' },
  { id: 'rules', label: 'Rules', emoji: '📋' },
]

export const SettingsModal = ({ teamId, isOpen, onClose }: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('agent')

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">⚙️ Team Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-1.5">{tab.emoji}</span>
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {activeTab === 'agent' && <AgentSettingsPanel teamId={teamId} />}
          {activeTab === 'rules' && <RuleTogglePanel teamId={teamId} />}
        </div>
      </div>
    </div>
  )
}
