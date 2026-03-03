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
import { useEffect, useRef, useMemo } from 'react'
import { useEntityStore } from '@/stores/entityStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { MessageDTO } from '@/types'
import { getMessages } from '@/services/messageService'
import { createInsight } from '@/services/insightService'
import { TypingIndicator } from './TypingIndicator'
import { AgentMetadataTag } from './AgentMetadataTag'
import { RAGContextPanel } from './RAGContextPanel'
import { FeedbackButtons } from './FeedbackButtons'
import { getAvatarBackgroundColor, getMessageBorderColor, getUserInitials } from '../../utils/avatarUtils'
import ReactMarkdown from 'react-markdown'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'

const EMPTY_ARRAY: readonly string[] = Object.freeze([])

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
  
  // Phase 6.5: Get showAIDetails preference
  const showAIDetails = useUIStore((state) => state.preferences.showAIDetails)
  const enableTimelineSync = useUIStore((state) => state.preferences.enableTimelineSync)
  
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const promotingFromMessageRef = useRef<Set<string>>(new Set())
  const applyingExternalSyncRef = useRef(false)
  const lastAnchorSyncInsightRef = useRef<string | null>(null)
  const suppressAnchorEmitUntilRef = useRef(0)
  const lastAppliedInsightRef = useRef<{ id: string; at: number } | null>(null)

  const handlePromoteAgentMessage = async (message: MessageDTO) => {
    if (!message?.content || promotingFromMessageRef.current.has(message.id)) return

    const excerpt = String(message.content).replace(/\s+/g, ' ').trim().slice(0, 500)
    if (!excerpt) return

    promotingFromMessageRef.current.add(message.id)
    try {
      const actionTitle = excerpt.length > 80 ? `${excerpt.slice(0, 80)}...` : excerpt
      await createInsight({
        teamId: message.teamId,
        type: 'action',
        title: `Action: ${actionTitle}`,
        content: `- ${excerpt}`,
        priority: 'medium',
        tags: ['promoted-from-agent-message', 'user-requested'],
        relatedMessageIds: [message.id],
        metadata: {
          sourceMessageId: message.id,
          sourceMessageExcerpt: excerpt,
        } as any,
      })
    } catch (error) {
      console.error('[MessageList] Failed to promote agent message:', error)
    } finally {
      promotingFromMessageRef.current.delete(message.id)
    }
  }

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

  // Check if agent is typing
  const isAgentTyping = useMemo(() => {
    return typingUserIds?.includes('agent') || false
  }, [typingUserIds])

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
    if (messages.length === 0) return
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'auto' })
  }, [currentTeamId, messages.length])

  useEffect(() => {
    const handleFocusChatMarker = (event: Event) => {
      const customEvent = event as CustomEvent<{ insightId?: string }>
      const insightId = customEvent.detail?.insightId
      if (!insightId) return

      const markerIndex = markerMessageIndexByInsight[insightId]
      if (typeof markerIndex === 'number') {
        virtuosoRef.current?.scrollToIndex({ index: markerIndex, align: 'center', behavior: 'smooth' })
      }

      const escapedInsightId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(insightId) : insightId
      setTimeout(() => {
        const markers = document.querySelectorAll<HTMLElement>(`[data-linked-insight-id="${escapedInsightId}"]`)
        if (!markers.length) return

        const target = markers[markers.length - 1]
        target.classList.add('ring-2', 'ring-indigo-400', 'ring-offset-2')
        setTimeout(() => {
          target.classList.remove('ring-2', 'ring-indigo-400', 'ring-offset-2')
        }, 1800)
      }, 220)
    }

    window.addEventListener('fypai:focus-chat-marker', handleFocusChatMarker as EventListener)
    return () => {
      window.removeEventListener('fypai:focus-chat-marker', handleFocusChatMarker as EventListener)
    }
  }, [markerMessageIndexByInsight])

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
          // Current user: right - use consistent color from team position
          const userBgColor = getAvatarBackgroundColor(currentUser.id, members);
          return (
            <div className="flex justify-end">
              <div className="flex items-center space-x-2">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500 mb-1">You</span>
                  <div className="bg-blue-600 text-white rounded-lg p-3 w-fit min-w-[4rem] max-w-[70%]">
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                  {message.metadata?.routeMode && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">
                      <span className="font-medium">Routed {message.metadata.routeMode === 'research' ? 'Research' : 'Ask'}</span>
                      {typeof message.metadata.routeConfidence === 'number' && (
                        <span>• {Math.round(message.metadata.routeConfidence * 100)}%</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <div className={`w-8 h-8 rounded-full ${userBgColor} flex items-center justify-center text-white font-semibold text-xs`}>
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
            return (
              <div
                id={`marker-${message.id}`}
                data-linked-insight-id={message.metadata?.linkedInsightId}
                className="flex justify-center"
              >
                <button
                  type="button"
                  onClick={() => {
                    const insightId = message.metadata?.linkedInsightId
                    if (!insightId) return
                    window.dispatchEvent(new CustomEvent('fypai:focus-insight', {
                      detail: { insightId },
                    }))
                  }}
                  className="max-w-[85%] rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-xs text-indigo-700 hover:bg-indigo-100"
                >
                  <span className="font-semibold">🔗 {message.metadata?.markerLabel || 'Insight'} Marker</span>
                  <span className="ml-2">{message.metadata?.sourceActionTitle || message.content}</span>
                  <span className="ml-2 text-indigo-500">(open insight)</span>
                </button>
              </div>
            )
          }

          // Agent: center, bright purple
          const tier = message.agentMetadata?.tier;
          const isAutonomous = Boolean(message.metadata?.chimeRuleName);

          return (
            <div className="flex justify-center">
              <div className="flex flex-col items-center max-w-[80%]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="relative w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-[10px] font-semibold border border-purple-300">
                    AI
                    <span className="absolute -bottom-0.5 -right-0.5 block h-2 w-2 rounded-full bg-green-500 ring-1 ring-white"></span>
                  </div>
                  {tier && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      tier === 'tier1' 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}>
                      {tier === 'tier1' ? 'Fast' : 'Smart'}
                    </span>
                  )}
                  {isAutonomous && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 border border-orange-200">
                      Auto
                    </span>
                  )}
                </div>
                <div className={`text-white rounded-xl p-3 shadow-md w-full border-2 ${
                  isAutonomous
                    ? 'bg-orange-500 border-orange-600'
                    : 'bg-purple-500 border-purple-600'
                }`}>
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="whitespace-pre-wrap break-words font-semibold mb-2 last:mb-0">{children}</p>,
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

                {!isInsightLinkMarker && (
                  <button
                    type="button"
                    onClick={() => handlePromoteAgentMessage(message)}
                    className="mt-2 rounded border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100"
                  >
                    Promote to Action
                  </button>
                )}
              </div>
            </div>
          )
        } else {
          // Other users: left, outlined, color per user
          const member = members.find((m) => m.userId === message.authorId)
          const borderColor = getMessageBorderColor(message.authorId, members)
          const avatarBgColor = getAvatarBackgroundColor(message.authorId, members)
          return (
            <div className="flex justify-start">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <div className={`w-8 h-8 rounded-full ${avatarBgColor} flex items-center justify-center text-white font-semibold text-xs`}>
                    {getUserInitials(member?.name || 'User')}
                  </div>
                  {isUserOnline(message.authorId) && (
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
                  )}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-xs text-gray-500 mb-1">{member?.name || 'User'}</span>
                  <div className={`border-2 ${borderColor} rounded-lg p-3 w-fit min-w-[4rem] max-w-[70%] bg-white text-gray-900`}> 
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                  {message.metadata?.routeMode && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">
                      <span className="font-medium">Routed {message.metadata.routeMode === 'research' ? 'Research' : 'Ask'}</span>
                      {typeof message.metadata.routeConfidence === 'number' && (
                        <span>• {Math.round(message.metadata.routeConfidence * 100)}%</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        }
  }

  return (
    <div className="h-full overflow-hidden">
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        overscan={300}
        followOutput="auto"
        className="h-full"
        rangeChanged={({ startIndex, endIndex }) => {
          if (!enableTimelineSync || applyingExternalSyncRef.current) return
          if (Date.now() < suppressAnchorEmitUntilRef.current) return

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
            typingUserNames.length > 0 || isAgentTyping ? (
              <div className="px-4 py-2">
                <TypingIndicator
                  userNames={typingUserNames}
                  isAgentTyping={isAgentTyping}
                  aiStage={aiProcessingStage}
                />
              </div>
            ) : null,
        }}
      />
    </div>
  )
}