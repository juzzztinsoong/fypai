/**
 * Message Controller
 * 
 * Tech Stack: Express, Prisma
 * Pattern: Controller handles business logic, routes delegate to controller
 * 
 * Methods:
 *   - getMessages(teamId: string): Get all messages for a team
 *   - createMessage(data: MessageInput): Create new message
 *   - updateMessage(id: string, content: string): Update message content
 *   - deleteMessage(id: string): Delete message
 * 
 * Arguments:
 *   MessageInput: { teamId, authorId, content, contentType, metadata? }
 */

import { prisma } from '../db.js'

export class MessageController {
  /**
   * Get all messages for a team
   * @param {string} teamId - Team ID
   * @returns {Promise<Array>} Array of messages
   */
  static async getMessages(teamId) {
    return await prisma.message.findMany({
      where: { teamId },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })
  }

  /**
   * Create a new message
   * @param {Object} data - Message data
   * @param {string} data.teamId - Team ID
   * @param {string} data.authorId - Author user ID
   * @param {string} data.content - Message content
   * @param {string} data.contentType - Content type
   * @param {string} [data.metadata] - Optional JSON metadata
   * @returns {Promise<Object>} Created message
   */
  static async createMessage(data) {
    return await prisma.message.create({
      data: {
        ...data,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      }
    })
  }

  /**
   * Update message content
   * @param {string} id - Message ID
   * @param {string} content - New content
   * @returns {Promise<Object>} Updated message
   */
  static async updateMessage(id, content) {
    return await prisma.message.update({
      where: { id },
      data: { content }
    })
  }

  /**
   * Delete a message
   * @param {string} id - Message ID
   * @returns {Promise<Object>} Deleted message
   */
  static async deleteMessage(id) {
    return await prisma.message.delete({
      where: { id }
    })
  }
}