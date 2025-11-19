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

import { Server, Socket } from 'socket.io'

// In-memory tracking
const onlineUsers = new Set<string>(['agent']) // AI agent is always online
const socketUserMap = new Map<string, string>() // socketId -> userId

// Phase 2.3: Typing indicators with TTL
const typingUsers = new Map<string, Map<string, number>>() // teamId -> Map<userId, timestamp>
let typingCleanupInterval: NodeJS.Timeout | null = null

/**
 * Phase 2.3: Start typing indicator cleanup (every 5s)
 */
function startTypingCleanup(io: Server): void {
  if (typingCleanupInterval) return // Already running
  
  typingCleanupInterval = setInterval(() => {
    const now = Date.now()
    const maxAge = 5000 // 5 seconds
    let changed = false
    
    typingUsers.forEach((teamTyping, teamId) => {
      teamTyping.forEach((timestamp, userId) => {
        if (now - timestamp > maxAge) {
          teamTyping.delete(userId)
          changed = true
          console.log(`[PRESENCE] \u23f1\ufe0f Auto-removed stale typing for user ${userId} in team ${teamId}`)
        }
      })
      
      // Remove empty team entries
      if (teamTyping.size === 0) {
        typingUsers.delete(teamId)
      }
    })
    
    // Broadcast if anything changed (optional - could broadcast per-team)
    if (changed) {
      console.log('[PRESENCE] \ud83e\uddf9 Cleaned up stale typing indicators')
    }
  }, 5000)
  
  console.log('[PRESENCE] \u23f0 Started typing indicator cleanup (5s interval)')
}

/**
 * Setup presence tracking event handlers
 * @param {Server} io - Socket.IO server instance
 * @param {Socket} socket - Individual socket connection
 */
export function setupPresenceHandlers(io: Server, socket: Socket): void {
  // Phase 2.3: Start cleanup interval on first connection
  startTypingCleanup(io)
  
  /**
   * User announces they're online
   * Payload: { userId: string }
   */
  socket.on('presence:online', ({ userId }: { userId: string }) => {
    // Get old user ID for this socket (if switching users in same tab)
    const oldUserId = socketUserMap.get(socket.id)
    
    // Update socket -> user mapping
    socketUserMap.set(socket.id, userId)
    
    // Add new user to online set
    onlineUsers.add(userId)
    
    // Broadcast new user online
    io.emit('presence:update', { userId, online: true })
    console.log(`[PRESENCE] User ${userId} is online (${onlineUsers.size} total)`)
    
    // If this socket was previously mapped to a different user, check if that user should go offline
    if (oldUserId && oldUserId !== userId && oldUserId !== 'agent') {
      // Check if the old user has any other active sockets
      const hasOtherSockets = Array.from(socketUserMap.values()).includes(oldUserId)
      
      if (!hasOtherSockets) {
        // No other sockets for old user, mark them offline
        onlineUsers.delete(oldUserId)
        io.emit('presence:update', { userId: oldUserId, online: false })
        console.log(`[PRESENCE] User ${oldUserId} went offline (no other sockets) (${onlineUsers.size} total)`)
      } else {
        console.log(`[PRESENCE] User ${oldUserId} still has other active sockets, keeping online`)
      }
    }
  })
  
  /**
   * User announces they're going offline
   * Payload: { userId: string }
   */
  socket.on('presence:offline', ({ userId }: { userId: string }) => {
    // Remove from online set
    onlineUsers.delete(userId)
    socketUserMap.delete(socket.id)
    
    // Broadcast to all clients
    io.emit('presence:update', { userId, online: false })
    
    console.log(`[PRESENCE] User ${userId} is offline (${onlineUsers.size} total)`)
  })
  
  /**
   * Client requests current list of online users
   */
  socket.on('presence:get', () => {
    const onlineUsersList = Array.from(onlineUsers)
    socket.emit('presence:list', onlineUsersList)
    console.log(`[PRESENCE] Sent list of ${onlineUsersList.length} online users to ${socket.id}`)
  })
  
  /**
   * Phase 2.3: Typing indicator - start
   * Payload: { teamId: string, userId: string }
   */
  socket.on('typing:start', ({ teamId, userId }: { teamId: string; userId: string }) => {
    // Get or create team typing map
    if (!typingUsers.has(teamId)) {
      typingUsers.set(teamId, new Map())
    }
    
    const teamTyping = typingUsers.get(teamId)!
    const wasTyping = teamTyping.has(userId)
    
    // Update timestamp
    teamTyping.set(userId, Date.now())
    
    // Only broadcast if this is a new typing user (prevent spam)
    if (!wasTyping) {
      socket.to(`team:${teamId}`).emit('typing:start', { teamId, userId })
      console.log(`[PRESENCE] \u2328\ufe0f  User ${userId} started typing in team ${teamId}`)
    }
  })
  
  /**
   * Phase 2.3: Typing indicator - stop
   * Payload: { teamId: string, userId: string }
   */
  socket.on('typing:stop', ({ teamId, userId }: { teamId: string; userId: string }) => {
    const teamTyping = typingUsers.get(teamId)
    if (!teamTyping) return
    
    const wasTyping = teamTyping.has(userId)
    teamTyping.delete(userId)
    
    // Clean up empty team entry
    if (teamTyping.size === 0) {
      typingUsers.delete(teamId)
    }
    
    // Only broadcast if user was actually typing
    if (wasTyping) {
      socket.to(`team:${teamId}`).emit('typing:stop', { teamId, userId })
      console.log(`[PRESENCE] \u270b User ${userId} stopped typing in team ${teamId}`)
    }
  })
  
  /**
   * Handle disconnect - cleanup user presence
   */
  socket.on('disconnect', () => {
    const userId = socketUserMap.get(socket.id)
    if (userId) {
      // Don't remove AI agent from online users
      if (userId !== 'agent') {
        // Remove from tracking
        onlineUsers.delete(userId)
        socketUserMap.delete(socket.id)
        
        // Broadcast offline status
        io.emit('presence:update', { userId, online: false })
        
        console.log(`[PRESENCE] User ${userId} disconnected (${onlineUsers.size} total)`)
      }
    }
  })
}

/**
 * Get current list of online users
 * @returns {string[]} Array of online user IDs
 */
export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers)
}

/**
 * Check if a specific user is online
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user is online
 */
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId)
}

/**
 * Get count of online users
 * @returns {number} Number of users online
 */
export function getOnlineUserCount(): number {
  return onlineUsers.size
}
