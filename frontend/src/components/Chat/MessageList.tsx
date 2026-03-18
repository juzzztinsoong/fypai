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
import { useCallback, useEffect, useRef, useMemo, useState, type ComponentPropsWithoutRef } from 'react'
import { useEntityStore } from '@/stores/entityStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore, type AIProcessingTargetType } from '@/stores/sessionStore'
import type { AIInsightDTO, MessageDTO } from '@/types'
import { getMessages } from '@/services/messageService'
import { trackSessionEvent } from '@/services/analyticsService'
import { TypingIndicator } from './TypingIndicator'
import { AgentMetadataTag } from './AgentMetadataTag'
import { RAGContextPanel } from './RAGContextPanel'
import { FeedbackButtons } from './FeedbackButtons'
import { getAvatarBackgroundColor, getMessageSurfaceTheme, getUserInitials } from '../../utils/avatarUtils'
import { getLinkVisuals } from '@/utils/linkVisuals'
import { emitDraftPromotion, extractDraftExcerpt } from '@/utils/draftComposer'
import { getChipClass, getElevationClass } from '@/styles/uiTokens'
import ReactMarkdown from 'react-markdown'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'

const EMPTY_ARRAY: readonly string[] = Object.freeze([])
const AXIS_HOVER_VERTICAL_PAD = 4
const CHAT_ANCHOR_SYNC_EMIT_INTERVAL_MS = 80
const CHAT_BOTTOM_SYNC_EMIT_INTERVAL_MS = 150
const REPLY_PREVIEW_MAX_CHARS = 160
const GENERIC_MARKER_TITLES = new Set([
  'conversation summary',
  'summary',
  'research',
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

const truncateReplyPreview = (raw: string): string => {
  const normalized = raw.replace(/\s+/g, ' ').trim()
  if (normalized.length <= REPLY_PREVIEW_MAX_CHARS) return normalized

  const slice = normalized.slice(0, REPLY_PREVIEW_MAX_CHARS + 1)
  const lastSpace = slice.lastIndexOf(' ')
  const cutoff = lastSpace > Math.floor(REPLY_PREVIEW_MAX_CHARS * 0.65) ? lastSpace : REPLY_PREVIEW_MAX_CHARS
  return `${slice.slice(0, cutoff).trimEnd()}...`
}

const formatProcessingTargetLabel = (targetType?: AIProcessingTargetType): string | null => {
  if (!targetType) return null
  if (targetType === 'summary') return 'Summary'
  if (targetType === 'document') return 'Research'
  if (targetType === 'action') return 'Action Items'
  if (targetType === 'suggestion') return 'Help'
  if (targetType === 'chat') return 'Response'
  return null
}

const formatInsightTypeLabel = (insightType?: string): string | null => {
  if (!insightType) return null
  if (insightType === 'summary') return 'Summary'
  if (insightType === 'document') return 'Research'
  if (insightType === 'action') return 'Action'
  if (insightType === 'suggestion') return 'Help'
  return 'Insight'
}

function MarkdownLink({ href, children }: ComponentPropsWithoutRef<'a'>) {
  if (!href) {
    return <span className="underline decoration-slate-400 [overflow-wrap:anywhere]">{children}</span>
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-violet-700 underline decoration-violet-400 underline-offset-2 break-all hover:text-violet-800"
    >
      {children}
    </a>
  )
}

type ReplyPreviewTarget = {
  kind: 'message' | 'insight'
  id: string
  label: string
  excerpt: string
  insightType?: AIInsightDTO['type']
}

type MessageFocusSource = 'reply-preview' | 'draft-context' | 'external'

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
  const aiProcessingDetail = useSessionStore((state) =>
    state.getAIProcessingDetail(currentTeamId || '')
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
      .map((id) => usersById[id]?.name?.trim() || null)
      .filter((name): name is string => name !== null)
  }, [typingUserIds, currentUser, usersById])

  const effectiveProcessingStage =
    aiProcessingStage !== 'idle' ? aiProcessingStage : isInsightGenerationLoading ? 'thinking' : 'idle'

  const pendingTargetLabel = useMemo(
    () => formatProcessingTargetLabel(aiProcessingDetail?.targetType),
    [aiProcessingDetail?.targetType],
  )

  const pendingMarkerTag = useMemo(() => {
    if (!pendingTargetLabel || pendingTargetLabel === 'Response') return null
    return pendingTargetLabel
  }, [pendingTargetLabel])

  const pendingMarkerStatus = useMemo(() => {
    const explicitLabel = aiProcessingDetail?.label?.trim()
    if (explicitLabel) return explicitLabel

    if (effectiveProcessingStage === 'thinking') {
      return pendingTargetLabel
        ? `Thinking through ${pendingTargetLabel.toLowerCase()} request`
        : 'Thinking through request'
    }

    if (effectiveProcessingStage === 'searching-memory') {
      return 'Searching team memory'
    }

    if (effectiveProcessingStage === 'analyzing') {
      return pendingTargetLabel
        ? `Generating ${pendingTargetLabel.toLowerCase()}`
        : 'Generating insight'
    }

    return 'Preparing generation'
  }, [aiProcessingDetail?.label, effectiveProcessingStage, pendingTargetLabel])

  const showPendingInsightMarker =
    effectiveProcessingStage !== 'idle'

  const hasFooterActivity =
    showPendingInsightMarker || typingUserNames.length > 0

  const handlePromoteMessageToDraft = useCallback((message: MessageDTO, sourceLabel: string) => {
    if (!currentTeamId) return

    const excerpt = extractDraftExcerpt(message.content)
    if (!excerpt) return

    emitDraftPromotion({
      sourceType: 'message',
      sourceId: message.id,
      sourceLabel,
      excerpt,
      parentMessageId: message.id,
      teamId: currentTeamId,
    })
  }, [currentTeamId])

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

    // When marker cards are folded into agent replies, anchor to the reply card index.
    messages.forEach((message, index) => {
      if (message.authorId !== 'agent') return
      if (message.metadata?.markerType === 'action-insight-link' || message.metadata?.markerType === 'insight-link') return

      const parentMessageId = message.metadata?.parentMessageId
      if (!parentMessageId) return

      Object.entries(insightsById).forEach(([insightId, insight]) => {
        if (!Array.isArray(insight.relatedMessageIds)) return
        if (!insight.relatedMessageIds.includes(parentMessageId)) return
        if (typeof indexMap[insightId] === 'number' && indexMap[insightId] <= index) return
        indexMap[insightId] = index
      })
    })

    return indexMap
  }, [messages, insightsById])

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

    // Add folded marker associations to agent reply rows for timeline sync.
    messages.forEach((message, index) => {
      if (message.authorId !== 'agent') return
      if (message.metadata?.markerType === 'action-insight-link' || message.metadata?.markerType === 'insight-link') return

      const parentMessageId = message.metadata?.parentMessageId
      if (!parentMessageId) return

      const matchedInsightId = Object.values(insightsById).find((insight) =>
        Array.isArray(insight.relatedMessageIds) && insight.relatedMessageIds.includes(parentMessageId),
      )?.id

      if (matchedInsightId) {
        indexMap[index] = matchedInsightId
      }
    })

    return indexMap
  }, [messages, insightsById])

  const triggeredInsightByMessageId = useMemo(() => {
    const map: Record<string, { insightType?: AIInsightDTO['type']; label: string }> = {}

    messages.forEach((message) => {
      const linkedInsightId = message.metadata?.linkedInsightId
      const isMarker =
        (message.metadata?.markerType === 'action-insight-link' || message.metadata?.markerType === 'insight-link') &&
        Boolean(linkedInsightId)

      if (!isMarker || !linkedInsightId) return

      const linkedInsight = insightsById[linkedInsightId]
      const inferredType: AIInsightDTO['type'] | undefined =
        message.metadata?.linkedInsightType ||
        linkedInsight?.type ||
        (message.metadata?.markerLabel?.toLowerCase().includes('action')
          ? 'action'
          : message.metadata?.markerLabel?.toLowerCase().includes('research') || message.metadata?.markerLabel?.toLowerCase().includes('document')
          ? 'document'
          : message.metadata?.markerLabel?.toLowerCase().includes('summary')
          ? 'summary'
          : message.metadata?.markerLabel?.toLowerCase().includes('suggestion') || message.metadata?.markerLabel?.toLowerCase().includes('help')
          ? 'suggestion'
          : undefined)

      const label = formatInsightTypeLabel(inferredType) || 'Insight'
      const relatedMessageIds = Array.isArray(linkedInsight?.relatedMessageIds)
        ? linkedInsight.relatedMessageIds
        : []

      relatedMessageIds.forEach((relatedMessageId) => {
        if (!relatedMessageId || map[relatedMessageId]) return
        map[relatedMessageId] = {
          insightType: inferredType,
          label,
        }
      })
    })

    return map
  }, [messages, insightsById])

  const markerContextByParentMessageId = useMemo(() => {
    const map: Record<
      string,
      {
        insightId: string
        insightType?: AIInsightDTO['type']
        markerLabel: string
        markerTitle: string
        markerPreview: string
        markerMessageId: string
      }
    > = {}

    messages.forEach((message) => {
      const linkedInsightId = message.metadata?.linkedInsightId
      const isMarker =
        (message.metadata?.markerType === 'action-insight-link' || message.metadata?.markerType === 'insight-link') &&
        Boolean(linkedInsightId)

      if (!isMarker || !linkedInsightId) return

      const markerLabel = message.metadata?.markerLabel?.toLowerCase() || ''
      const linkedInsight = insightsById[linkedInsightId]
      const insightType =
        message.metadata?.linkedInsightType ||
        linkedInsight?.type ||
        (markerLabel.includes('action')
          ? 'action'
          : markerLabel.includes('research') || markerLabel.includes('document') || markerLabel.includes('brief')
          ? 'document'
          : markerLabel.includes('summary')
          ? 'summary'
          : markerLabel.includes('suggestion') || markerLabel.includes('help')
          ? 'suggestion'
          : undefined)

      const markerTitle = resolveMarkerInsightTitle(
        linkedInsight,
        message.metadata?.sourceActionTitle,
        message.content,
      )

      const markerPreview =
        typeof message.metadata?.markerPreview === 'string'
          ? truncateReplyPreview(message.metadata.markerPreview)
          : ''

      const relatedMessageIds = Array.isArray(linkedInsight?.relatedMessageIds)
        ? linkedInsight.relatedMessageIds
        : []

      relatedMessageIds.forEach((relatedMessageId) => {
        if (!relatedMessageId || map[relatedMessageId]) return
        map[relatedMessageId] = {
          insightId: linkedInsightId,
          insightType,
          markerLabel: (message.metadata?.markerLabel || 'Insight').replace(/\b\w/g, (character) => character.toUpperCase()),
          markerTitle,
          markerPreview,
          markerMessageId: message.id,
        }
      })
    })

    return map
  }, [messages, insightsById])

  const hiddenMarkerMessageIds = useMemo(() => {
    const hidden = new Set<string>()

    messages.forEach((message) => {
      if (message.authorId !== 'agent') return

      const isMarker =
        message.metadata?.markerType === 'action-insight-link' || message.metadata?.markerType === 'insight-link'
      if (isMarker) return

      const parentMessageId = message.metadata?.parentMessageId
      if (!parentMessageId) return

      const markerContext = markerContextByParentMessageId[parentMessageId]
      if (!markerContext) return

      hidden.add(markerContext.markerMessageId)
    })

    return hidden
  }, [messages, markerContextByParentMessageId])

  const messageIndexById = useMemo(() => {
    const indexMap: Record<string, number> = {}
    messages.forEach((message, index) => {
      indexMap[message.id] = index
    })
    return indexMap
  }, [messages])

  const focusMessageById = useCallback(
    (messageId: string, source: MessageFocusSource = 'external') => {
      if (!messageId) return

      const messageIndex = messageIndexById[messageId]
      if (typeof messageIndex !== 'number') return

      trackSessionEvent({
        eventType: 'navigation',
        eventName: 'focus_chat_message',
        teamId: currentTeamId || undefined,
        actorUserId: currentUser?.id,
        messageId,
        metadata: {
          source,
        },
      })

      virtuosoRef.current?.scrollToIndex({ index: messageIndex, align: 'center', behavior: 'smooth' })

      const escapedMessageId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(messageId) : messageId
      setTimeout(() => {
        const target = document.querySelector<HTMLElement>(`[data-message-id="${escapedMessageId}"]`)
        if (!target) return

        target.classList.add('fypai-link-highlight')
        setTimeout(() => {
          target.classList.remove('fypai-link-highlight')
        }, 1800)
      }, 220)
    },
    [messageIndexById, currentTeamId, currentUser?.id],
  )

  const focusInsightFromReplyPreview = useCallback(
    (insightId: string) => {
      if (!insightId) return

      trackSessionEvent({
        eventType: 'navigation',
        eventName: 'focus_insight_from_reply_preview',
        teamId: currentTeamId || undefined,
        actorUserId: currentUser?.id,
        insightId,
      })

      window.dispatchEvent(
        new CustomEvent('fypai:focus-insight', {
          detail: {
            insightId,
            preferredTab: 'all',
            source: 'reply-preview',
          },
        }),
      )
    },
    [currentTeamId, currentUser?.id],
  )

  const resolveReplyPreviewTargets = useCallback(
    (message: MessageDTO): ReplyPreviewTarget[] => {
      const targets: ReplyPreviewTarget[] = []
      const seenTargetKeys = new Set<string>()

      const pushTarget = (target: ReplyPreviewTarget | null) => {
        if (!target) return
        const key = `${target.kind}:${target.id}`
        if (seenTargetKeys.has(key)) return
        seenTargetKeys.add(key)
        targets.push(target)
      }

      const buildMessageTarget = (messageId?: string): ReplyPreviewTarget | null => {
        if (!messageId) return null

        const referencedMessage = messagesById[messageId]
        if (!referencedMessage?.content?.trim()) return null

        const authorLabel =
          referencedMessage.authorId === 'agent'
            ? 'AI'
            : referencedMessage.authorId === currentUser?.id
            ? 'You'
            : usersById[referencedMessage.authorId]?.name || 'Teammate'

        return {
          kind: 'message',
          id: referencedMessage.id,
          label: `Replying to ${authorLabel}`,
          excerpt: truncateReplyPreview(referencedMessage.content),
        }
      }

      const buildInsightTarget = (insightId?: string, labelHint?: string): ReplyPreviewTarget | null => {
        if (!insightId) return null

        const sourceInsight = insightsById[insightId]
        const sourceLabel =
          sourceInsight?.title?.trim() || labelHint?.trim() || 'Insight'
        const sourceExcerpt =
          extractDraftExcerpt(sourceInsight?.content || sourceLabel, REPLY_PREVIEW_MAX_CHARS) || sourceLabel

        return {
          kind: 'insight',
          id: insightId,
          label: `Replying to ${truncateReplyPreview(sourceLabel)}`,
          excerpt: sourceExcerpt,
          insightType: sourceInsight?.type,
        }
      }

      pushTarget(buildMessageTarget(message.metadata?.parentMessageId))

      const draftSourceMessageIds = Array.isArray(message.metadata?.draftSourceMessageIds)
        ? message.metadata.draftSourceMessageIds
        : []
      draftSourceMessageIds.forEach((messageId) => {
        pushTarget(buildMessageTarget(messageId))
      })

      const draftSourceInsightIds = Array.isArray(message.metadata?.draftSourceInsightIds)
        ? message.metadata.draftSourceInsightIds
        : []
      const draftContextLabels = Array.isArray(message.metadata?.draftContextLabels)
        ? message.metadata.draftContextLabels
        : []

      draftSourceInsightIds.forEach((insightId, index) => {
        pushTarget(buildInsightTarget(insightId, draftContextLabels[index]))
      })

      return targets
    },
    [messagesById, insightsById, currentUser?.id, usersById],
  )

  const renderReplyPreview = useCallback(
    (message: MessageDTO, align: 'left' | 'center' | 'right') => {
      const targets = resolveReplyPreviewTargets(message)
      if (targets.length === 0) return null

      const wrapperClass =
        align === 'right'
          ? 'mb-2 w-full text-left text-[11px] leading-4 text-indigo-900'
          : align === 'center'
          ? 'mb-2 w-full text-left text-[11px] leading-4 text-slate-700'
          : 'mb-2 w-full text-left text-[11px] leading-4 text-slate-700'

      const jumpClass = align === 'right' ? 'text-indigo-700' : 'text-slate-600'
      const bubbleClass =
        align === 'right'
          ? 'min-w-0 flex-1 basis-[220px] rounded-md border border-indigo-200/90 bg-white/70 px-2 py-1 text-left transition hover:bg-indigo-100/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-300'
          : 'min-w-0 flex-1 basis-[220px] rounded-md border border-slate-300/80 bg-white/90 px-2 py-1 text-left transition hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300'
      const targetTagClass =
        align === 'right'
          ? 'inline-flex items-center rounded border border-indigo-200 bg-indigo-100/80 px-1 py-0 text-[10px] font-semibold text-indigo-700'
          : 'inline-flex items-center rounded border border-slate-300 bg-slate-100 px-1 py-0 text-[10px] font-semibold text-slate-600'

      const summaryLabel =
        targets.length > 1 ? `Replying to ${targets.length} sources` : targets[0].label

      return (
        <div className={wrapperClass} role="group" aria-label={summaryLabel}>
          {targets.length > 1 && (
            <div className="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">Replying to</div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {targets.map((target) => {
              const insightTypeLabel = formatInsightTypeLabel(target.insightType)
              const jumpLabel =
                target.kind === 'message'
                  ? 'View message'
                  : `View ${(insightTypeLabel || 'Insight').toLowerCase()}`
              const targetKindLabel = target.kind === 'message' ? 'Message' : insightTypeLabel || 'Insight'
              const insightVisuals =
                target.kind === 'insight' ? getLinkVisuals({ insightType: target.insightType }) : null
              const targetTypeChipClass =
                target.kind === 'insight' && insightVisuals
                  ? `inline-flex items-center rounded border px-1 py-0 text-[10px] font-semibold ${insightVisuals.pill}`
                  : targetTagClass
              const targetDisplayLabel =
                targets.length > 1 ? target.label.replace(/^Replying to\s+/i, '') : target.label

              const handleClick = () => {
                if (target.kind === 'message') {
                  focusMessageById(target.id, 'reply-preview')
                  return
                }

                focusInsightFromReplyPreview(target.id)
              }

              return (
                <button
                  key={`${target.kind}:${target.id}`}
                  type="button"
                  onClick={handleClick}
                  className={bubbleClass}
                  title={`${target.label}: ${target.excerpt}`}
                >
                  <div className="mb-0.5 flex items-center justify-between gap-1.5">
                    <span className={targetTypeChipClass}>{targetKindLabel}</span>
                    <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${jumpClass}`}>
                      {jumpLabel}
                    </span>
                  </div>
                  <div className="truncate font-medium">{targetDisplayLabel}</div>
                  <div className="truncate opacity-85">{target.excerpt}</div>
                </button>
              )
            })}
          </div>
        </div>
      )
    },
    [resolveReplyPreviewTargets, focusMessageById, focusInsightFromReplyPreview],
  )

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
    const handleFocusChatMessage = (event: Event) => {
      const customEvent = event as CustomEvent<{ messageId?: string; source?: MessageFocusSource }>
      const messageId = customEvent.detail?.messageId
      if (!messageId) return

      const source =
        customEvent.detail?.source === 'draft-context'
          ? 'draft-context'
          : customEvent.detail?.source === 'reply-preview'
          ? 'reply-preview'
          : 'external'

      focusMessageById(messageId, source)
    }

    window.addEventListener('fypai:focus-chat-message', handleFocusChatMessage as EventListener)
    return () => {
      window.removeEventListener('fypai:focus-chat-message', handleFocusChatMessage as EventListener)
    }
  }, [focusMessageById])

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
          const triggeredInsight = triggeredInsightByMessageId[message.id]
          const triggeredInsightVisual = triggeredInsight
            ? getLinkVisuals({ insightType: triggeredInsight.insightType })
            : null
          return (
            <div id={`message-${message.id}`} data-message-id={message.id} className="flex justify-end">
              <div className="group flex items-center space-x-2">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500 mb-1">You</span>
                  <div className={`${userTheme.bubbleBg} border ${userTheme.bubbleBorder} ${userTheme.bubbleText} rounded-xl p-3 ${getElevationClass('surface')} w-fit min-w-[4rem] max-w-[70%] overflow-hidden`}>
                    {renderReplyPreview(message, 'right')}
                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
                  </div>
                  {triggeredInsight && triggeredInsightVisual && (
                    <div className="mt-1 mb-0.5 flex justify-end">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${triggeredInsightVisual.pill}`}>
                        Triggers {triggeredInsight.label}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handlePromoteMessageToDraft(message, 'You')}
                    className="mt-1 text-[11px] text-slate-500 opacity-0 transition-opacity hover:text-slate-700 group-hover:opacity-100"
                  >
                    Reply
                  </button>
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
          if (hiddenMarkerMessageIds.has(message.id)) {
            return null
          }

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
            const markerPreview =
              typeof message.metadata?.markerPreview === 'string'
                ? truncateReplyPreview(message.metadata.markerPreview)
                : ''
            const markerSourceToken =
              typeof message.metadata?.markerSource === 'string'
                ? message.metadata.markerSource.toLowerCase()
                : ''
            const markerIsAutonomous = markerSourceToken.includes('autonomous')
            const markerCardTheme = isHiddenInsightMarker
              ? 'border-slate-300 bg-slate-100 text-slate-500'
              : markerIsAutonomous
              ? 'border-amber-300/80 bg-amber-50/90 text-amber-950'
              : 'border-violet-200/80 bg-white/95 text-violet-950'
            const markerAccentRail = isHiddenInsightMarker
              ? 'bg-slate-300'
              : markerIsAutonomous
              ? 'bg-amber-400'
              : 'bg-violet-400'
            const markerAvatarTheme = isHiddenInsightMarker
              ? 'bg-slate-500 border-slate-400'
              : markerIsAutonomous
              ? 'bg-amber-700 border-amber-600'
              : 'bg-violet-700 border-violet-500'
            const markerTypeChipClass = isHiddenInsightMarker
              ? 'inline-flex items-center rounded border border-slate-300 bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600'
              : `inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${visuals.pill}`
            return (
              <div
                id={`marker-${message.id}`}
                data-message-id={message.id}
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
                  className={`relative max-w-[85%] rounded-2xl border px-4 py-3 text-left text-xs leading-5 transition ${
                    isHiddenInsightMarker
                      ? markerCardTheme
                      : `${markerCardTheme} ${getElevationClass('raised')}`
                  }`}
                >
                  <span
                    className={`absolute left-0 top-3 h-8 w-1 rounded-r-full ${markerAccentRail}`}
                    aria-hidden="true"
                  />
                  <span className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold text-white ${markerAvatarTheme}`}>
                        AI
                        <span className="absolute -bottom-0.5 -right-0.5 block h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">AI Marker</span>
                      <span className={markerTypeChipClass}>{displayMarkerLabel}</span>
                    </span>
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${isHiddenInsightMarker ? 'bg-slate-400' : visuals.dot}`} />
                    <span className="min-w-0 flex-1 truncate text-current leading-5">
                      {markerTitle}
                    </span>
                  </span>
                  {markerPreview && (
                    <span className={`mt-1 block text-[11px] leading-4 ${isHiddenInsightMarker ? 'text-slate-500' : 'text-slate-600'}`}>
                      {markerPreview}
                    </span>
                  )}
                </button>
              </div>
            )
          }

          // Agent: center, brand accent
          const isAutonomous = Boolean(message.metadata?.chimeRuleName);
          const parentMessageId = message.metadata?.parentMessageId;
          const inferredMarkerContext = parentMessageId
            ? markerContextByParentMessageId[parentMessageId]
            : undefined;
          const linkedInsightId =
            typeof message.metadata?.linkedInsightId === 'string'
              ? message.metadata.linkedInsightId
              : inferredMarkerContext?.insightId;
          const linkedInsightTitle = linkedInsightId
            ? insightsById[linkedInsightId]?.title || inferredMarkerContext?.markerTitle
            : undefined;
          const linkedInsightTypeLabel = formatInsightTypeLabel(
            inferredMarkerContext?.insightType || (linkedInsightId ? insightsById[linkedInsightId]?.type : undefined),
          ) || 'Insight'
          const inlineMarkerVisuals = inferredMarkerContext
            ? getLinkVisuals({ insightType: inferredMarkerContext.insightType })
            : null
          const agentCardTheme = isAutonomous
            ? 'border-amber-300/80 bg-amber-50/90 text-amber-950'
            : 'border-violet-200/80 bg-white/95 text-violet-950';
          const agentAccentRail = isAutonomous ? 'bg-amber-400' : 'bg-violet-400';
          const agentAvatarTheme = isAutonomous
            ? 'bg-amber-700 border-amber-600'
            : 'bg-violet-700 border-violet-500';

          return (
            <div id={`message-${message.id}`} data-message-id={message.id} className="flex justify-center px-2 py-2">
              <div
                className={`relative flex max-w-[80%] flex-col items-start rounded-2xl border p-3 ${getElevationClass('raised')} ${agentCardTheme} overflow-hidden`}
              >
                <span
                  className={`absolute left-0 top-3 h-8 w-1 rounded-r-full ${agentAccentRail}`}
                  aria-hidden="true"
                />
                <div className="mb-1 flex w-full items-center gap-2">
                  <div className={`relative w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold border ${agentAvatarTheme}`}>
                    AI
                    <span className="absolute -bottom-0.5 -right-0.5 block h-2 w-2 rounded-full bg-emerald-600 ring-1 ring-white"></span>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">AI Reply</span>
                  {isAutonomous && (
                    <span className={getChipClass('warning', 'xs')}>
                      Auto
                    </span>
                  )}
                </div>
                <div className="w-full rounded-xl p-2.5">
                  {renderReplyPreview(message, 'center')}
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-medium mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="break-words [overflow-wrap:anywhere]">{children}</li>,
                      a: MarkdownLink,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {inferredMarkerContext && inlineMarkerVisuals && (
                    <button
                      type="button"
                      data-linked-insight-id={linkedInsightId}
                      data-linked-insight-type={inferredMarkerContext.insightType}
                      onMouseEnter={() => {
                        if (!linkedInsightId) return
                        window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: linkedInsightId, active: true } }))
                      }}
                      onMouseLeave={() => {
                        if (!linkedInsightId) return
                        window.dispatchEvent(new CustomEvent('fypai:link-hover', { detail: { insightId: linkedInsightId, active: false } }))
                      }}
                      onClick={() => {
                        if (!linkedInsightId) return
                        trackSessionEvent({
                          eventType: 'navigation',
                          eventName: 'focus_insight_from_agent_message',
                          teamId: currentTeamId || undefined,
                          actorUserId: currentUser?.id,
                          insightId: linkedInsightId,
                          messageId: message.id,
                        })

                        window.dispatchEvent(new CustomEvent('fypai:focus-insight', {
                          detail: {
                            insightId: linkedInsightId,
                            preferredTab: 'all',
                            source: 'agent-message-link',
                          },
                        }))
                      }}
                      className="mt-2 w-full rounded-lg border border-slate-200/90 bg-slate-50/90 px-2.5 py-2 text-left text-[11px] text-slate-700 transition hover:border-slate-300 hover:bg-slate-100/90"
                      title={
                        linkedInsightTitle
                          ? `Open ${linkedInsightTypeLabel.toLowerCase()}: ${linkedInsightTitle}`
                          : `Open linked ${linkedInsightTypeLabel.toLowerCase()}`
                      }
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">AI Marker</span>
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${inlineMarkerVisuals.pill}`}>
                          {inferredMarkerContext.markerLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 leading-4 text-slate-700">
                        <span className={`h-1.5 w-1.5 rounded-full ${inlineMarkerVisuals.dot}`} />
                        <span className="min-w-0 truncate font-medium">{inferredMarkerContext.markerTitle}</span>
                      </div>
                      {inferredMarkerContext.markerPreview && (
                        <div className="mt-1 text-[11px] leading-4 text-slate-600">{inferredMarkerContext.markerPreview}</div>
                      )}
                    </button>
                  )}
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
                <button
                  type="button"
                  onClick={() => handlePromoteMessageToDraft(message, 'AI Reply')}
                  className="mt-2 inline-flex items-center rounded-md border border-indigo-600 bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-700"
                >
                  Reply
                </button>
              </div>
            </div>
          )
        } else {
          // Other users: left, outlined, color per user
          const member = members.find((m) => m.userId === message.authorId)
          const userTheme = getMessageSurfaceTheme(message.authorId, members)
          const avatarBgColor = getAvatarBackgroundColor(message.authorId, members)
          return (
            <div id={`message-${message.id}`} data-message-id={message.id} className="flex justify-start">
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
                  <div className={`border ${userTheme.bubbleBorder} rounded-xl p-3 w-fit min-w-[4rem] max-w-[70%] ${getElevationClass('surface')} ${userTheme.bubbleBg} ${userTheme.bubbleText} overflow-hidden`}> 
                    {renderReplyPreview(message, 'left')}
                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePromoteMessageToDraft(message, member?.name || 'Teammate')}
                    className="mt-1 text-[11px] text-slate-500 opacity-0 transition-opacity hover:text-slate-700 group-hover:opacity-100"
                  >
                    Reply
                  </button>
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
          hiddenMarkerMessageIds.has(message.id) ? null : (
            <div className="px-4 py-2">
              {renderMessage(message)}
            </div>
          )
        )}
        components={{
          Footer: () =>
            hasFooterActivity ? (
              <div className="px-4 py-2">
                {showPendingInsightMarker && (
                  <div className="mb-2 flex justify-center">
                    <div className={`relative max-w-[80%] rounded-2xl border border-violet-200/80 bg-white/95 px-4 py-3 text-xs text-violet-950 ${getElevationClass('raised')}`}>
                      <span className="absolute left-0 top-3 h-8 w-1 rounded-r-full bg-violet-400" aria-hidden="true" />
                      <div className="mb-1 flex items-center gap-2">
                        <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-500 bg-violet-700 text-[9px] font-semibold text-white">
                          AI
                          <span className="absolute -bottom-0.5 -right-0.5 block h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">AI</span>
                        {pendingMarkerTag && (
                          <span className="inline-flex items-center rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                            {pendingMarkerTag}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 leading-5 text-slate-700">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
                        <span className="font-semibold">{pendingMarkerStatus}</span>
                      </div>
                    </div>
                  </div>
                )}
                <TypingIndicator
                  userNames={typingUserNames}
                  aiStage={effectiveProcessingStage}
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
            className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 ${getElevationClass('raised')} transition hover:border-slate-400 hover:bg-white`}
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