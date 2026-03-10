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
import { generateAction, generateSuggestion, generateSummary } from '@/services/insightService'
import { classifyIntent } from '@/services/intentService'
import { trackSessionEvent } from '@/services/analyticsService'
import { MessageList } from './MessageList'
import { ChatHeader } from './ChatHeader'
import { socketService } from '@/services/socketService'
import { SegmentedControl, type SegmentedControlItem } from '@/components/common/SegmentedControl'
import { uiTokens } from '@/styles/uiTokens'
import type { MessageMetadata } from '@/types'

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

const COMPOSER_SEGMENTS: SegmentedControlItem<ComposerOverrideMode>[] = [
  { key: 'auto', label: 'Auto', accent: 'brand' },
  { key: 'ask', label: 'Ask Assistant', accent: 'brand' },
  { key: 'research', label: 'Research', accent: 'success' },
]

export const ChatWindow = () => {
  const [newMessage, setNewMessage] = useState('')
  const [composerOverrideMode, setComposerOverrideMode] = useState<ComposerOverrideMode>('auto')
  const [isResearchGenerating, setIsResearchGenerating] = useState(false)
  const [quickGeneratingType, setQuickGeneratingType] = useState<'summary' | 'action' | 'suggestion' | null>(null)
  const [lastRouteDecision, setLastRouteDecision] = useState<{
    mode: ComposerMode
    confidence: number
    rationale: string
    source: 'manual-override' | 'server-classifier' | 'frontend-fallback'
  } | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  
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
    if (!newMessage.trim() || !currentTeam || !currentUser || isResearchGenerating || quickGeneratingType !== null) return

    const submittedMessage = newMessage.trim()
    const inferredMode = inferComposerMode(submittedMessage)

    let effectiveMode: ComposerMode = composerOverrideMode === 'auto' ? inferredMode : composerOverrideMode
    let routeDecision: {
      mode: ComposerMode
      confidence: number
      rationale: string
      source: 'manual-override' | 'server-classifier' | 'frontend-fallback'
    }

    if (composerOverrideMode !== 'auto') {
      routeDecision = {
        mode: composerOverrideMode,
        confidence: 1,
        rationale: 'Manual override selected by user.',
        source: 'manual-override',
      }
    } else {
      try {
        const serverClassification = await classifyIntent(submittedMessage, currentTeam.id)
        effectiveMode = serverClassification.mode
        routeDecision = {
          mode: serverClassification.mode,
          confidence: serverClassification.confidence,
          rationale: serverClassification.rationale,
          source: 'server-classifier',
        }
      } catch {
        routeDecision = {
          mode: inferredMode,
          confidence: 0.6,
          rationale: 'Server classification unavailable; used frontend fallback heuristic.',
          source: 'frontend-fallback',
        }
      }
    }

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

    const messageMetadata: MessageMetadata = {
      routeMode: routeDecision.mode,
      routeConfidence: routeDecision.confidence,
      routeRationale: routeDecision.rationale,
      routeSource: routeDecision.source,
      routeOverrideUsed: composerOverrideMode !== 'auto',
    }

    try {
      const createdMessage = await createMessage({
        teamId: currentTeam.id,
        authorId: currentUser.id,
        content: submittedMessage,
        contentType: 'text',
        metadata: messageMetadata,
      })

      trackSessionEvent({
        eventType: 'chat',
        eventName: 'message_sent',
        teamId: currentTeam.id,
        actorUserId: currentUser.id,
        messageId: createdMessage.id,
        content: submittedMessage,
        metadata: {
          routeMode: routeDecision.mode,
          routeConfidence: routeDecision.confidence,
          routeSource: routeDecision.source,
          overrideMode: composerOverrideMode,
        },
      })

      setNewMessage('')
      setLastRouteDecision(routeDecision)

      if (effectiveMode === 'research') {
        trackSessionEvent({
          eventType: 'chat',
          eventName: 'research_job_requested',
          teamId: currentTeam.id,
          actorUserId: currentUser.id,
          messageId: createdMessage.id,
          content: submittedMessage,
          metadata: {
            mode: effectiveMode,
            routeConfidence: routeDecision.confidence,
          },
        })

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

  const handleMentionAgent = () => {
    const withMention = newMessage.trimStart().startsWith('@agent')
      ? newMessage
      : newMessage.length > 0
      ? `@agent ${newMessage}`
      : '@agent '

    setNewMessage(withMention)
    setComposerOverrideMode('ask')
    composerRef.current?.focus()

    if (currentTeam && currentUser) {
      trackSessionEvent({
        eventType: 'chat',
        eventName: 'invoke_agent_quick_action',
        teamId: currentTeam.id,
        actorUserId: currentUser.id,
      })
    }
  }

  const handleSetResearchMode = () => {
    setComposerOverrideMode('research')
    composerRef.current?.focus()

    if (currentTeam && currentUser) {
      trackSessionEvent({
        eventType: 'chat',
        eventName: 'composer_mode_quick_set',
        teamId: currentTeam.id,
        actorUserId: currentUser.id,
        metadata: {
          mode: 'research',
          source: 'chat-quick-action',
        },
      })
    }
  }

  const handleDeterministicGenerate = async (kind: 'summary' | 'action' | 'suggestion') => {
    if (!currentTeam || !currentUser || isResearchGenerating || quickGeneratingType !== null) return

    setQuickGeneratingType(kind)

    trackSessionEvent({
      eventType: 'insight',
      eventName: 'insight_generate_requested',
      teamId: currentTeam.id,
      actorUserId: currentUser.id,
      metadata: {
        insightType: kind,
        source: 'chat-quick-action',
      },
    })

    try {
      if (kind === 'summary') {
        await generateSummary(currentTeam.id)
      } else if (kind === 'action') {
        await generateAction(currentTeam.id)
      } else {
        await generateSuggestion(currentTeam.id)
      }

      trackSessionEvent({
        eventType: 'insight',
        eventName: 'insight_generate_completed',
        teamId: currentTeam.id,
        actorUserId: currentUser.id,
        metadata: {
          insightType: kind,
          source: 'chat-quick-action',
        },
      })
    } catch (error) {
      trackSessionEvent({
        eventType: 'insight',
        eventName: 'insight_generate_failed',
        teamId: currentTeam.id,
        actorUserId: currentUser.id,
        metadata: {
          insightType: kind,
          source: 'chat-quick-action',
          error: error instanceof Error ? error.message : 'Unknown generation error',
        },
      })
      console.error('[ChatWindow] Deterministic generation failed:', error)
    } finally {
      setQuickGeneratingType(null)
    }
  }

  const inferredMode = inferComposerMode(newMessage)
  const effectiveMode: ComposerMode =
    composerOverrideMode === 'auto' ? inferredMode : composerOverrideMode
  const isAutoMode = composerOverrideMode === 'auto'

  return (
    <main className="flex-1 min-w-0 flex flex-col h-screen">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <ChatHeader />
      </div>

      {/* Scrollable Message Area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <MessageList />
      </div>

      {/* Fixed Footer - Message Composer */}
      <div className={`flex-shrink-0 ${uiTokens.layout.railFooter} px-4 py-3 border-t border-gray-200 bg-white`}>
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SegmentedControl
            items={COMPOSER_SEGMENTS}
            activeKey={composerOverrideMode}
            onChange={setComposerOverrideMode}
          />
          <button
            type="button"
            onClick={handleMentionAgent}
            className={`${uiTokens.controls.button.sm} border-indigo-300 text-indigo-700 hover:bg-indigo-50`}
            title="Insert @agent mention"
          >
            @agent
          </button>
          <button
            type="button"
            onClick={() => handleDeterministicGenerate('summary')}
            disabled={isResearchGenerating || quickGeneratingType !== null}
            className={`${uiTokens.controls.button.sm} border-sky-300 text-sky-700 hover:bg-sky-50`}
            title="Generate deterministic summary insight"
          >
            {quickGeneratingType === 'summary' ? 'Summarizing...' : 'Summary'}
          </button>
          <button
            type="button"
            onClick={() => handleDeterministicGenerate('action')}
            disabled={isResearchGenerating || quickGeneratingType !== null}
            className={`${uiTokens.controls.button.sm} border-amber-300 text-amber-700 hover:bg-amber-50`}
            title="Generate deterministic action items"
          >
            {quickGeneratingType === 'action' ? 'Generating...' : 'Actions'}
          </button>
          <button
            type="button"
            onClick={() => handleDeterministicGenerate('suggestion')}
            disabled={isResearchGenerating || quickGeneratingType !== null}
            className={`${uiTokens.controls.button.sm} border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50`}
            title="Generate deterministic suggestions"
          >
            {quickGeneratingType === 'suggestion' ? 'Generating...' : 'Suggestions'}
          </button>
          <button
            type="button"
            onClick={handleSetResearchMode}
            className={`${uiTokens.controls.button.sm} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}
            title="Switch composer to research mode"
          >
            Research mode
          </button>
          <span className={uiTokens.text.meta}>
            {isAutoMode
              ? `Auto-routed: ${effectiveMode === 'research' ? 'Research' : 'Ask'}`
              : `${effectiveMode === 'research' ? 'Research' : 'Ask'} mode`}
          </span>
          {effectiveMode === 'research' && (
            <span className={uiTokens.text.successMeta}>→ long-form insight in Research</span>
          )}
          {lastRouteDecision && (
            <span className="text-xs text-slate-400">
              Last: {lastRouteDecision.mode === 'research' ? 'Research' : 'Ask'} ({Math.round(lastRouteDecision.confidence * 100)}%)
            </span>
          )}
        </div>

        {/* Message Composer */}
        <div className="flex space-x-2">
          <textarea
            ref={composerRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={effectiveMode === 'research' ? 'Ask a research question...' : 'Type a message...'}
            className="flex-1 min-h-[40px] max-h-32 px-3 py-2 text-sm leading-5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isResearchGenerating || quickGeneratingType !== null}
            className={`h-10 w-10 flex items-center justify-center rounded-lg transition-colors ${uiTokens.controls.button.brandSolid}`}
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