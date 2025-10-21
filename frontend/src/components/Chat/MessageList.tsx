/**
 * MessageList Component
 *
 * Tech Stack: React (Vite), RealtimeStore for data, Zustand for UI state, Tailwind CSS
 * Patterns: Stateless functional component, Event Bus architecture
 * Requirements:
 *   - Display all messages for the current team from RealtimeStore
 *   - Differentiate user and agent messages visually
 *   - Show author label and message bubble
 *   - Support multi-line messages
 *   - Fetch messages from backend when team changes
 *
 * Architecture:
 *   - Subscribes directly to RealtimeStore for message data
 *   - Uses chatStore only for loading/error UI state
 *   - No direct socket dependencies (handled by Socket Bridge)
 *
 * Methods & Arguments:
 *   - MessageList(): No arguments. Uses stores for state.
 *     - Returns: JSX.Element (list of messages)
 *
 * Usage:
 *   - Used in ChatWindow to display chat history for the active team
 */
import { useEffect, useRef, useMemo } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useUserStore } from '../../stores/userStore'
import { useCurrentTeam } from '../../stores/teamStore'
import { usePresenceStore } from '../../stores/presenceStore'
import { useRealtimeStore } from '@/core/eventBus/RealtimeStore'
import { TypingIndicator } from './TypingIndicator'
import { getAvatarBackgroundColor, getMessageBorderColor, getUserInitials } from '../../utils/avatarUtils'

export const MessageList = () => {
  const team = useCurrentTeam()
  const teamId = team?.id || ''
  
  // Subscribe to this team's messages array directly
  // Returns stable EMPTY_ARRAY if no messages exist for this team
  const messages = useRealtimeStore((state) => state.getMessages(teamId))
  
  // Subscribe to the typing users Map directly (stable reference)
  const typingUsersMap = useRealtimeStore((state) => state.presence.typingUsers)
  
  // Convert the Set to an array in useMemo (only re-runs when Set changes)
  const typingUserIds = useMemo(() => {
    const teamTyping = typingUsersMap.get(teamId)
    return teamTyping ? Array.from(teamTyping) : []
  }, [typingUsersMap, teamId])
  
  console.log('[MessageList] 🎨 Component rendering, teamId:', teamId, 'messages count:', messages.length)
  
  // UI state from chatStore - extract only what we need
  const fetchMessages = useChatStore((state) => state.fetchMessages)
  const isLoading = useChatStore((state) => state.isLoading)
  const error = useChatStore((state) => state.error)
  
  const { user } = useUserStore()
  const { isUserOnline } = usePresenceStore()
  const members = team?.members || []
  const scrollRef = useRef<HTMLDivElement>(null)

  // Map typing user IDs to names and filter out current user
  const typingUserNames = useMemo(() => {
    if (!typingUserIds || typingUserIds.length === 0) return []
    
    return typingUserIds
      .filter((id) => id !== user.id) // Don't show "You are typing"
      .map((id) => {
        if (id === 'agent') return null // Handle agent separately
        const member = members.find((m) => m.userId === id)
        return member?.name || null
      })
      .filter((name): name is string => name !== null)
  }, [typingUserIds, user.id, members])

  // Check if agent is typing
  const isAgentTyping = useMemo(() => {
    return typingUserIds?.includes('agent') || false
  }, [typingUserIds])

  // Fetch messages when team changes (publishes to Event Bus → RealtimeStore)
  useEffect(() => {
    if (team?.id) {
      console.log('[MessageList] Fetching messages for team:', team.id)
      fetchMessages(team.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id]) // Only re-fetch when teamId changes, not when fetchMessages reference changes

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, team?.id])

  // Debug: Log when messages change
  useEffect(() => {
    console.log('[MessageList] � Messages from RealtimeStore, count:', messages.length, 'team:', team?.id)
  }, [messages.length, team?.id])

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
        if (message.authorId === user.id) {
          // Current user: right - use consistent color from team position
          const userBgColor = getAvatarBackgroundColor(user.id, members);
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
                    {getUserInitials(user.name)}
                  </div>
                  {isUserOnline(user.id) && (
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