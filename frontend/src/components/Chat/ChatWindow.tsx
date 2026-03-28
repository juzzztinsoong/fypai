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
import { classifyIntent } from '@/services/intentService'
import { getErrorMessage } from '@/services/api'
import { trackSessionEvent } from '@/services/analyticsService'
import { MessageList } from './MessageList'
import { ChatHeader } from './ChatHeader'
import { socketService } from '@/services/socketService'
import { SegmentedControl, type SegmentedControlItem } from '@/components/common/SegmentedControl'
import {
  getChipClass,
  uiTokens,
} from '@/styles/uiTokens'
import type { AgentPromptArchetype, MessageMetadata } from '@/types'
import { subscribeToDraftPromotion, type DraftPromotionPayload } from '@/utils/draftComposer'

type ComposerMode = 'ask' | 'research'
type DeterministicComposerMode = 'summary' | 'action' | 'suggestion'
type ComposerOverrideMode = 'auto' | ComposerMode | DeterministicComposerMode
type DeterministicInsightKind = 'summary' | 'action' | 'suggestion' | 'research'
type RequestedInsightType = 'summary' | 'document' | 'action' | 'suggestion'

interface DraftContextItem {
  key: string
  sourceType: DraftPromotionPayload['sourceType']
  sourceId: string
  sourceLabel: string
  excerpt: string
  parentMessageId?: string
}

function parseSlashInsightCommand(input: string): { kind: DeterministicInsightKind; prompt?: string } | null {
  const match = input.trim().match(/^\/(summary|research|actions?|suggest|help)\b\s*(.*)$/i)
  if (!match) return null

  const command = match[1].toLowerCase()
  const prompt = match[2]?.trim() || undefined

  if (command === 'summary') return { kind: 'summary', prompt }
  if (command === 'research') return { kind: 'research', prompt }
  if (command === 'action' || command === 'actions') return { kind: 'action', prompt }
  if (command === 'help') return { kind: 'suggestion', prompt }
  return { kind: 'suggestion', prompt }
}

function mapKindToRequestedInsightType(kind: DeterministicInsightKind): RequestedInsightType {
  if (kind === 'research') return 'document'
  return kind
}

const RESEARCH_PATTERNS = [
  /\bresearch\s+(brief|plan|report|analysis|summary)\b/i,
  /\bresearch\s+(on|about)\b/i,
  /\bresearch\s+this\b/i,
  /\b(?:do|run|perform|conduct)\s+(?:some\s+)?research\b/i,
  /\bcompare\b/i,
  /\btrade[-\s]?off(s)?\b/i,
  /\bpros?\s+and\s+cons?\b/i,
  /\bdeep\s+dive\b/i,
  /\banaly[sz]e\b/i,
  /\boptions?\b/i,
  /\brecommend\b/i,
  /\bwhat\s+should\s+we\s+do\b/i,
]

function inferComposerMode(input: string): ComposerMode {
  const normalized = input.trim()
  if (!normalized) return 'ask'

  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  if (wordCount <= 1) return 'ask'

  const hasResearchSignal = RESEARCH_PATTERNS.some((pattern) => pattern.test(normalized))
  return hasResearchSignal ? 'research' : 'ask'
}

const COMPOSER_SEGMENTS: SegmentedControlItem<ComposerOverrideMode>[] = [
  { key: 'auto', label: 'Auto', accent: 'brand' },
  { key: 'ask', label: 'Ask Assistant', accent: 'brand' },
  { key: 'research', label: 'Research', accent: 'success' },
  { key: 'summary', label: 'Summary', accent: 'summary' },
  { key: 'action', label: 'Actions', accent: 'action' },
  { key: 'suggestion', label: 'Help', accent: 'suggestion' },
]

const COMPOSER_MIN_HEIGHT_PX = 40
const COMPOSER_MAX_HEIGHT_PX = 144

function getArchetypeForRouteMode(mode: ComposerMode): AgentPromptArchetype {
  return mode === 'research' ? 'research-analyst' : 'pragmatic-advisor'
}

function getArchetypeForDeterministicKind(kind: DeterministicInsightKind): AgentPromptArchetype {
  if (kind === 'summary') return 'decision-brief'
  if (kind === 'action') return 'execution-coach'
  if (kind === 'suggestion') return 'pragmatic-advisor'
  return 'research-analyst'
}

