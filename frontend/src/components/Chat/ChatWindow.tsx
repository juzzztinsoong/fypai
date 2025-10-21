import { useState, useRef, useCallback } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useCurrentTeam } from '../../stores/teamStore'
import { MessageList } from './MessageList'
import { ChatHeader } from './ChatHeader'
import { useUserStore } from '../../stores/userStore'
import { socketService } from '@/services/socketService'

/**
 * ChatWindow Component
 *
 * Tech Stack: React (Vite), Zustand for state, Tailwind CSS for styling
 * Patterns: Controlled input, state-driven UI, functional component
 * Requirements:
 *   - Display chat history for current team
 *   - Allow user to send messages (Enter key or button)
 *   - Validate non-empty input
 *   - Future: Support agent responses, file uploads, markdown
 *
 * Methods & Arguments:
 *   - ChatWindow(): No arguments. Uses Zustand stores for state.
 *     - Returns: JSX.Element (chat UI)
 *   - useState(newMessage): string - controlled textarea value
 *   - useTeamStore(): Returns currentTeam (Team)
 *   - useChatStore(): Returns addMessage(teamId, message)
 *   - handleSend(): No arguments. Sends message if valid
 *     - Creates Message object with id, teamId, authorId, content, etc.
 *     - Calls addMessage(teamId, message)
 *
 * Usage:
 *   - Used in main layout between Sidebar and RightPanel
 */

export const ChatWindow = () => {
  // newMessage: string - controlled textarea value
  const [newMessage, setNewMessage] = useState('')
  // currentTeam: Team | null - active team context
  const currentTeam = useCurrentTeam()
  // Use API method instead of direct mutation
  const sendMessage = useChatStore((state) => state.sendMessage)
  const { user } = useUserStore()
  
  // Track typing state to avoid spamming socket events
  const isTypingRef = useRef(false)
  const typingTimeoutRef = useRef<number | null>(null)

  // Send typing indicator (debounced)
  const handleTypingStart = useCallback(() => {
    if (!currentTeam || isTypingRef.current) return
    
    isTypingRef.current = true
    socketService.sendTypingIndicator(currentTeam.id, user.id, true)
    console.log('[ChatWindow] 👆 Typing started')
  }, [currentTeam, user.id])

  const handleTypingStop = useCallback(() => {
    if (!currentTeam || !isTypingRef.current) return
    
    isTypingRef.current = false
    socketService.sendTypingIndicator(currentTeam.id, user.id, false)
    console.log('[ChatWindow] 👇 Typing stopped')
  }, [currentTeam, user.id])

  // Handle input change with typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value)
    
    // Start typing if not already
    if (e.target.value.length > 0 && !isTypingRef.current) {
      handleTypingStart()
    }
    
    // Reset timeout - stop typing after 3s of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    if (e.target.value.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        handleTypingStop()
      }, 3000)
    } else {
      // Empty input = stop typing immediately
      handleTypingStop()
    }
  }

  // handleSend(): sends message via API
  const handleSend = async () => {
    if (!newMessage.trim() || !currentTeam) return

    // Stop typing indicator before sending
    handleTypingStop()
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    try {
      await sendMessage({
        teamId: currentTeam.id,
        authorId: user.id,
        content: newMessage.trim(),
        contentType: 'text',
      })
      setNewMessage('')
    } catch (error) {
      console.error('[ChatWindow] Failed to send message:', error)
      // Could show error toast here
    }
  }

  return (
    <main className="flex-1 flex flex-col h-screen border-x border-gray-200 ml-60">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <ChatHeader />
      </div>

      {/* Scrollable Message Area */}
      <div className="flex-1 overflow-hidden">
        <MessageList />
      </div>

      {/* Fixed Footer - Message Composer */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
        {/* Message Composer */}
        <div className="flex space-x-2">
          <textarea
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 min-h-[44px] max-h-32 p-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="w-5 h-5"
            >
              <path d="M3 20V4l19 8-19 8zm2-3l11.85-5L5 7v3.5l6 1.5-6 1.5V17z" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  )
}