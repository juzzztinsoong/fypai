/**
 * EntityStore - Normalized Domain Data Storage
 * 
 * Per Refactoring Guide Section 1.2:
 * - Normalized storage: entities by ID, relationships as ID arrays
 * - Stable empty references (EMPTY_USER, EMPTY_ARRAY) prevent re-renders
 * - Optimistic updates with correlationId pattern
 * - O(1) lookups, efficient updates
 */

import { create } from 'zustand'
import type { UserDTO, TeamWithMembersDTO, MessageDTO, AIInsightDTO } from '@fypai/types'

// ============================================================================
// STABLE EMPTY REFERENCES
// ============================================================================

const EMPTY_USER: UserDTO = Object.freeze({
  id: '',
  name: 'Unknown User',
  email: null,
  avatar: null,
  role: 'member' as const,
  createdAt: new Date().toISOString()
})

const EMPTY_TEAM: TeamWithMembersDTO = Object.freeze({
  id: '',
  name: 'Unknown Team',
  isChimeEnabled: true,
  createdAt: new Date().toISOString(),
  members: [],
})

const EMPTY_ARRAY: readonly any[] = Object.freeze([])

// ============================================================================
// STATE TYPES
// ============================================================================

interface EntityState {
  // Normalized entities (by ID)
  entities: {
    users: Record<string, UserDTO>
    teams: Record<string, TeamWithMembersDTO>
    messages: Record<string, MessageDTO>
    insights: Record<string, AIInsightDTO>
  }
  
  // Relationships (arrays of IDs)
  relationships: {
    teamMessages: Record<string, string[]>      // teamId -> messageId[]
    teamInsights: Record<string, string[]>      // teamId -> insightId[]
    teamMembers: Record<string, string[]>       // teamId -> userId[]
    userTeams: Record<string, string[]>         // userId -> teamId[]
  }
  
  // Optimistic updates tracking
  optimistic: {
    messages: Map<string, { tempId: string; correlationId: string }>
  }
}

interface EntityActions {
  // User methods
  addUser: (user: UserDTO) => void
  updateUser: (userId: string, updates: Partial<UserDTO>) => void
  getUser: (userId: string) => UserDTO
  getUsers: (userIds: string[]) => UserDTO[]
  
  // Team methods
  addTeam: (team: TeamWithMembersDTO) => void
  updateTeam: (teamId: string, updates: Partial<TeamWithMembersDTO>) => void
  getTeam: (teamId: string) => TeamWithMembersDTO
  
  // Message methods
  addMessage: (message: MessageDTO) => void
  updateMessage: (messageId: string, updates: Partial<MessageDTO>) => void
  deleteMessage: (messageId: string, teamId: string) => void
  getMessage: (messageId: string) => MessageDTO | null
  getTeamMessages: (teamId: string) => readonly string[]
  getTeamMessagesWithData: (teamId: string) => MessageDTO[]
  
  // Insight methods
  addInsight: (insight: AIInsightDTO) => void
  updateInsight: (insightId: string, updates: Partial<AIInsightDTO>) => void
  deleteInsight: (insightId: string, teamId: string) => void
  getTeamInsights: (teamId: string) => readonly string[]
  getTeamInsightsWithData: (teamId: string) => AIInsightDTO[]
  
  // Optimistic update methods
  addOptimisticMessage: (tempMessage: MessageDTO, correlationId: string) => void
  confirmMessage: (correlationId: string, serverMessage: MessageDTO) => void
  removeOptimisticMessage: (tempId: string) => void
}

