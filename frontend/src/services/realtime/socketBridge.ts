/**
 * Socket Bridge
 * 
 * Bridges raw Socket.IO events to the Event Bus domain events.
 * This is the critical layer that connects real-time transport to the Event Bus.
 * 
 * Architecture:
 * - Socket.IO emits raw events (message:new, ai:insight:new, etc.)
 * - Socket Bridge transforms them into domain events
 * - Publishes to Event Bus
 * - Event Bridge updates RealtimeStore
 * 
 * Result: Socket events and REST events flow through the same channel!
 */

import type { Socket } from 'socket.io-client'
import { eventBus, EventTransformer } from '@/core/eventBus'
import { useRealtimeStore } from '@/core/eventBus/RealtimeStore'
import type { MessageDTO, AIInsightDTO } from '@fypai/types'

/**
 * Socket event payloads (from backend)
 */
interface PresenceUpdatePayload {
  userId: string
  online: boolean
}

interface TypingPayload {
  teamId: string
  userId: string
  isTyping: boolean
}

interface PresenceListPayload {
  users: string[]
}

/**
 * Initialize socket bridge
 * 
 * Sets up listeners on socket that transform and publish to Event Bus.
 * This is called once during app initialization after socket connects.
 * 
 * @param socket - Connected Socket.IO client instance
 * @returns Cleanup function to remove all listeners
 */
export function initializeSocketBridge(socket: Socket): () => void {
  console.log('[SocketBridge] 🌉 Initializing socket → Event Bus bridge')

  // === Message Events ===

  const handleMessageNew = (message: MessageDTO) => {
    console.log('[SocketBridge] 📨 Socket: message:new ->', message.id)
    
    // Transform to domain event and publish to Event Bus
    // Note: Socket events don't have requestId, so each gets unique eventId
    const event = EventTransformer.messageCreated(message, 'socket')
    eventBus.publish(event)
  }

  const handleMessageEdited = (message: MessageDTO) => {
    console.log('[SocketBridge] ✏️  Socket: message:edited ->', message.id)
    
    const event = EventTransformer.messageUpdated(message, 'socket')
    eventBus.publish(event)
  }

  const handleMessageDeleted = (data: { messageId: string; teamId?: string }) => {
    console.log('[SocketBridge] 🗑️  Socket: message:deleted ->', data.messageId)
    
    // If teamId not provided, we'll need to find it (shouldn't happen in practice)
    const teamId = data.teamId || 'unknown'
    const event = EventTransformer.messageDeleted(data.messageId, teamId, 'socket')
    eventBus.publish(event)
  }

  // === Insight Events ===

  const handleInsightNew = (insight: AIInsightDTO) => {
    console.log('[SocketBridge] 🤖 Socket: ai:insight:new ->', insight.id)
    
    const event = EventTransformer.insightCreated(insight, 'socket')
    eventBus.publish(event)
  }

  const handleInsightDeleted = (data: { id: string; teamId?: string }) => {
    console.log('[SocketBridge] 🗑️  Socket: insight:deleted ->', data.id)
    
    const teamId = data.teamId || 'unknown'
    const event = EventTransformer.insightDeleted(data.id, teamId, 'socket')
    eventBus.publish(event)
  }

  // === Presence Events ===

  const handlePresenceUpdate = (data: PresenceUpdatePayload) => {
    console.log('[SocketBridge] 👤 Socket: presence:update ->', data.userId, data.online ? 'online' : 'offline')
    
    if (data.online) {
      const event = EventTransformer.presenceOnline(data.userId, 'socket')
      eventBus.publish(event)
    } else {
      const event = EventTransformer.presenceOffline(data.userId, 'socket')
      eventBus.publish(event)
    }
  }

  const handlePresenceList = (data: PresenceListPayload) => {
    console.log('[SocketBridge] 📋 Socket: presence:list ->', data.users.length, 'users')
    
    const event = EventTransformer.presenceList(data.users, 'socket')
    eventBus.publish(event)
  }

  const handleTypingStart = (data: TypingPayload) => {
    console.log('[SocketBridge] ⌨️  Socket: typing:start ->', data.userId, 'in', data.teamId)
    
    const event = EventTransformer.presenceTyping(data.teamId, data.userId, true, 'socket')
    eventBus.publish(event)
  }

  const handleTypingStop = (data: TypingPayload) => {
    console.log('[SocketBridge] ⌨️  Socket: typing:stop ->', data.userId, 'in', data.teamId)
    
    const event = EventTransformer.presenceTyping(data.teamId, data.userId, false, 'socket')
    eventBus.publish(event)
  }

  const handleAIToggle = (data: { teamId: string; enabled: boolean }) => {
    console.log('[SocketBridge] 🤖 Socket: ai:toggle ->', data.teamId, 'enabled:', data.enabled)
    
    // Update RealtimeStore directly (no need for Event Bus for settings)
    useRealtimeStore.getState().setAIEnabled(data.teamId, data.enabled)
  }

  // Register all socket listeners
  socket.on('message:new', handleMessageNew)
  socket.on('message:edited', handleMessageEdited)
  socket.on('message:deleted', handleMessageDeleted)
  socket.on('ai:insight:new', handleInsightNew)
  socket.on('insight:deleted', handleInsightDeleted)
  socket.on('presence:update', handlePresenceUpdate)
  socket.on('presence:list', handlePresenceList)
  socket.on('typing:start', handleTypingStart)
  socket.on('typing:stop', handleTypingStop)
  socket.on('ai:toggle', handleAIToggle)

  console.log('[SocketBridge] ✅ Socket bridge initialized (10 event handlers)')

  // Return cleanup function
  return () => {
    console.log('[SocketBridge] 🧹 Cleaning up socket bridge')
    
    socket.off('message:new', handleMessageNew)
    socket.off('message:edited', handleMessageEdited)
    socket.off('message:deleted', handleMessageDeleted)
    socket.off('ai:insight:new', handleInsightNew)
    socket.off('insight:deleted', handleInsightDeleted)
    socket.off('presence:update', handlePresenceUpdate)
    socket.off('presence:list', handlePresenceList)
    socket.off('typing:start', handleTypingStart)
    socket.off('typing:stop', handleTypingStop)
    socket.off('ai:toggle', handleAIToggle)
  }
}

/**
 * Get socket bridge status
 */
export function getSocketBridgeStatus(socket: Socket | null): {
  isActive: boolean
  connected: boolean
} {
  if (!socket) {
    return { isActive: false, connected: false }
  }

  return {
    isActive: socket.connected,
    connected: socket.connected,
  }
}
