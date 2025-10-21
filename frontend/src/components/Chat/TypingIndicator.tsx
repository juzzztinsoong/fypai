/**
 * TypingIndicator Component
 * 
 * Displays animated "..." when users or AI are typing/generating
 * Matches message bubble styling and positioning
 * 
 * Props:
 * - userNames: string[] - Names of users currently typing (left-aligned)
 * - isAgentTyping: boolean - Whether AI agent is generating (center-aligned)
 * 
 * Visual:
 * - Users: Left-aligned with gray bubble and avatar placeholder
 * - Agent: Center-aligned with purple bubble and AI icon
 */

interface TypingIndicatorProps {
  userNames: string[]
  isAgentTyping?: boolean
}

export const TypingIndicator = ({ userNames, isAgentTyping }: TypingIndicatorProps) => {
  if (!isAgentTyping && userNames.length === 0) {
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

  // Agent typing indicator (center-aligned, purple)
  if (isAgentTyping) {
    return (
      <div className="flex justify-center">
        <div className="flex flex-col items-center">
          <span className="text-xs text-purple-700 mb-1 font-bold">AI Assistant</span>
          <div className="bg-purple-100 border-2 border-purple-500 text-purple-700 rounded-xl px-4 py-2 shadow-sm flex items-center gap-2">
            <span className="text-sm font-medium">Generating response</span>
            <AnimatedDots />
          </div>
          <div className="mt-2">
            <svg className="w-8 h-8 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#fff">AI</text>
            </svg>
          </div>
        </div>
      </div>
    )
  }

  // User typing indicator (left-aligned, gray)
  return (
    <div className="flex justify-start">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
          <span className="text-xs text-gray-600">...</span>
        </div>
        <div className="flex flex-col items-start">
          <span className="text-xs text-gray-500 mb-1">{userNames.length > 1 ? 'Multiple users' : userNames[0]}</span>
          <div className="border-2 border-gray-300 bg-gray-50 text-gray-600 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-sm">{getUserMessage()}</span>
            <AnimatedDots />
          </div>
        </div>
      </div>
    </div>
  )
}
