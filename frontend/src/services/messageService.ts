/**
 * Message Service
 * 
 * Handles all message-related API operations using shared DTOs
 * 
 * Tech Stack: Axios
 * Types: @fypai/types (MessageDTO, CreateMessageRequest, UpdateMessageRequest)
 * 
 * Operations:
 * - Get messages for a team
 * - Create new message
 * - Update message
 * - Delete message
 */

import { api, getErrorMessage } from './api'
import type { MessageDTO, CreateMessageRequest, UpdateMessageRequest } from '@fypai/types'

/**
 * Get all messages for a team
 * GET /messages?teamId=:teamId
 * @param teamId - Team ID to fetch messages for
 * @returns Array of messages
 */
export async function getMessages(teamId: string): Promise<MessageDTO[]> {
  try {
    const response = await api.get<MessageDTO[]>('/messages', {
      params: { teamId },
    })
    return response.data
  } catch (error) {
    console.error(`[MessageService] Failed to fetch messages for team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Create a new message
 * POST /messages
 * @param data - Message creation data (teamId, authorId, content, contentType, metadata)
 * @returns Newly created message
 */
export async function createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
  try {
    const response = await api.post<MessageDTO>('/messages', data)
    console.log('[MessageService] Message created:', response.data.id)
    return response.data
  } catch (error) {
    console.error('[MessageService] Failed to create message:', getErrorMessage(error))
    throw error
  }
}

/**
 * Update an existing message
 * PUT /messages/:id
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
    console.log('[MessageService] Message updated:', messageId)
    return response.data
  } catch (error) {
    console.error(`[MessageService] Failed to update message ${messageId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Delete a message
 * DELETE /messages/:id
 * @param messageId - Message ID to delete
 * @returns Deleted message confirmation
 */
export async function deleteMessage(messageId: string): Promise<{ id: string }> {
  try {
    const response = await api.delete<{ id: string }>(`/messages/${messageId}`)
    console.log('[MessageService] Message deleted:', messageId)
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
