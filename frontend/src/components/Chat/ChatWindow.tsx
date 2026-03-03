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
import { createResearchJob } from '@/services/researchJobService'
import { MessageList } from './MessageList'
import { ChatHeader } from './ChatHeader'
import { socketService } from '@/services/socketService'

type ComposerMode = 'ask' | 'research'
type ComposerOverrideMode = 'auto' | ComposerMode

const RESEARCH_PATTERNS = [
  /\bresearch\b/i,
  /\bcompare\b/i,
  /\btrade[-\s]?off(s)?\b/i,
  /\bpros?\s+and\s+cons?\b/i,
  /\bdeep\s+dive\b/i,
  /\bbrief\b/i,
  /\banaly[sz]e\b/i,
  /\boptions?\b/i,
  /\brecommend\b/i,
  /\bwhat\s+should\s+we\s+do\b/i,
]

function inferComposerMode(input: string): ComposerMode {
  const normalized = input.trim()
  if (!normalized) return 'ask'

  const hasResearchSignal = RESEARCH_PATTERNS.some((pattern) => pattern.test(normalized))
  return hasResearchSignal ? 'research' : 'ask'
}

export const ChatWindow = () => {
  const [newMessage, setNewMessage] = useState('')
  const [composerOverrideMode, setComposerOverrideMode] = useState<ComposerOverrideMode>('auto')
  const [isResearchGenerating, setIsResearchGenerating] = useState(false)
  
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
    if (!newMessage.trim() || !currentTeam || !currentUser || isResearchGenerating) return

    const submittedMessage = newMessage.trim()
    const inferredMode = inferComposerMode(submittedMessage)
    const effectiveMode: ComposerMode =
      composerOverrideMode === 'auto' ? inferredMode : composerOverrideMode

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
        content: submittedMessage,
        contentType: 'text',
      })
      setNewMessage('')

      if (effectiveMode === 'research') {
        setIsResearchGenerating(true)
        try {
          await createResearchJob({
            teamId: currentTeam.id,
            query: submittedMessage,
          })
        } catch (researchError) {
          console.error('[ChatWindow] Failed to generate research insight:', researchError)
        } finally {
          setIsResearchGenerating(false)
        }
      }
    } catch (error) {
      console.error('[ChatWindow] Failed to send message:', error)
      // Could show error toast here
    }
  }

  const inferredMode = inferComposerMode(newMessage)
  const effectiveMode: ComposerMode =
    composerOverrideMode === 'auto' ? inferredMode : composerOverrideMode
  const isAutoMode = composerOverrideMode === 'auto'

  return (
    <main className="flex-1 min-w-0 flex flex-col h-screen border-x border-gray-200">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <ChatHeader />
      </div>

      {/* Scrollable Message Area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <MessageList />
      </div>

      {/* Fixed Footer - Message Composer */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
        <div className="mb-2 flex items-center gap-1.5">
          <button
            onClick={() => setComposerOverrideMode('auto')}
            className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
              composerOverrideMode === 'auto'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => setComposerOverrideMode('ask')}
            className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
              composerOverrideMode === 'ask'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Ask Assistant
          </button>
          <button
            onClick={() => setComposerOverrideMode('research')}
            className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
              composerOverrideMode === 'research'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Research
          </button>
          <span className="text-xs text-gray-500">
            {isAutoMode
              ? `Auto-routed: ${effectiveMode === 'research' ? 'Research' : 'Ask'}`
              : `${effectiveMode === 'research' ? 'Research' : 'Ask'} mode`}
          </span>
          {effectiveMode === 'research' && (
            <span className="text-xs text-purple-600">→ long-form insight in Research</span>
          )}
        </div>

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
            placeholder={effectiveMode === 'research' ? 'Ask a research question...' : 'Type a message...'}
            className="flex-1 min-h-[40px] max-h-32 px-3 py-2 text-sm leading-5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isResearchGenerating}
            className="h-10 w-10 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isResearchGenerating ? 'Generating research insight...' : 'Send message'}
          >
            {isResearchGenerating ? (
              <svg className="w-4.5 h-4.5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className="w-4.5 h-4.5"
              >
                <path d="M3 20V4l19 8-19 8zm2-3l11.85-5L5 7v3.5l6 1.5-6 1.5V17z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </main>
  )
}