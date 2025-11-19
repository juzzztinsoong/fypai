/**
 * SessionStore - User Session and Real-time State
 * 
 * Per Refactoring Guide Section 2.1:
 * - Current user session
 * - Socket connection state
 * - Presence (online users, typing indicators)
 * - API request tracking
 */

import { create } from 'zustand'
import type { UserDTO } from '@fypai/types'

// ============================================================================
// STABLE EMPTY REFERENCES
// ============================================================================

const EMPTY_ARRAY: readonly string[] = Object.freeze([])

// ============================================================================
// STATE TYPES
// ============================================================================

interface SessionState {
  // Current User Session
  currentUser: UserDTO | null
  
  // Socket State (per guide section 2.1 + 2.2)
  socket: {
    isConnected: boolean
    isReconnecting: boolean
    reconnectAttempts: number
    connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
    lastPingTime: number | null
    lastPongTime: number | null
  }
  
  // Offline message queue (Phase 2.2)
  offlineQueue: Array<{
    event: string
    data: any
    timestamp: number
  }>
  
  // Presence (moved from old presenceStore, per guide section 2.1)
  presence: {
    onlineUsers: string[]  // userId array (for HMR compatibility)
    typingUsers: Record<string, string[]>  // teamId -> userId[]
  }
  
  // API Status (per guide section 2.1)
  apiStatus: {
    inFlightRequests: Record<string, any>  // requestId -> metadata
  }
}

interface SessionActions {
  // User session methods
  setCurrentUser: (user: UserDTO | null) => void
  getCurrentUser: () => UserDTO | null
  logout: () => void
  
  // Socket state methods (Phase 2.2 enhanced)
  setSocketConnected: (connected: boolean) => void
  setSocketReconnecting: (reconnecting: boolean) => void
  setConnectionState: (state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed') => void
  incrementReconnectAttempts: () => void
  resetReconnectAttempts: () => void
  updatePingTime: (time: number) => void
  updatePongTime: (time: number) => void
  
  // Offline queue methods (Phase 2.2)
  queueOfflineMessage: (event: string, data: any) => void
  getOfflineQueue: () => Array<{ event: string; data: any; timestamp: number }>
  clearOfflineQueue: () => void
  removeOldQueuedMessages: (maxAgeMs: number) => void
  
  // Presence methods
  setUserOnline: (userId: string) => void
  setUserOffline: (userId: string) => void
  setOnlineUsersList: (users: string[]) => void
  getOnlineUsers: () => string[]
  addTypingUser: (teamId: string, userId: string) => void
  removeTypingUser: (teamId: string, userId: string) => void
  getTypingUsers: (teamId: string) => string[]
  
  // API status methods
  addInFlightRequest: (requestId: string, metadata: any) => void
  removeInFlightRequest: (requestId: string) => void
  getInFlightRequests: () => Record<string, any>
}

type SessionStore = SessionState & SessionActions

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  currentUser: null,
  
  socket: {
    isConnected: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    connectionState: 'disconnected' as const,
    lastPingTime: null,
    lastPongTime: null,
  },
  
  offlineQueue: [],
  
  presence: {
    onlineUsers: [],
    typingUsers: {},
  },
  
  apiStatus: {
    inFlightRequests: {},
  },
  
  // ============================================================================
  // USER SESSION METHODS
  // ============================================================================
  
  setCurrentUser: (user) => set({ currentUser: user }),
  
  getCurrentUser: () => get().currentUser,
  
  logout: () => set({
    currentUser: null,
    socket: {
      isConnected: false,
      isReconnecting: false,
      reconnectAttempts: 0,
      connectionState: 'disconnected' as const,
      lastPingTime: null,
      lastPongTime: null,
    },
    offlineQueue: [],
    presence: {
      onlineUsers: [],
      typingUsers: {},
    },
    apiStatus: {
      inFlightRequests: {},
    },
  }),
  
  // ============================================================================
  // SOCKET STATE METHODS (Phase 2.2 Enhanced)
  // ============================================================================
  
  setSocketConnected: (connected) => set((state) => ({
    socket: {
      ...state.socket,
      isConnected: connected,
      isReconnecting: false,
      connectionState: connected ? 'connected' as const : 'disconnected' as const,
    },
  })),
  
