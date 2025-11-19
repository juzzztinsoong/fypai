/**
 * WebSocket Service
 * 
 * Manages real-time communication using Socket.IO
 * 
 * Tech Stack: Socket.IO Client
 * Types: @fypai/types (event payload types)
 * 
 * Features:
 * - Connection management (connect, disconnect, auto-reconnect)
 * - Event listeners (message:new, presence:update, typing, etc.)
 * - Event emitters (send message, typing indicators, presence)
 * - Team-specific event routing
 * - Integration with Zustand stores
 * 
 * Usage:
 *   import { socketService } from './socketService'
 *   
 *   // Connect
 *   socketService.connect(userId)
 *   
 *   // Join team
 *   socketService.joinTeam(teamId)
 *   
 *   // Listen for messages
 *   socketService.on('message:new', (message) => { ... })
 *   
 *   // Disconnect
 *   socketService.disconnect()
 */

import { io, Socket } from 'socket.io-client'
import type {
  PresenceUpdateEvent,
  TypingEvent,
  AITaskStatusEvent,
  MessageDTO,
  AIInsightDTO,
} from '@fypai/types'
import { useSessionStore } from '../stores/sessionStore'

/**
 * WebSocket Service Class
 * Singleton pattern for global socket connection
 */
class SocketService {
  private socket: Socket | null = null
  private currentUserId: string | null = null
  private currentTeamId: string | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 5
  private connectionPromise: Promise<void> | null = null
  
  // Phase 2.2: Heartbeat system
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private readonly heartbeatIntervalMs = 30000 // 30 seconds
  
  // Phase 2.2: Exponential backoff
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private readonly baseReconnectDelay = 1000 // 1 second
  
  // Phase 2.2: Offline queue constants
  private readonly maxOfflineQueueAgeMs = 5 * 60 * 1000 // 5 minutes (max queue size enforced in SessionStore)

  /**
   * Get WebSocket server URL from environment
   */
  private getServerUrl(): string {
    return import.meta.env.VITE_WS_URL || 'http://localhost:5000'
  }

  /**
   * Connect to WebSocket server
   * @param userId - Current user ID for presence tracking
   * @returns Promise that resolves when connected
   */
  connect(userId: string): Promise<void> {
    // Already connected - return immediately
    if (this.socket?.connected) {
      console.log('[SocketService] Already connected, resolving immediately')
      return Promise.resolve()
    }

    // Connection in progress - return existing promise
    if (this.connectionPromise) {
      console.log('[SocketService] Connection in progress, returning existing promise')
      return this.connectionPromise
    }

    // Socket exists but not connected - try to reconnect
    if (this.socket && !this.socket.connected) {
      console.log('[SocketService] Socket exists but disconnected, attempting reconnect...')
      this.connectionPromise = new Promise((resolve, reject) => {
        this.socket!.once('connect', () => {
          console.log('[SocketService] ✅ Reconnected:', this.socket?.id)
          this.connectionPromise = null
          resolve()
        })
        
        this.socket!.once('connect_error', (error: Error) => {
          console.error('[SocketService] Reconnect failed:', error.message)
          this.connectionPromise = null
          reject(error)
        })
        
        this.socket!.connect()
      })
      return this.connectionPromise
    }

    // Create new socket connection
    this.currentUserId = userId
    const serverUrl = this.getServerUrl()

    console.log(`[SocketService] Connecting to ${serverUrl}...`)

    this.connectionPromise = new Promise((resolve, reject) => {
      this.socket = io(serverUrl, {
        transports: ['websocket'],
        reconnection: false, // Phase 2.2: Manual reconnection with exponential backoff
        autoConnect: true,
      })

      // Add global event logger for debugging
      this.socket.onAny((eventName, ...args) => {
        console.log('[SocketService] 📨 Received event:', eventName, args)
      })

      // Resolve promise once connected
      this.socket.once('connect', () => {
        console.log('[SocketService] ✅ Connected and ready:', this.socket?.id)
        this.reconnectAttempts = 0
        this.connectionPromise = null
        
        // Phase 2.2: Update SessionStore
        useSessionStore.getState().setConnectionState('connected')
        useSessionStore.getState().resetReconnectAttempts()
        
        // Phase 2.2: Start heartbeat
        this.startHeartbeat()

        // Register user presence
        if (this.currentUserId) {
          this.registerPresence(this.currentUserId)
          
          // Request current list of online users for state sync
          console.log('[SocketService] 📋 Requesting current online users list')
          this.getOnlineUsers()
        }

        // Rejoin team if was in one
        if (this.currentTeamId) {
          this.joinTeam(this.currentTeamId)
        }
        
        // Phase 2.2: Flush offline queue
        this.flushOfflineQueue()

        resolve()
      })

      // Reject on connection error
      this.socket.once('connect_error', (error: Error) => {
        console.error('[SocketService] Initial connection failed:', error.message)
        this.connectionPromise = null
        
        // Phase 2.2: Update SessionStore
        useSessionStore.getState().setConnectionState('failed')
        
        reject(error)
      })

      this.setupListeners()
    })

    return this.connectionPromise
  }

