/**
 * MessageList Component
 *
 * Per Refactoring Guide Section 1.3:
 * - Uses EntityStore for messages (normalized data)
 * - Uses UIStore for current team context
 * - Uses SessionStore for current user and typing indicators
 * - No Event Bus, no RealtimeStore
 *
 * Tech Stack: React (Vite), EntityStore, UIStore, SessionStore, Tailwind CSS
 */
import { useEffect, useRef, useMemo, useState } from 'react'
import { useEntityStore } from '@/stores/entityStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { AIInsightDTO, MessageDTO } from '@/types'
import { getMessages } from '@/services/messageService'
import { trackSessionEvent } from '@/services/analyticsService'
import { TypingIndicator } from './TypingIndicator'
import { AgentMetadataTag } from './AgentMetadataTag'
import { RAGContextPanel } from './RAGContextPanel'
import { FeedbackButtons } from './FeedbackButtons'
import { getAvatarBackgroundColor, getMessageSurfaceTheme, getUserInitials } from '../../utils/avatarUtils'
import { getLinkVisuals } from '@/utils/linkVisuals'
import { getChipClass } from '@/styles/uiTokens'
import ReactMarkdown from 'react-markdown'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'

const EMPTY_ARRAY: readonly string[] = Object.freeze([])
const AXIS_HOVER_VERTICAL_PAD = 4
const CHAT_ANCHOR_SYNC_EMIT_INTERVAL_MS = 80
const CHAT_BOTTOM_SYNC_EMIT_INTERVAL_MS = 150
const GENERIC_MARKER_TITLES = new Set([
  'conversation summary',
  'summary',
  'research brief',
  'brief',
  'action item',
  'action items',
  'help',
  'help recommendations',
  'recommendations',
  'analysis',
  'insight',
  'decision made',
])

const sanitizeMarkerTitle = (raw: string): string => {
  return raw
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^[-*]\s*(?:\[[ xX]\]\s*)?/, '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s:;.,-]+$/, '')
}

const normalizeMarkerTitle = (raw: string): string => {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const truncateMarkerTitle = (title: string, maxLength = 96): string => {
  if (title.length <= maxLength) return title
  const slice = title.slice(0, maxLength + 1)
  const lastSpace = slice.lastIndexOf(' ')
  const cutoff = lastSpace > Math.floor(maxLength * 0.6) ? lastSpace : maxLength
  return `${slice.slice(0, cutoff).trimEnd()}...`
}

const isGenericMarkerTitle = (title: string): boolean => {
  const normalized = normalizeMarkerTitle(title)
  if (!normalized) return true
  if (GENERIC_MARKER_TITLES.has(normalized)) return true

  const wordCount = normalized.split(' ').filter(Boolean).length
  if (
    wordCount <= 3 &&
    /summary|brief|help|action|item|analysis|insight|recommendation|decision/.test(normalized)
  ) {
    return true
  }

  return false
}

const extractMarkerTitleFromInsightContent = (content?: string): string | null => {
  if (!content) return null

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const choose = (raw: string): string | null => {
    const candidate = sanitizeMarkerTitle(raw)
    if (!candidate || candidate.length < 8 || isGenericMarkerTitle(candidate)) return null
    return truncateMarkerTitle(candidate)
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      const candidate = choose(headingMatch[1])
      if (candidate) return candidate
    }
  }

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*]\s+(?:\[[ xX]\]\s*)?(.+)$/)
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/)
    const candidate = choose((bulletMatch || numberedMatch)?.[1] || '')
    if (candidate) return candidate
  }

  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) continue
    if (/^[-*]\s+/.test(line)) continue
    if (/^\d+\.\s+/.test(line)) continue
    const firstSentence = line.split(/[.!?]/)[0] || line
    const candidate = choose(firstSentence)
    if (candidate) return candidate
  }

  return null
}

const resolveMarkerInsightTitle = (
  linkedInsight: AIInsightDTO | undefined,
  sourceActionTitle: string | undefined,
  markerContent: string,
): string => {
  const linkedTitle = sanitizeMarkerTitle(linkedInsight?.title || '')
  if (linkedTitle && !isGenericMarkerTitle(linkedTitle)) {
    return truncateMarkerTitle(linkedTitle)
  }

  const fromInsightContent = extractMarkerTitleFromInsightContent(linkedInsight?.content)
  if (fromInsightContent) {
    return fromInsightContent
  }

  const sourceTitle = sanitizeMarkerTitle(sourceActionTitle || '')
  if (sourceTitle && !isGenericMarkerTitle(sourceTitle)) {
    return truncateMarkerTitle(sourceTitle)
  }

  if (linkedTitle) {
    return truncateMarkerTitle(linkedTitle)
  }

  if (sourceTitle) {
    return truncateMarkerTitle(sourceTitle)
  }

  const fromMarkerContent = extractMarkerTitleFromInsightContent(markerContent)
  return fromMarkerContent || markerContent
}

