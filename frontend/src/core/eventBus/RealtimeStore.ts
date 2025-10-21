/**
 * Realtime Store (Zustand)
 * 
 * SINGLE SOURCE OF TRUTH for all real-time data.
 * 
 * Architecture:
 * - Event Bus publishes events → RealtimeStore updates
 * - UI components read from RealtimeStore (reactive)
 * - Services write to Event Bus (not directly to store)
 * 
 * This replaces:
 * - chatStore (messages)
 * - aiInsightsStore (insights)
 * - presenceStore (online users, typing)
 * 
 * Benefits:
 * - No duplicate state across multiple stores
 * - Consistent data model
 * - Easy to subscribe to changes
 * - Automatic deduplication via Event Bus
 */

import { create } from 'zustand'
import type { MessageDTO, AIInsightDTO } from '@fypai/types'

// Stable empty arrays to prevent re-renders (frozen to avoid accidental mutation)
// Cast through unknown to satisfy TypeScript: frozen readonly array -> typed empty array
const EMPTY_ARRAY = Object.freeze([]) as unknown as MessageDTO[]
const EMPTY_INSIGHTS_ARRAY = Object.freeze([]) as unknown as AIInsightDTO[]

interface PresenceState {
  onlineUsers: Set<string>
  typingUsers: Map<string, Set<string>> // teamId -> Set<userId>
}

interface TeamSettingsState {
  aiEnabled: Map<string, boolean> // teamId -> boolean
}

interface RealtimeState {
  // Messages organized by team
  messages: Record<string, MessageDTO[]>

  // AI Insights organized by team
  insights: Record<string, AIInsightDTO[]>

  // Presence state
  presence: PresenceState

  // Team settings
  settings: TeamSettingsState

  // Message Operations
  setMessages: (teamId: string, messages: MessageDTO[]) => void
  addMessage: (teamId: string, message: MessageDTO) => void
  updateMessage: (teamId: string, messageId: string, updates: Partial<MessageDTO>) => void
  deleteMessage: (teamId: string, messageId: string) => void
  getMessages: (teamId: string) => MessageDTO[]

  // Insight Operations
  setInsights: (teamId: string, insights: AIInsightDTO[]) => void
  addInsight: (teamId: string, insight: AIInsightDTO) => void
  updateInsight: (teamId: string, insightId: string, updates: Partial<AIInsightDTO>) => void
  deleteInsight: (teamId: string, insightId: string) => void
  getInsights: (teamId: string) => AIInsightDTO[]

  // Presence Operations
  setUserOnline: (userId: string) => void
  setUserOffline: (userId: string) => void
  setMultipleUsersOnline: (userIds: string[]) => void
  isUserOnline: (userId: string) => boolean
  getOnlineUsers: () => string[]
  setUserTyping: (teamId: string, userId: string, isTyping: boolean) => void
  getTypingUsers: (teamId: string) => string[]

  // Team Settings Operations
  setAIEnabled: (teamId: string, enabled: boolean) => void
  isAIEnabled: (teamId: string) => boolean

  // Utility
  clear: () => void
}

