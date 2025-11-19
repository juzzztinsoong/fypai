/**
 * Team Service
 * 
 * Per Refactoring Guide Section 1.3:
 * - Handles all team-related API operations
 * - Updates EntityStore after API calls
 * - No Event Bus, direct store updates
 * 
 * Tech Stack: Axios, EntityStore
 * Types: @fypai/types (TeamWithMembersDTO, CreateTeamDTO, AddMemberDTO)
 */

import { api, getErrorMessage } from './api'
import type { TeamWithMembersDTO, CreateTeamRequest, AddTeamMemberRequest } from '@fypai/types'
import { useEntityStore } from '@/stores/entityStore'

/**
 * Get all teams the current user can access
 * GET /teams?userId=:userId
 * @param userId - User ID to fetch teams for
 * @returns Array of teams with their members
 */
export async function getTeamsForUser(userId: string): Promise<TeamWithMembersDTO[]> {
  try {
    const response = await api.get<TeamWithMembersDTO[]>('/teams', {
      params: { userId },
    })
    
    // Update EntityStore
    response.data.forEach(team => {
      useEntityStore.getState().addTeam(team)
    })
    
    return response.data
  } catch (error) {
    console.error('[TeamService] Failed to fetch teams:', getErrorMessage(error))
    throw error
  }
}

/**
 * Get a specific team by ID
 * GET /teams/:id
 * @param teamId - Team ID
 * @returns Team with members
 */
export async function getTeamById(teamId: string): Promise<TeamWithMembersDTO> {
  try {
    const response = await api.get<TeamWithMembersDTO>(`/teams/${teamId}`)
    
    // Update EntityStore
    useEntityStore.getState().addTeam(response.data)
    
    return response.data
  } catch (error) {
    console.error(`[TeamService] Failed to fetch team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Create a new team
 * POST /teams
 * @param data - Team creation data (name, description)
 * @returns Newly created team with members
 */
export async function createTeam(data: CreateTeamRequest): Promise<TeamWithMembersDTO> {
  try {
    const response = await api.post<TeamWithMembersDTO>('/teams', data)
    console.log('[TeamService] Team created:', response.data.name)
    return response.data
  } catch (error) {
    console.error('[TeamService] Failed to create team:', getErrorMessage(error))
    throw error
  }
}

/**
 * Add a member to a team
 * POST /teams/:teamId/members
 * @param teamId - Team ID
 * @param data - Member data (userId, role)
 * @returns Updated team with members
 */
export async function addMemberToTeam(
  teamId: string,
  data: AddTeamMemberRequest
): Promise<TeamWithMembersDTO> {
  try {
    const response = await api.post<TeamWithMembersDTO>(
      `/teams/${teamId}/members`,
      data
    )
    console.log('[TeamService] Member added to team:', teamId)
    return response.data
  } catch (error) {
    console.error(`[TeamService] Failed to add member to team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Remove a member from a team
 * DELETE /teams/:teamId/members/:userId
 * @param teamId - Team ID
 * @param userId - User ID to remove
 * @returns Updated team with members
 */
export async function removeMemberFromTeam(
  teamId: string,
  userId: string
): Promise<TeamWithMembersDTO> {
  try {
    const response = await api.delete<TeamWithMembersDTO>(
      `/teams/${teamId}/members/${userId}`
    )
    console.log('[TeamService] Member removed from team:', teamId)
    return response.data
  } catch (error) {
    console.error(`[TeamService] Failed to remove member from team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

export default {
  getTeamsForUser,
  getTeamById,
  createTeam,
  addMemberToTeam,
  removeMemberFromTeam,
}
