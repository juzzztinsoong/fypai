/**
 * Event Bus → RealtimeStore Bridge
 * 
 * Connects Event Bus events to RealtimeStore updates.
 * This is the glue layer that makes the Event Bus architecture work.
 * 
 * Call `initializeEventBridge()` once during app initialization.
 */

import { eventBus } from './EventBus'
import { useRealtimeStore } from './RealtimeStore'

/**
 * Initialize Event Bus → RealtimeStore bridge
 * 
 * Subscribes to all domain events and updates RealtimeStore accordingly.
 * This is the central coordinator that makes everything work together.
 * 
 * @returns Cleanup function to unsubscribe all listeners
 */
export function initializeEventBridge(): () => void {
  const store = useRealtimeStore.getState()
  const unsubscribers: Array<() => void> = []

  // === Message Events ===

  unsubscribers.push(
    eventBus.subscribe('messages:fetched', (event) => {
      if (event.type === 'messages:fetched') {
        store.setMessages(event.teamId, event.messages)
      }
    })
  )

  unsubscribers.push(
    eventBus.subscribe('message:created', (event) => {
      if (event.type === 'message:created') {
        store.addMessage(event.message.teamId, event.message)
      }
    })
  )

  unsubscribers.push(
    eventBus.subscribe('message:updated', (event) => {
      if (event.type === 'message:updated') {
        store.updateMessage(event.message.teamId, event.message.id, event.message)
      }
    })
  )

  unsubscribers.push(
    eventBus.subscribe('message:deleted', (event) => {
      if (event.type === 'message:deleted') {
        store.deleteMessage(event.teamId, event.messageId)
      }
    })
  )

  // === Insight Events ===

  unsubscribers.push(
    eventBus.subscribe('insights:fetched', (event) => {
      if (event.type === 'insights:fetched') {
        store.setInsights(event.teamId, event.insights)
      }
    })
  )

  unsubscribers.push(
    eventBus.subscribe('insight:created', (event) => {
      if (event.type === 'insight:created') {
        store.addInsight(event.insight.teamId, event.insight)
      }
    })
  )

  unsubscribers.push(
    eventBus.subscribe('insight:updated', (event) => {
      if (event.type === 'insight:updated') {
        store.updateInsight(event.insight.teamId, event.insight.id, event.insight)
      }
    })
  )

  unsubscribers.push(
    eventBus.subscribe('insight:deleted', (event) => {
      if (event.type === 'insight:deleted') {
        store.deleteInsight(event.teamId, event.insightId)
      }
    })
  )

  // === Presence Events ===

  unsubscribers.push(
    eventBus.subscribe('presence:online', (event) => {
      if (event.type === 'presence:online') {
        store.setUserOnline(event.userId)
      }
    })
  )

  unsubscribers.push(
    eventBus.subscribe('presence:offline', (event) => {
      if (event.type === 'presence:offline') {
        store.setUserOffline(event.userId)
      }
    })
  )

  unsubscribers.push(
    eventBus.subscribe('presence:list', (event) => {
      if (event.type === 'presence:list') {
        store.setMultipleUsersOnline(event.users)
      }
    })
  )

  unsubscribers.push(
    eventBus.subscribe('presence:typing', (event) => {
      if (event.type === 'presence:typing') {
        store.setUserTyping(event.teamId, event.userId, event.isTyping)
      }
    })
  )

  // Return cleanup function that unsubscribes all listeners
  return () => {
    unsubscribers.forEach((unsub) => unsub())
  }
}
