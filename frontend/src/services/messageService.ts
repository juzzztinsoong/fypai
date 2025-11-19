/**
 * Message Service
 * 
 * Per Refactoring Guide Section 1.1-1.2:
 * - Removed Event Bus (call EntityStore directly)
 * - Optimistic updates with correlationId pattern
 * - Socket-aware (REST + WebSocket coordination)
 * 
 * Tech Stack: Axios, EntityStore, SessionStore
 * Types: @fypai/types (MessageDTO, CreateMessageRequest, UpdateMessageRequest)
 * 
 * Operations:
 * - Get messages for a team
 * - Create new message (with optimistic update)
 * - Update message
 * - Delete message
 */

import { api, getErrorMessage } from './api'
import type { MessageDTO, CreateMessageRequest, UpdateMessageRequest } from '@fypai/types'
import { useEntityStore } from '@/stores/entityStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'

/**
 * Get all messages for a team
 * GET /messages?teamId=:teamId
 * 
 * @param teamId - Team ID to fetch messages for
 * @returns Array of messages
 */
export async function getMessages(teamId: string): Promise<MessageDTO[]> {
  console.log('[MessageService] 📞 getMessages called for teamId:', teamId)
  const uiStore = useUIStore.getState()
  const entityStore = useEntityStore.getState()
  
  uiStore.setLoading('messages', true)
  
  try {
    const response = await api.get<MessageDTO[]>('/messages', {
      params: { teamId },
    })
    
    // Add to EntityStore (per guide: call store directly)
    response.data.forEach(message => entityStore.addMessage(message))
    
    uiStore.clearError('messages')
    console.log('[MessageService] ✅ Fetched messages for team:', teamId)
    
    return response.data
  } catch (error) {
    const errorMsg = getErrorMessage(error)
    uiStore.setError('messages', errorMsg)
    console.error(`[MessageService] Failed to fetch messages for team ${teamId}:`, errorMsg)
    throw error
  } finally {
    uiStore.setLoading('messages', false)
  }
}

/**
 * Create a new message (with optimistic update per guide section 1.2)
 * POST /messages
 * 
 * Flow:
 * 1. Create temp message with correlationId (instant UI update)
 * 2. Send to REST API
 * 3. Confirm optimistic message with server response
 * 4. Socket event also arrives (EntityStore handles deduplication)
 * 
 * @param data - Message creation data
 * @returns Newly created message
 */
export async function createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
  const entityStore = useEntityStore.getState()
  const sessionStore = useSessionStore.getState()
  
  // Generate temp ID and correlationId for optimistic update
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const correlationId = crypto.randomUUID()
  
  const currentUser = sessionStore.getCurrentUser()
  
  // Create temp message for optimistic update
  const tempMessage: MessageDTO = {
    id: tempId,
    teamId: data.teamId,
    authorId: currentUser?.id || data.authorId,
    content: data.content,
    contentType: data.contentType || 'text',
    createdAt: new Date().toISOString(),
    metadata: data.metadata || {},
  }
  
  // Add optimistic message (instant UI update)
  entityStore.addOptimisticMessage(tempMessage, correlationId)
  console.log('[MessageService] 🚀 Optimistic message added:', tempId)
  
  try {
    // Send to API with correlationId
    const response = await api.post<MessageDTO>('/messages', {
      ...data,
      correlationId,
    })
    
    // Confirm optimistic update (replaces temp with real)
    entityStore.confirmMessage(correlationId, response.data)
    console.log('[MessageService] ✅ Message confirmed:', response.data.id)
    
    return response.data
  } catch (error) {
    // Remove failed optimistic message
    entityStore.removeOptimisticMessage(tempId)
    console.error('[MessageService] ❌ Failed to create message, optimistic update removed')
    console.error('[MessageService] Error:', getErrorMessage(error))
    throw error
  }
}

/**
 * Update an existing message
 * PUT /messages/:id
 * 
 * @param messageId - Message ID to update
 * @param data - Update data (content, metadata)
 * @returns Updated message
 */
export async function updateMessage(
  messageId: string,
  data: UpdateMessageRequest
): Promise<MessageDTO> {
  const entityStore = useEntityStore.getState()
  
  try {
    const response = await api.put<MessageDTO>(`/messages/${messageId}`, data)
    
    // Update in EntityStore
    entityStore.updateMessage(messageId, response.data)
    
    console.log('[MessageService] ✅ Message updated:', messageId)
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
 * @param messageId - Message ID to delete
 * @param teamId - Team ID (for EntityStore)
 * @returns Deleted message confirmation
 */
export async function deleteMessage(messageId: string, teamId: string): Promise<{ id: string }> {
  const entityStore = useEntityStore.getState()
  
  try {
    const response = await api.delete<{ id: string }>(`/messages/${messageId}`)
    
    // Remove from EntityStore
    entityStore.deleteMessage(messageId, teamId)
    
    console.log('[MessageService] ✅ Message deleted:', messageId)
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
