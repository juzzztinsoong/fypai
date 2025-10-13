import { useTeamStore } from '../../stores/teamStore'
import { useUserStore } from '../../stores/userStore'

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
  const { teams, currentTeamId, setCurrentTeam } = useTeamStore()
  const { user } = useUserStore()

  // Only show teams where current user is a member
  const visibleTeams = teams.filter(team =>
    team.members.some(m => m.id === user.id)
  )

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col fixed">
      <div className="px-6 py-4 mt-8">
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
    </aside>
  )
}