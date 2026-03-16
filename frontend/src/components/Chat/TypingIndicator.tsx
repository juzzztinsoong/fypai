/**
 * TypingIndicator Component
 * 
 * Displays animated "..." when users are typing.
 * Matches message bubble styling and positioning
 * 
 * Props:
 * - userNames: string[] - Names of users currently typing (left-aligned)
 * - isAgentTyping: retained for compatibility, ignored
 * - aiStage: retained for compatibility, ignored
 * 
 * Visual:
 * - Users: Left-aligned with gray bubble and avatar placeholder
 */

import { getElevationClass } from '@/styles/uiTokens'

interface TypingIndicatorProps {
  userNames: string[]
  isAgentTyping?: boolean
  aiStage?: 'thinking' | 'searching-memory' | 'analyzing' | 'idle'
}

export const TypingIndicator = ({ userNames, isAgentTyping, aiStage = 'idle' }: TypingIndicatorProps) => {
  void isAgentTyping
  void aiStage

  if (userNames.length === 0) {
    return null
  }

  const getUserMessage = () => {
    if (userNames.length === 1) {
      return `${userNames[0]} is typing`
    }

    if (userNames.length === 2) {
      return `${userNames[0]} and ${userNames[1]} are typing`
    }

    return `${userNames[0]}, ${userNames[1]}, and ${userNames.length - 2} ${userNames.length - 2 === 1 ? 'other' : 'others'} are typing`
  }

  // Animated dots component
  const AnimatedDots = () => (
    <div className="flex gap-1">
      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
    </div>
  )

  // User typing indicator (left-aligned, gray)
  return (
    <div className="flex justify-start">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
          <span className="text-xs text-gray-600">...</span>
        </div>
        <div className="flex flex-col items-start">
          <span className="text-xs text-gray-500 mb-1">{userNames.length > 1 ? 'Multiple users' : userNames[0]}</span>
          <div className={`border border-slate-300 bg-slate-50 text-slate-700 rounded-xl px-3 py-2 ${getElevationClass('surface')} flex items-center gap-2`}>
            <span className="text-sm">{getUserMessage()}</span>
            <AnimatedDots />
          </div>
        </div>
      </div>
    </div>
  )
}
