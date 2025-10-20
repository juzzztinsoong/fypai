/**
 * Event Deduplicator
 * 
 * Prevents duplicate events from being processed when the same event
 * arrives from multiple sources (e.g., REST API response + socket event).
 * 
 * Strategy:
 * - Uses LRU cache with TTL (time-to-live)
 * - Events are identified by unique eventId
 * - Automatically cleans up old entries to prevent memory leaks
 */

interface DedupEntry {
  eventId: string
  timestamp: number
}

export class EventDeduplicator {
  private recentEvents: Map<string, DedupEntry> = new Map()
  private readonly ttl: number // Time-to-live in milliseconds
  private readonly maxSize: number // Maximum cache size
  private cleanupIntervalId: number | null = null

  constructor(ttl: number = 5000, maxSize: number = 1000) {
    this.ttl = ttl
    this.maxSize = maxSize
    this.startCleanup()
  }

  /**
   * Check if an event is a duplicate
   * @param eventId - Unique identifier for the event
   * @returns true if event was seen recently, false otherwise
   */
  isDuplicate(eventId: string): boolean {
    const now = Date.now()
    const existing = this.recentEvents.get(eventId)

    if (existing) {
      // Check if entry is still valid (within TTL)
      if (now - existing.timestamp < this.ttl) {
        return true // Duplicate!
      } else {
        // Entry expired, remove it
        this.recentEvents.delete(eventId)
      }
    }

    // Not a duplicate, record it
    this.recentEvents.set(eventId, {
      eventId,
      timestamp: now,
    })

    // Enforce max size (LRU eviction)
    if (this.recentEvents.size > this.maxSize) {
      this.evictOldest()
    }

    return false
  }

  /**
   * Manually mark an event as seen (for testing or special cases)
   */
  markAsSeen(eventId: string): void {
    this.recentEvents.set(eventId, {
      eventId,
      timestamp: Date.now(),
    })
  }

  /**
   * Clear all entries (for testing or reset)
   */
  clear(): void {
    this.recentEvents.clear()
  }

  /**
   * Get statistics about deduplication
   */
  getStats() {
    return {
      cacheSize: this.recentEvents.size,
      ttl: this.ttl,
      maxSize: this.maxSize,
    }
  }

  /**
   * Evict oldest entry (LRU strategy)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTimestamp = Infinity

    for (const [key, entry] of this.recentEvents.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.recentEvents.delete(oldestKey)
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Run cleanup every TTL interval
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpired()
    }, this.ttl)
  }

  /**
   * Remove all expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now()
    const toDelete: string[] = []

    for (const [key, entry] of this.recentEvents.entries()) {
      if (now - entry.timestamp >= this.ttl) {
        toDelete.push(key)
      }
    }

    toDelete.forEach((key) => this.recentEvents.delete(key))
  }

  /**
   * Stop cleanup interval (for cleanup/testing)
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = null
    }
    this.clear()
  }
}

/**
 * Singleton instance for global use
 */
export const eventDeduplicator = new EventDeduplicator()
