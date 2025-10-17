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
import { MessageController } from '../controllers/messageController.js';
import { setupPresenceHandlers } from './presenceHandler.js';
/**
 * Setup Socket.IO event handlers
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
export function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log('[SOCKET] Client connected:', socket.id);
        // Setup presence tracking handlers
        setupPresenceHandlers(io, socket);
        /**
         * Join team room for scoped broadcasts
         * Payload: { teamId: string }
         */
        socket.on('team:join', ({ teamId }) => {
            socket.join(`team:${teamId}`);
            console.log(`[SOCKET] ${socket.id} joined team:${teamId}`);
        });
        /**
         * Leave team room
         * Payload: { teamId: string }
         */
        socket.on('team:leave', ({ teamId }) => {
            socket.leave(`team:${teamId}`);
            console.log(`[SOCKET] ${socket.id} left team:${teamId}`);
        });
        /**
         * New message event
         * Payload: { teamId, authorId, content, contentType, metadata? }
         */
        socket.on('message:new', async (data) => {
            try {
                // Persist message to DB
                const message = await MessageController.createMessage(data);
                // Broadcast to all clients in team room
                io.to(`team:${data.teamId}`).emit('message:new', message);
            }
            catch (error) {
                console.error('[SOCKET] message:new error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });
        /**
         * Typing indicator - start typing
         * Payload: { teamId, userId }
         */
        socket.on('typing:start', ({ teamId, userId }) => {
            socket.to(`team:${teamId}`).emit('typing:start', { userId });
            console.log(`[SOCKET] User ${userId} started typing in team:${teamId}`);
        });
        /**
         * Typing indicator - stop typing
         * Payload: { teamId, userId }
         */
        socket.on('typing:stop', ({ teamId, userId }) => {
            socket.to(`team:${teamId}`).emit('typing:stop', { userId });
            console.log(`[SOCKET] User ${userId} stopped typing in team:${teamId}`);
        });
        /**
         * Legacy typing indicator (for backward compatibility)
         * Payload: { teamId, userId, isTyping }
         */
        socket.on('presence:typing', ({ teamId, userId, isTyping }) => {
            socket.to(`team:${teamId}`).emit('presence:typing', { userId, isTyping });
        });
        /**
         * Message edit event
         * Payload: { messageId, content }
         */
        socket.on('message:edit', async ({ messageId, content, teamId }) => {
            try {
                const message = await MessageController.updateMessage(messageId, { content });
                io.to(`team:${teamId}`).emit('message:edited', message);
                console.log(`[SOCKET] Message ${messageId} edited`);
            }
            catch (error) {
                console.error('[SOCKET] message:edit error:', error);
                socket.emit('error', { message: 'Failed to edit message' });
            }
        });
        /**
         * Message delete event
         * Payload: { messageId, teamId }
         */
        socket.on('message:delete', async ({ messageId, teamId }) => {
            try {
                await MessageController.deleteMessage(messageId);
                io.to(`team:${teamId}`).emit('message:deleted', { messageId });
                console.log(`[SOCKET] Message ${messageId} deleted`);
            }
            catch (error) {
                console.error('[SOCKET] message:delete error:', error);
                socket.emit('error', { message: 'Failed to delete message' });
            }
        });
        /**
         * AI task status update
         * Payload: { taskId, teamId?, status, progress?, result? }
         */
        socket.on('ai:task:status', (data) => {
            // Broadcast to team room if teamId provided, otherwise broadcast globally
            if (data.teamId) {
                io.to(`team:${data.teamId}`).emit('ai:task:status', data);
                console.log(`[SOCKET] AI task ${data.taskId} status: ${data.status} (team: ${data.teamId})`);
            }
            else {
                io.emit('ai:task:status', data);
                console.log(`[SOCKET] AI task ${data.taskId} status: ${data.status} (global)`);
            }
        });
        /**
         * AI insight created event
         * Payload: { insight, teamId }
         */
        socket.on('insight:created', ({ insight, teamId }) => {
            io.to(`team:${teamId}`).emit('insight:created', insight);
            console.log(`[SOCKET] New AI insight created for team:${teamId}`);
        });
        /**
         * AI insight deleted event
         * Payload: { insightId, teamId }
         */
        socket.on('insight:deleted', ({ insightId, teamId }) => {
            io.to(`team:${teamId}`).emit('insight:deleted', { insightId });
            console.log(`[SOCKET] AI insight ${insightId} deleted from team:${teamId}`);
        });
        /**
         * Error broadcast
         * Send error to specific socket
         */
        socket.on('error:broadcast', ({ userId, error }) => {
            socket.emit('error', { userId, error });
        });
        socket.on('disconnect', () => {
            console.log('[SOCKET] Client disconnected:', socket.id);
        });
    });
}
