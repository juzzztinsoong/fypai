/**
 * Global Realtime Initialization
 * 
 * Socket lifecycle lives OUTSIDE React component lifecycle to avoid
 * React 18's double-mount/unmount behavior breaking the connection.
 * 
 * Handlers registered once globally, persist across component remounts.
 */

import { socketService } from './socketService'
import { useEntityStore } from '@/stores/entityStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { MessageDTO, AIInsightDTO } from '@fypai/types'

// Closure variables to track initialization state
let initPromise: Promise<void> | null = null
let isInitialized = false

/**
 * Initialize realtime infrastructure (socket + handlers)
 * Idempotent - safe to call multiple times
 */
export async function initializeRealtime(userId: string): Promise<void> {
  // Already fully initialized and connected
  if (isInitialized && socketService.getSocket()?.connected) {
    console.log('[RealtimeInit] ✅ Already initialized and connected, skipping')
    return Promise.resolve()
  }
  
  // Initialization already in progress
  if (initPromise) {
    console.log('[RealtimeInit] ⏳ Initialization in progress, returning existing promise')
    return initPromise
  }
  
  console.log('[RealtimeInit] 🚀 Starting realtime initialization...')
  
  initPromise = (async () => {
    try {
      // Set current user in SessionStore
      const sessionStore = useSessionStore.getState()
      sessionStore.setCurrentUser({
        id: userId,
        name: userId === 'user1' ? 'Alice' : 'User',
        email: `${userId}@example.com`,
        avatar: null,
        role: 'member',
        createdAt: new Date().toISOString()
      })
      
      // Connect to WebSocket
      console.log('[RealtimeInit] 🔌 Connecting to WebSocket...')
      await socketService.connect(userId)
      const socket = socketService.getSocket()
      
      if (!socket) {
        throw new Error('Socket not available after connection')
      }
      
      console.log('[RealtimeInit] ✅ WebSocket connected')
      console.log('[RealtimeInit] 📡 Registering socket handlers...')
      
      // ========================================================================
      // MESSAGE EVENTS
      // ========================================================================
      
      socket.on('message:new', (message: MessageDTO) => {
        console.log('[RealtimeInit] 📨 Socket: message:new ->', message.id)
        useEntityStore.getState().addMessage(message)
      })
      
      socket.on('message:edited', (message: MessageDTO) => {
        console.log('[RealtimeInit] ✏️  Socket: message:edited ->', message.id)
        useEntityStore.getState().updateMessage(message.id, message)
      })
      
      socket.on('message:deleted', (data: { messageId: string; teamId: string }) => {
        console.log('[RealtimeInit] 🗑️  Socket: message:deleted ->', data.messageId)
        useEntityStore.getState().deleteMessage(data.messageId, data.teamId)
      })
      
      // ========================================================================
      // INSIGHT EVENTS
      // ========================================================================
      
      socket.on('ai:insight:new', (insight: AIInsightDTO) => {
        console.log('[RealtimeInit] 🤖 Socket: ai:insight:new ->', insight.id)
        useEntityStore.getState().addInsight(insight)
      })
      
      socket.on('insight:deleted', (data: { id: string; teamId: string }) => {
        console.log('[RealtimeInit] 🗑️  Socket: insight:deleted ->', data.id)
        useEntityStore.getState().deleteInsight(data.id, data.teamId)
      })
      
      // ========================================================================
      // PRESENCE EVENTS
      // ========================================================================
      
      socket.on('presence:update', (data: { userId: string; online: boolean }) => {
        console.log('[RealtimeInit] 👤 Socket: presence:update ->', data.userId, data.online ? 'online' : 'offline')
        const sessionStore = useSessionStore.getState()
        if (data.online) {
          sessionStore.setUserOnline(data.userId)
        } else {
          sessionStore.setUserOffline(data.userId)
        }
      })
      
      // ========================================================================
      // AI TOGGLE EVENTS
      // ========================================================================
      
      socket.on('ai:toggle', (data: { teamId: string; enabled: boolean }) => {
        console.log('[RealtimeInit] 🤖 Socket: ai:toggle ->', data.teamId, data.enabled ? 'enabled' : 'disabled')
        useEntityStore.getState().updateTeam(data.teamId, { isChimeEnabled: data.enabled })
      })
      
      socket.on('presence:list', (data: { users: string[] }) => {
        console.log('[RealtimeInit] 📋 Socket: presence:list ->', data.users.length, 'users', data.users)
        const sessionStore = useSessionStore.getState()
        // Replace entire list instead of appending to avoid stale data
        sessionStore.setOnlineUsersList(data.users)
      })
      
      // ========================================================================
      // TYPING EVENTS
      // ========================================================================
      
      socket.on('typing:start', (data: { teamId: string; userId: string }) => {
        console.log('[RealtimeInit] ⌨️  Socket: typing:start ->', data.userId, 'in', data.teamId)
        useSessionStore.getState().addTypingUser(data.teamId, data.userId)
      })
      
      socket.on('typing:stop', (data: { teamId: string; userId: string }) => {
        console.log('[RealtimeInit] ⌨️  Socket: typing:stop ->', data.userId, 'in', data.teamId)
        useSessionStore.getState().removeTypingUser(data.teamId, data.userId)
      })
      
      // ========================================================================
      // SOCKET CONNECTION EVENTS
      // ========================================================================
      
      socket.on('connect', () => {
        console.log('[RealtimeInit] ✅ Socket connected')
        const sessionStore = useSessionStore.getState()
        sessionStore.setSocketConnected(true)
        sessionStore.resetReconnectAttempts()
      })
      
      socket.on('disconnect', () => {
        console.log('[RealtimeInit] ❌ Socket disconnected')
        useSessionStore.getState().setSocketConnected(false)
      })
      
      socket.on('reconnecting', (attemptNumber: number) => {
        console.log('[RealtimeInit] 🔄 Socket reconnecting, attempt', attemptNumber)
        const sessionStore = useSessionStore.getState()
        sessionStore.setSocketReconnecting(true)
        sessionStore.incrementReconnectAttempts()
      })
      
      console.log('[RealtimeInit] ✅ Socket handlers registered')
      console.log('[RealtimeInit] ✅ Realtime initialization complete!')
      
      isInitialized = true
      initPromise = null // Clear promise after success
      
    } catch (error) {
      console.error('[RealtimeInit] ❌ Initialization failed:', error)
      initPromise = null // Clear promise on error so it can be retried
      isInitialized = false
      throw error
    }
  })()
  
  return initPromise
}

/**
 * Check if realtime is initialized and connected
 */
export function isRealtimeInitialized(): boolean {
  return isInitialized && socketService.getSocket()?.connected === true
}

/**
 * Reset initialization state (for testing or full app reload)
 */
export function resetRealtime(): void {
  console.log('[RealtimeInit] 🔄 Resetting realtime state')
  initPromise = null
  isInitialized = false
}
