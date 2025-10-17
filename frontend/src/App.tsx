import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatWindow } from './components/Chat/ChatWindow'
import { RightPanel } from './components/RightPanel/RightPanel'
// import { RightPanelTest1, RightPanelTest2, RightPanelTest3, RightPanelTest4, RightPanelTest5, RightPanelTest6, RightPanelTest7 } from './components/RightPanel/RightPanel.test'
import { useTeamStore } from './stores/teamStore'
import { useUserStore } from './stores/userStore'
import { usePresenceStore } from './stores/presenceStore'
import { useChatStore } from './stores/chatStore'
import { useAIInsightsStore } from './stores/aiInsightsStore'

function App() {
  const fetchTeams = useTeamStore((state) => state.fetchTeams)
  const teams = useTeamStore((state) => state.teams)
  const fetchUser = useUserStore((state) => state.fetchUser)
  const user = useUserStore((state) => state.user)
  const { connect, disconnect } = usePresenceStore()
  const { initializeSocketListeners, cleanupSocketListeners } = useChatStore()
  const { initializeInsightListeners, cleanupInsightListeners } = useAIInsightsStore()

  useEffect(() => {
    // Initialize the application by fetching user and teams
    const initializeApp = async () => {
      // Use hardcoded user ID for now (in real app, would come from auth)
      const userId = 'user1'
      
      try {
        console.log('[App] Initializing with userId:', userId)
        
        // Fetch current user profile
        await fetchUser(userId)
        console.log('[App] User fetched')
        
        // Fetch teams for the user
        await fetchTeams(userId)
        console.log('[App] Teams fetched')
        
        // Connect to WebSocket for real-time updates (WAIT for connection)
        await connect(userId)
        console.log('[App] ✅ WebSocket connected and ready')
        
        // NOW initialize socket listeners (socket is connected)
        initializeSocketListeners()
        console.log('[App] ✅ Chat socket listeners initialized')
        
        initializeInsightListeners()
        console.log('[App] ✅ Insight socket listeners initialized')
      } catch (error) {
        console.error('[App] Failed to initialize:', error)
      }
    }

    initializeApp()

    // Cleanup on unmount
    return () => {
      cleanupSocketListeners()
      cleanupInsightListeners()
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Debug logging
  useEffect(() => {
    console.log('[App] Current user:', user)
    console.log('[App] Teams count:', teams.length)
    console.log('[App] Teams:', teams)
  }, [user, teams])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <ChatWindow />
      <RightPanel />
    </div>
  )
}

export default App
