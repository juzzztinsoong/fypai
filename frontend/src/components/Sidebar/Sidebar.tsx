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
import { getTeamsForUser } from '@/services/teamService'
import { exportSession, type SessionExportFormat } from '@/services/exportService'
import { resetTeamSession } from '@/services/messageService'
import { resetTeamInsights } from '@/services/insightService'
import { analyticsService, trackSessionEvent } from '@/services/analyticsService'
import {
  getChipClass,
  getSwitchThumbClass,
  getSwitchTrackClass,
  uiTokens,
  type ChipVariant,
} from '@/styles/uiTokens'

interface SwitchableUser {
  id: string
  name: string
  email: string | null
  avatar: string | null
  role: 'admin' | 'member'
}

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
  
  // Get showAIDetails preference for research toggle (Phase 6.5.1)
  const showAIDetails = useUIStore((state) => state.preferences.showAIDetails)
  const enableTimelineSync = useUIStore((state) => state.preferences.enableTimelineSync)
  const updatePreference = useUIStore((state) => state.updatePreference)
  
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
  const [showResearchTools, setShowResearchTools] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleSessionExport = async (format: SessionExportFormat) => {
    if (!currentTeamId || isExporting) return

    try {
      setIsExporting(true)
      setExportError(null)

      trackSessionEvent({
        eventType: 'session',
        eventName: 'session_export_requested',
        teamId: currentTeamId,
        actorUserId: currentUser?.id,
        metadata: { format },
      })

      await analyticsService.flush()

      await exportSession(currentTeamId, format)

      trackSessionEvent({
        eventType: 'session',
        eventName: 'session_export_completed',
        teamId: currentTeamId,
        actorUserId: currentUser?.id,
        metadata: { format },
      })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export session')

      trackSessionEvent({
        eventType: 'session',
        eventName: 'session_export_failed',
        teamId: currentTeamId,
        actorUserId: currentUser?.id,
        metadata: {
          format,
          error: error instanceof Error ? error.message : 'Unknown export error',
        },
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleSessionReset = async () => {
    if (!currentTeamId || isResetting) return

    const confirmed = window.confirm('Reset this team session? This will delete all messages and insights for the current team.')
    if (!confirmed) return

    try {
      setIsResetting(true)
      setResetError(null)

      trackSessionEvent({
        eventType: 'session',
        eventName: 'session_reset_requested',
        teamId: currentTeamId,
        actorUserId: currentUser?.id,
      })

      await resetTeamSession(currentTeamId)
      await resetTeamInsights(currentTeamId)

      const sessionStore = useSessionStore.getState()
      const typingUsers = [...sessionStore.getTypingUsers(currentTeamId)]
      for (const userId of typingUsers) {
        sessionStore.removeTypingUser(currentTeamId, userId)
      }
      sessionStore.setAIProcessingStage(currentTeamId, 'idle')

      trackSessionEvent({
        eventType: 'session',
        eventName: 'session_reset_completed',
        teamId: currentTeamId,
        actorUserId: currentUser?.id,
      })
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Failed to reset session')

      trackSessionEvent({
        eventType: 'session',
        eventName: 'session_reset_failed',
        teamId: currentTeamId,
        actorUserId: currentUser?.id,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown reset error',
        },
      })
    } finally {
      setIsResetting(false)
    }
  }

  // Only show teams where current user is a member
  const visibleTeams = allTeams.filter(team =>
    team.members.some(m => m.userId === currentUser?.id)
  )

  // Build dynamic switchable users from currently visible team members.
  const switchableUsers = useMemo<SwitchableUser[]>(() => {
    const byId = new Map<string, SwitchableUser>()

    for (const team of visibleTeams) {
      for (const member of team.members) {
        if (member.role === 'agent') {
          continue
        }

        if (!byId.has(member.userId)) {
          byId.set(member.userId, {
            id: member.userId,
            name: member.name,
            email: member.email,
            avatar: member.avatar,
            role: member.role === 'admin' ? 'admin' : 'member',
          })
        }
      }
    }

    const priorityOrder = ['user1', 'user2', 'user3']
    return Array.from(byId.values()).sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a.id)
      const bIndex = priorityOrder.indexOf(b.id)

      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      }

      return a.name.localeCompare(b.name)
    })
  }, [visibleTeams])

  // Get avatar color for current user
  const userAvatarColor = allTeams.length > 0 && currentUser
    ? getAvatarBackgroundColor(currentUser.id, allTeams[0].members) 
    : 'bg-indigo-500'

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

  const getConnectionChipVariant = (
    connectionState: 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'failed',
  ): ChipVariant => {
    if (connectionState === 'connected') return 'success'
    if (connectionState === 'reconnecting') return 'warning'
    if (connectionState === 'connecting') return 'brand'
    if (connectionState === 'failed') return 'danger'
    return 'neutral'
  }

  if (isLoading) {
    return (
      <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col fixed">
        <div className="px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-800 leading-6">Teams</h2>
          <div className="mt-6 text-gray-500">Loading teams...</div>
        </div>
      </aside>
    )
  }

  if (error) {
    return (
      <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col fixed">
        <div className="px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-800 leading-6">Teams</h2>
          <div className="mt-6 text-red-500">Error: {error}</div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col fixed">
      {/* Teams Section */}
      <div className="px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-800 leading-6">Teams</h2>
      </div>

      <div className="px-5 py-4 flex-1">

        <nav className="mt-2">
          <ul className="space-y-2">
            {visibleTeams.map((team) => (
              <li key={team.id}>
                <button
                  onClick={() => {
                    if (currentTeamId !== team.id) {
                      trackSessionEvent({
                        eventType: 'navigation',
                        eventName: 'team_switched',
                        teamId: team.id,
                        actorUserId: currentUser?.id,
                        metadata: {
                          previousTeamId: currentTeamId,
                          nextTeamId: team.id,
                        },
                      })
                    }
                    setCurrentTeamId(team.id)
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-left flex items-center space-x-3 text-sm font-medium
                    ${currentTeamId === team.id 
                      ? 'bg-indigo-50 text-indigo-600' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <svg 
                    className={`w-5 h-5 ${currentTeamId === team.id ? 'text-indigo-600' : 'text-gray-400'}`}
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

      {/* User Profile Section */}
      <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className={`w-10 h-10 rounded-full ${userAvatarColor} flex items-center justify-center text-white font-semibold`}>
              {getUserInitials(currentUser?.name || 'User')}
            </div>
            {currentUser && isUserOnline(currentUser.id) && (
              <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-gray-50"></span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{currentUser?.name || 'User'}</p>
            <p className="text-xs text-gray-500">Research testing mode</p>
          </div>
        </div>
      </div>

      {/* Research Tools (collapsible) */}
      <div className="px-5 py-3 border-t border-gray-200 space-y-3">
        <button
          onClick={() => setShowResearchTools(prev => !prev)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-xs font-semibold text-gray-700">Research Tools</span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${showResearchTools ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showResearchTools && (
          <div className="space-y-3">
            {/* Connection Status & Heartbeat (Phase 2.2) */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600">Connection</span>
                <span className={getChipClass(getConnectionChipVariant(socket.connectionState), 'sm')}>
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
                <div className="text-xs text-amber-600">
                  Attempt {socket.reconnectAttempts}/5
                </div>
              )}
            </div>

            {/* AI Details Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium text-gray-600">AI Details</span>
              </div>
              <button
                onClick={() => {
                  const nextValue = !showAIDetails
                  updatePreference('showAIDetails', nextValue)
                  trackSessionEvent({
                    eventType: 'navigation',
                    eventName: 'show_ai_details_toggled',
                    teamId: currentTeamId || undefined,
                    actorUserId: currentUser?.id,
                    metadata: {
                      enabled: nextValue,
                    },
                  })
                }}
                className={`${uiTokens.controls.switch.base} ${getSwitchTrackClass(showAIDetails)}`}
                role="switch"
                aria-checked={showAIDetails}
                aria-label="Show AI response details"
              >
                <span
                  className={`${uiTokens.controls.switch.thumbBase} ${getSwitchThumbClass(showAIDetails)}`}
                />
              </button>
            </div>
            <p className="-mt-2 text-xs text-gray-400">Show model, tokens, cost on AI messages</p>

            {/* Timeline Sync Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-2c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                </svg>
                <span className="text-xs font-medium text-gray-600">Timeline Sync</span>
              </div>
              <button
                onClick={() => {
                  const nextValue = !enableTimelineSync
                  updatePreference('enableTimelineSync', nextValue)
                  trackSessionEvent({
                    eventType: 'navigation',
                    eventName: 'timeline_sync_toggled',
                    teamId: currentTeamId || undefined,
                    actorUserId: currentUser?.id,
                    metadata: {
                      enabled: nextValue,
                    },
                  })
                }}
                className={`${uiTokens.controls.switch.base} ${getSwitchTrackClass(enableTimelineSync)}`}
                role="switch"
                aria-checked={enableTimelineSync}
                aria-label="Enable timeline sync"
              >
                <span
                  className={`${uiTokens.controls.switch.thumbBase} ${getSwitchThumbClass(enableTimelineSync)}`}
                />
              </button>
            </div>
            <p className="-mt-2 text-xs text-gray-400">Sync chat and insights scroll positions (experimental)</p>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2">Session Export</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSessionExport('json')}
                  disabled={!currentTeamId || isExporting}
                  className={`${uiTokens.controls.button.sm} ${uiTokens.controls.button.secondary}`}
                >
                  Full JSON
                </button>
                <button
                  onClick={() => handleSessionExport('csv')}
                  disabled={!currentTeamId || isExporting}
                  className={`${uiTokens.controls.button.sm} ${uiTokens.controls.button.secondary}`}
                >
                  Message CSV
                </button>
                <button
                  onClick={() => handleSessionExport('timeline-json')}
                  disabled={!currentTeamId || isExporting}
                  className={`${uiTokens.controls.button.sm} ${uiTokens.controls.button.secondary}`}
                >
                  Timeline JSON
                </button>
                <button
                  onClick={() => handleSessionExport('metrics-csv')}
                  disabled={!currentTeamId || isExporting}
                  className={`${uiTokens.controls.button.sm} ${uiTokens.controls.button.secondary}`}
                >
                  Metrics CSV
                </button>
              </div>
              {exportError && <p className="mt-2 text-xs text-rose-500">{exportError}</p>}
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2">Session Reset</p>
              <button
                onClick={handleSessionReset}
                disabled={!currentTeamId || isResetting}
                className={`${uiTokens.controls.button.sm} ${uiTokens.controls.button.danger}`}
              >
                {isResetting ? 'Resetting…' : 'Reset Current Team'}
              </button>
              {resetError && <p className="mt-2 text-xs text-rose-500">{resetError}</p>}
            </div>

            <div className="pt-2 border-t border-gray-100 relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-xs font-medium text-gray-600">Switch user (testing)</span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showUserMenu && (
                <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  {switchableUsers.map((switchUser) => (
                    <button
                      key={switchUser.id}
                      onClick={async () => {
                        setCurrentUser({
                          id: switchUser.id,
                          name: switchUser.name,
                          email: switchUser.email,
                          avatar: switchUser.avatar,
                          role: switchUser.role,
                          createdAt: new Date().toISOString(),
                        })

                        trackSessionEvent({
                          eventType: 'navigation',
                          eventName: 'test_user_switched',
                          teamId: currentTeamId || undefined,
                          actorUserId: currentUser?.id,
                          metadata: {
                            fromUserId: currentUser?.id,
                            toUserId: switchUser.id,
                            toUserName: switchUser.name,
                          },
                        })

                        console.log('[Sidebar] 🔄 Refetching teams for new user:', switchUser.id)
                        try {
                          const teams = await getTeamsForUser(switchUser.id)

                          const shouldKeepCurrent = currentTeamId
                            ? teams.some((team) => team.id === currentTeamId)
                            : false

                          if (!shouldKeepCurrent) {
                            const firstTeamId = teams[0]?.id ?? null
                            setCurrentTeamId(firstTeamId)
                            console.log('[Sidebar] Set current team:', firstTeamId)
                          }
                        } catch (error) {
                          console.error('[Sidebar] Failed to fetch teams:', error)
                        }

                        if (socketService.isConnected()) {
                          console.log('[Sidebar] 📤 Sending presence:online for new user:', switchUser.id)
                          socketService.getSocket()?.emit('presence:online', { userId: switchUser.id })

                          console.log('[Sidebar] 📋 Requesting current online users list')
                          socketService.getOnlineUsers()
                        }

                        setShowUserMenu(false)
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 ${
                        currentUser?.id === switchUser.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full ${getAvatarBackgroundColor(switchUser.id, visibleTeams[0]?.members || [])} flex items-center justify-center text-white font-semibold text-xs`}>
                        {getUserInitials(switchUser.name)}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-900">{switchUser.name}</p>
                        <p className="text-[11px] text-gray-500">{switchUser.id}</p>
                      </div>
                      {currentUser?.id === switchUser.id && (
                        <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                  {switchableUsers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-500">No users available for switching.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </aside>
  )
}