function getDeterministicKindFromOverride(
  mode: ComposerOverrideMode,
): Exclude<DeterministicInsightKind, 'research'> | null {
  if (mode === 'summary') return 'summary'
  if (mode === 'action') return 'action'
  if (mode === 'suggestion') return 'suggestion'
  return null
}

export const ChatWindow = () => {
  const [newMessage, setNewMessage] = useState('')
  const [composerError, setComposerError] = useState<string | null>(null)
  const [composerOverrideMode, setComposerOverrideMode] = useState<ComposerOverrideMode>('auto')
  const [draftContexts, setDraftContexts] = useState<DraftContextItem[]>([])
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const footerRef = useRef<HTMLDivElement | null>(null)
  
  // Get current team from UIStore
  const currentTeamId = useUIStore((state) => state.currentTeamId)
  const currentTeam = useEntityStore((state) => 
    currentTeamId ? state.getTeam(currentTeamId) : null
  )
  const isAiLightCondition = Boolean(currentTeam && !currentTeam.isChimeEnabled)

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

  const removeDraftContext = useCallback((key: string) => {
    setDraftContexts((prev) => prev.filter((item) => item.key !== key))
  }, [])

  const clearDraftContexts = useCallback(() => {
    setDraftContexts([])
  }, [])

  const focusDraftContextSource = useCallback(
    (context: DraftContextItem) => {
      if (!currentTeamId) return

      trackSessionEvent({
        eventType: 'navigation',
        eventName: 'focus_reply_context_source',
        teamId: currentTeamId,
        actorUserId: currentUser?.id,
        metadata: {
          sourceType: context.sourceType,
          sourceId: context.sourceId,
          sourceLabel: context.sourceLabel,
        },
      })

      if (context.sourceType === 'insight') {
        window.dispatchEvent(
          new CustomEvent('fypai:focus-insight', {
            detail: {
              insightId: context.sourceId,
              preferredTab: 'all',
              source: 'composer-reply-context',
            },
          }),
        )
        return
      }

      window.dispatchEvent(
        new CustomEvent('fypai:focus-chat-message', {
          detail: {
            messageId: context.parentMessageId || context.sourceId,
            source: 'draft-context',
          },
        }),
      )
    },
    [currentTeamId, currentUser?.id],
  )

  useEffect(() => {
    const unsubscribe = subscribeToDraftPromotion((payload) => {
      if (!currentTeamId) return
      if (payload.teamId && payload.teamId !== currentTeamId) return

      const excerpt = payload.excerpt.trim()
      if (!excerpt) return

      const key = `${payload.sourceType}:${payload.sourceId}`

      setDraftContexts((prev) => {
        if (prev.some((item) => item.key === key)) {
          return prev
        }

        const next: DraftContextItem = {
          key,
          sourceType: payload.sourceType,
          sourceId: payload.sourceId,
          sourceLabel: payload.sourceLabel,
          excerpt,
          parentMessageId:
            payload.parentMessageId ||
            (payload.sourceType === 'message' ? payload.sourceId : undefined),
        }

        return [...prev, next].slice(-4)
      })

      setComposerOverrideMode('ask')

      requestAnimationFrame(() => {
        composerRef.current?.focus()
      })

      trackSessionEvent({
        eventType: 'insight',
        eventName: 'draft_context_promoted',
        teamId: currentTeamId,
        actorUserId: currentUser?.id,
        metadata: {
          sourceType: payload.sourceType,
          sourceId: payload.sourceId,
          sourceLabel: payload.sourceLabel,
        },
      })
    })

    return () => {
      unsubscribe()
    }
  }, [currentTeamId, currentUser?.id])

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
    if (!currentTeam || !currentUser) return

    const submittedMessage = newMessage.trim()
    if (!submittedMessage) return
    setComposerError(null)

    const selectedDeterministicKind = getDeterministicKindFromOverride(composerOverrideMode)

    const shouldForceAgentInvoke = draftContexts.length > 0
    const invokingMessage =
      shouldForceAgentInvoke && !/^@agent\b/i.test(submittedMessage)
        ? `@agent ${submittedMessage}`
        : submittedMessage

    const slashInsightCommand = invokingMessage ? parseSlashInsightCommand(invokingMessage) : null

    if (slashInsightCommand) {
      if (isAiLightCondition) {
        setComposerError('This condition supports explicit @agent chat only. Insight commands are disabled.')
        return
      }

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      emitTypingStop()

      const draftSourceInsightIds = draftContexts
        .filter((context) => context.sourceType === 'insight')
        .map((context) => context.sourceId)
      const draftSourceMessageIds = draftContexts
        .filter((context) => context.sourceType === 'message')
        .map((context) => context.sourceId)
      const draftContextLabels = draftContexts.map((context) => context.sourceLabel)
      const parentDraftContext = [...draftContexts]
        .reverse()
        .find((context) => typeof context.parentMessageId === 'string')

      const messageMetadata: MessageMetadata = {
        routeMode: slashInsightCommand.kind === 'research' ? 'research' : 'ask',
        routeConfidence: 1,
        routeRationale: `Slash command ${slashInsightCommand.kind} selected.`,
        routeSource: 'manual-override',
        routeOverrideUsed: true,
        requestedInsightType: mapKindToRequestedInsightType(slashInsightCommand.kind),
        routeExecutionId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        routeArchetype: getArchetypeForDeterministicKind(slashInsightCommand.kind),
        parentMessageId: parentDraftContext?.parentMessageId,
        draftSourceInsightIds: draftSourceInsightIds.length > 0 ? draftSourceInsightIds : undefined,
        draftSourceMessageIds: draftSourceMessageIds.length > 0 ? draftSourceMessageIds : undefined,
        draftContextLabels: draftContextLabels.length > 0 ? draftContextLabels : undefined,
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
            routeMode: messageMetadata.routeMode,
            routeConfidence: messageMetadata.routeConfidence,
            routeSource: messageMetadata.routeSource,
            overrideMode: composerOverrideMode,
            routeArchetype: messageMetadata.routeArchetype,
            slashKind: slashInsightCommand.kind,
          },
        })
      } catch (error) {
        console.error('[ChatWindow] Failed to send slash-command message:', error)
        setComposerError(getErrorMessage(error))
        return
      }

      setNewMessage('')
      clearDraftContexts()
      return
    }

    if (selectedDeterministicKind) {
      if (isAiLightCondition) {
        setComposerError('This condition supports explicit @agent chat only. Deterministic insight generation is disabled.')
        return
      }

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      emitTypingStop()

      const draftSourceInsightIds = draftContexts
        .filter((context) => context.sourceType === 'insight')
        .map((context) => context.sourceId)
      const draftSourceMessageIds = draftContexts
        .filter((context) => context.sourceType === 'message')
        .map((context) => context.sourceId)
      const draftContextLabels = draftContexts.map((context) => context.sourceLabel)
      const parentDraftContext = [...draftContexts]
        .reverse()
        .find((context) => typeof context.parentMessageId === 'string')

      const messageMetadata: MessageMetadata = {
        routeMode: 'ask',
        routeConfidence: 1,
        routeRationale: `Deterministic ${selectedDeterministicKind} category selected.`,
        routeSource: 'manual-override',
        routeOverrideUsed: true,
        requestedInsightType: mapKindToRequestedInsightType(selectedDeterministicKind),
        routeExecutionId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        routeArchetype: getArchetypeForDeterministicKind(selectedDeterministicKind),
        parentMessageId: parentDraftContext?.parentMessageId,
        draftSourceInsightIds: draftSourceInsightIds.length > 0 ? draftSourceInsightIds : undefined,
        draftSourceMessageIds: draftSourceMessageIds.length > 0 ? draftSourceMessageIds : undefined,
        draftContextLabels: draftContextLabels.length > 0 ? draftContextLabels : undefined,
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
          eventName: 'message_route_decision',
          teamId: currentTeam.id,
          actorUserId: currentUser.id,
          messageId: createdMessage.id,
          metadata: {
            routeMode: messageMetadata.routeMode,
            routeConfidence: messageMetadata.routeConfidence,
            routeSource: messageMetadata.routeSource,
            routeRationale: messageMetadata.routeRationale,
            routeOverrideUsed: true,
            routeArchetype: messageMetadata.routeArchetype,
          },
        })

        trackSessionEvent({
          eventType: 'chat',
          eventName: 'message_sent',
          teamId: currentTeam.id,
          actorUserId: currentUser.id,
          messageId: createdMessage.id,
          content: submittedMessage,
          metadata: {
            routeMode: messageMetadata.routeMode,
            routeConfidence: messageMetadata.routeConfidence,
            routeSource: messageMetadata.routeSource,
            overrideMode: composerOverrideMode,
            routeArchetype: messageMetadata.routeArchetype,
            selectedCategory: selectedDeterministicKind,
          },
        })
      } catch (error) {
        console.error('[ChatWindow] Failed to send category-selected message:', error)
        setComposerError(getErrorMessage(error))
        return
      }

      setNewMessage('')
      clearDraftContexts()
      return
    }

    const routeOverrideMode: ComposerMode | null =
      composerOverrideMode === 'ask' || composerOverrideMode === 'research'
        ? composerOverrideMode
        : null

    let routeDecision: {
      mode: ComposerMode
      confidence: number
      rationale: string
      source: 'manual-override' | 'server-classifier' | 'frontend-fallback'
    }

    if (routeOverrideMode) {
      routeDecision = {
        mode: routeOverrideMode,
        confidence: 1,
        rationale: 'Manual override selected by user.',
        source: 'manual-override',
      }
    } else {
      try {
        const serverClassification = await classifyIntent(invokingMessage, currentTeam.id)
        routeDecision = {
          mode: serverClassification.mode,
          confidence: serverClassification.confidence,
          rationale: serverClassification.rationale,
          source: 'server-classifier',
        }
      } catch {
        routeDecision = {
          mode: 'ask',
          confidence: 0.5,
          rationale: 'Server classification unavailable; used conservative ask fallback.',
          source: 'frontend-fallback',
        }
      }
    }

    if (isAiLightCondition && routeDecision.mode === 'research') {
      routeDecision = {
        mode: 'ask',
        confidence: routeDecision.confidence,
        rationale: 'AI-light condition enforces explicit @agent chat only; research route was downgraded to ask.',
        source: routeDecision.source,
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

    const draftSourceInsightIds = draftContexts
      .filter((context) => context.sourceType === 'insight')
      .map((context) => context.sourceId)
    const draftSourceMessageIds = draftContexts
      .filter((context) => context.sourceType === 'message')
      .map((context) => context.sourceId)
    const draftContextLabels = draftContexts.map((context) => context.sourceLabel)
    const parentDraftContext = [...draftContexts]
      .reverse()
      .find((context) => typeof context.parentMessageId === 'string')
    const shouldForceAgentReply = routeOverrideMode === 'ask'

    const messageMetadata: MessageMetadata = {
      routeMode: routeDecision.mode,
      routeConfidence: routeDecision.confidence,
      routeRationale: routeDecision.rationale,
      routeSource: routeDecision.source,
      routeOverrideUsed: composerOverrideMode !== 'auto',
      requestedInsightType: routeDecision.mode === 'research' ? 'document' : undefined,
      routeExecutionId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      forceAgentReply: shouldForceAgentReply,
      routeArchetype: getArchetypeForRouteMode(routeDecision.mode),
      parentMessageId: parentDraftContext?.parentMessageId,
      draftSourceInsightIds: draftSourceInsightIds.length > 0 ? draftSourceInsightIds : undefined,
      draftSourceMessageIds: draftSourceMessageIds.length > 0 ? draftSourceMessageIds : undefined,
      draftContextLabels: draftContextLabels.length > 0 ? draftContextLabels : undefined,
    }

    try {
      const createdMessage = await createMessage({
        teamId: currentTeam.id,
        authorId: currentUser.id,
        content: invokingMessage,
        contentType: 'text',
        metadata: messageMetadata,
      })

      trackSessionEvent({
        eventType: 'chat',
        eventName: 'message_route_decision',
        teamId: currentTeam.id,
        actorUserId: currentUser.id,
        messageId: createdMessage.id,
        metadata: {
          routeMode: routeDecision.mode,
          routeConfidence: routeDecision.confidence,
          routeSource: routeDecision.source,
          routeRationale: routeDecision.rationale,
          routeOverrideUsed: composerOverrideMode !== 'auto',
          routeArchetype: messageMetadata.routeArchetype,
        },
      })

      trackSessionEvent({
        eventType: 'chat',
        eventName: 'message_sent',
        teamId: currentTeam.id,
        actorUserId: currentUser.id,
        messageId: createdMessage.id,
        content: invokingMessage,
        metadata: {
          routeMode: routeDecision.mode,
          routeConfidence: routeDecision.confidence,
          routeSource: routeDecision.source,
          overrideMode: composerOverrideMode,
          routeArchetype: messageMetadata.routeArchetype,
        },
      })

      setNewMessage('')
      clearDraftContexts()
    } catch (error) {
      console.error('[ChatWindow] Failed to send message:', error)
      setComposerError(getErrorMessage(error))
    }
  }

  const inferredMode = inferComposerMode(newMessage)
  const allowedComposerSegments = isAiLightCondition
    ? COMPOSER_SEGMENTS.filter((item) => item.key === 'auto' || item.key === 'ask')
    : COMPOSER_SEGMENTS

  useEffect(() => {
    if (!isAiLightCondition) return

    if (composerOverrideMode === 'research' || composerOverrideMode === 'summary' || composerOverrideMode === 'action' || composerOverrideMode === 'suggestion') {
      setComposerOverrideMode('auto')
    }
  }, [isAiLightCondition, composerOverrideMode])

  const effectiveMode: ComposerMode =
    composerOverrideMode === 'auto'
      ? inferredMode
      : composerOverrideMode === 'research'
      ? 'research'
      : 'ask'

  const composerPlaceholder =
    composerOverrideMode === 'summary'
      ? 'Describe what to summarize...'
      : composerOverrideMode === 'action'
      ? 'Describe which actions to extract...'
      : composerOverrideMode === 'suggestion'
      ? 'Describe what help you need...'
      : effectiveMode === 'research'
      ? 'Ask a research question...'
      : 'Type a message...'

  useEffect(() => {
    const textarea = composerRef.current
    if (!textarea) return

    textarea.style.height = '0px'
    const nextHeight = Math.min(
      COMPOSER_MAX_HEIGHT_PX,
      Math.max(COMPOSER_MIN_HEIGHT_PX, textarea.scrollHeight),
    )
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > COMPOSER_MAX_HEIGHT_PX ? 'auto' : 'hidden'
  }, [newMessage])

  useEffect(() => {
    const footer = footerRef.current
    if (!footer) return

    const syncFooterHeight = () => {
      const nextHeight = Math.ceil(footer.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--fypai-chat-footer-height', `${nextHeight}px`)
    }

    syncFooterHeight()
    const observer = new ResizeObserver(() => {
      syncFooterHeight()
    })
    observer.observe(footer)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <main className="flex-1 min-w-0 flex flex-col h-screen bg-white">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <ChatHeader />
      </div>

      {/* Scrollable Message Area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <MessageList />
      </div>

      {/* Fixed Footer - Message Composer */}
      <div
        ref={footerRef}
        className="fypai-edge-shadow-top relative z-20 flex-shrink-0 min-h-[112px] px-4 py-2.5 border-t border-slate-200 bg-[#ffffff]"
      >
        <div className="mb-1.5 space-y-1.5">
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SegmentedControl
              items={allowedComposerSegments}
              activeKey={composerOverrideMode}
              onChange={setComposerOverrideMode}
            />
          </div>

          {draftContexts.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={getChipClass('neutral', 'xs')}>Reply Context</span>
              {draftContexts.map((context) => (
                <span
                  key={context.key}
                  className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 text-[11px] text-indigo-700"
                  title={context.excerpt}
                >
                  <button
                    type="button"
                    onClick={() => focusDraftContextSource(context)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 transition hover:bg-indigo-100"
                    title={`Open ${context.sourceLabel}`}
                  >
                    <span className="max-w-[13rem] truncate text-left">{context.sourceLabel}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDraftContext(context.key)}
                    className="px-1.5 text-indigo-500 hover:text-indigo-700"
                    aria-label={`Remove ${context.sourceLabel} context`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearDraftContexts}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
              >
                Clear all
              </button>
            </div>
          )}

          {composerOverrideMode === 'ask' && (
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className={getChipClass('muted', 'xs')} title="The next send will explicitly request agent assistance.">
                Assist requested (next send)
              </span>
            </div>
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
            placeholder={composerPlaceholder}
            className="flex-1 min-h-[40px] px-3 py-2 text-sm leading-5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className={`h-10 w-10 flex items-center justify-center rounded-lg transition-colors ${uiTokens.controls.button.brandSolid}`}
            title="Send message"
          >
            {
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className="w-4.5 h-4.5"
              >
                <path d="M3 20V4l19 8-19 8zm2-3l11.85-5L5 7v3.5l6 1.5-6 1.5V17z" />
              </svg>
            }
          </button>
        </div>

        {composerError && (
          <p className="mt-2 text-xs font-medium text-rose-600">{composerError}</p>
        )}
      </div>
    </main>
  )
}