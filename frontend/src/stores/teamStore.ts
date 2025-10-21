/**
 * TEAM STORE (Zustand)
 *
 * Tech Stack: Zustand, TypeScript, @fypai/types
 * Purpose: Manage team state, selection, and member management
 *
 * State:
 *   - teams: TeamWithMembersDTO[] - all teams with their members
 *   - currentTeamId: string | null - selected team ID
 *   - isLoading: boolean - loading state for async operations
 *   - error: string | null - error message if operation fails
 *
 * Methods & Arguments:
 *   - fetchTeams(userId: string): fetches teams from API
 *   - setCurrentTeam(teamId: string): sets active team
 *   - createTeam(data: CreateTeamRequest): creates new team via API
 *   - addMember(teamId: string, data: AddTeamMemberRequest): adds member via API
 *   - removeMember(teamId: string, userId: string): removes member via API
 *   - setTeams(teams: TeamWithMembersDTO[]): replaces all teams (internal)
 *   - updateTeam(teamId: string, updates: Partial<TeamWithMembersDTO>): updates team fields (internal)
 *
 * Architecture:
 *   - Uses TeamWithMembersDTO from @fypai/types (matches backend API responses)
 *   - Integrates with teamService for all API calls
 *   - TeamMemberDTO includes both user role and team role
 *   - All timestamps are ISO strings
 *
 * Exports:
 *   - useTeamStore: Zustand hook for team state/methods
 *   - useCurrentTeam: Returns currently selected team (TeamWithMembersDTO | null)
 */
import { create } from 'zustand'
import type { TeamWithMembersDTO, CreateTeamRequest, AddTeamMemberRequest } from '../types'
import { useChatStore } from './chatStore'
import { teamService, getErrorMessage } from '@/services'
import { socketService } from '@/services/socketService'

interface TeamState {
  teams: TeamWithMembersDTO[]
  currentTeamId: string | null
  isLoading: boolean
  error: string | null
  fetchTeams: (userId: string) => Promise<void>
  setCurrentTeam: (teamId: string) => void
  createTeam: (data: CreateTeamRequest) => Promise<TeamWithMembersDTO>
  addMember: (teamId: string, data: AddTeamMemberRequest) => Promise<void>
  removeMember: (teamId: string, userId: string) => Promise<void>
  setTeams: (teams: TeamWithMembersDTO[]) => void
  updateTeam: (teamId: string, updates: Partial<TeamWithMembersDTO>) => void
}

export const useTeamStore = create<TeamState>()((set, get) => ({
  teams: [],
  currentTeamId: null,
  isLoading: false,
  error: null,

  /**
   * Fetch all teams for a user from the API
   */
  fetchTeams: async (userId: string) => {
    set({ isLoading: true, error: null })
    try {
      const teams = await teamService.getTeamsForUser(userId)
      set({ teams, isLoading: false })
      
      // Sync AI enabled state from team data to RealtimeStore
      const { useRealtimeStore } = await import('@/core/eventBus/RealtimeStore')
      teams.forEach(team => {
        useRealtimeStore.getState().setAIEnabled(team.id, team.isChimeEnabled)
      })
      console.log('[TeamStore] 🤖 Synced AI toggle state from server for', teams.length, 'teams')
      
      // Set first team as current if none selected
      if (!get().currentTeamId && teams.length > 0) {
        get().setCurrentTeam(teams[0].id)
      }
    } catch (error) {
      console.error('[TeamStore] Failed to fetch teams:', error)
      set({ 
        error: getErrorMessage(error), 
        isLoading: false,
        teams: [] // Clear teams on error
      })
    }
  },

  /**
   * Create a new team via API
   */
  createTeam: async (data: CreateTeamRequest) => {
    set({ isLoading: true, error: null })
    try {
      const newTeam = await teamService.createTeam(data)
      set((state) => ({ 
        teams: [...state.teams, newTeam],
        isLoading: false 
      }))
      return newTeam
    } catch (error) {
      console.error('[TeamStore] Failed to create team:', error)
      set({ 
        error: getErrorMessage(error), 
        isLoading: false 
      })
      throw error
    }
  },

  /**
   * Add member to team via API
   */
  addMember: async (teamId: string, data: AddTeamMemberRequest) => {
    set({ isLoading: true, error: null })
    try {
      const updatedTeam = await teamService.addMemberToTeam(teamId, data)
      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? updatedTeam : t
        ),
        isLoading: false
      }))
    } catch (error) {
      console.error('[TeamStore] Failed to add member:', error)
      set({ 
        error: getErrorMessage(error), 
        isLoading: false 
      })
      throw error
    }
  },

  /**
   * Remove member from team via API
   */
  removeMember: async (teamId: string, userId: string) => {
    set({ isLoading: true, error: null })
    try {
      const updatedTeam = await teamService.removeMemberFromTeam(teamId, userId)
      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? updatedTeam : t
        ),
        isLoading: false
      }))
    } catch (error) {
      console.error('[TeamStore] Failed to remove member:', error)
      set({ 
        error: getErrorMessage(error), 
        isLoading: false 
      })
      throw error
    }
  },

  setCurrentTeam: (teamId: string) => {
    set({ currentTeamId: teamId });
    
    // Join socket room for real-time updates
    console.log('[TeamStore] 🚪 Joining socket room for team:', teamId);
    socketService.joinTeam(teamId);
    
    // Update chatStore's currentTeamId (no need to copy messages, they're in RealtimeStore)
    const chatStore = useChatStore.getState();
    chatStore.setCurrentTeam(teamId);
  },

  setTeams: (teams: TeamWithMembersDTO[]) => set({ teams }),

  updateTeam: (teamId: string, updates: Partial<TeamWithMembersDTO>) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId ? { ...t, ...updates } : t
      ),
    })),
}))

export const useCurrentTeam = () => {
  const { teams, currentTeamId } = useTeamStore()
  return teams.find((t) => t.id === currentTeamId) || null
}
