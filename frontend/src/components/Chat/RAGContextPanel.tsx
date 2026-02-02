/**
 * RAGContextPanel Component
 * 
 * Phase 6.5.1: RAG Context Viewer
 * Shows the context retrieved via RAG (Retrieval-Augmented Generation)
 * that was used to generate an AI response.
 * 
 * Features:
 * - Expandable panel showing retrieved messages
 * - Relevance scores with visual indicators
 * - Timestamps and author information
 * - "Why this context?" tooltip
 * 
 * Tech Stack: React, Tailwind CSS
 */

import { useState } from 'react'
import type { RAGContextItem } from '@fypai/types'

interface RAGContextPanelProps {
  ragContext?: RAGContextItem[]
  className?: string
}

export const RAGContextPanel = ({ 
  ragContext, 
  className = '' 
}: RAGContextPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!ragContext || ragContext.length === 0) {
    return null
  }

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Get relevance color based on score
  const getRelevanceColor = (score: number): string => {
    if (score >= 0.9) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 0.8) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
    if (score >= 0.7) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-orange-600 bg-orange-50 border-orange-200'
  }

  return (
    <div className={`mt-1 ${className}`}>
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors"
        title="View context used to generate this response"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span>Context Used ({ragContext.length})</span>
        <svg 
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded context list */}
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {/* Why this context tooltip */}
          <div className="text-[9px] text-gray-400 italic px-2">
            💡 These messages were retrieved based on semantic similarity to your question
          </div>
          
          {ragContext.map((item, index) => (
            <div 
              key={item.messageId || index}
              className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-[10px]"
            >
              {/* Header: Author, Time, Relevance */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-indigo-700">
                    {item.authorName || item.authorId}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-medium ${getRelevanceColor(item.relevanceScore)}`}>
                  {(item.relevanceScore * 100).toFixed(0)}% match
                </span>
              </div>
              
              {/* Content */}
              <p className="text-gray-700 leading-relaxed">
                {item.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
