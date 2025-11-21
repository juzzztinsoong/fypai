/**
 * Message Controller
 * 
 * Tech Stack: Express, Prisma, @fypai/types
 * Pattern: Controller handles business logic, routes delegate to controller
 * 
 * Methods:
 *   - getMessages(teamId: string): Get all messages for a team (returns MessageDTO[])
 *   - createMessage(data: CreateMessageRequest): Create new message (returns MessageDTO)
 *   - updateMessage(id: string, data: UpdateMessageRequest): Update message content (returns MessageDTO)
 *   - deleteMessage(id: string): Delete message
 * 
 * Architecture:
 *   - Uses Prisma entity types for database operations
 *   - Transforms to DTO types using messageToDTO() before returning
 *   - Returns API-friendly types with ISO strings and parsed metadata
 */

import { prisma } from '../db.js'
import { Message } from '@prisma/client'
import { MessageDTO, CreateMessageRequest, UpdateMessageRequest, messagesToDTO, messageToDTO } from '../types.js'
import { CacheService } from '../services/cacheService.js'
import { queueMessageEmbedding } from '../queues/embeddingQueue.js'

export class MessageController {
  /**
   * Get all messages for a team
   * @param {string} teamId - Team ID
   * @returns {Promise<MessageDTO[]>} Array of message DTOs with author info
   */
  static async getMessages(teamId: string): Promise<MessageDTO[]> {
    const messages = await prisma.message.findMany({
      where: { teamId },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return messages.map(msg => 
      messageToDTO(msg, msg.author)
    )
  }

  /**
   * Create a new message
   * @param {CreateMessageRequest} data - Message data
   * @returns {Promise<MessageDTO>} Created message DTO
   */
  static async createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
    const message = await prisma.message.create({
      data: {
        teamId: data.teamId,
        authorId: data.authorId,
        content: data.content,
        contentType: data.contentType,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      }
    })

    // Invalidate conversation context cache for this team
    await CacheService.invalidateTeamCache(data.teamId)

    // Queue embedding generation for RAG (Phase 4)
    // Skip embedding for very short messages or AI agent messages
    if (message.content.trim().length >= 10 && message.contentType === 'text') {
      try {
        await queueMessageEmbedding({
          messageId: message.id,
          teamId: message.teamId,
          content: message.content,
          authorId: message.authorId,
          createdAt: message.createdAt.toISOString(),
          priority: 1,
        })
        console.log(`[MessageController] ✅ Queued embedding for message: ${message.id}`)
      } catch (error) {
        // Don't fail message creation if embedding queue fails
        console.error('[MessageController] ⚠️ Failed to queue embedding:', error)
      }
    }

    return messageToDTO(message, message.author)
  }

  /**
   * Update message content
   * @param {string} id - Message ID
   * @param {UpdateMessageRequest} data - Update data
   * @returns {Promise<MessageDTO>} Updated message DTO
   */
  static async updateMessage(id: string, data: UpdateMessageRequest): Promise<MessageDTO> {
    const message = await prisma.message.update({
      where: { id },
      data: { content: data.content },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      }
    })
    
    return messageToDTO(message, message.author)
  }

  /**
   * Delete a message
   * @param {string} id - Message ID
   * @returns {Promise<void>}
   */
  static async deleteMessage(id: string): Promise<void> {
    await prisma.message.delete({
      where: { id }
    })
  }

  /**
   * Get a single message by ID
   * @param {string} id - Message ID
   * @returns {Promise<MessageDTO | null>} Message DTO or null if not found
   */
  static async getMessage(id: string): Promise<MessageDTO | null> {
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      }
    })
    
    if (!message) return null
    
    return messageToDTO(message, message.author)
  }
}