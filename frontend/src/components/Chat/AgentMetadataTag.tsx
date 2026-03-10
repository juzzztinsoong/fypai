/**
 * AgentMetadataTag Component
 * 
 * Phase 6.5.1: Response Metadata Display
 * Shows AI agent execution details below agent messages:
 * - Model used (e.g., "gpt-4o-mini" or "gpt-4o")
 * - Tier (1 = Fast/Cheap, 2 = Smart/Expensive)
 * - Response latency (if available)
 * - Tokens used (input/output)
 * - Cost estimate
 * - Triggered rule name (if chime/autonomous)
 * 
 * Tech Stack: React, Tailwind CSS
 */

import { useState } from 'react'
import type { AgentMetadata, MessageMetadata } from '@fypai/types'
import { getChipClass, type ChipVariant } from '@/styles/uiTokens'

interface AgentMetadataTagProps {
  agentMetadata?: AgentMetadata
  messageMetadata?: MessageMetadata
  className?: string
}

export const AgentMetadataTag = ({ 
  agentMetadata, 
  messageMetadata,
  className = '' 
}: AgentMetadataTagProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!agentMetadata) {
    return null
  }

  const { model, tier, tokensUsed, cost, confidence } = agentMetadata
  const chimeRuleName = messageMetadata?.chimeRuleName
  // Use confidence from agentMetadata if available, fallback to messageMetadata
  const confidenceScore = confidence ?? messageMetadata?.confidence
  const totalTokens = tokensUsed.input + tokensUsed.output

  // Format model name for display
  const displayModel = model?.replace('gpt-4o-', '4o-') || 'unknown'
  
  // Format cost
  const formattedCost = cost < 0.0001 
    ? '<$0.0001' 
    : `$${cost.toFixed(4)}`

  // Tier display
  const tierDisplay = tier === 'tier1' 
    ? { label: 'Fast', icon: '⚡', variant: 'success' as ChipVariant }
    : { label: 'Smart', icon: '🧠', variant: 'brand' as ChipVariant }

  const confidenceValueClassByVariant: Record<ChipVariant, string> = {
    brand: 'text-indigo-700',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-rose-700',
    neutral: 'text-slate-700',
    muted: 'text-slate-500',
  }

  // Confidence display
  const getConfidenceDisplay = (score: number) => {
    if (score >= 0.8) return { label: 'High', variant: 'success' as ChipVariant, icon: '✓' }
    if (score >= 0.5) return { label: 'Med', variant: 'warning' as ChipVariant, icon: '~' }
    return { label: 'Low', variant: 'danger' as ChipVariant, icon: '?' }
  }

  const confidenceDisplay =
    confidenceScore !== undefined ? getConfidenceDisplay(confidenceScore) : undefined
  const confidencePercent =
    confidenceScore !== undefined ? (confidenceScore * 100).toFixed(0) : null

  return (
    <div className={`mt-2 ${className}`}>
      {/* Collapsed view - just a small toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
        title="Show AI details"
      >
        <span className="font-mono">{displayModel}</span>
        <span className={getChipClass(tierDisplay.variant, 'xs')}>
          {tierDisplay.icon} {tierDisplay.label}
        </span>
        {confidenceDisplay && (
          <span className={getChipClass(confidenceDisplay.variant, 'xs')}>
            {confidenceDisplay.icon} {confidenceDisplay.label}
          </span>
        )}
        {chimeRuleName && (
          <span className={getChipClass('warning', 'xs')}>
            🔔 Chime
          </span>
        )}
        <svg 
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded view - full details */}
      {isExpanded && (
        <div className="mt-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-600 space-y-1">
          {/* Model & Tier */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Model:</span>
            <span className="font-mono">{model}</span>
          </div>
          
          {/* Tokens */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Tokens:</span>
            <span>
              <span className="text-indigo-600">{tokensUsed.input} in</span>
              {' → '}
              <span className="text-emerald-600">{tokensUsed.output} out</span>
              {' = '}
              <span className="font-semibold">{totalTokens} total</span>
            </span>
          </div>
          
          {/* Cost */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-500">Cost:</span>
            <span className={cost > 0.01 ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
              {formattedCost}
            </span>
          </div>

          {/* Confidence (if available) */}
          {confidenceDisplay && confidencePercent !== null && (
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-500">Confidence:</span>
              <span className={`font-medium ${confidenceValueClassByVariant[confidenceDisplay.variant]}`}>
                {confidencePercent}% ({confidenceDisplay.label})
              </span>
            </div>
          )}

          {/* Triggered Rule (if chime) */}
          {chimeRuleName && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="font-medium text-slate-500">Triggered by:</span>
              <span className="text-amber-600 font-medium">{chimeRuleName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
