import { useState } from 'react'
import { useTeamStore } from '../../stores/teamStore'
import { useUserStore } from '../../stores/userStore'
import { usePresenceStore } from '../../stores/presenceStore'
import { getAvatarBackgroundColor, getUserInitials } from '../../utils/avatarUtils'

// Mock users for testing typing indicators
const TEST_USERS = [
  { id: 'user1', name: 'Alice', role: 'admin' as const },
  { id: 'user2', name: 'Bob', role: 'member' as const },
  { id: 'user3', name: 'Charlie', role: 'member' as const },
]

export const Sidebar = () => {
  /**
   * Sidebar Component
   *
   * Tech Stack: React (Vite), Zustand for state, Tailwind CSS for styling
   * Patterns: Team context switching, state-driven UI, minimal prop drilling
   * Requirements:
   *   - Display all teams in a fixed sidebar
   *   - Highlight the active team
   *   - Allow switching teams (updates chat context)
   *   - Future: Add team creation, member management, and backend sync
   *
   * State:
   *   - Uses Zustand store (useTeamStore) for teams and currentTeamId
   *   - Team switching updates currentTeamId, which updates chat context
   *
   * Backend Gaps:
   *   - Team CRUD will be handled via Express routes (see backend template)
   *   - Team list should be fetched from backend and synced
   *
   * AI API Integration:
   *   - No direct AI calls here, but team context will affect agent responses
   *
   * Usage:
   *   - Used in main layout alongside ChatWindow and RightPanel
   */
  const { teams, currentTeamId, setCurrentTeam, isLoading, error } = useTeamStore()
  const { user, setUser } = useUserStore()
  const { isUserOnline } = usePresenceStore()
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Only show teams where current user is a member
  const visibleTeams = teams.filter(team =>
    team.members.some(m => m.userId === user.id)
  )

  // Get avatar color for current user
  const userAvatarColor = teams.length > 0 
    ? getAvatarBackgroundColor(user.id, teams[0].members) 
    : 'bg-blue-500'

  console.log('[Sidebar] Current user:', user.id, user.name)
  console.log('[Sidebar] All teams:', teams.length, teams)
  console.log('[Sidebar] Visible teams:', visibleTeams.length, visibleTeams)
  console.log('[Sidebar] Loading:', isLoading, 'Error:', error)

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
        <nav className="mt-6">
          <ul className="space-y-2">
            {visibleTeams.map((team) => (
              <li key={team.id}>
                <button
                  onClick={() => setCurrentTeam(team.id)}
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
              {getUserInitials(user.name)}
            </div>
            {isUserOnline(user.id) && (
              <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-gray-50"></span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
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
                onClick={() => {
                  setUser({
                    id: testUser.id,
                    name: testUser.name,
                    email: null,
                    avatar: null,
                    role: testUser.role,
                    createdAt: new Date().toISOString(),
                  })
                  setShowUserMenu(false)
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                  user.id === testUser.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-full ${getAvatarBackgroundColor(testUser.id, teams[0]?.members || [])} flex items-center justify-center text-white font-semibold text-xs`}>
                  {getUserInitials(testUser.name)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{testUser.name}</p>
                  <p className="text-xs text-gray-500">{testUser.id}</p>
                </div>
                {user.id === testUser.id && (
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