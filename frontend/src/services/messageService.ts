/**
 * Message Service (Socket-Aware)
 * 
 * Handles all message-related operations with unified REST + Real-time coordination.
 * 
 * Architecture:
 * - REST API calls → Publish to Event Bus
 * - Socket events → Subscribe via Event Bus
 * - RealtimeStore → Single source of truth
 * 
 * Tech Stack: Axios, Event Bus, RealtimeStore
 * Types: @fypai/types (MessageDTO, CreateMessageRequest, UpdateMessageRequest)
 * 
 * Operations:
 * - Get messages for a team (REST → Event Bus)
 * - Create new message (REST → Event Bus, socket event deduplicated)
 * - Update message (REST → Event Bus)
 * - Delete message (REST → Event Bus)
 * - Subscribe to team messages (joins socket room, listens to Event Bus)
 */

import { api, getErrorMessage } from './api'
import type { MessageDTO, CreateMessageRequest, UpdateMessageRequest } from '@fypai/types'
import { eventBus, EventTransformer } from '@/core/eventBus'

/**
 * Get all messages for a team
 * GET /messages?teamId=:teamId
 * 
 * Flow:
 * 1. Fetch from REST API
 * 2. Publish to Event Bus
 * 3. RealtimeStore updates automatically
 * 
 * @param teamId - Team ID to fetch messages for
 * @returns Array of messages
 */
export async function getMessages(teamId: string): Promise<MessageDTO[]> {
  try {
    const response = await api.get<MessageDTO[]>('/messages', {
      params: { teamId },
    })
    
    // Publish to Event Bus (RealtimeStore will update)
    const event = EventTransformer.messagesFetched(teamId, response.data, 'rest')
    eventBus.publish(event)
    
    return response.data
  } catch (error) {
    console.error(`[MessageService] Failed to fetch messages for team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Create a new message
 * POST /messages
 * 
 * Flow:
 * 1. Send to REST API
 * 2. Publish to Event Bus with requestId
 * 3. Socket event arrives with same message
 * 4. Event Bus deduplicates (same requestId)
 * 5. RealtimeStore updated only once
 * 
 * @param data - Message creation data (teamId, authorId, content, contentType, metadata)
 * @returns Newly created message
 */
export async function createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
  try {
    // Generate unique request ID for deduplication
    const requestId = EventTransformer.generateEventId('create-msg', data.teamId)
    
    const response = await api.post<MessageDTO>('/messages', data)
    
    // Publish to Event Bus (socket event will be deduplicated)
    const event = EventTransformer.messageCreated(response.data, 'rest', requestId)
    eventBus.publish(event)
    
    return response.data
  } catch (error) {
    console.error('[MessageService] Failed to create message:', getErrorMessage(error))
    throw error
  }
}

/**
 * Update an existing message
 * PUT /messages/:id
 * 
 * Flow:
 * 1. Update via REST API
 * 2. Publish to Event Bus
 * 3. RealtimeStore updates automatically
 * 
 * @param messageId - Message ID to update
 * @param data - Update data (content, metadata)
 * @returns Updated message
 */
export async function updateMessage(
  messageId: string,
  data: UpdateMessageRequest
): Promise<MessageDTO> {
  try {
    const response = await api.put<MessageDTO>(`/messages/${messageId}`, data)
    
    // Publish to Event Bus
    const event = EventTransformer.messageUpdated(response.data, 'rest')
    eventBus.publish(event)
    
    return response.data
  } catch (error) {
    console.error(`[MessageService] Failed to update message ${messageId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Delete a message
 * DELETE /messages/:id
 * 
 * Flow:
 * 1. Delete via REST API
 * 2. Publish to Event Bus
 * 3. RealtimeStore removes message automatically
 * 
 * @param messageId - Message ID to delete
 * @param teamId - Team ID (needed for Event Bus routing)
 * @returns Deleted message confirmation
 */
export async function deleteMessage(messageId: string, teamId: string): Promise<{ id: string }> {
  try {
    const response = await api.delete<{ id: string }>(`/messages/${messageId}`)
    
    // Publish to Event Bus
    const event = EventTransformer.messageDeleted(messageId, teamId, 'rest')
    eventBus.publish(event)
    
    return response.data
  } catch (error) {
    console.error(`[MessageService] Failed to delete message ${messageId}:`, getErrorMessage(error))
    throw error
  }
}

export default {
  getMessages,
  createMessage,
  updateMessage,
  deleteMessage,
}