  /**
   * Setup core socket event listeners
   * Phase 2.2: Enhanced with exponential backoff and SessionStore updates
   */
  private setupListeners(): void {
    if (!this.socket) return

    // Connection events - handle reconnections (initial connect is handled in connect() method)
    this.socket.on('connect', () => {
      console.log('[SocketService] Reconnected:', this.socket?.id)
      this.reconnectAttempts = 0
      
      // Phase 2.2: Update SessionStore
      useSessionStore.getState().setConnectionState('connected')
      useSessionStore.getState().resetReconnectAttempts()
      
      // Phase 2.2: Start heartbeat
      this.startHeartbeat()

      // Register user presence
      if (this.currentUserId) {
        this.registerPresence(this.currentUserId)
        
        // Request current list of online users for state sync
        console.log('[SocketService] 📋 Requesting current online users list (reconnect)')
        this.getOnlineUsers()
      }

      // Rejoin team if was in one
      if (this.currentTeamId) {
        this.joinTeam(this.currentTeamId)
      }
      
      // Phase 2.2: Flush offline queue
      this.flushOfflineQueue()
    })

    this.socket.on('disconnect', (reason: string) => {
      console.log('[SocketService] Disconnected:', reason)
      
      // Phase 2.2: Stop heartbeat
      this.stopHeartbeat()
      
      // Phase 2.2: Update SessionStore
      useSessionStore.getState().setConnectionState('disconnected')
      
      // Phase 2.2: Auto-reconnect with exponential backoff (unless manual disconnect)
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect()
      }
    })

    this.socket.on('connect_error', (error: Error) => {
      console.error('[SocketService] Connection error:', error.message)
      
      // Phase 2.2: Update SessionStore
      useSessionStore.getState().incrementReconnectAttempts()
      
      // Phase 2.2: Schedule exponential backoff reconnect
      this.scheduleReconnect()
    })

    this.socket.on('error', (error: Error) => {
      console.error('[SocketService] Socket error:', error)
    })
    