export const MessageList = () => {
  // Get current team from UIStore
  const currentTeamId = useUIStore((state) => state.currentTeamId)
  console.log('[MessageList] currentTeamId:', currentTeamId)
  
  // FIXED: Subscribe directly to the relationship array (reactive)
  const messageIds = useEntityStore((state) => 
    state.relationships.teamMessages[currentTeamId || ''] || EMPTY_ARRAY
  )
  const messagesById = useEntityStore((state) => state.entities.messages)
  const usersById = useEntityStore((state) => state.entities.users)
  const insightsById = useEntityStore((state) => state.entities.insights)
  
  // Map to data in useMemo to prevent re-renders
  const messages = useMemo(() => {
    return (messageIds as string[])
      .map(id => messagesById[id])
      .filter(Boolean)
      .map(message => ({
        ...message,
        author: usersById[message.authorId] || { id: '', name: 'Unknown', email: null, avatar: null, role: 'member' as const, createdAt: new Date().toISOString() }
      }))
  }, [messageIds, messagesById, usersById])
  
  // Get typing users from SessionStore
  const typingUserIds = useSessionStore((state) => 
    state.getTypingUsers(currentTeamId || '')
  )
  
  // Get current user from SessionStore
  const currentUser = useSessionStore((state) => state.currentUser)
  const aiProcessingStage = useSessionStore((state) =>
    state.getAIProcessingStage(currentTeamId || '')
  )
  
  // Get loading/error states from UIStore
  const isLoading = useUIStore((state) => state.getLoading('messages'))
  const error = useUIStore((state) => state.getError('messages'))
  const isInsightGenerationLoading = useUIStore((state) => state.getLoading('insight-generation'))
  
  // Phase 6.5: Get showAIDetails preference
  const showAIDetails = useUIStore((state) => state.preferences.showAIDetails)
  const enableTimelineSync = useUIStore((state) => state.preferences.enableTimelineSync)
  
  const chatViewportRef = useRef<HTMLDivElement>(null)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const applyingExternalSyncRef = useRef(false)
  const lastAnchorSyncInsightRef = useRef<string | null>(null)
  const suppressAnchorEmitUntilRef = useRef(0)
  const lastAppliedInsightRef = useRef<{ id: string; at: number } | null>(null)
  const isAtBottomRef = useRef(true)
  const atBottomBeforeFooterRef = useRef(true)
  const initializedTeamRef = useRef<string | null>(null)
  const lastMessageCountRef = useRef(0)
  const footerPinToBottomRef = useRef(false)
  const previousFooterActivityRef = useRef(false)
  const lastChatSyncEmitAtRef = useRef(0)
  const lastBottomSyncEmitAtRef = useRef(0)
  const axisHoverInsightIdRef = useRef<string | null>(null)
  const axisHoverPointerRef = useRef<{ x: number; y: number } | null>(null)
  const axisHoverRafRef = useRef<number | null>(null)
  const axisHoverEvaluatorRef = useRef<((x: number, y: number) => void) | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [unseenMessageCount, setUnseenMessageCount] = useState(0)

  // Map typing user IDs to names (filter out current user)
  const typingUserNames = useMemo(() => {
    if (!typingUserIds || typingUserIds.length === 0 || !currentUser) return []
    
    return typingUserIds
      .filter((id) => id !== currentUser.id && id !== 'agent')
      .map((id) => {
        const user = useEntityStore.getState().getUser(id)
        return user?.name || null
      })
      .filter((name): name is string => name !== null)
  }, [typingUserIds, currentUser])

  const pendingMarkerLabel = useMemo(() => {
    if (aiProcessingStage === 'searching-memory') return 'Research marker'
    if (aiProcessingStage === 'analyzing') return 'Insight marker'
    if (isInsightGenerationLoading) return 'Insight marker'
    return 'Summary marker'
  }, [aiProcessingStage, isInsightGenerationLoading])

  const showPendingInsightMarker =
    aiProcessingStage !== 'idle' || isInsightGenerationLoading

  const hasFooterActivity =
    showPendingInsightMarker || typingUserNames.length > 0

  // Fetch messages when team changes
  useEffect(() => {
    console.log('[MessageList] 🔄 useEffect[currentTeamId] fired, teamId:', currentTeamId)
    if (currentTeamId) {
      console.log('[MessageList] Fetching messages for team:', currentTeamId)
      getMessages(currentTeamId)
    }
  }, [currentTeamId])

  const markerMessageIndexByInsight = useMemo(() => {
    const indexMap: Record<string, number> = {}
    messages.forEach((message, index) => {
      const linkedInsightId = message.metadata?.linkedInsightId
      const isMarker =
        (message.metadata?.markerType === 'action-insight-link' || message.metadata?.markerType === 'insight-link') &&
        Boolean(linkedInsightId)

      if (isMarker && linkedInsightId) {
        indexMap[linkedInsightId] = index
      }
    })
    return indexMap
  }, [messages])

  const markerInsightByMessageIndex = useMemo(() => {
    const indexMap: Record<number, string> = {}
    messages.forEach((message, index) => {
      const linkedInsightId = message.metadata?.linkedInsightId
      const isMarker =
        (message.metadata?.markerType === 'action-insight-link' || message.metadata?.markerType === 'insight-link') &&
        Boolean(linkedInsightId)

      if (isMarker && linkedInsightId) {
        indexMap[index] = linkedInsightId
      }
    })
    return indexMap
  }, [messages])

  useEffect(() => {
    if (!currentTeamId || messages.length === 0) return

    if (initializedTeamRef.current !== currentTeamId) {
      initializedTeamRef.current = currentTeamId
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'auto' })
    }
  }, [currentTeamId, messages.length])

  useEffect(() => {
    if (!currentTeamId) {
      initializedTeamRef.current = null
      isAtBottomRef.current = true
      setIsAtBottom(true)
      setUnseenMessageCount(0)
      lastMessageCountRef.current = 0
      return
    }

    setUnseenMessageCount(0)
    lastMessageCountRef.current = messages.length
  }, [currentTeamId])

  useEffect(() => {
    const previousCount = lastMessageCountRef.current

    if (messages.length <= previousCount) {
      lastMessageCountRef.current = messages.length
      return
    }

    const appendedCount = messages.length - previousCount
    if (!isAtBottomRef.current && appendedCount > 0) {
      setUnseenMessageCount((count) => count + appendedCount)
    }

    lastMessageCountRef.current = messages.length
  }, [messages.length])

  useEffect(() => {
    if (hasFooterActivity && !previousFooterActivityRef.current) {
      // Latch bottom-pin using pre-footer position to avoid race when footer height changes.
      footerPinToBottomRef.current = atBottomBeforeFooterRef.current || isAtBottomRef.current
    }

    if (!hasFooterActivity) {
      atBottomBeforeFooterRef.current = isAtBottomRef.current
      footerPinToBottomRef.current = false
    }

    previousFooterActivityRef.current = hasFooterActivity
  }, [hasFooterActivity])

  useEffect(() => {
    if (!hasFooterActivity || messages.length === 0) return
    if (!isAtBottomRef.current && !footerPinToBottomRef.current) return

    const syncToBottom = () => {
      // Keep the live tail in view while generation/typing footer content changes height.
      virtuosoRef.current?.autoscrollToBottom()
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'auto' })
    }

    syncToBottom()
    const frameId = window.requestAnimationFrame(syncToBottom)
    const timeoutId = window.setTimeout(syncToBottom, 90)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [hasFooterActivity, messages.length, aiProcessingStage])

  useEffect(() => {
    const handleFocusChatMarker = (event: Event) => {
      const customEvent = event as CustomEvent<{ insightId?: string }>
      const insightId = customEvent.detail?.insightId
      if (!insightId) return

      trackSessionEvent({
        eventType: 'navigation',
        eventName: 'focus_chat_marker_from_insight',
        teamId: currentTeamId || undefined,
        actorUserId: currentUser?.id,
        insightId,
      })

      const markerIndex = markerMessageIndexByInsight[insightId]
      if (typeof markerIndex === 'number') {
        virtuosoRef.current?.scrollToIndex({ index: markerIndex, align: 'center', behavior: 'smooth' })
      }

      const escapedInsightId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(insightId) : insightId
      setTimeout(() => {
        const markers = document.querySelectorAll<HTMLElement>(`[data-linked-insight-id="${escapedInsightId}"]`)
        if (!markers.length) return

        const target = markers[markers.length - 1]
        target.classList.add('fypai-link-highlight')
        setTimeout(() => {
          target.classList.remove('fypai-link-highlight')
        }, 1800)
      }, 220)
    }

    window.addEventListener('fypai:focus-chat-marker', handleFocusChatMarker as EventListener)
    return () => {
      window.removeEventListener('fypai:focus-chat-marker', handleFocusChatMarker as EventListener)
    }
  }, [markerMessageIndexByInsight, currentTeamId, currentUser?.id])

  useEffect(() => {
    const handleLinkHover = (event: Event) => {
      const customEvent = event as CustomEvent<{ insightId?: string; active?: boolean }>
      const insightId = customEvent.detail?.insightId
      if (!insightId) return

      const escapedInsightId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(insightId) : insightId
      const markers = document.querySelectorAll<HTMLElement>(`[data-linked-insight-id="${escapedInsightId}"]`)
      markers.forEach((marker) => {
        if (customEvent.detail?.active) {
          marker.classList.add('fypai-link-highlight-soft')
        } else {
          marker.classList.remove('fypai-link-highlight-soft')
        }
      })
    }

    window.addEventListener('fypai:link-hover', handleLinkHover as EventListener)
    return () => {
      window.removeEventListener('fypai:link-hover', handleLinkHover as EventListener)
    }
  }, [])

  useEffect(() => {
    const container = chatViewportRef.current
    if (!container) return

    const setHoveredInsight = (nextInsightId: string | null) => {
      const previousInsightId = axisHoverInsightIdRef.current
      if (previousInsightId === nextInsightId) return

      axisHoverInsightIdRef.current = nextInsightId

      if (previousInsightId) {
        window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: previousInsightId, active: false } }))
      }

      if (nextInsightId) {
        window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: nextInsightId, active: true } }))
      }
    }

    const evaluateAxisHover = (x: number, y: number) => {
      const bounds = container.getBoundingClientRect()
      const withinChatWidth = x >= bounds.left && x <= bounds.right
      const withinChatHeight = y >= bounds.top && y <= bounds.bottom

      if (!withinChatWidth || !withinChatHeight) {
        setHoveredInsight(null)
        return
      }

      const markers = container.querySelectorAll<HTMLElement>('[data-linked-insight-id]')
      let matchedInsightId: string | null = null
      let bestDistance = Number.POSITIVE_INFINITY

      markers.forEach((marker) => {
        const insightId = marker.dataset.linkedInsightId
        if (!insightId) return

        const rect = marker.getBoundingClientRect()
        if (y < rect.top - AXIS_HOVER_VERTICAL_PAD || y > rect.bottom + AXIS_HOVER_VERTICAL_PAD) return

        const markerCenterY = rect.top + rect.height / 2
        const distance = Math.abs(markerCenterY - y)
        if (distance < bestDistance) {
          bestDistance = distance
          matchedInsightId = insightId
        }
      })

      setHoveredInsight(matchedInsightId)
    }

    axisHoverEvaluatorRef.current = evaluateAxisHover

    const onMouseMove = (event: MouseEvent) => {
      axisHoverPointerRef.current = { x: event.clientX, y: event.clientY }

      if (axisHoverRafRef.current !== null) return
      axisHoverRafRef.current = window.requestAnimationFrame(() => {
        axisHoverRafRef.current = null
        const point = axisHoverPointerRef.current
        if (!point) return
        evaluateAxisHover(point.x, point.y)
      })
    }

    const onMouseLeave = () => {
      axisHoverPointerRef.current = null
      setHoveredInsight(null)
    }

    container.addEventListener('mousemove', onMouseMove, { passive: true })
    container.addEventListener('mouseleave', onMouseLeave)

    return () => {
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      axisHoverEvaluatorRef.current = null

      if (axisHoverRafRef.current !== null) {
        window.cancelAnimationFrame(axisHoverRafRef.current)
        axisHoverRafRef.current = null
      }

      const previousInsightId = axisHoverInsightIdRef.current
      axisHoverInsightIdRef.current = null
      if (previousInsightId) {
        window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: previousInsightId, active: false } }))
      }
    }
  }, [currentTeamId])

  useEffect(() => {
    const point = axisHoverPointerRef.current
    if (!point || !axisHoverEvaluatorRef.current) return

    axisHoverEvaluatorRef.current(point.x, point.y)
  }, [messages.length, hasFooterActivity])

  useEffect(() => {
    if (!enableTimelineSync) return

    const handleAnchorSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ source?: 'chat' | 'right-panel'; insightId?: string }>
      if (customEvent.detail?.source !== 'right-panel') return

      const insightId = customEvent.detail.insightId
      if (!insightId) return

      if (lastAppliedInsightRef.current?.id === insightId && Date.now() - lastAppliedInsightRef.current.at < 1400) {
        return
      }

      const markerIndex = markerMessageIndexByInsight[insightId]
      if (typeof markerIndex !== 'number') return

      applyingExternalSyncRef.current = true
      suppressAnchorEmitUntilRef.current = Date.now() + 1600
      lastAppliedInsightRef.current = { id: insightId, at: Date.now() }
      virtuosoRef.current?.scrollToIndex({ index: markerIndex, align: 'center', behavior: 'smooth' })
      setTimeout(() => {
        applyingExternalSyncRef.current = false
      }, 420)
    }

    window.addEventListener('fypai:anchor-sync', handleAnchorSync as EventListener)
    return () => {
      window.removeEventListener('fypai:anchor-sync', handleAnchorSync as EventListener)
    }
  }, [enableTimelineSync, markerMessageIndexByInsight])

  // Get current team and members from EntityStore
  const team = useEntityStore((state) => 
    currentTeamId ? state.getTeam(currentTeamId) : null
  )
  
  const members = team?.members || []
  
  // Get online status function from SessionStore
  const isUserOnline = (userId: string) => {
    return useSessionStore.getState().presence.onlineUsers.includes(userId)
  }

  // Show loading state
  if (isLoading && messages.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  const renderMessage = (message: MessageDTO) => {
        const isInsightLinkMarker =
          (message.metadata?.markerType === 'action-insight-link' || message.metadata?.markerType === 'insight-link') &&
          Boolean(message.metadata?.linkedInsightId)

        // Message alignment and style
        if (message.authorId === currentUser?.id) {
          // Current user: right - use same per-user palette source as the rest of the app
          const userTheme = getMessageSurfaceTheme(currentUser.id, members)
          const userAvatarBgColor = getAvatarBackgroundColor(currentUser.id, members)
          return (
            <div className="flex justify-end">
              <div className="group flex items-center space-x-2">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500 mb-1">You</span>
                  <div className={`${userTheme.bubbleBg} border ${userTheme.bubbleBorder} ${userTheme.bubbleText} rounded-xl p-3 shadow-sm w-fit min-w-[4rem] max-w-[70%}`}>
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </div>
                <div className="relative">
                  <div className={`w-8 h-8 rounded-full ${userAvatarBgColor} flex items-center justify-center text-white font-semibold text-xs`}>
                    {getUserInitials(currentUser.name)}
                  </div>
                  {isUserOnline(currentUser.id) && (
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
                  )}
                </div>
              </div>
            </div>
          )
        } else if (message.authorId === 'agent') {
          if (isInsightLinkMarker) {
            const insightId = message.metadata?.linkedInsightId
            const markerLabel = message.metadata?.markerLabel?.toLowerCase() || ''
            const linkedInsight = insightId ? insightsById[insightId] : undefined
            const isHiddenInsightMarker =
              linkedInsight?.status === 'dismissed' || linkedInsight?.status === 'archived'
            const inferredInsightType =
              message.metadata?.linkedInsightType ||
              (markerLabel.includes('action')
                ? 'action'
                : markerLabel.includes('research') || markerLabel.includes('document') || markerLabel.includes('brief')
                ? 'document'
                : markerLabel.includes('summary')
                ? 'summary'
                : markerLabel.includes('suggestion')
                ? 'suggestion'
                : undefined)
            const visuals = getLinkVisuals({
              insightId,
              insightType: inferredInsightType,
            })
            const displayMarkerLabel = (message.metadata?.markerLabel || 'Insight').replace(
              /\b\w/g,
              (character) => character.toUpperCase()
            )
            const markerTitle = resolveMarkerInsightTitle(
              linkedInsight,
              message.metadata?.sourceActionTitle,
              message.content,
            )
            return (
              <div
                id={`marker-${message.id}`}
                className="flex justify-center"
              >
                <button
                  type="button"
                  data-linked-insight-id={insightId}
                  data-linked-insight-type={inferredInsightType}
                  onMouseEnter={() => {
                    if (!insightId) return
                    window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId, active: true } }))
                  }}
                  onMouseLeave={() => {
                    if (!insightId) return
                    window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId, active: false } }))
                  }}
                  onClick={() => {
                    const insightId = message.metadata?.linkedInsightId
                    if (!insightId) return

                    trackSessionEvent({
                      eventType: 'navigation',
                      eventName: 'focus_insight_from_marker',
                      teamId: currentTeamId || undefined,
                      actorUserId: currentUser?.id,
                      insightId,
                      messageId: message.id,
                    })

                    window.dispatchEvent(new CustomEvent('fypai:focus-insight', {
                      detail: {
                        insightId,
                        preferredTab: 'all',
                        source: 'chat-marker',
                      },
                    }))
                  }}
                  className={`max-w-[85%] rounded-md border px-4 py-2.5 text-left text-xs leading-5 ${
                    isHiddenInsightMarker
                      ? 'border-slate-300 bg-slate-100 text-slate-500 hover:bg-slate-100'
                      : visuals.marker
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 font-semibold leading-5 ${
                        isHiddenInsightMarker ? 'text-slate-600' : visuals.icon
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isHiddenInsightMarker ? 'bg-slate-400' : visuals.dot}`} />
                      <span>🔗 {displayMarkerLabel} Marker</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-current leading-5">
                      {markerTitle}
                    </span>
                  </span>
                </button>
              </div>
            )
          }

          // Agent: center, brand accent
          const tier = message.agentMetadata?.tier;
          const isAutonomous = Boolean(message.metadata?.chimeRuleName);
          const agentBubbleTheme = isAutonomous
            ? 'bg-amber-50 border-amber-300 text-amber-950'
            : 'bg-violet-100 border-violet-500 text-violet-950';

          return (
            <div className="flex justify-center">
              <div className="flex flex-col items-center max-w-[80%]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="relative w-6 h-6 rounded-full bg-violet-700 flex items-center justify-center text-white text-[10px] font-semibold border border-violet-500">
                    AI
                    <span className="absolute -bottom-0.5 -right-0.5 block h-2 w-2 rounded-full bg-emerald-600 ring-1 ring-white"></span>
                  </div>
                  {tier && (
                    <span
                      className={
                        tier === 'tier1'
                          ? 'inline-flex items-center rounded-md border border-emerald-700 bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm'
                          : getChipClass('brand', 'xs')
                      }
                    >
                      {tier === 'tier1' ? 'Fast' : 'Smart'}
                    </span>
                  )}
                  {isAutonomous && (
                    <span className={getChipClass('warning', 'xs')}>
                      Auto
                    </span>
                  )}
                </div>
                <div className={`rounded-xl p-3 shadow-sm w-full border ${agentBubbleTheme}`}>
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="whitespace-pre-wrap break-words font-medium mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="break-words">{children}</li>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                
                {/* Phase 6.5: Agent Metadata Display */}
                {showAIDetails && (
                  <>
                    {console.log('[MessageList] Agent message metadata:', { 
                      id: message.id,
                      hasAgentMetadata: !!message.agentMetadata,
                      agentMetadata: message.agentMetadata,
                      metadata: message.metadata
                    })}
                    <AgentMetadataTag 
                      agentMetadata={message.agentMetadata} 
                      messageMetadata={message.metadata}
                    />
                  </>
                )}
                
                {/* Phase 6.5: RAG Context Viewer */}
                {showAIDetails && message.agentMetadata?.ragContext && (
                  <RAGContextPanel ragContext={message.agentMetadata.ragContext} />
                )}

                <FeedbackButtons
                  messageId={message.id}
                  userId={currentUser?.id}
                  chimeRuleId={message.metadata?.chimeRuleId}
                />
              </div>
            </div>
          )
        } else {
          // Other users: left, outlined, color per user
          const member = members.find((m) => m.userId === message.authorId)
          const userTheme = getMessageSurfaceTheme(message.authorId, members)
          const avatarBgColor = getAvatarBackgroundColor(message.authorId, members)
          return (
            <div className="flex justify-start">
              <div className="group flex items-center space-x-2">
                <div className="relative">
                  <div className={`w-8 h-8 rounded-full ${avatarBgColor} flex items-center justify-center text-white font-semibold text-xs`}>
                    {getUserInitials(member?.name || 'User')}
                  </div>
                  {isUserOnline(message.authorId) && (
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
                  )}
                </div>
                <div className="flex flex-col items-start">
                  <span className={`text-xs mb-1 ${userTheme.bubbleMutedText}`}>{member?.name || 'User'}</span>
                  <div className={`border ${userTheme.bubbleBorder} rounded-xl p-3 w-fit min-w-[4rem] max-w-[70%] shadow-sm ${userTheme.bubbleBg} ${userTheme.bubbleText}`}> 
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        }
  }

  const handleJumpToLatest = () => {
    if (messages.length === 0) return

    trackSessionEvent({
      eventType: 'navigation',
      eventName: 'jump_to_latest',
      teamId: currentTeamId || undefined,
      actorUserId: currentUser?.id,
    })

    setUnseenMessageCount(0)
    virtuosoRef.current?.scrollToIndex({
      index: messages.length - 1,
      align: 'end',
      behavior: 'smooth',
    })
  }

  return (
    <div ref={chatViewportRef} className="relative h-full overflow-hidden">
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        overscan={300}
        atBottomThreshold={24}
        atBottomStateChange={(atBottom) => {
          isAtBottomRef.current = atBottom
          if (!hasFooterActivity) {
            atBottomBeforeFooterRef.current = atBottom
          }
          setIsAtBottom(atBottom)
          if (atBottom) {
            setUnseenMessageCount(0)

            if (enableTimelineSync) {
              const now = Date.now()
              if (now - lastBottomSyncEmitAtRef.current > CHAT_BOTTOM_SYNC_EMIT_INTERVAL_MS) {
                lastBottomSyncEmitAtRef.current = now
                window.dispatchEvent(
                  new CustomEvent('fypai:anchor-sync', {
                    detail: {
                      source: 'chat',
                      syncMode: 'bottom',
                    },
                  })
                )
              }
            }
          }
        }}
        followOutput={(isAtBottom) => (isAtBottom ? 'auto' : false)}
        className="h-full"
        rangeChanged={({ startIndex, endIndex }) => {
          if (!enableTimelineSync || applyingExternalSyncRef.current) return
          if (isAtBottomRef.current) return
          if (Date.now() < suppressAnchorEmitUntilRef.current) return

          const now = Date.now()
          if (now - lastChatSyncEmitAtRef.current < CHAT_ANCHOR_SYNC_EMIT_INTERVAL_MS) return
          lastChatSyncEmitAtRef.current = now

          const middleIndex = Math.floor((startIndex + endIndex) / 2)
          let bestInsightId: string | null = null
          let bestDistance = Number.POSITIVE_INFINITY

          for (let index = startIndex; index <= endIndex; index += 1) {
            const insightId = markerInsightByMessageIndex[index]
            if (!insightId) continue

            const distance = Math.abs(index - middleIndex)
            if (distance < bestDistance) {
              bestDistance = distance
              bestInsightId = insightId
            }
          }

          if (!bestInsightId || bestInsightId === lastAnchorSyncInsightRef.current) return
          lastAnchorSyncInsightRef.current = bestInsightId

          window.dispatchEvent(
            new CustomEvent('fypai:anchor-sync', {
              detail: {
                source: 'chat',
                insightId: bestInsightId,
              },
            })
          )
        }}
        itemContent={(_, message) => (
          <div className="px-4 py-2">
            {renderMessage(message)}
          </div>
        )}
        components={{
          Footer: () =>
            hasFooterActivity ? (
              <div className="px-4 py-2">
                {showPendingInsightMarker && (
                  <div className="mb-2 flex justify-center">
                    <div className="max-w-[85%] rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-xs text-indigo-700">
                      <div className="flex items-center gap-2 leading-5">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                        <span className="font-semibold">🔗 {pendingMarkerLabel}</span>
                        <span className="opacity-90">Generating...</span>
                      </div>
                    </div>
                  </div>
                )}
                <TypingIndicator
                  userNames={typingUserNames}
                  aiStage={aiProcessingStage}
                />
              </div>
            ) : null,
        }}
      />

      {!isAtBottom && messages.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-20">
          <button
            type="button"
            onClick={handleJumpToLatest}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md transition hover:border-slate-400 hover:bg-white"
          >
            <span>Jump to latest</span>
            {unseenMessageCount > 0 && (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unseenMessageCount > 99 ? '99+' : unseenMessageCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}