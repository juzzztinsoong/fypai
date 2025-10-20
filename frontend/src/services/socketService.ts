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
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        console.log('[SocketService] Already connected')
        resolve()
        return
      }

      this.currentUserId = userId
      const serverUrl = this.getServerUrl()

      console.log(`[SocketService] Connecting to ${serverUrl}...`)

      this.socket = io(serverUrl, {
        transports: ['websocket'], // ✅ WebSocket only - no polling upgrade
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      // Add global event logger for debugging
      this.socket.onAny((eventName, ...args) => {
        console.log('[SocketService] 📨 Received event:', eventName, args)
      })

      // Resolve promise once connected
      this.socket.once('connect', () => {
        console.log('[SocketService] ✅ Connected and ready:', this.socket?.id)
        this.reconnectAttempts = 0

        // Register user presence
        if (this.currentUserId) {
          this.registerPresence(this.currentUserId)
        }

        // Rejoin team if was in one
        if (this.currentTeamId) {
          this.joinTeam(this.currentTeamId)
        }

        resolve()
      })

      // Reject on connection error
      this.socket.once('connect_error', (error: Error) => {
        console.error('[SocketService] Initial connection failed:', error.message)
        reject(error)
      })

      this.setupListeners()
    })
  }

  /**
   * Setup core socket event listeners
   */
  private setupListeners(): void {
    if (!this.socket) return

    // Connection events - handle reconnections (initial connect is handled in connect() method)
    this.socket.on('connect', () => {
      console.log('[SocketService] Reconnected:', this.socket?.id)
      this.reconnectAttempts = 0

      // Register user presence
      if (this.currentUserId) {
        this.registerPresence(this.currentUserId)
      }

      // Rejoin team if was in one
      if (this.currentTeamId) {
        this.joinTeam(this.currentTeamId)
      }
    })

    this.socket.on('disconnect', (reason: string) => {
      console.log('[SocketService] Disconnected:', reason)
    })

    this.socket.on('connect_error', (error: Error) => {
      this.reconnectAttempts++
      console.error('[SocketService] Connection error:', error.message)

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[SocketService] Max reconnection attempts reached')
      }
    })

    this.socket.on('error', (error: Error) => {
      console.error('[SocketService] Socket error:', error)
    })
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
   * @param message - Message to send
   */
  sendMessage(message: MessageDTO): void {
    if (!this.socket?.connected) {
      console.warn('[SocketService] Cannot send message - not connected')
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
    if (!this.socket?.connected) return

    const event = isTyping ? 'typing:start' : 'typing:stop'
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
   * Disconnect from server
   */
  disconnect(): void {
    if (!this.socket) return

    console.log('[SocketService] Disconnecting...')
    
    // Leave current team
    this.leaveTeam()

    // Disconnect socket
    this.socket.disconnect()
    this.socket = null
    this.currentUserId = null
    this.currentTeamId = null
    this.reconnectAttempts = 0
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false
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
