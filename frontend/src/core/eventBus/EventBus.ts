/**
 * Event Bus
 * 
 * Central pub/sub coordinator for all application events.
 * Decouples event producers (services) from event consumers (stores, other services).
 * 
 * Features:
 * - Type-safe event publishing and subscription
 * - Automatic event deduplication
 * - Event logging and statistics
 * - Wildcard subscriptions (e.g., 'message:*')
 * - Unsubscribe mechanism
 * 
 * Architecture:
 * - Services publish events (REST responses, socket events, local actions)
 * - Event Bus deduplicates and routes to subscribers
 * - Stores/components subscribe to events they care about
 */

import type { DomainEvent, EventCallback, EventStats } from './types'
import { EventDeduplicator } from './EventDeduplicator'

interface Subscription {
  id: string
  eventType: string // Can include wildcards like 'message:*'
  callback: EventCallback
}

export class EventBus {
  private subscriptions: Map<string, Subscription[]> = new Map()
  private deduplicator: EventDeduplicator
  private stats: EventStats = {
    totalPublished: 0,
    totalDeduplicated: 0,
    totalSubscribers: 0,
    eventCounts: {} as Record<DomainEvent['type'], number>,
  }
  private enableLogging: boolean = false

  constructor(deduplicator?: EventDeduplicator) {
    this.deduplicator = deduplicator || new EventDeduplicator()
  }

  /**
   * Enable/disable event logging for debugging
   */
  setLogging(enabled: boolean): void {
    this.enableLogging = enabled
  }

  /**
   * Subscribe to events
   * @param eventType - Event type to listen for (supports wildcards like 'message:*')
   * @param callback - Function to call when event fires
   * @returns Unsubscribe function
   */
  subscribe(eventType: string, callback: EventCallback): () => void {
    const subscriptionId = this.generateSubscriptionId()
    const subscription: Subscription = {
      id: subscriptionId,
      eventType,
      callback,
    }

    // Get or create subscription list for this event type
    const existing = this.subscriptions.get(eventType) || []
    existing.push(subscription)
    this.subscriptions.set(eventType, existing)

    this.stats.totalSubscribers++

    if (this.enableLogging) {
      console.log(`[EventBus] 📝 Subscribed to ${eventType} (id: ${subscriptionId})`)
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(subscriptionId, eventType)
    }
  }

  /**
   * Publish an event to all subscribers
   * @param event - Event to publish
   */
  publish(event: DomainEvent): void {
    // Check for duplicates
    if (this.deduplicator.isDuplicate(event.eventId)) {
      this.stats.totalDeduplicated++
      if (this.enableLogging) {
        console.log(
          `[EventBus] 🔄 Deduplicated ${event.type} (eventId: ${event.eventId})`
        )
      }
      return
    }

    // Update stats
    this.stats.totalPublished++
    this.stats.eventCounts[event.type] = (this.stats.eventCounts[event.type] || 0) + 1

    if (this.enableLogging) {
      console.log(
        `[EventBus] 📢 Publishing ${event.type} from ${event.source}:`,
        event
      )
    }

    // Notify exact match subscribers
    const exactSubscribers = this.subscriptions.get(event.type) || []
    exactSubscribers.forEach((sub) => {
      try {
        sub.callback(event)
      } catch (error) {
        console.error(
          `[EventBus] ❌ Error in subscriber for ${event.type}:`,
          error
        )
      }
    })

    // Notify wildcard subscribers (e.g., 'message:*' matches 'message:created')
    const wildcardPattern = event.type.split(':')[0] + ':*'
    const wildcardSubscribers = this.subscriptions.get(wildcardPattern) || []
    wildcardSubscribers.forEach((sub) => {
      try {
        sub.callback(event)
      } catch (error) {
        console.error(
          `[EventBus] ❌ Error in wildcard subscriber for ${wildcardPattern}:`,
          error
        )
      }
    })

    // Notify universal subscribers ('*')
    const universalSubscribers = this.subscriptions.get('*') || []
    universalSubscribers.forEach((sub) => {
      try {
        sub.callback(event)
      } catch (error) {
        console.error(
          `[EventBus] ❌ Error in universal subscriber:`,
          error
        )
      }
    })
  }

  /**
   * Unsubscribe from events
   */
  private unsubscribe(subscriptionId: string, eventType: string): void {
    const subscribers = this.subscriptions.get(eventType) || []
    const filtered = subscribers.filter((sub) => sub.id !== subscriptionId)

    if (filtered.length === 0) {
      this.subscriptions.delete(eventType)
    } else {
      this.subscriptions.set(eventType, filtered)
    }

    this.stats.totalSubscribers--

    if (this.enableLogging) {
      console.log(
        `[EventBus] 🗑️ Unsubscribed from ${eventType} (id: ${subscriptionId})`
      )
    }
  }

  /**
   * Clear all subscriptions (for cleanup/testing)
   */
  clear(): void {
    this.subscriptions.clear()
    this.deduplicator.clear()
    this.stats = {
      totalPublished: 0,
      totalDeduplicated: 0,
      totalSubscribers: 0,
      eventCounts: {} as Record<DomainEvent['type'], number>,
    }

    if (this.enableLogging) {
      console.log('[EventBus] 🧹 Cleared all subscriptions')
    }
  }

  /**
   * Get current statistics
   */
  getStats(): EventStats {
    return { ...this.stats }
  }

  /**
   * Get all active subscriptions (for debugging)
   */
  getSubscriptions(): Map<string, Subscription[]> {
    return new Map(this.subscriptions)
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub-${Date.now()}-${Math.random().toString(36).substring(7)}`
  }

  /**
   * Destroy event bus (cleanup intervals, clear state)
   */
  destroy(): void {
    this.clear()
    this.deduplicator.destroy()
  }
}

/**
 * Singleton instance for global use
 */
export const eventBus = new EventBus()
