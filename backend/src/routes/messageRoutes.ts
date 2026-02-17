/**
 * Message Routes
 * 
 * Tech Stack: Express Router
 * Pattern: RESTful API endpoints
 * 
 * Endpoints:
 *   GET    /api/messages?teamId=:id  - List messages for team
 *   POST   /api/messages              - Create new message
 *   PATCH  /api/messages/:id          - Update message
 *   DELETE /api/messages/:id          - Delete message
 * 
 * Request/Response Shapes:
 *   POST body: { teamId, authorId, content, contentType, metadata? }
 *   PATCH body: { content }
 */

import { Router } from 'express'
import { MessageController } from '../controllers/messageController.js'
import { AIAgentController } from '../controllers/aiAgentController.js'
import { Request, Response, NextFunction } from 'express'
import { Server as SocketIOServer } from 'socket.io'

const router = Router()

// Store io instance for broadcasting
let ioInstance: SocketIOServer | null = null

export function setSocketIO(io: SocketIOServer) {
  ioInstance = io
}

/**
 * GET /api/messages?teamId=:id
 * Get all messages for a team
 */
router.get('/', async (req, res, next) => {
  try {
    const { teamId } = req.query
    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId is required' })
    }
    const messages = await MessageController.getMessages(teamId)
    res.json(messages)
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/messages/team/:teamId
 * Reset a team session by deleting all team messages
 */
router.delete('/team/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params
    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId is required' })
    }

    const deletedMessageIds = await MessageController.deleteMessagesByTeam(teamId)

    if (ioInstance) {
      for (const messageId of deletedMessageIds) {
        ioInstance.to(`team:${teamId}`).emit('message:deleted', { messageId })
      }
    }

    res.json({ teamId, deletedCount: deletedMessageIds.length, deletedMessageIds })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/messages/:id
 * Get a single message by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const message = await MessageController.getMessage(id)
    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }
    res.json(message)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/messages
 * Create a new message
 */
router.post('/', async (req, res, next) => {
  try {
    const message = await MessageController.createMessage(req.body)
    
    // Broadcast message to team room via WebSocket
    if (ioInstance) {
      ioInstance.to(`team:${message.teamId}`).emit('message:new', message)
    }
    
    // 🚨 CRITICAL: Trigger AI agent evaluation (reactive + chime rules)
    // Don't await - let it process asynchronously
    AIAgentController.handleNewMessage(message).catch(error => {
      console.error('[MessageRoutes] Error in AI agent handling:', error)
    })
    
    res.status(201).json(message)
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/messages/:id
 * Update message content
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const message = await MessageController.updateMessage(id, req.body)
    
    // Broadcast message edit to team room via WebSocket
    if (ioInstance) {
      ioInstance.to(`team:${message.teamId}`).emit('message:edited', message)
    }
    
    res.json(message)
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/messages/:id
 * Delete a message
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Get message to find teamId before deletion
    const message = await MessageController.getMessage(id)
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }
    
    // Delete the message
    await MessageController.deleteMessage(id)
    
    // Broadcast message deletion to team room via WebSocket
    if (ioInstance) {
      ioInstance.to(`team:${message.teamId}`).emit('message:deleted', { messageId: id })
    }
    
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router