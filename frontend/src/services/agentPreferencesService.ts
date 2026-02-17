/**
 * Agent Preferences Service (Frontend)
 * 
 * Phase 6.5.2: API client for per-team AI agent customization
 * 
 * Endpoints:
 *   GET  /api/teams/:teamId/agent-preferences
 *   PUT  /api/teams/:teamId/agent-preferences
 *   DELETE /api/teams/:teamId/agent-preferences (reset)
 */

import { api, getErrorMessage } from './api'
import type { AgentPreferencesDTO, UpdateAgentPreferencesRequest } from '@fypai/types'

/**
 * Get agent preferences for a team (creates defaults if none exist)
 */
export async function getAgentPreferences(teamId: string): Promise<AgentPreferencesDTO> {
  try {
    const response = await api.get<{ data: AgentPreferencesDTO }>(
      `/teams/${teamId}/agent-preferences`
    )
    return response.data.data
  } catch (error) {
    console.error('[AgentPreferencesService] GET failed:', getErrorMessage(error))
    throw error
  }
}

/**
 * Update agent preferences for a team
 */
export async function updateAgentPreferences(
  teamId: string,
  updates: UpdateAgentPreferencesRequest
): Promise<AgentPreferencesDTO> {
  try {
    const response = await api.put<{ data: AgentPreferencesDTO }>(
      `/teams/${teamId}/agent-preferences`,
      updates
    )
    return response.data.data
  } catch (error) {
    console.error('[AgentPreferencesService] PUT failed:', getErrorMessage(error))
    throw error
  }
}

/**
 * Reset agent preferences to defaults for a team
 */
export async function resetAgentPreferences(teamId: string): Promise<void> {
  try {
    await api.delete(`/teams/${teamId}/agent-preferences`)
  } catch (error) {
    console.error('[AgentPreferencesService] DELETE failed:', getErrorMessage(error))
    throw error
  }
}
