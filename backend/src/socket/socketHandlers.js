/**
 * WebSocket Event Handlers
 * 
 * Tech Stack: Socket.IO 4.6.1
 * Pattern: Event-driven realtime communication
 * 
 * Events:
 *   - message:new       : Broadcast new message to team
 *   - presence:update   : User online/offline/typing
 *   - ai:task:status    : AI job progress updates
 * 
 * Usage:
 *   import { setupSocketHandlers } from './socket/socketHandlers.js'
 *   setupSocketHandlers(io)
 */

import { MessageController } from '../controllers/messageController.js'

/**
 * Setup Socket.IO event handlers
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('[SOCKET] Client connected:', socket.id)

    /**
     * Join team room for scoped broadcasts
     * Payload: { teamId: string }
     */
    socket.on('team:join', ({ teamId }) => {
      socket.join(`team:${teamId}`)
      console.log(`[SOCKET] ${socket.id} joined team:${teamId}`)
    })

    /**
     * Leave team room
     * Payload: { teamId: string }
     */
    socket.on('team:leave', ({ teamId }) => {
      socket.leave(`team:${teamId}`)
      console.log(`[SOCKET] ${socket.id} left team:${teamId}`)
    })

    /**
     * New message event
     * Payload: { teamId, authorId, content, contentType, metadata? }
     */
    socket.on('message:new', async (data) => {
      try {
        // Persist message to DB
        const message = await MessageController.createMessage(data)
        
        // Broadcast to all clients in team room
        io.to(`team:${data.teamId}`).emit('message:new', message)
      } catch (error) {
        console.error('[SOCKET] message:new error:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    /**
     * Typing indicator
     * Payload: { teamId, userId, isTyping }
     */
    socket.on('presence:typing', ({ teamId, userId, isTyping }) => {
      socket.to(`team:${teamId}`).emit('presence:typing', { userId, isTyping })
    })

    /**
     * AI task status update
     * Payload: { taskId, status, progress?, result? }
     */
    socket.on('ai:task:status', (data) => {
      // Broadcast AI job progress
      io.emit('ai:task:status', data)
    })

    socket.on('disconnect', () => {
      console.log('[SOCKET] Client disconnected:', socket.id)
    })
  })
}