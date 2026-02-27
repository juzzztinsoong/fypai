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
import { getMessages } from '@/services/messageService'
import { TypingIndicator } from './TypingIndicator'
import { AgentMetadataTag } from './AgentMetadataTag'
import { RAGContextPanel } from './RAGContextPanel'
import { FeedbackButtons } from './FeedbackButtons'
import { getAvatarBackgroundColor, getMessageBorderColor, getUserInitials } from '../../utils/avatarUtils'
import ReactMarkdown from 'react-markdown'

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
  
  const scrollRef = useRef<HTMLDivElement>(null)

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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, currentTeamId])

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

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden p-4 space-y-4">
      {messages.map((message) => {
        // Message alignment and style
        if (message.authorId === currentUser?.id) {
          // Current user: right - use consistent color from team position
          const userBgColor = getAvatarBackgroundColor(currentUser.id, members);
          return (
            <div key={message.id} className="flex justify-end">
              <div className="flex items-center space-x-2">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500 mb-1">You</span>
                  <div className="bg-blue-600 text-white rounded-lg p-3 w-fit min-w-[4rem] max-w-[70%]">
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
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
          // Agent: center, bright purple
          const tier = message.agentMetadata?.tier;
          const isAutonomous = Boolean(message.metadata?.chimeRuleName);
          const isLongForm = message.contentType === 'ai_longform';
          const isReactive = !isAutonomous && !isLongForm;
          const parentId = message.metadata?.parentMessageId;
          const parentPreview = parentId
            ? messagesById[parentId]?.content?.slice(0, 100)
            : undefined;

          return (
            <div key={message.id} className="flex justify-center">
              <div className="flex flex-col items-center max-w-[80%]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-purple-700 font-bold">AI Assistant</span>
                  {tier && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      tier === 'tier1' 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}>
                      {tier === 'tier1' ? '⚡ Fast' : '🧠 Smart'}
                    </span>
                  )}
                  {isReactive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 border border-blue-200">
                      💬 Reply
                    </span>
                  )}
                  {/* Show chime indicator if triggered by rule */}
                  {isAutonomous && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 border border-orange-200">
                      🔔 Auto
                    </span>
                  )}
                  {isLongForm && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                      📄 Insight
                    </span>
                  )}
                </div>
                {parentPreview && (
                  <div className="w-full mb-1 text-[11px] text-purple-900/80 bg-purple-50 border border-purple-200 rounded-md px-2 py-1">
                    Replying to: {parentPreview}{messagesById[parentId!]?.content && messagesById[parentId!]?.content.length > 100 ? '…' : ''}
                  </div>
                )}
                <div className={`text-[11px] w-full mb-1 ${
                  isAutonomous ? 'text-orange-700' : isLongForm ? 'text-emerald-700' : 'text-blue-700'
                }`}>
                  {isAutonomous
                    ? 'Autonomous AI chime'
                    : isLongForm
                    ? 'AI long-form response'
                    : 'Reactive AI response'}
                </div>
                <div className={`text-white rounded-xl p-3 shadow-lg w-full border-2 ${
                  isAutonomous
                    ? 'bg-orange-500 border-orange-600'
                    : isLongForm
                    ? 'bg-emerald-500 border-emerald-600'
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
                
                <div className="mt-2 relative">
                  <svg className="w-8 h-8 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#fff">AI</text>
                  </svg>
                  {isUserOnline('agent') && (
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
                  )}
                </div>
              </div>
            </div>
          )
        } else {
          // Other users: left, outlined, color per user
          const member = members.find((m) => m.userId === message.authorId)
          const borderColor = getMessageBorderColor(message.authorId, members)
          const avatarBgColor = getAvatarBackgroundColor(message.authorId, members)
          return (
            <div key={message.id} className="flex justify-start">
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
                </div>
              </div>
            </div>
          )
        }
      })}
      
      {/* Typing indicator */}
      {(typingUserNames.length > 0 || isAgentTyping) && (
        <TypingIndicator
          userNames={typingUserNames}
          isAgentTyping={isAgentTyping}
          aiStage={aiProcessingStage}
        />
      )}
    </div>
  )
}