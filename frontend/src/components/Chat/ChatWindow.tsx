import { useState } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useCurrentTeam } from '../../stores/teamStore'
import { MessageList } from './MessageList'
import { ChatHeader } from './ChatHeader'
import type { Message } from '../../types'
import { useUserStore } from '../../stores/userStore'

/**
 * ChatWindow Component
 *
 * Tech Stack: React (Vite), Zustand for state, Tailwind CSS for styling
 * Patterns: Controlled input, state-driven UI, functional component
 * Requirements:
 *   - Display chat history for current team
 *   - Allow user to send messages (Enter key or button)
 *   - Validate non-empty input
 *   - Future: Support agent responses, file uploads, markdown
 *
 * Methods & Arguments:
 *   - ChatWindow(): No arguments. Uses Zustand stores for state.
 *     - Returns: JSX.Element (chat UI)
 *   - useState(newMessage): string - controlled textarea value
 *   - useTeamStore(): Returns currentTeam (Team)
 *   - useChatStore(): Returns addMessage(teamId, message)
 *   - handleSend(): No arguments. Sends message if valid
 *     - Creates Message object with id, teamId, authorId, content, etc.
 *     - Calls addMessage(teamId, message)
 *
 * Usage:
 *   - Used in main layout between Sidebar and RightPanel
 */

export const ChatWindow = () => {
  // newMessage: string - controlled textarea value
  const [newMessage, setNewMessage] = useState('')
  // currentTeam: Team | null - active team context
  const currentTeam = useCurrentTeam()
  // addMessage: (teamId: string, message: Message) => void
  const { addMessage } = useChatStore()
  const { user } = useUserStore()

  // handleSend(): sends message if valid
  const handleSend = () => {
    if (!newMessage.trim() || !currentTeam) return

    const message: Message = {
      id: crypto.randomUUID(),
      teamId: currentTeam.id,
      authorId: user.id,
      content: newMessage,
      contentType: 'text',
      createdAt: new Date().toISOString(),
    }

    addMessage(currentTeam.id, message)
    setNewMessage('')
  }

  return (
    <main className="flex-1 flex flex-col min-h-screen border-x border-gray-200 ml-60">
      <ChatHeader />
      <MessageList />
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 min-h-[44px] max-h-32 p-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="w-5 h-5"
            >
              <path d="M3 20V4l19 8-19 8zm2-3l11.85-5L5 7v3.5l6 1.5-6 1.5V17z" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  )
}