  setSocketReconnecting: (reconnecting) => set((state) => ({
    socket: {
      ...state.socket,
      isReconnecting: reconnecting,
      connectionState: reconnecting ? 'reconnecting' as const : state.socket.connectionState,
    },
  })),
  
  setConnectionState: (connectionState) => set((state) => ({
    socket: {
      ...state.socket,
      connectionState,
    },
  })),
  
  incrementReconnectAttempts: () => set((state) => ({
    socket: {
      ...state.socket,
      reconnectAttempts: state.socket.reconnectAttempts + 1,
    },
  })),
  
  resetReconnectAttempts: () => set((state) => ({
    socket: {
      ...state.socket,
      reconnectAttempts: 0,
    },
  })),
  
  updatePingTime: (time) => set((state) => ({
    socket: {
      ...state.socket,
      lastPingTime: time,
    },
  })),
  
  updatePongTime: (time) => set((state) => ({
    socket: {
      ...state.socket,
      lastPongTime: time,
    },
  })),
  
  // ============================================================================
  // OFFLINE QUEUE METHODS (Phase 2.2)
  // ============================================================================
  
  queueOfflineMessage: (event, data) => set((state) => {
    const MAX_QUEUE_SIZE = 100
    const newQueue = [
      ...state.offlineQueue,
      { event, data, timestamp: Date.now() }
    ].slice(-MAX_QUEUE_SIZE) // Keep last 100 messages
    
    return { offlineQueue: newQueue }
  }),
  
  getOfflineQueue: () => get().offlineQueue,
  
  clearOfflineQueue: () => set({ offlineQueue: [] }),
  
  removeOldQueuedMessages: (maxAgeMs) => set((state) => {
    const now = Date.now()
    return {
      offlineQueue: state.offlineQueue.filter(
        msg => now - msg.timestamp < maxAgeMs
      )
    }
  }),
  
  // ============================================================================
  // PRESENCE METHODS
  // ============================================================================
  
  setUserOnline: (userId) => set((state) => {
    const onlineUsers = state.presence.onlineUsers
    if (onlineUsers.includes(userId)) return state
    
    return {
      presence: {
        ...state.presence,
        onlineUsers: [...onlineUsers, userId],
      },
    }
  }),
  
  setUserOffline: (userId) => set((state) => ({
    presence: {
      ...state.presence,
      onlineUsers: state.presence.onlineUsers.filter(id => id !== userId),
    },
  })),
  
  setOnlineUsersList: (users) => set((state) => ({
    presence: {
      ...state.presence,
      onlineUsers: users,
    },
  })),
  
  getOnlineUsers: () => get().presence.onlineUsers,
  
  addTypingUser: (teamId, userId) => set((state) => {
    const currentTyping = state.presence.typingUsers[teamId] || []
    
    // Don't add duplicate
    if (currentTyping.includes(userId)) {
      return state
    }
    
    return {
      presence: {
        ...state.presence,
        typingUsers: {
          ...state.presence.typingUsers,
          [teamId]: [...currentTyping, userId],
        },
      },
    }
  }),
  
  removeTypingUser: (teamId, userId) => set((state) => {
    const currentTyping = state.presence.typingUsers[teamId] || []
    const newTyping = currentTyping.filter(id => id !== userId)
    
    return {
      presence: {
        ...state.presence,
        typingUsers: {
          ...state.presence.typingUsers,
          [teamId]: newTyping,
        },
      },
    }
  }),
  
  getTypingUsers: (teamId) => {
    const typingUsers = get().presence.typingUsers[teamId]
    return typingUsers || EMPTY_ARRAY
  },
  
  // ============================================================================
  // API STATUS METHODS
  // ============================================================================
  
  addInFlightRequest: (requestId, metadata) => set((state) => ({
    apiStatus: {
      ...state.apiStatus,
      inFlightRequests: {
        ...state.apiStatus.inFlightRequests,
        [requestId]: metadata,
      },
    },
  })),
  
  removeInFlightRequest: (requestId) => set((state) => {
    const { [requestId]: _, ...rest } = state.apiStatus.inFlightRequests
    
    return {
      apiStatus: {
        ...state.apiStatus,
        inFlightRequests: rest,
      },
    }
  }),
  
  getInFlightRequests: () => get().apiStatus.inFlightRequests,
}))