export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
  // Initial state
  messages: {},
  insights: {},
  presence: {
    onlineUsers: new Set(['agent']), // Agent is always online
    typingUsers: new Map(),
  },
  settings: {
    aiEnabled: new Map(), // teamId -> boolean, default true if not set
  },

  // === Message Operations ===

  setMessages: (teamId, messages) =>
    set((state) => {
      console.log('[RealtimeStore] setMessages', { teamId, count: messages.length })
      return {
        messages: {
          ...state.messages,
          [teamId]: messages,
        },
      }
    }),

  addMessage: (teamId, message) =>
    set((state) => {
      const existingMessages = state.messages[teamId] || []

      // Check for duplicate
      const isDuplicate = existingMessages.some((m) => m.id === message.id)
      if (isDuplicate) {
        console.log('[RealtimeStore] addMessage - duplicate ignored', { teamId, messageId: message.id })
        return state // No change
      }

      console.log('[RealtimeStore] addMessage', { teamId, messageId: message.id })
      return {
        messages: {
          ...state.messages,
          [teamId]: [...existingMessages, message],
        },
      }
    }),

  updateMessage: (teamId, messageId, updates) =>
    set((state) => {
      const messages = state.messages[teamId] || []
      const updatedMessages = messages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )

      console.log('[RealtimeStore] updateMessage', { teamId, messageId })
      return {
        messages: {
          ...state.messages,
          [teamId]: updatedMessages,
        },
      }
    }),

  deleteMessage: (teamId, messageId) =>
    set((state) => {
      const messages = state.messages[teamId] || []
      const filteredMessages = messages.filter((msg) => msg.id !== messageId)

      console.log('[RealtimeStore] deleteMessage', { teamId, messageId })
      return {
        messages: {
          ...state.messages,
          [teamId]: filteredMessages,
        },
      }
    }),

  getMessages: (teamId) => {
    const msgs = get().messages[teamId]
    // Return stable empty array when undefined to avoid creating new [] each selector run
    return msgs ? msgs : EMPTY_ARRAY
  },

  // === Insight Operations ===

  setInsights: (teamId, insights) =>
    set((state) => ({
      insights: {
        ...state.insights,
        [teamId]: insights,
      },
    })),

  addInsight: (teamId, insight) =>
    set((state) => {
      const existingInsights = state.insights[teamId] || []

      // Check for duplicate
      const isDuplicate = existingInsights.some((i) => i.id === insight.id)
      if (isDuplicate) {
        return state // No change
      }

      return {
        insights: {
          ...state.insights,
          [teamId]: [...existingInsights, insight],
        },
      }
    }),

  updateInsight: (teamId, insightId, updates) =>
    set((state) => {
      const insights = state.insights[teamId] || []
      const updatedInsights = insights.map((insight) =>
        insight.id === insightId ? { ...insight, ...updates } : insight
      )

      return {
        insights: {
          ...state.insights,
          [teamId]: updatedInsights,
        },
      }
    }),

  deleteInsight: (teamId, insightId) =>
    set((state) => {
      const insights = state.insights[teamId] || []
      const filteredInsights = insights.filter((insight) => insight.id !== insightId)

      return {
        insights: {
          ...state.insights,
          [teamId]: filteredInsights,
        },
      }
    }),

  getInsights: (teamId) => {
    return get().insights[teamId] || EMPTY_INSIGHTS_ARRAY
  },

  // === Presence Operations ===

  setUserOnline: (userId) =>
    set((state) => ({
      presence: {
        ...state.presence,
        onlineUsers: new Set([...state.presence.onlineUsers, userId]),
      },
    })),

  setUserOffline: (userId) =>
    set((state) => {
      const newOnlineUsers = new Set(state.presence.onlineUsers)
      newOnlineUsers.delete(userId)

      return {
        presence: {
          ...state.presence,
          onlineUsers: newOnlineUsers,
        },
      }
    }),

  setMultipleUsersOnline: (userIds) =>
    set((state) => ({
      presence: {
        ...state.presence,
        onlineUsers: new Set([...state.presence.onlineUsers, ...userIds]),
      },
    })),

  isUserOnline: (userId) => {
    return get().presence.onlineUsers.has(userId)
  },

  getOnlineUsers: () => {
    return Array.from(get().presence.onlineUsers)
  },

  setUserTyping: (teamId, userId, isTyping) =>
    set((state) => {
      const typingUsers = new Map(state.presence.typingUsers)
      const teamTyping = typingUsers.get(teamId) || new Set()

      if (isTyping) {
        console.log('[RealtimeStore] ⌨️  User started typing', { teamId, userId })
        teamTyping.add(userId)
      } else {
        console.log('[RealtimeStore] ⌨️  User stopped typing', { teamId, userId })
        teamTyping.delete(userId)
      }

      if (teamTyping.size === 0) {
        typingUsers.delete(teamId)
      } else {
        typingUsers.set(teamId, teamTyping)
      }

      console.log('[RealtimeStore] 📊 Current typing users in team', teamId, ':', Array.from(teamTyping))

      return {
        presence: {
          ...state.presence,
          typingUsers,
        },
      }
    }),

  getTypingUsers: (teamId) => {
    const teamTyping = get().presence.typingUsers.get(teamId)
    return teamTyping ? Array.from(teamTyping) : []
  },

  // === Team Settings ===

  setAIEnabled: (teamId, enabled) =>
    set((state) => {
      const aiEnabled = new Map(state.settings.aiEnabled)
      aiEnabled.set(teamId, enabled)
      console.log('[RealtimeStore] 🤖 AI toggle for team', teamId, ':', enabled ? 'enabled' : 'disabled')
      
      return {
        settings: {
          ...state.settings,
          aiEnabled,
        },
      }
    }),

  isAIEnabled: (teamId) => {
    const enabled = get().settings.aiEnabled.get(teamId)
    return enabled ?? false // Default to disabled until loaded from server
  },

  // === Utility ===

  clear: () =>
    set({
      messages: {},
      insights: {},
      presence: {
        onlineUsers: new Set(['agent']),
        typingUsers: new Map(),
      },
      settings: {
        aiEnabled: new Map(),
      },
    }),
}))
