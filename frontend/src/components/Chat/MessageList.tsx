/**
 * MessageList Component
 *
 * Tech Stack: React (Vite), Zustand for state, Tailwind CSS for styling
 * Patterns: Stateless functional component, state-driven rendering
 * Requirements:
 *   - Display all messages for the current team
 *   - Differentiate user and agent messages visually
 *   - Show author label and message bubble
 *   - Support multi-line messages
 *
 * Methods & Arguments:
 *   - MessageList(): No arguments. Uses Zustand store for state.
 *     - Returns: JSX.Element (list of messages)
 *   - useChatStore(): Returns store object with 'messages' array (Message[])
 *   - messages.map((message)): Iterates over Message[]
 *     - message: Message object with id, authorId, content, etc.
 *
 * Usage:
 *   - Used in ChatWindow to display chat history for the active team
 */
import { useChatStore } from '../../stores/chatStore'
import { useUserStore } from '../../stores/userStore'
import { useCurrentTeam } from '../../stores/teamStore'
import { usePresenceStore } from '../../stores/presenceStore'
import { getAvatarBackgroundColor, getMessageBorderColor, getUserInitials } from '../../utils/avatarUtils'

export const MessageList = () => {
  const { messages } = useChatStore()
  const { user } = useUserStore()
  const team = useCurrentTeam()
  const { isUserOnline } = usePresenceStore()
  const members = team?.members || []

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                    <p className="whitespace-pre-wrap">{message.content}</p>
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
                  <p className="whitespace-pre-wrap font-semibold">{message.content}</p>
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
          const member = members.find((m) => m.id === message.authorId)
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
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      })}
    </div>
  )
}