type EntityStore = EntityState & EntityActions

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useEntityStore = create<EntityStore>((set, get) => ({
  // Initial state
  entities: {
    users: {},
    teams: {},
    messages: {},
    insights: {},
  },
  
  relationships: {
    teamMessages: {},
    teamInsights: {},
    teamMembers: {},
    userTeams: {},
  },
  
  optimistic: {
    messages: new Map(),
  },
  
  // ============================================================================
  // USER METHODS
  // ============================================================================
  
  addUser: (user) => set((state) => ({
    entities: {
      ...state.entities,
      users: {
        ...state.entities.users,
        [user.id]: user,
      },
    },
  })),
  
  updateUser: (userId, updates) => set((state) => {
    const existingUser = state.entities.users[userId]
    if (!existingUser) return state
    
    return {
      entities: {
        ...state.entities,
        users: {
          ...state.entities.users,
          [userId]: { ...existingUser, ...updates },
        },
      },
    }
  }),
  
  getUser: (userId) => {
    const user = get().entities.users[userId]
    return user || EMPTY_USER
  },
  
  getUsers: (userIds) => {
    const { users } = get().entities
    return userIds.map(id => users[id] || EMPTY_USER)
  },
  
  // ============================================================================
  // TEAM METHODS
  // ============================================================================
  
  addTeam: (team) => set((state) => ({
    entities: {
      ...state.entities,
      teams: {
        ...state.entities.teams,
        [team.id]: team,
      },
    },
  })),
  
  updateTeam: (teamId, updates) => set((state) => {
    const existingTeam = state.entities.teams[teamId]
    if (!existingTeam) return state
    
    return {
      entities: {
        ...state.entities,
        teams: {
          ...state.entities.teams,
          [teamId]: { ...existingTeam, ...updates },
        },
      },
    }
  }),
  
  getTeam: (teamId) => {
    const team = get().entities.teams[teamId]
    return team || EMPTY_TEAM
  },
  
  // ============================================================================
  // MESSAGE METHODS
  // ============================================================================
  
  addMessage: (message) => set((state) => {
    // Skip if message already exists (deduplication)
    if (state.entities.messages[message.id]) {
      return state
    }
    
    // Check if already in relationships (happens when socket broadcasts after confirmMessage)
    const teamMessageIds = state.relationships.teamMessages[message.teamId] || []
    if (teamMessageIds.includes(message.id)) {
      return state
    }
    
    // Check if this is a server response for an optimistic message
    // If so, find and remove the temp message
    let finalMessages = state.entities.messages
    let finalTeamMessages = teamMessageIds
    
    for (const [correlationId, optimisticData] of state.optimistic.messages.entries()) {
      const tempMessage = state.entities.messages[optimisticData.tempId]
      if (tempMessage && tempMessage.teamId === message.teamId) {
        // Check if content matches (server message confirms this optimistic update)
        if (tempMessage.content === message.content) {
          // Remove temp message from entities
          const { [optimisticData.tempId]: removed, ...remaining } = finalMessages
          finalMessages = remaining
          
          // Replace temp ID with server ID in relationships
          finalTeamMessages = teamMessageIds.map(id => 
            id === optimisticData.tempId ? message.id : id
          )
          
          // Remove from optimistic tracking
          const newOptimistic = new Map(state.optimistic.messages)
          newOptimistic.delete(correlationId)
          
          // Add server message and update state
          return {
            entities: {
              ...state.entities,
              messages: {
                ...finalMessages,
                [message.id]: message,
              },
            },
            relationships: {
              ...state.relationships,
              teamMessages: {
                ...state.relationships.teamMessages,
                [message.teamId]: finalTeamMessages,
              },
            },
            optimistic: {
              ...state.optimistic,
              messages: newOptimistic,
            },
          }
        }
      }
    }
    
    // Normal add (no optimistic match)
    const newMessages = {
      ...finalMessages,
      [message.id]: message,
    }
    
    const newTeamMessages = {
      ...state.relationships.teamMessages,
      [message.teamId]: [...finalTeamMessages, message.id],
    }
    
    return {
      entities: {
        ...state.entities,
        messages: newMessages,
      },
      relationships: {
        ...state.relationships,
        teamMessages: newTeamMessages,
      },
    }
  }),
  
  updateMessage: (messageId, updates) => set((state) => {
    const existingMessage = state.entities.messages[messageId]
    if (!existingMessage) return state
    
    return {
      entities: {
        ...state.entities,
        messages: {
          ...state.entities.messages,
          [messageId]: { ...existingMessage, ...updates },
        },
      },
    }
  }),
  
  deleteMessage: (messageId, teamId) => set((state) => {
    // Remove from entities
    const { [messageId]: removed, ...remainingMessages } = state.entities.messages
    
    // Remove from relationships
    const teamMessageIds = state.relationships.teamMessages[teamId] || []
    const newTeamMessages = {
      ...state.relationships.teamMessages,
      [teamId]: teamMessageIds.filter(id => id !== messageId),
    }
    
    return {
      entities: {
        ...state.entities,
        messages: remainingMessages,
      },
      relationships: {
        ...state.relationships,
        teamMessages: newTeamMessages,
      },
    }
  }),
  
  getMessage: (messageId) => {
    return get().entities.messages[messageId] || null
  },
  
  getTeamMessages: (teamId) => {
    const messageIds = get().relationships.teamMessages[teamId]
    return messageIds || EMPTY_ARRAY
  },
  
  getTeamMessagesWithData: (teamId) => {
    const state = get()
    const messageIds = state.relationships.teamMessages[teamId] || []
    const { messages, users } = state.entities
    
    return messageIds
      .map(id => messages[id])
      .filter(Boolean)
      .map(message => ({
        ...message,
        author: users[message.authorId] || EMPTY_USER,
      }))
  },
  
  // ============================================================================
  // INSIGHT METHODS
  // ============================================================================
  
  addInsight: (insight) => set((state) => {
    // Add to entities (will update if exists)
    const newInsights = {
      ...state.entities.insights,
      [insight.id]: insight,
    }
    
    // Add to relationships (only if not already present)
    const teamInsightIds = state.relationships.teamInsights[insight.teamId] || []
    const insightExists = teamInsightIds.includes(insight.id)
    const newTeamInsights = {
      ...state.relationships.teamInsights,
      [insight.teamId]: insightExists 
        ? teamInsightIds 
        : [...teamInsightIds, insight.id],
    }
    
    return {
      entities: {
        ...state.entities,
        insights: newInsights,
      },
      relationships: {
        ...state.relationships,
        teamInsights: newTeamInsights,
      },
    }
  }),
  
  updateInsight: (insightId, updates) => set((state) => {
    const existingInsight = state.entities.insights[insightId]
    if (!existingInsight) return state
    
    return {
      entities: {
        ...state.entities,
        insights: {
          ...state.entities.insights,
          [insightId]: { ...existingInsight, ...updates },
        },
      },
    }
  }),
  
  deleteInsight: (insightId, teamId) => set((state) => {
    // Remove from entities
    const { [insightId]: removed, ...remainingInsights } = state.entities.insights
    
    // Remove from relationships
    const teamInsightIds = state.relationships.teamInsights[teamId] || []
    const newTeamInsights = {
      ...state.relationships.teamInsights,
      [teamId]: teamInsightIds.filter(id => id !== insightId),
    }
    
    return {
      entities: {
        ...state.entities,
        insights: remainingInsights,
      },
      relationships: {
        ...state.relationships,
        teamInsights: newTeamInsights,
      },
    }
  }),
  
  getTeamInsights: (teamId) => {
    const insightIds = get().relationships.teamInsights[teamId]
    return insightIds || EMPTY_ARRAY
  },
  
  getTeamInsightsWithData: (teamId) => {
    const state = get()
    const insightIds = state.relationships.teamInsights[teamId] || []
    const { insights } = state.entities
    
    return insightIds
      .map(id => insights[id])
      .filter(Boolean)
  },
  
  // ============================================================================
  // OPTIMISTIC UPDATE METHODS
  // ============================================================================
  
  addOptimisticMessage: (tempMessage, correlationId) => {
    const { addMessage } = get()
    
    // Add message to store
    addMessage(tempMessage)
    
    // Track correlation
    set((state) => ({
      optimistic: {
        ...state.optimistic,
        messages: new Map(state.optimistic.messages).set(correlationId, {
          tempId: tempMessage.id,
          correlationId,
        }),
      },
    }))
  },
  
  confirmMessage: (correlationId, serverMessage) => {
    const state = get()
    const optimisticData = state.optimistic.messages.get(correlationId)
    
    if (!optimisticData) {
      // No optimistic message found, just add the server message
      get().addMessage(serverMessage)
      return
    }
    
    const { tempId } = optimisticData
    const tempMessage = state.entities.messages[tempId]
    
    if (!tempMessage) {
      // Temp message not found, just add server message
      get().addMessage(serverMessage)
      return
    }
    
    // Replace temp message with server message
    set((prevState) => {
      // Remove temp message from entities
      const { [tempId]: removed, ...remainingMessages } = prevState.entities.messages
      
      // Add server message
      const newMessages = {
        ...remainingMessages,
        [serverMessage.id]: serverMessage,
      }
      
      // Update relationship (replace tempId with serverId)
      const teamId = tempMessage.teamId
      const teamMessageIds = prevState.relationships.teamMessages[teamId] || []
      const newTeamMessages = {
        ...prevState.relationships.teamMessages,
        [teamId]: teamMessageIds.map(id => id === tempId ? serverMessage.id : id),
      }
      
      // Remove from optimistic tracking
      const newOptimisticMessages = new Map(prevState.optimistic.messages)
      newOptimisticMessages.delete(correlationId)
      
      return {
        entities: {
          ...prevState.entities,
          messages: newMessages,
        },
        relationships: {
          ...prevState.relationships,
          teamMessages: newTeamMessages,
        },
        optimistic: {
          ...prevState.optimistic,
          messages: newOptimisticMessages,
        },
      }
    })
  },
  
  removeOptimisticMessage: (tempId) => {
    const state = get()
    const tempMessage = state.entities.messages[tempId]
    
    if (!tempMessage) return
    
    const teamId = tempMessage.teamId
    
    set((prevState) => {
      // Remove from entities
      const { [tempId]: removed, ...remainingMessages } = prevState.entities.messages
      
      // Remove from relationships
      const teamMessageIds = prevState.relationships.teamMessages[teamId] || []
      const newTeamMessages = {
        ...prevState.relationships.teamMessages,
        [teamId]: teamMessageIds.filter(id => id !== tempId),
      }
      
      // Remove from optimistic tracking (find by tempId)
      const newOptimisticMessages = new Map(prevState.optimistic.messages)
      for (const [correlationId, data] of newOptimisticMessages.entries()) {
        if (data.tempId === tempId) {
          newOptimisticMessages.delete(correlationId)
          break
        }
      }
      
      return {
        entities: {
          ...prevState.entities,
          messages: remainingMessages,
        },
        relationships: {
          ...prevState.relationships,
          teamMessages: newTeamMessages,
        },
        optimistic: {
          ...prevState.optimistic,
          messages: newOptimisticMessages,
        },
      }
    })
  },
}))
