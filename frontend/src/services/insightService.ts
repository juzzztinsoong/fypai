/**
 * AI Insight Service
 * 
 * Handles all AI insight-related API operations using shared DTOs
 * Publishes events to Event Bus for unified real-time updates
 * 
 * Tech Stack: Axios, Event Bus
 * Types: @fypai/types (AIInsightDTO, CreateAIInsightRequest)
 * 
 * Operations:
 * - Get insights for a team (publishes insights:fetched event)
 * - Create new insight (publishes insight:created event)
 * - Delete insight (publishes insight:deleted event)
 * - Generate summary (publishes insight:created event)
 * - Generate report (publishes insight:created event)
 */

import { api, getErrorMessage } from './api'
import type { AIInsightDTO, CreateAIInsightRequest } from '@fypai/types'
import { eventBus } from '@/core/eventBus'
import { EventTransformer } from '@/core/eventBus/EventTransformer'

/**
 * Get all AI insights for a team
 * GET /insights?teamId=:teamId
 * @param teamId - Team ID to fetch insights for
 * @returns Array of AI insights
 */
export async function getInsights(teamId: string): Promise<AIInsightDTO[]> {
  try {
    const response = await api.get<AIInsightDTO[]>('/insights', {
      params: { teamId },
    })
    
    // Publish to Event Bus for unified updates
    const event = EventTransformer.insightsFetched(teamId, response.data, 'rest')
    eventBus.publish(event)
    console.log('[InsightService] 📤 Published insights:fetched event for team:', teamId)
    
    return response.data
  } catch (error) {
    console.error(`[InsightService] Failed to fetch insights for team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Create a new AI insight
 * POST /insights
 * @param data - Insight creation data (teamId, type, priority, content, tags, relatedMessageIds, metadata)
 * @returns Newly created insight
 */
export async function createInsight(data: CreateAIInsightRequest): Promise<AIInsightDTO> {
  try {
    const response = await api.post<AIInsightDTO>('/insights', data)
    console.log('[InsightService] Insight created:', response.data.id)
    
    // Publish to Event Bus with requestId for deduplication
    const event = EventTransformer.insightCreated(response.data, 'rest')
    eventBus.publish(event)
    console.log('[InsightService] 📤 Published insight:created event:', response.data.id)
    
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
  try {
    const response = await api.delete<{ id: string }>(`/insights/${insightId}`)
    console.log('[InsightService] Insight deleted:', insightId)
    
    // Publish to Event Bus
    const event = EventTransformer.insightDeleted(insightId, teamId, 'rest')
    eventBus.publish(event)
    console.log('[InsightService] 📤 Published insight:deleted event:', insightId)
    
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
  try {
    const response = await api.post<AIInsightDTO>('/insights/generate/summary', { teamId })
    console.log('[InsightService] Summary generated:', response.data.id)
    
    // Publish to Event Bus (backend also broadcasts via socket, will be deduplicated)
    const event = EventTransformer.insightCreated(response.data, 'rest')
    eventBus.publish(event)
    console.log('[InsightService] 📤 Published insight:created event (summary):', response.data.id)
    
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
 * @param prompt - Optional custom prompt for report generation
 * @returns Newly created report insight
 */
export async function generateReport(teamId: string, prompt?: string): Promise<AIInsightDTO> {
  try {
    const response = await api.post<AIInsightDTO>('/insights/generate/report', { teamId, prompt })
    console.log('[InsightService] Report generated:', response.data.id)
    
    // Publish to Event Bus (backend also broadcasts via socket, will be deduplicated)
    const event = EventTransformer.insightCreated(response.data, 'rest')
    eventBus.publish(event)
    console.log('[InsightService] 📤 Published insight:created event (report):', response.data.id)
    
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
