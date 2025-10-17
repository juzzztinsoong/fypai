/**
 * Presence Tracking Handler
 *
 * Tech Stack: Socket.IO, In-memory Set
 * Pattern: Track online/offline users in memory
 *
 * Events:
 *   Client -> Server:
 *     - presence:online   : User comes online
 *     - presence:offline  : User goes offline
 *     - presence:get      : Request list of online users
 *
 *   Server -> Client:
 *     - presence:update   : Broadcast user status change
 *     - presence:list     : Send list of online users
 *
 * Architecture:
 *   - In-memory Set tracks online user IDs
 *   - Socket ID -> User ID mapping for disconnect cleanup
 *   - Broadcasts status changes to all connected clients
 *
 * Limitations:
 *   - Not persistent (restarts clear state)
 *   - Not scalable across multiple servers (use Redis for production)
 */
// In-memory tracking
const onlineUsers = new Set();
const socketUserMap = new Map(); // socketId -> userId
/**
 * Setup presence tracking event handlers
 * @param {Server} io - Socket.IO server instance
 * @param {Socket} socket - Individual socket connection
 */
export function setupPresenceHandlers(io, socket) {
    /**
     * User announces they're online
     * Payload: { userId: string }
     */
    socket.on('presence:online', ({ userId }) => {
        // Track user as online
        onlineUsers.add(userId);
        socketUserMap.set(socket.id, userId);
        // Broadcast to all clients
        io.emit('presence:update', { userId, status: 'online' });
        console.log(`[PRESENCE] User ${userId} is online (${onlineUsers.size} total)`);
    });
    /**
     * User announces they're going offline
     * Payload: { userId: string }
     */
    socket.on('presence:offline', ({ userId }) => {
        // Remove from online set
        onlineUsers.delete(userId);
        socketUserMap.delete(socket.id);
        // Broadcast to all clients
        io.emit('presence:update', { userId, status: 'offline' });
        console.log(`[PRESENCE] User ${userId} is offline (${onlineUsers.size} total)`);
    });
    /**
     * Client requests current list of online users
     */
    socket.on('presence:get', () => {
        const onlineUsersList = Array.from(onlineUsers);
        socket.emit('presence:list', onlineUsersList);
        console.log(`[PRESENCE] Sent list of ${onlineUsersList.length} online users to ${socket.id}`);
    });
    /**
     * Handle disconnect - cleanup user presence
     */
    socket.on('disconnect', () => {
        const userId = socketUserMap.get(socket.id);
        if (userId) {
            // Remove from tracking
            onlineUsers.delete(userId);
            socketUserMap.delete(socket.id);
            // Broadcast offline status
            io.emit('presence:update', { userId, status: 'offline' });
            console.log(`[PRESENCE] User ${userId} disconnected (${onlineUsers.size} total)`);
        }
    });
}
/**
 * Get current list of online users
 * @returns {string[]} Array of online user IDs
 */
export function getOnlineUsers() {
    return Array.from(onlineUsers);
}
/**
 * Check if a specific user is online
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user is online
 */
export function isUserOnline(userId) {
    return onlineUsers.has(userId);
}
/**
 * Get count of online users
 * @returns {number} Number of users online
 */
export function getOnlineUserCount() {
    return onlineUsers.size;
}
