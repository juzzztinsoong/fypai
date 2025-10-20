/**
 * Event Bus Module
 * 
 * Central event coordination system for the application.
 * 
 * Usage:
 * ```typescript
 * import { eventBus, EventTransformer, useRealtimeStore } from '@/core/eventBus'
 * 
 * // Publish event
 * const event = EventTransformer.messageCreated(message, 'rest')
 * eventBus.publish(event)
 * 
 * // Subscribe to events
 * eventBus.subscribe('message:created', (event) => {
 *   console.log('New message:', event.message)
 * })
 * 
 * // Read from store
 * const messages = useRealtimeStore((state) => state.getMessages(teamId))
 * ```
 */

export { EventBus, eventBus } from './EventBus'
export { EventDeduplicator, eventDeduplicator } from './EventDeduplicator'
export { EventTransformer } from './EventTransformer'
export { useRealtimeStore } from './RealtimeStore'
export { initializeEventBridge } from './bridge'
export * from './types'
