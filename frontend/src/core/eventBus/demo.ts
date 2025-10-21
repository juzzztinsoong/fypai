/**
 * Event Bus Integration Example
 * 
 * This file demonstrates how the Event Bus will be used in the refactored architecture.
 * 
 * Run this in browser console or as a test to verify Event Bus functionality.
 */

import { eventBus, EventTransformer, useRealtimeStore } from '@/core/eventBus'
import type { MessageDTO } from '@fypai/types'

/**
 * Example: How messageService will use Event Bus
 */
export function demonstrateEventBusUsage() {
  console.log('=== Event Bus Demo ===\n')

  // 1. Subscribe to events (what stores will do)
  const unsubscribe = eventBus.subscribe('message:created', (event) => {
    if (event.type === 'message:created') {
      console.log('📨 Store received message:', event.message.content)

      // Update RealtimeStore
      const store = useRealtimeStore.getState()
      store.addMessage(event.message.teamId, event.message)
    }
  })

  // 2. Simulate REST API response (what messageService will do)
  const mockMessage: MessageDTO = {
    id: 'msg-123',
    teamId: 'team1',
    authorId: 'user1',
    content: 'Hello from REST API',
    contentType: 'text',
    createdAt: new Date().toISOString(),
  }

  const restEvent = EventTransformer.messageCreated(mockMessage, 'rest', 'req-456')
  console.log('🌐 Publishing REST event...')
  eventBus.publish(restEvent)

  // 3. Simulate socket event arriving (same message)
  setTimeout(() => {
    console.log('\n⚡ Socket event arrives (duplicate)...')
    const socketEvent = EventTransformer.messageCreated(mockMessage, 'socket', 'req-456')
    eventBus.publish(socketEvent) // Should be deduplicated!
  }, 100)

  // 4. Check RealtimeStore
  setTimeout(() => {
    const store = useRealtimeStore.getState()
    const messages = store.getMessages('team1')
    console.log('\n📊 Messages in RealtimeStore:', messages.length)
    console.log('✅ Expected: 1 (deduplication worked!)')
    console.log('\n📈 Event Bus Stats:', eventBus.getStats())

    unsubscribe()
    console.log('\n=== Demo Complete ===')
  }, 200)
}

/**
 * Example: Wildcard subscriptions
 */
export function demonstrateWildcardSubscriptions() {
  console.log('=== Wildcard Subscription Demo ===\n')

  let eventCount = 0

  // Subscribe to ALL message events
  const unsubscribe = eventBus.subscribe('message:*', (event) => {
    eventCount++
    console.log(`📬 Wildcard caught: ${event.type}`)
  })

  // Publish different message events
  const mockMessage: MessageDTO = {
    id: 'msg-789',
    teamId: 'team1',
    authorId: 'user1',
    content: 'Test message',
    contentType: 'text',
    createdAt: new Date().toISOString(),
  }

  eventBus.publish(EventTransformer.messageCreated(mockMessage, 'rest'))
  eventBus.publish(EventTransformer.messageUpdated(mockMessage, 'socket'))
  eventBus.publish(EventTransformer.messageDeleted('msg-789', 'team1', 'rest'))

  setTimeout(() => {
    console.log(`\n✅ Wildcard caught ${eventCount} events`)
    console.log('Expected: 3 (created, updated, deleted)')
    unsubscribe()
    console.log('\n=== Demo Complete ===')
  }, 100)
}

/**
 * Example: How services will coordinate via Event Bus
 */
export function demonstrateServiceCoordination() {
  console.log('=== Service Coordination Demo ===\n')

  // Simulate messageService subscribing to its own events
  const messageServiceUnsubscribe = eventBus.subscribe('message:created', (_event) => {
    console.log('📝 MessageService: Updating local cache')
    // In real code: this.cache.set(event.message.id, event.message)
  })

  // Simulate insightService listening for messages (for auto-insights)
  const insightServiceUnsubscribe = eventBus.subscribe('message:created', (event) => {
    if (event.type === 'message:created' && event.message.content.includes('@agent')) {
      console.log('🤖 InsightService: Detected @agent mention, generating response')
      // In real code: this.generateAgentResponse(event.message)
    }
  })

  // Simulate presenceService updating typing status
  const presenceServiceUnsubscribe = eventBus.subscribe('presence:typing', (event) => {
    if (event.type === 'presence:typing') {
      console.log(`⌨️  PresenceService: ${event.userId} ${event.isTyping ? 'started' : 'stopped'} typing`)
      const store = useRealtimeStore.getState()
      store.setUserTyping(event.teamId, event.userId, event.isTyping)
    }
  })

  // Publish events
  const mockMessage: MessageDTO = {
    id: 'msg-999',
    teamId: 'team1',
    authorId: 'user1',
    content: '@agent what is the status?',
    contentType: 'text',
    createdAt: new Date().toISOString(),
  }

  eventBus.publish(EventTransformer.messageCreated(mockMessage, 'rest'))
  eventBus.publish(EventTransformer.presenceTyping('team1', 'user2', true, 'socket'))

  setTimeout(() => {
    console.log('\n✅ Multiple services coordinated via Event Bus')
    messageServiceUnsubscribe()
    insightServiceUnsubscribe()
    presenceServiceUnsubscribe()
    console.log('\n=== Demo Complete ===')
  }, 100)
}

// Enable logging for demos
eventBus.setLogging(true)
