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
import type { TeamWithMembersDTO, CreateTeamRequest, AddTeamMemberRequest, TaskContextDTO, UpdateTaskContextRequest } from '@fypai/types'
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
    
    // Replace all teams in EntityStore (not additive)
    useEntityStore.getState().setTeams(response.data)
    
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

/**
 * Get the shared task context for a team
 * GET /teams/:id/context
 * @param teamId - Team ID
 * @returns Task context DTO
 */
export async function getTaskContext(teamId: string): Promise<TaskContextDTO> {
  try {
    const response = await api.get<TaskContextDTO>(`/teams/${teamId}/context`)
    return response.data
  } catch (error) {
    console.error(`[TeamService] Failed to fetch task context for team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Update the shared task context for a team
 * PUT /teams/:id/context
 * @param teamId - Team ID
 * @param content - New context content (markdown)
 * @param userId - User making the update
 * @returns Updated task context DTO
 */
export async function updateTaskContext(
  teamId: string,
  content: string,
  userId: string
): Promise<TaskContextDTO> {
  try {
    const data: UpdateTaskContextRequest = { content, userId }
    const response = await api.put<TaskContextDTO>(`/teams/${teamId}/context`, data)
    console.log('[TeamService] Task context updated for team:', teamId)
    return response.data
  } catch (error) {
    console.error(`[TeamService] Failed to update task context for team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Persist team AI enabled state.
 * PATCH /teams/:id/ai
 */
export async function setTeamAIEnabled(teamId: string, enabled: boolean): Promise<void> {
  try {
    await api.patch(`/teams/${teamId}/ai`, { enabled })
    console.log('[TeamService] Team AI state updated:', teamId, enabled)
  } catch (error) {
    console.error(`[TeamService] Failed to update AI state for team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

export default {
  getTeamsForUser,
  getTeamById,
  createTeam,
  addMemberToTeam,
  removeMemberFromTeam,
  getTaskContext,
  updateTaskContext,
  setTeamAIEnabled,
}