    // Phase 2.2: Heartbeat pong listener
    this.socket.on('pong', () => {
      const now = Date.now()
      useSessionStore.getState().updatePongTime(now)
      console.log('[SocketService] 💓 Pong received')
    })
  }

  /**
   * Phase 2.2: Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }
    
    // Check if max attempts reached
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SocketService] ❌ Max reconnection attempts reached')
      useSessionStore.getState().setConnectionState('failed')
      return
    }
    
    // Calculate exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++
    
    console.log(`[SocketService] 🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)
    
    // Update SessionStore
    useSessionStore.getState().setConnectionState('reconnecting')
    useSessionStore.getState().incrementReconnectAttempts()
    
    // Schedule reconnect
    this.reconnectTimeoutId = setTimeout(() => {
      console.log('[SocketService] 🔄 Attempting reconnect...')
      this.socket?.connect()
    }, delay)
  }
  
  /**
   * Phase 2.2: Start heartbeat interval
   */
  private startHeartbeat(): void {
    // Clear existing interval
    this.stopHeartbeat()
    
    console.log('[SocketService] 💓 Starting heartbeat (30s interval)')
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        const now = Date.now()
        useSessionStore.getState().updatePingTime(now)
        this.socket.emit('ping')
        console.log('[SocketService] 💓 Ping sent')
      }
    }, this.heartbeatIntervalMs)
  }
  
  /**
   * Phase 2.2: Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      console.log('[SocketService] 💓 Heartbeat stopped')
    }
  }
  
  /**
   * Phase 2.2: Flush offline queue
   */
  private flushOfflineQueue(): void {
    const sessionStore = useSessionStore.getState()
    const queue = sessionStore.getOfflineQueue()
    
    if (queue.length === 0) return
    
    console.log(`[SocketService] 📤 Flushing ${queue.length} queued messages`)
    
    // Remove messages older than 5 minutes
    sessionStore.removeOldQueuedMessages(this.maxOfflineQueueAgeMs)
    
    // Send queued messages in order
    const validQueue = sessionStore.getOfflineQueue()
    validQueue.forEach(({ event, data }) => {
      if (this.socket?.connected) {
        console.log(`[SocketService] 📤 Sending queued ${event}`)
        this.socket.emit(event, data)
      }
    })
    
    // Clear queue
    sessionStore.clearOfflineQueue()
    console.log('[SocketService] ✅ Offline queue flushed')
  }
  
  /**
   * Phase 2.2: Queue message for offline sending
   */
  private queueForOffline(event: string, data: any): void {
    console.log(`[SocketService] 📥 Queuing ${event} for offline send`)
    useSessionStore.getState().queueOfflineMessage(event, data)
  }
  
  /**
   * Register user presence with server
   */
  private registerPresence(userId: string): void {
    if (!this.socket?.connected) return
    
    console.log('[SocketService] Registering presence:', userId)
    this.socket.emit('presence:online', { userId })
  }

  /**
   * Get the socket instance (for external integrations like Socket Bridge)
   */
  getSocket(): Socket | null {
    return this.socket
  }

  /**
   * Join a team room
   * @param teamId - Team ID to join
   */
  joinTeam(teamId: string): void {
    if (!this.socket?.connected) {
      console.error('[SocketService] ❌ Cannot join team - socket not connected!')
      return
    }

    console.log('[SocketService] 🚪 Emitting team:join for team:', teamId)
    this.currentTeamId = teamId
    this.socket.emit('team:join', { teamId })
    console.log('[SocketService] ✅ team:join emitted for team:', teamId)
  }

  /**
   * Leave current team room
   */
  leaveTeam(): void {
    if (!this.socket?.connected || !this.currentTeamId) return

    console.log('[SocketService] Leaving team:', this.currentTeamId)
    this.socket.emit('team:leave', { teamId: this.currentTeamId })
    this.currentTeamId = null
  }

  /**
   * Send a message (emits to server, server broadcasts)
   * Phase 2.2: Uses offline queue when disconnected
   * @param message - Message to send
   */
  sendMessage(message: MessageDTO): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] ⚠️  Not connected - queuing message for offline send')
      this.queueForOffline('message:new', message)
      return
    }

    console.log('[SocketService] Sending message:', message.id)
    this.socket.emit('message:new', message)
  }

  /**
   * Send typing indicator
   * @param teamId - Team ID
   * @param userId - User ID who is typing
   * @param isTyping - True if user is typing, false if stopped
   */
  sendTypingIndicator(teamId: string, userId: string, isTyping: boolean): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] ⚠️  Cannot send typing indicator - socket not connected')
      return
    }

    const event = isTyping ? 'typing:start' : 'typing:stop'
    console.log(`[SocketService] ⌨️  Emitting ${event}`, { teamId, userId, socketId: this.socket.id })
    this.socket.emit(event, { teamId, userId })
  }

  /**
   * Request list of online users
   */
  getOnlineUsers(): void {
    if (!this.socket?.connected) return

    this.socket.emit('presence:get')
  }

  /**
   * Toggle AI assistant for a team (broadcast to all team members)
   * @param teamId - Team ID
   * @param enabled - True to enable AI, false to disable
   */
  toggleTeamAI(teamId: string, enabled: boolean): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] ⚠️  Cannot toggle AI - socket not connected')
      return
    }

    console.log(`[SocketService] 🤖 Emitting ai:toggle`, { teamId, enabled, socketId: this.socket.id })
    this.socket.emit('ai:toggle', { teamId, enabled })
  }

  /**
   * Listen for new messages
   * @param callback - Function to call when message received
   */
  onMessage(callback: (message: MessageDTO) => void): void {
    if (!this.socket) {
      console.error('[SocketService] ❌ Cannot register message:new listener - socket is null')
      return
    }
    console.log('[SocketService] 🔔 Registering message:new listener')
    
    // Wrap callback to add logging
    const wrappedCallback = (message: MessageDTO) => {
      console.log('[SocketService] 🎯 message:new listener FIRED for message:', message.id)
      callback(message)
    }
    
    this.socket.on('message:new', wrappedCallback)
    console.log('[SocketService] ✅ message:new listener registered successfully')
  }

  /**
   * Listen for message edits
   * @param callback - Function to call when message edited
   */
  onMessageEdit(callback: (message: MessageDTO) => void): void {
    if (!this.socket) return
    console.log('[SocketService] 🔔 Registering message:edited listener')
    this.socket.on('message:edited', callback)
  }

  /**
   * Listen for message deletions
   * @param callback - Function to call when message deleted
   */
  onMessageDelete(callback: (data: { messageId: string }) => void): void {
    if (!this.socket) return
    console.log('[SocketService] 🔔 Registering message:deleted listener')
    this.socket.on('message:deleted', callback)
  }

  /**
   * Listen for presence updates
   * @param callback - Function to call when presence changes
   */
  onPresenceUpdate(callback: (data: PresenceUpdateEvent) => void): void {
    if (!this.socket) return
    this.socket.on('presence:update', callback)
  }

  /**
   * Listen for presence list
   * @param callback - Function to call when online users list received
   */
  onPresenceList(callback: (data: { users: string[] }) => void): void {
    if (!this.socket) return
    this.socket.on('presence:list', callback)
  }

  /**
   * Listen for typing indicators
   * @param callback - Function to call when someone starts/stops typing
   */
  onTyping(callback: (data: TypingEvent) => void): void {
    if (!this.socket) return
    this.socket.on('typing:start', callback)
    this.socket.on('typing:stop', callback)
  }

  /**
   * Listen for AI task status updates
   * @param callback - Function to call when AI task status changes
   */
  onAITaskStatus(callback: (data: AITaskStatusEvent) => void): void {
    if (!this.socket) return
    this.socket.on('ai:task:status', callback)
  }

  /**
   * Listen for new AI insights
   * @param callback - Function to call when insight created
   */
  onInsightCreated(callback: (insight: AIInsightDTO) => void): void {
    if (!this.socket) return
    this.socket.on('insight:created', callback)
  }

  /**
   * Listen for new AI-generated insights (from AI generation endpoints)
   * @param callback - Function to call when AI insight generated
   */
  onAIInsight(callback: (insight: AIInsightDTO) => void): void {
    if (!this.socket) return
    console.log('[SocketService] 🔔 Registering ai:insight:new listener')
    this.socket.on('ai:insight:new', callback)
  }

  /**
   * Listen for deleted AI insights
   * @param callback - Function to call when insight deleted
   */
  onInsightDeleted(callback: (data: { id: string }) => void): void {
    if (!this.socket) return
    this.socket.on('insight:deleted', callback)
  }

  /**
   * Remove event listener
   * @param event - Event name
   * @param callback - Optional specific callback to remove
   */
  off(event: string, callback?: (...args: any[]) => void): void {
    if (!this.socket) return
    
    if (callback) {
      this.socket.off(event, callback)
    } else {
      this.socket.off(event)
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected === true
  }

  /**
   * Disconnect from server
   * Phase 2.2: Cleans up timers and updates SessionStore
   */
  disconnect(): void {
    if (!this.socket) return

    console.log('[SocketService] Disconnecting...')
    
    // Phase 2.2: Stop heartbeat
    this.stopHeartbeat()
    
    // Phase 2.2: Clear reconnect timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }
    
    // Leave current team
    this.leaveTeam()

    // Disconnect socket
    this.socket.disconnect()
    this.socket = null
    this.currentUserId = null
    this.connectionPromise = null
    this.currentTeamId = null
    this.reconnectAttempts = 0
    
    // Phase 2.2: Update SessionStore
    useSessionStore.getState().setConnectionState('disconnected')
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId
  }

  /**
   * Get current team ID
   */
  getCurrentTeamId(): string | null {
    return this.currentTeamId
  }
}

// Export singleton instance
export const socketService = new SocketService()

export default socketService
