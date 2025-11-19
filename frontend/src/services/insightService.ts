/**
 * AI Insight Service
 * 
 * Per Refactoring Guide Section 1.1:
 * - Removed Event Bus (call EntityStore directly)
 * - Handles all AI insight-related API operations
 * 
 * Tech Stack: Axios, EntityStore
 * Types: @fypai/types (AIInsightDTO, CreateAIInsightRequest)
 * 
 * Operations:
 * - Get insights for a team
 * - Create new insight
 * - Delete insight
 * - Generate summary
 * - Generate report
 */

import { api, getErrorMessage } from './api'
import type { AIInsightDTO, CreateAIInsightRequest } from '@fypai/types'
import { useEntityStore } from '@/stores/entityStore'
import { useUIStore } from '@/stores/uiStore'

/**
 * Get all AI insights for a team
 * GET /insights?teamId=:teamId
 * @param teamId - Team ID to fetch insights for
 * @returns Array of AI insights
 */
export async function getInsights(teamId: string): Promise<AIInsightDTO[]> {
  const uiStore = useUIStore.getState()
  const entityStore = useEntityStore.getState()
  
  uiStore.setLoading('insights', true)
  
  try {
    const response = await api.get<AIInsightDTO[]>('/insights', {
      params: { teamId },
    })
    
    // Add to EntityStore (per guide: call store directly)
    response.data.forEach(insight => entityStore.addInsight(insight))
    
    uiStore.clearError('insights')
    console.log('[InsightService] ✅ Fetched insights for team:', teamId)
    
    return response.data
  } catch (error) {
    const errorMsg = getErrorMessage(error)
    uiStore.setError('insights', errorMsg)
    console.error(`[InsightService] Failed to fetch insights for team ${teamId}:`, errorMsg)
    throw error
  } finally {
    uiStore.setLoading('insights', false)
  }
}

/**
 * Create a new AI insight
 * POST /insights
 * @param data - Insight creation data
 * @returns Newly created insight
 */
export async function createInsight(data: CreateAIInsightRequest): Promise<AIInsightDTO> {
  const entityStore = useEntityStore.getState()
  
  try {
    const response = await api.post<AIInsightDTO>('/insights', data)
    
    // Add to EntityStore (socket will also broadcast, but that's OK)
    entityStore.addInsight(response.data)
    
    console.log('[InsightService] ✅ Insight created:', response.data.id)
    return response.data
  } catch (error) {
    console.error('[InsightService] Failed to create insight:', getErrorMessage(error))
    throw error
  }
}

/**
 * Delete an AI insight
 * DELETE /insights/:id
 * @param insightId - Insight ID to delete
 * @returns Deleted insight confirmation
 */
export async function deleteInsight(insightId: string, teamId: string): Promise<{ id: string }> {
  const entityStore = useEntityStore.getState()
  
  try {
    const response = await api.delete<{ id: string }>(`/insights/${insightId}`)
    
    // Remove from EntityStore
    entityStore.deleteInsight(insightId, teamId)
    
    console.log('[InsightService] ✅ Insight deleted:', insightId)
    return response.data
  } catch (error) {
    console.error(`[InsightService] Failed to delete insight ${insightId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Generate AI-powered conversation summary as insight
 * POST /insights/generate/summary
 * @param teamId - Team ID to generate summary for
 * @returns Newly created summary insight
 */
export async function generateSummary(teamId: string): Promise<AIInsightDTO> {
  const entityStore = useEntityStore.getState()
  
  try {
    const response = await api.post<AIInsightDTO>('/insights/generate/summary', { teamId })
    
    // Add to EntityStore (backend socket will also broadcast)
    entityStore.addInsight(response.data)
    
    console.log('[InsightService] ✅ Summary generated:', response.data.id)
    return response.data
  } catch (error) {
    console.error(`[InsightService] Failed to generate summary for team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Generate AI-powered discussion report as insight
 * POST /insights/generate/report
 * @param teamId - Team ID to generate report for
 * @param prompt - Optional custom prompt
 * @returns Newly created report insight
 */
export async function generateReport(teamId: string, prompt?: string): Promise<AIInsightDTO> {
  const entityStore = useEntityStore.getState()
  
  try {
    const response = await api.post<AIInsightDTO>('/insights/generate/report', { teamId, prompt })
    
    // Add to EntityStore (backend socket will also broadcast)
    entityStore.addInsight(response.data)
    
    console.log('[InsightService] ✅ Report generated:', response.data.id)
    return response.data
  } catch (error) {
    console.error(`[InsightService] Failed to generate report for team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

export default {
  getInsights,
  createInsight,
  deleteInsight,
  generateSummary,
  generateReport,
}
