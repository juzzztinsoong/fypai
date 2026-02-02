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
    ? { label: 'Fast', icon: '⚡', color: 'text-green-600 bg-green-50 border-green-200' }
    : { label: 'Smart', icon: '🧠', color: 'text-blue-600 bg-blue-50 border-blue-200' }

  // Confidence display
  const getConfidenceDisplay = (score: number) => {
    if (score >= 0.8) return { label: 'High', color: 'text-green-600 bg-green-50 border-green-200', icon: '✓' }
    if (score >= 0.5) return { label: 'Med', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: '~' }
    return { label: 'Low', color: 'text-red-600 bg-red-50 border-red-200', icon: '?' }
  }

  return (
    <div className={`mt-2 ${className}`}>
      {/* Collapsed view - just a small toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
        title="Show AI details"
      >
        <span className="font-mono">{displayModel}</span>
        <span className={`px-1 py-0.5 rounded border ${tierDisplay.color} text-[9px]`}>
          {tierDisplay.icon} {tierDisplay.label}
        </span>
        {confidenceScore !== undefined && (
          <span className={`px-1 py-0.5 rounded border ${getConfidenceDisplay(confidenceScore).color} text-[9px]`}>
            {getConfidenceDisplay(confidenceScore).icon} {getConfidenceDisplay(confidenceScore).label}
          </span>
        )}
        {chimeRuleName && (
          <span className="px-1 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200 text-[9px]">
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
        <div className="mt-1.5 p-2 rounded-lg bg-gray-50 border border-gray-200 text-[10px] text-gray-600 space-y-1">
          {/* Model & Tier */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-500">Model:</span>
            <span className="font-mono">{model}</span>
          </div>
          
          {/* Tokens */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-500">Tokens:</span>
            <span>
              <span className="text-blue-600">{tokensUsed.input} in</span>
              {' → '}
              <span className="text-green-600">{tokensUsed.output} out</span>
              {' = '}
              <span className="font-semibold">{totalTokens} total</span>
            </span>
          </div>
          
          {/* Cost */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-500">Cost:</span>
            <span className={cost > 0.01 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
              {formattedCost}
            </span>
          </div>

          {/* Confidence (if available) */}
          {confidenceScore !== undefined && (
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-500">Confidence:</span>
              <span className={`font-medium ${getConfidenceDisplay(confidenceScore).color.split(' ')[0]}`}>
                {(confidenceScore * 100).toFixed(0)}% ({getConfidenceDisplay(confidenceScore).label})
              </span>
            </div>
          )}

          {/* Triggered Rule (if chime) */}
          {chimeRuleName && (
            <div className="flex items-center justify-between pt-1 border-t border-gray-200">
              <span className="font-medium text-gray-500">Triggered by:</span>
              <span className="text-orange-600 font-medium">{chimeRuleName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
