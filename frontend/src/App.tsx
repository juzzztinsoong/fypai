/**
 * App Component
 *
 * Per Refactoring Guide Section 1.3:
 * - Initializes application by fetching user and teams
 * - Uses SessionStore for current user
 * - Uses EntityStore for teams/users data
 * - Uses UIStore for setting initial current team
 * - No teamStore, no userStore
 */
import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatWindow } from './components/Chat/ChatWindow'
import { RightPanel } from './components/RightPanel/RightPanel'
import { useEntityStore } from './stores/entityStore'
import { useUIStore } from './stores/uiStore'
import { getUserById } from './services/userService'
import { getTeamsForUser } from './services/teamService'
import { socketService } from './services'

// Expose diagnostic tools to window for debugging
if (typeof window !== 'undefined') {
  (window as any).appDebug = {
    socketService,
    useEntityStore,
    useUIStore,
    diagnose: () => {
      const socket = socketService.getSocket()
      const entityStore = useEntityStore.getState()
      const uiStore = useUIStore.getState()
      
      return {
        socket: {
          connected: socket?.connected,
          id: socket?.id,
          transport: socket?.io?.engine?.transport?.name
        },
        currentTeam: uiStore.currentTeamId,
        messageCount: Object.keys(entityStore.entities.messages).length,
        teamMessages: entityStore.relationships.teamMessages,
        teams: Object.keys(entityStore.entities.teams)
      }
    }
  }
  console.log('[App] 🔧 Debug tools available: window.appDebug.diagnose()')
}

let appRenderCount = 0

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  
  // Watch current team and auto-join socket room
  const currentTeamId = useUIStore((state) => state.currentTeamId)
  
  appRenderCount++
  console.log('[App] 🎨 Render #' + appRenderCount, { isInitialized, currentTeamId })
  
  useEffect(() => {
    console.log('[App] 🔄 useEffect triggered - initializing app')
    // Initialize the application by fetching user and teams
    const initializeApp = async () => {
      // Use hardcoded user ID for now (in real app, would come from auth)
      const userId = 'user1'
      
      try {
        console.log('[App] Initializing with userId:', userId)
        
        // Fetch current user profile
        await getUserById(userId)
        console.log('[App] User fetched')
        
        // Fetch teams for the user
        await getTeamsForUser(userId)
        console.log('[App] Teams fetched')
        
        // Set first team as current if exists
        const teams = useEntityStore.getState().entities.teams
        const firstTeamId = Object.keys(teams)[0]
        if (firstTeamId) {
          useUIStore.getState().setCurrentTeam(firstTeamId)
          console.log('[App] Set current team:', firstTeamId)
        }
        
        console.log('[App] ✅ Application initialized')
        setIsInitialized(true)
      } catch (error) {
        console.error('[App] Failed to initialize:', error)
        setInitError(error instanceof Error ? error.message : 'Failed to initialize app')
      }
    }

    initializeApp()
  }, []) // Run once on mount

  // Auto-join team room when currentTeamId changes
  useEffect(() => {
    console.log('[App] Team effect triggered for:', currentTeamId)
    
    if (currentTeamId) {
      console.log('[App] 🚪 Joining team room:', currentTeamId)
      socketService.joinTeam(currentTeamId)
    }
    
    // Cleanup: Only leave room if we're actually switching teams or unmounting
    return () => {
      if (currentTeamId) {
        console.log('[App] 🚪 Leaving team room on cleanup:', currentTeamId)
        socketService.leaveTeam()
      }
    }
  }, [currentTeamId])

  // Show loading state
  if (!isInitialized && !initError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-800">Loading...</div>
          <div className="text-sm text-gray-500 mt-2">Initializing application</div>
        </div>
      </div>
    )
  }

  // Show error state
  if (initError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-xl font-semibold text-red-600">Error</div>
          <div className="text-sm text-gray-500 mt-2">{initError}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <ChatWindow />
      <RightPanel />
    </div>
  )
}

export default App
