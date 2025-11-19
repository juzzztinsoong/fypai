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
import { getAvatarBackgroundColor, getMessageBorderColor, getUserInitials } from '../../utils/avatarUtils'

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
  
  // Get loading/error states from UIStore
  const isLoading = useUIStore((state) => state.getLoading('messages'))
  const error = useUIStore((state) => state.getError('messages'))
  
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
    <div ref={scrollRef} className="h-full overflow-y-auto p-4 space-y-4">
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
                  <div className="bg-blue-600 text-white rounded-lg p-3 max-w-[70%]">
                    <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
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
          return (
            <div key={message.id} className="flex justify-center">
              <div className="flex flex-col items-center">
                <span className="text-xs text-purple-700 mb-1 font-bold">AI Assistant</span>
                <div className="bg-purple-500 text-white rounded-xl p-3 max-w-[70%] shadow-lg animate-pulse">
                  <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere font-semibold">{message.content}</p>
                </div>
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
                  <div className={`border-2 ${borderColor} rounded-lg p-3 max-w-[70%] bg-white text-gray-900`}> 
                    <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      })}
      
      {/* Typing indicator */}
      {(typingUserNames.length > 0 || isAgentTyping) && (
        <TypingIndicator userNames={typingUserNames} isAgentTyping={isAgentTyping} />
      )}
    </div>
  )
}