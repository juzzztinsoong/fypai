/**
 * ChatWindow Component
 *
 * Per Refactoring Guide Section 1.3:
 * - Uses UIStore for current team context
 * - Uses SessionStore for current user
 * - Uses messageService for sending messages
 * - No chatStore, no teamStore, no userStore
 *
 * Tech Stack: React (Vite), EntityStore, UIStore, SessionStore, Tailwind CSS
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useEntityStore } from '@/stores/entityStore'
import { createMessage } from '@/services/messageService'
import { MessageList } from './MessageList'
import { ChatHeader } from './ChatHeader'
import { socketService } from '@/services/socketService'

export const ChatWindow = () => {
  const [newMessage, setNewMessage] = useState('')
  
  // Get current team from UIStore
  const currentTeamId = useUIStore((state) => state.currentTeamId)
  const currentTeam = useEntityStore((state) => 
    currentTeamId ? state.getTeam(currentTeamId) : null
  )
  
  // Get current user from SessionStore
  const currentUser = useSessionStore((state) => state.currentUser)
  
  // Phase 2.3: Cleanup timers on unmount
  useEffect(() => {
    return () => {
      console.log('[ChatWindow] 🧹 Cleaning up typing timers on unmount')
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      // Stop typing if component unmounts
      if (isTypingRef.current && currentTeam && currentUser) {
        socketService.sendTypingIndicator(currentTeam.id, currentUser.id, false)
        isTypingRef.current = false
      }
    }
  }, [currentTeam, currentUser])
  
  // Phase 2.3: Track typing state with debouncing
  const isTypingRef = useRef(false)
  const typingTimeoutRef = useRef<number | null>(null) // Auto-stop after 3s
  const debounceTimeoutRef = useRef<number | null>(null) // 500ms delay before emit

  // Phase 2.3: Send typing:start (only called after debounce)
  const emitTypingStart = useCallback(() => {
    if (!currentTeam || !currentUser || isTypingRef.current) return
    
    isTypingRef.current = true
    socketService.sendTypingIndicator(currentTeam.id, currentUser.id, true)
    console.log('[ChatWindow] 👆 Typing started (emitted after 500ms debounce)')
  }, [currentTeam, currentUser])

  // Phase 2.3: Send typing:stop
  const emitTypingStop = useCallback(() => {
    if (!currentTeam || !currentUser || !isTypingRef.current) return
    
    isTypingRef.current = false
    socketService.sendTypingIndicator(currentTeam.id, currentUser.id, false)
    console.log('[ChatWindow] 👇 Typing stopped')
  }, [currentTeam, currentUser])

  // Phase 2.3: Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value)
    
    const hasContent = e.target.value.length > 0
    
    if (hasContent) {
      // Clear existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      
      // Clear auto-stop timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Phase 2.3: Debounce - only emit if still typing after 500ms
      if (!isTypingRef.current) {
        debounceTimeoutRef.current = setTimeout(() => {
          emitTypingStart()
        }, 500)
      }
      
      // Phase 2.3: Auto-stop after 3s of no input
      typingTimeoutRef.current = setTimeout(() => {
        emitTypingStop()
      }, 3000)
    } else {
      // Empty input = stop immediately
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      emitTypingStop()
    }
  }

  // handleSend(): sends message via messageService
  const handleSend = async () => {
    if (!newMessage.trim() || !currentTeam || !currentUser) return

    // Phase 2.3: Clear all timers and stop typing
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = null
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    emitTypingStop()

    try {
      await createMessage({
        teamId: currentTeam.id,
        authorId: currentUser.id,
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