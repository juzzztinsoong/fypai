/**
 * Sidebar Component
 *
 * Per Refactoring Guide Section 1.3:
 * - Uses EntityStore for teams and users
 * - Uses UIStore for current team context and loading states
 * - Uses SessionStore for current user and presence
 * - No teamStore, no userStore, no presenceStore
 *
 * Tech Stack: React (Vite), EntityStore, UIStore, SessionStore, Tailwind CSS
 */
import { useState, useMemo, useEffect } from 'react'
import { useEntityStore } from '@/stores/entityStore'
import { useUIStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import { getAvatarBackgroundColor, getUserInitials } from '../../utils/avatarUtils'
import { socketService } from '@/services/socketService'

// Mock users for testing typing indicators
const TEST_USERS = [
  { id: 'user1', name: 'Alice', role: 'admin' as const },
  { id: 'user2', name: 'Bob', role: 'member' as const },
  { id: 'user3', name: 'Charlie', role: 'member' as const },
]

let sidebarRenderCount = 0

export const Sidebar = () => {
  sidebarRenderCount++
  console.log('[Sidebar] 🎨 Render #' + sidebarRenderCount)
  
  // Get all teams from EntityStore (use stable reference)
  const teamsById = useEntityStore((state) => state.entities.teams)
  console.log('[Sidebar] teamsById keys:', Object.keys(teamsById).length)
  const allTeams = useMemo(() => {
    const teams = Object.values(teamsById)
    console.log('[Sidebar] useMemo allTeams recalculated, count:', teams.length)
    return teams
  }, [teamsById])
  
  // Get current team ID and loading states from UIStore
  const currentTeamId = useUIStore((state) => state.currentTeamId)
  const setCurrentTeamId = useUIStore((state) => state.setCurrentTeam)
  const isLoading = useUIStore((state) => state.getLoading('teams'))
  const error = useUIStore((state) => state.getError('teams'))
  
  // Get current user and presence from SessionStore
  const currentUser = useSessionStore((state) => state.currentUser)
  const setCurrentUser = useSessionStore((state) => state.setCurrentUser)
  const onlineUsers = useSessionStore((state) => state.presence.onlineUsers)
  
  // Get socket connection state and heartbeat times (Phase 2.2)
  const socket = useSessionStore((state) => state.socket)
  const lastPingTime = socket.lastPingTime
  const lastPongTime = socket.lastPongTime
  
  // Force re-render every second to update time display
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Only show teams where current user is a member
  const visibleTeams = allTeams.filter(team =>
    team.members.some(m => m.userId === currentUser?.id)
  )

  // Get avatar color for current user
  const userAvatarColor = allTeams.length > 0 && currentUser
    ? getAvatarBackgroundColor(currentUser.id, allTeams[0].members) 
    : 'bg-blue-500'

  const isUserOnline = (userId: string) => onlineUsers.includes(userId)
  
  // Format heartbeat time for display
  const formatHeartbeatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never'
    const now = Date.now()
    const diff = now - timestamp
    if (diff < 1000) return 'Just now'
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    return `${Math.floor(diff / 60000)}m ago`
  }

  if (isLoading) {
    return (
      <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col fixed">
        <div className="px-6 py-4 mt-8">
          <h2 className="text-xl font-semibold text-gray-800">Teams</h2>
          <div className="mt-6 text-gray-500">Loading teams...</div>
        </div>
      </aside>
    )
  }

  if (error) {
    return (
      <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col fixed">
        <div className="px-6 py-4 mt-8">
          <h2 className="text-xl font-semibold text-gray-800">Teams</h2>
          <div className="mt-6 text-red-500">Error: {error}</div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col fixed">
      {/* Teams Section */}
      <div className="px-6 py-4 mt-8 flex-1">
        <h2 className="text-xl font-semibold text-gray-800">Teams</h2>
        
        {/* Connection Status & Heartbeat (Phase 2.2) */}
        <div className="mt-4 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">Connection</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              socket.connectionState === 'connected' ? 'bg-green-100 text-green-800' :
              socket.connectionState === 'reconnecting' ? 'bg-yellow-100 text-yellow-800' :
              socket.connectionState === 'connecting' ? 'bg-blue-100 text-blue-800' :
              socket.connectionState === 'failed' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {socket.connectionState}
            </span>
          </div>
          {socket.connectionState === 'connected' && (
            <div className="space-y-1 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>💓 Last Ping:</span>
                <span className="font-mono">{formatHeartbeatTime(lastPingTime)}</span>
              </div>
              <div className="flex justify-between">
                <span>💚 Last Pong:</span>
                <span className="font-mono">{formatHeartbeatTime(lastPongTime)}</span>
              </div>
            </div>
          )}
          {socket.connectionState === 'reconnecting' && (
            <div className="text-xs text-yellow-600">
              Attempt {socket.reconnectAttempts}/5
            </div>
          )}
        </div>
        
        <nav className="mt-6">
          <ul className="space-y-2">
            {visibleTeams.map((team) => (
              <li key={team.id}>
                <button
                  onClick={() => setCurrentTeamId(team.id)}
                  className={`w-full px-4 py-2 rounded-lg text-left flex items-center space-x-3 
                    ${currentTeamId === team.id 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <svg 
                    className={`w-5 h-5 ${currentTeamId === team.id ? 'text-blue-600' : 'text-gray-400'}`}
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M12 2c-2.714 0-5 2.286-5 5s2.286 5 5 5 5-2.286 5-5-2.286-5-5-5zm-7 12c-2.714 0-5 2.286-5 5v3h24v-3c0-2.714-2.286-5-5-5h-14z" />
                  </svg>
                  <span>{team.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* User Profile Section with Switcher (for testing typing indicators) */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center space-x-3 hover:bg-gray-100 rounded-lg p-2 -m-2 transition-colors"
        >
          <div className="relative">
            <div className={`w-10 h-10 rounded-full ${userAvatarColor} flex items-center justify-center text-white font-semibold`}>
              {getUserInitials(currentUser?.name || 'User')}
            </div>
            {currentUser && isUserOnline(currentUser.id) && (
              <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-gray-50"></span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-gray-900 truncate">{currentUser?.name || 'User'}</p>
            <p className="text-xs text-gray-500">Switch user (testing)</p>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* User switcher dropdown */}
        {showUserMenu && (
          <div className="absolute bottom-full left-6 right-6 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {TEST_USERS.map((testUser) => (
              <button
                key={testUser.id}
                onClick={async () => {
                  // Update current user in SessionStore FIRST
                  setCurrentUser({
                    id: testUser.id,
                    name: testUser.name,
                    email: null,
                    avatar: null,
                    role: testUser.role,
                    createdAt: new Date().toISOString(),
                  })
                  
                  // Send presence update for new user going online
                  // This will update the socketUserMap on backend for this socket ID
                  // Backend will handle cleanup of old user if no other sockets use it
                  if (socketService.isConnected()) {
                    console.log('[Sidebar] 📤 Sending presence:online for new user:', testUser.id)
                    socketService.getSocket()?.emit('presence:online', { userId: testUser.id })
                    
                    // Request current online users list for state sync
                    console.log('[Sidebar] 📋 Requesting current online users list')
                    socketService.getOnlineUsers()
                  }
                  
                  setShowUserMenu(false)
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                  currentUser?.id === testUser.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-full ${getAvatarBackgroundColor(testUser.id, allTeams[0]?.members || [])} flex items-center justify-center text-white font-semibold text-xs`}>
                  {getUserInitials(testUser.name)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{testUser.name}</p>
                  <p className="text-xs text-gray-500">{testUser.id}</p>
                </div>
                {currentUser?.id === testUser.id && (
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}