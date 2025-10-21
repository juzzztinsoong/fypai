# Architecture Improvements Roadmap

> **Branch**: `socket-refactoring`  
> **Date**: October 21, 2025  
> **Status**: Event Bus refactoring complete, real-time updates working

This document outlines critical architectural improvements needed to bring the application to modern standards for production readiness.

---

## Priority Matrix

| Issue | Impact | Effort | Priority | Timeline |
|-------|---------|--------|----------|----------|
| **1. Offline Resilience** | 🔴 Critical | High | **P0** | Sprint 1 |
| **2. Error Handling & Retry** | 🔴 Critical | Medium | **P0** | Sprint 1 |
| **3. Event Bus Performance** | 🟡 Medium | Low | **P1** | Sprint 2 |
| **4. Observability** | 🟡 Medium | Medium | **P1** | Sprint 2 |
| **5. Memory Leaks** | 🟡 Medium | Low | **P2** | Sprint 3 |
| **6. Type Safety** | 🟡 Low | Medium | **P2** | Sprint 3 |
| **7. Latency Optimization** | 🟠 Low | High | **P3** | Sprint 4 |
| **8. Socket Room Management** | 🟠 Low | Low | **P2** | Sprint 3 |
| **9. Testing & DI** | 🟡 Low | High | **P3** | Sprint 4+ |

---

## 1. Offline Resilience - CRITICAL 🔴

### Current Problem
- **No local persistence** (IndexedDB/localStorage)
- **No optimistic updates** - UI waits for server confirmation
- **No retry queue** for failed operations
- **No conflict resolution** when reconnecting
- **Impact**: App breaks completely when offline. Users lose work.

### Modern Standard Implementation

```typescript
// === frontend/src/services/offline/OutboxService.ts ===
interface OutboxEntry {
  id: string
  operation: 'create' | 'update' | 'delete'
  entity: 'message' | 'insight'
  payload: unknown
  timestamp: number
  retries: number
  status: 'pending' | 'syncing' | 'failed' | 'synced'
  teamId: string
}

class OutboxService {
  private db: IDBDatabase

  async enqueue(entry: Omit<OutboxEntry, 'id' | 'timestamp' | 'retries' | 'status'>): Promise<void> {
    const outboxEntry: OutboxEntry = {
      ...entry,
      id: generateUUID(),
      timestamp: Date.now(),
      retries: 0,
      status: 'pending'
    }
    
    await this.db.put('outbox', outboxEntry)
    this.triggerSync()
  }

  async syncAll(): Promise<void> {
    const pending = await this.getPendingEntries()
    
    for (const entry of pending) {
      try {
        await this.syncEntry(entry)
        await this.markSynced(entry.id)
      } catch (error) {
        await this.incrementRetries(entry.id)
        if (entry.retries >= 3) {
          await this.markFailed(entry.id)
        }
      }
    }
  }
}

// === frontend/src/services/offline/OfflineMessageService.ts ===
class OfflineMessageService {
  constructor(
    private outbox: OutboxService,
    private realtimeStore: RealtimeStore,
    private api: ApiClient
  ) {}

  async createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
    // 1. Generate optimistic message
    const optimisticMessage: MessageDTO = {
      ...data,
      id: `temp-${generateUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { ...data.metadata, synced: false }
    }
    
    // 2. Add to local store immediately (optimistic update)
    this.realtimeStore.addMessage(data.teamId, optimisticMessage)
    
    // 3. Queue for sync
    await this.outbox.enqueue({
      operation: 'create',
      entity: 'message',
      payload: data,
      teamId: data.teamId
    })
    
    // 4. Try sync in background
    if (navigator.onLine) {
      this.backgroundSync()
    }
    
    return optimisticMessage
  }

  private async backgroundSync(): Promise<void> {
    try {
      const realMessage = await this.api.post('/messages', data)
      
      // Replace optimistic with real
      this.realtimeStore.updateMessage(
        realMessage.teamId,
        optimisticMessage.id,
        realMessage
      )
    } catch (error) {
      // Will retry via outbox
      console.error('[OfflineMessageService] Background sync failed:', error)
    }
  }
}

// === frontend/src/services/offline/IndexedDBService.ts ===
class IndexedDBService {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('fypai-offline', 1)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' })
          messageStore.createIndex('teamId', 'teamId', { unique: false })
          messageStore.createIndex('createdAt', 'createdAt', { unique: false })
        }
        
        // Outbox store
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' })
          outboxStore.createIndex('status', 'status', { unique: false })
          outboxStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
      
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onerror = () => reject(request.error)
    })
  }

  async saveMessages(teamId: string, messages: MessageDTO[]): Promise<void> {
    const tx = this.db!.transaction('messages', 'readwrite')
    const store = tx.objectStore('messages')
    
    for (const message of messages) {
      await store.put(message)
    }
    
    await tx.complete
  }

  async getMessages(teamId: string): Promise<MessageDTO[]> {
    const tx = this.db!.transaction('messages', 'readonly')
    const store = tx.objectStore('messages')
    const index = store.index('teamId')
    
    return await index.getAll(teamId)
  }
}
```

### Implementation Checklist
- [ ] Create `frontend/src/services/offline/` directory
- [ ] Implement `IndexedDBService` for local storage
- [ ] Implement `OutboxService` for sync queue
- [ ] Implement `OfflineMessageService` with optimistic updates
- [ ] Add network status listener (`window.addEventListener('online')`)
- [ ] Add UI indicators (offline badge, syncing spinner)
- [ ] Implement conflict resolution (last-write-wins or user prompt)
- [ ] Add periodic background sync (every 30s when online)

---

## 2. Error Handling & Retry Logic - CRITICAL 🔴

### Current Problem
- API calls fail permanently on network errors
- No circuit breaker pattern for degraded services
- Socket reconnection relies on Socket.IO defaults only
- **Impact**: Transient network issues cause permanent failures

### Modern Standard Implementation

```typescript
// === frontend/src/utils/retry.ts ===
interface RetryOptions {
  maxRetries: number
  backoffMs: number
  shouldRetry: (error: unknown) => boolean
  onRetry?: (attempt: number, error: unknown) => void
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const isLastAttempt = attempt === options.maxRetries
      const shouldRetry = options.shouldRetry(error)
      
      if (isLastAttempt || !shouldRetry) {
        throw error
      }
      
      // Exponential backoff with jitter
      const delay = options.backoffMs * Math.pow(2, attempt) + Math.random() * 1000
      
      options.onRetry?.(attempt + 1, error)
      console.log(`[Retry] Attempt ${attempt + 1}/${options.maxRetries} after ${delay}ms`)
      
      await sleep(delay)
    }
  }
  
  throw new Error('Unreachable')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Error classification
function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    // Network errors
    if (!error.response) return true
    
    // 5xx server errors
    if (error.response.status >= 500) return true
    
    // 429 rate limit
    if (error.response.status === 429) return true
    
    // 408 timeout
    if (error.response.status === 408) return true
  }
  
  return false
}

// === frontend/src/services/messageService.ts ===
export async function createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
  const requestId = EventTransformer.generateEventId('create-msg', data.teamId)
  
  const response = await withRetry(
    () => api.post<MessageDTO>('/messages', data),
    {
      maxRetries: 3,
      backoffMs: 1000,
      shouldRetry: isRetryableError,
      onRetry: (attempt, error) => {
        console.warn(`[MessageService] Retry ${attempt}/3:`, error)
      }
    }
  )
  
  const event = EventTransformer.messageCreated(response.data, 'rest', requestId)
  eventBus.publish(event)
  
  return response.data
}

// === frontend/src/utils/circuitBreaker.ts ===
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private failures = 0
  private lastFailureTime = 0
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess(): void {
    this.failures = 0
    this.state = 'closed'
  }
  
  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.threshold) {
      this.state = 'open'
      console.error(`[CircuitBreaker] OPENED after ${this.failures} failures`)
    }
  }
}

// Usage
const messageServiceBreaker = new CircuitBreaker(5, 60000)

export async function createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
  return messageServiceBreaker.execute(async () => {
    return withRetry(
      () => api.post<MessageDTO>('/messages', data),
      { maxRetries: 3, backoffMs: 1000, shouldRetry: isRetryableError }
    )
  })
}
```

### Implementation Checklist
- [ ] Create `frontend/src/utils/retry.ts` with exponential backoff
- [ ] Create `frontend/src/utils/circuitBreaker.ts`
- [ ] Wrap all service API calls with retry logic
- [ ] Add error classification (retryable vs non-retryable)
- [ ] Add UI feedback for retry attempts (toast notifications)
- [ ] Implement socket reconnection with backoff
- [ ] Add health check endpoint polling

---

## 3. Event Bus Performance - MEDIUM 🟡

### Current Problem
- All event handlers run synchronously in `publish()`
- One slow subscriber blocks all others
- No error isolation between subscribers
- **Impact**: Can cause UI jank if handler does heavy work

### Modern Standard Implementation

```typescript
// === frontend/src/core/eventBus/EventBus.ts ===
export class EventBus {
  // ... existing code ...
  
  publish(event: DomainEvent): void {
    // Check for duplicates
    if (this.deduplicator.isDuplicate(event.eventId)) {
      this.stats.totalDeduplicated++
      if (this.enableLogging) {
        console.log(`[EventBus] 🔄 Deduplicated ${event.type}`)
      }
      return
    }

    // Update stats
    this.stats.totalPublished++
    this.stats.eventCounts[event.type] = (this.stats.eventCounts[event.type] || 0) + 1

    if (this.enableLogging) {
      console.log(`[EventBus] 📢 Publishing ${event.type} from ${event.source}:`, event)
    }

    const subscribers = this.getMatchingSubscribers(event.type)
    
    // Run subscribers asynchronously in microtasks (non-blocking)
    subscribers.forEach((sub) => {
      queueMicrotask(async () => {
        try {
          await sub.callback(event)
        } catch (error) {
          this.handleSubscriberError(sub, event, error)
        }
      })
    })
  }
  
  private getMatchingSubscribers(eventType: string): Subscription[] {
    const exact = this.subscriptions.get(eventType) || []
    const wildcardPattern = eventType.split(':')[0] + ':*'
    const wildcard = this.subscriptions.get(wildcardPattern) || []
    const universal = this.subscriptions.get('*') || []
    
    return [...exact, ...wildcard, ...universal]
  }
  
  private handleSubscriberError(
    subscriber: Subscription,
    event: DomainEvent,
    error: unknown
  ): void {
    console.error(
      `[EventBus] ❌ Subscriber ${subscriber.id} failed for ${event.type}:`,
      error
    )
    
    // Optional: Send to error tracking service
    // Sentry.captureException(error, { contexts: { event, subscriber } })
  }
  
  // Priority-based publishing
  publishWithPriority(event: DomainEvent, priority: 'high' | 'low'): void {
    if (priority === 'high') {
      this.publishSync(event) // UI-critical (messages appearing)
    } else {
      this.publishAsync(event) // Background (analytics, logging)
    }
  }
  
  private publishSync(event: DomainEvent): void {
    // Original synchronous behavior for critical events
    const subscribers = this.getMatchingSubscribers(event.type)
    subscribers.forEach((sub) => {
      try {
        sub.callback(event)
      } catch (error) {
        this.handleSubscriberError(sub, event, error)
      }
    })
  }
  
  private publishAsync(event: DomainEvent): void {
    // Async microtask queue for non-critical events
    const subscribers = this.getMatchingSubscribers(event.type)
    subscribers.forEach((sub) => {
      queueMicrotask(async () => {
        try {
          await sub.callback(event)
        } catch (error) {
          this.handleSubscriberError(sub, event, error)
        }
      })
    })
  }
}
```

### Implementation Checklist
- [ ] Refactor `EventBus.publish()` to use `queueMicrotask()`
- [ ] Add priority-based publishing (high/low)
- [ ] Update all critical event publishes to use `publishWithPriority('high')`
- [ ] Add performance monitoring for slow subscribers (>10ms)
- [ ] Consider worker thread for heavy background processing

---

## 4. Observability & Debugging - MEDIUM 🟡

### Current Problem
- Console.log only (not production-grade)
- No distributed tracing (can't trace event through system)
- No performance metrics (latency tracking)
- No event replay for debugging
- **Impact**: Hard to debug issues in production

### Modern Standard Implementation

```typescript
// === frontend/src/core/eventBus/ObservableEventBus.ts ===
interface EventTrace {
  eventId: string
  type: string
  source: string
  timestamp: number
  duration?: number
  subscribers: Array<{
    id: string
    duration: number
    error?: string
  }>
}

class ObservableEventBus extends EventBus {
  private traces: EventTrace[] = []
  private maxTraces = 1000
  
  publish(event: DomainEvent): void {
    const trace: EventTrace = {
      eventId: event.eventId,
      type: event.type,
      source: event.source,
      timestamp: performance.now(),
      subscribers: []
    }
    
    const subscribers = this.getMatchingSubscribers(event.type)
    
    subscribers.forEach((sub) => {
      const start = performance.now()
      
      queueMicrotask(async () => {
        try {
          await sub.callback(event)
          
          trace.subscribers.push({
            id: sub.id,
            duration: performance.now() - start
          })
        } catch (error) {
          trace.subscribers.push({
            id: sub.id,
            duration: performance.now() - start,
            error: String(error)
          })
          
          this.handleSubscriberError(sub, event, error)
        }
      })
    })
    
    trace.duration = performance.now() - trace.timestamp
    this.addTrace(trace)
    
    // Alert on slow events
    if (trace.duration && trace.duration > 100) {
      this.reportSlowEvent(trace)
    }
    
    super.publish(event)
  }
  
  private addTrace(trace: EventTrace): void {
    this.traces.push(trace)
    
    // Keep only last N traces
    if (this.traces.length > this.maxTraces) {
      this.traces.shift()
    }
  }
  
  private reportSlowEvent(trace: EventTrace): void {
    console.warn(
      `[EventBus] 🐌 Slow event ${trace.type} took ${trace.duration}ms`,
      trace
    )
    
    // Optional: Send to monitoring service
    // Sentry.captureMessage('Slow event', { extra: trace })
  }
  
  // DevTools integration
  getEventTimeline(): EventTrace[] {
    return this.traces.slice(-100) // Last 100 events
  }
  
  getEventStats(): Record<string, { count: number; avgDuration: number }> {
    const stats: Record<string, { total: number; count: number }> = {}
    
    for (const trace of this.traces) {
      if (!stats[trace.type]) {
        stats[trace.type] = { total: 0, count: 0 }
      }
      stats[trace.type].total += trace.duration || 0
      stats[trace.type].count++
    }
    
    return Object.fromEntries(
      Object.entries(stats).map(([type, { total, count }]) => [
        type,
        { count, avgDuration: total / count }
      ])
    )
  }
  
  // Event replay for debugging
  replayEvent(eventId: string): void {
    const trace = this.traces.find(t => t.eventId === eventId)
    if (!trace) {
      console.error(`[EventBus] Event ${eventId} not found in history`)
      return
    }
    
    console.log(`[EventBus] 🔁 Replaying event:`, trace)
    // Re-publish the event
    // (would need to store original event payload)
  }
}

// Expose to window for DevTools access
if (typeof window !== 'undefined') {
  (window as any).__eventBusDebug = {
    getTimeline: () => eventBus.getEventTimeline(),
    getStats: () => eventBus.getEventStats(),
    replay: (id: string) => eventBus.replayEvent(id)
  }
}
```

### Implementation Checklist
- [ ] Create `ObservableEventBus` extending `EventBus`
- [ ] Add performance tracking for all events
- [ ] Store event history (last 1000 events)
- [ ] Add DevTools window integration
- [ ] Integrate with monitoring service (Sentry/DataDog)
- [ ] Add event replay functionality
- [ ] Create debug UI panel for event timeline

---

## 5. Memory Leaks - MEDIUM 🟡

### Current Problem
- Presence Set/Map can grow unbounded
- Typing indicators never cleaned up
- No TTL for stale data
- **Impact**: Memory grows over time, especially for long-running sessions

### Modern Standard Implementation

```typescript
// === frontend/src/core/eventBus/RealtimeStore.ts ===
interface PresenceEntry {
  userId: string
  lastSeen: number
  ttl: number // 5 minutes
}

interface TypingEntry {
  userId: string
  teamId: string
  startedAt: number
  ttl: number // 10 seconds
}

export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
  // ... existing state ...
  
  presence: {
    onlineUsers: new Map<string, PresenceEntry>(), // Changed from Set to Map
    typingUsers: new Map<string, TypingEntry>() // Flattened structure
  },
  
  // Start cleanup interval
  startCleanup: () => {
    setInterval(() => {
      const now = Date.now()
      const state = get()
      
      // Clean up stale online users
      const onlineUsers = new Map(state.presence.onlineUsers)
      for (const [userId, entry] of onlineUsers.entries()) {
        if (now - entry.lastSeen > entry.ttl) {
          onlineUsers.delete(userId)
          console.log(`[RealtimeStore] Cleaned up stale user: ${userId}`)
        }
      }
      
      // Clean up stale typing indicators
      const typingUsers = new Map(state.presence.typingUsers)
      for (const [key, entry] of typingUsers.entries()) {
        if (now - entry.startedAt > entry.ttl) {
          typingUsers.delete(key)
          console.log(`[RealtimeStore] Cleaned up stale typing: ${entry.userId}`)
        }
      }
      
      set({
        presence: { onlineUsers, typingUsers }
      })
    }, 60000) // Every minute
  },
  
  setUserOnline: (userId) =>
    set((state) => {
      const onlineUsers = new Map(state.presence.onlineUsers)
      onlineUsers.set(userId, {
        userId,
        lastSeen: Date.now(),
        ttl: 5 * 60 * 1000 // 5 minutes
      })
      
      return {
        presence: { ...state.presence, onlineUsers }
      }
    }),
  
  setUserTyping: (teamId, userId, isTyping) =>
    set((state) => {
      const typingUsers = new Map(state.presence.typingUsers)
      const key = `${teamId}:${userId}`
      
      if (isTyping) {
        typingUsers.set(key, {
          userId,
          teamId,
          startedAt: Date.now(),
          ttl: 10 * 1000 // 10 seconds
        })
      } else {
        typingUsers.delete(key)
      }
      
      return {
        presence: { ...state.presence, typingUsers }
      }
    }),
  
  getTypingUsers: (teamId) => {
    const state = get()
    const typing: string[] = []
    
    for (const [key, entry] of state.presence.typingUsers.entries()) {
      if (entry.teamId === teamId) {
        typing.push(entry.userId)
      }
    }
    
    return typing
  }
}))

// Initialize cleanup on store creation
useRealtimeStore.getState().startCleanup()
```

### Implementation Checklist
- [ ] Refactor presence state to use Map with TTL
- [ ] Add periodic cleanup interval (every 60s)
- [ ] Add TTL for typing indicators (10s)
- [ ] Add TTL for online users (5min)
- [ ] Add memory monitoring to detect leaks
- [ ] Consider WeakMap for temporary subscriptions

---

## 6. Type Safety - LOW 🟡

### Current Problem
- Event callbacks use union types, forcing runtime checks
- No compile-time guarantees about event shape
- **Impact**: Runtime errors, harder to maintain

### Modern Standard Implementation

```typescript
// === frontend/src/core/eventBus/TypedEventBus.ts ===
type EventTypeMap = {
  'message:created': MessageCreatedEvent
  'message:updated': MessageUpdatedEvent
  'message:deleted': MessageDeletedEvent
  'messages:fetched': MessagesFetchedEvent
  'insight:created': InsightCreatedEvent
  // ... all event types
}

class TypedEventBus {
  private bus = new EventBus()
  
  subscribe<T extends keyof EventTypeMap>(
    eventType: T,
    callback: (event: EventTypeMap[T]) => void | Promise<void>
  ): () => void {
    return this.bus.subscribe(eventType, (event) => {
      // Type assertion safe because we control the publish
      callback(event as EventTypeMap[T])
    })
  }
  
  publish<T extends keyof EventTypeMap>(
    eventType: T,
    event: EventTypeMap[T]
  ): void {
    this.bus.publish(event)
  }
}

// Usage (no runtime check needed!)
eventBus.subscribe('message:created', (event) => {
  // event is MessageCreatedEvent (inferred automatically)
  store.addMessage(event.message.teamId, event.message)
  // TypeScript error if you try to access wrong property
})
```

### Implementation Checklist
- [ ] Create `TypedEventBus` wrapper class
- [ ] Create `EventTypeMap` with all event types
- [ ] Migrate all subscribers to use typed subscriptions
- [ ] Remove runtime type checks (`if (event.type === ...)`)
- [ ] Add unit tests for type safety

---

## 7. Latency Optimization - LOW 🟠

### Current Problem
- No request deduplication
- No pagination
- No virtualization for long lists
- **Impact**: Poor performance with large datasets

### Modern Standard Implementation

```typescript
// === frontend/src/services/BatchedMessageService.ts ===
class BatchedMessageService {
  private pendingRequests = new Map<string, Promise<MessageDTO[]>>()
  
  async getMessages(teamId: string): Promise<MessageDTO[]> {
    // Deduplicate concurrent requests for same team
    if (this.pendingRequests.has(teamId)) {
      console.log(`[MessageService] Deduplicating request for team: ${teamId}`)
      return this.pendingRequests.get(teamId)!
    }
    
    const promise = this._fetchMessages(teamId)
    this.pendingRequests.set(teamId, promise)
    
    try {
      return await promise
    } finally {
      this.pendingRequests.delete(teamId)
    }
  }
  
  private async _fetchMessages(teamId: string): Promise<MessageDTO[]> {
    const response = await api.get<MessageDTO[]>('/messages', {
      params: { teamId }
    })
    return response.data
  }
}

// === Pagination ===
interface PaginatedResponse<T> {
  data: T[]
  cursor: string | null
  hasMore: boolean
  total: number
}

async function getMessagesPaginated(
  teamId: string,
  cursor?: string,
  limit = 50
): Promise<PaginatedResponse<MessageDTO>> {
  const response = await api.get<PaginatedResponse<MessageDTO>>('/messages', {
    params: { teamId, cursor, limit }
  })
  return response.data
}

// === Virtual Scrolling (React Virtuoso) ===
import { Virtuoso } from 'react-virtuoso'

export const MessageList = () => {
  const messages = useRealtimeStore((state) => state.getMessages(teamId))
  
  return (
    <Virtuoso
      data={messages}
      itemContent={(index, message) => (
        <MessageBubble key={message.id} message={message} />
      )}
      followOutput="auto"
    />
  )
}
```

### Implementation Checklist
- [ ] Implement request deduplication in services
- [ ] Add pagination to backend API
- [ ] Add infinite scroll UI
- [ ] Install `react-virtuoso` for virtual scrolling
- [ ] Implement lazy loading for insights
- [ ] Add request caching (SWR pattern)

---

## 8. Socket Room Management - LOW 🟠

### Current Problem
- No verification that room join succeeded
- No fallback if socket disconnected during team switch
- **Impact**: Silent failures, users miss messages

### Modern Standard Implementation

```typescript
// === frontend/src/services/socketService.ts ===
class SocketService {
  async joinTeamWithConfirmation(
    teamId: string,
    options: { timeout: number } = { timeout: 5000 }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Room join timeout'))
      }, options.timeout)
      
      // Emit with acknowledgment callback
      this.socket.emit('team:join', { teamId }, (ack: { success: boolean; roomSize: number }) => {
        clearTimeout(timeoutId)
        
        if (ack.success) {
          console.log(`[SocketService] ✅ Joined team:${teamId} (${ack.roomSize} users)`)
          resolve()
        } else {
          reject(new Error('Room join rejected by server'))
        }
      })
    })
  }
}

// === frontend/src/stores/teamStore.ts ===
setCurrentTeam: async (teamId: string) => {
  set({ currentTeamId: teamId, isLoading: true, error: null })
  
  try {
    // 1. Join socket room with confirmation
    await socketService.joinTeamWithConfirmation(teamId, { timeout: 5000 })
    
    // 2. Fetch initial data in parallel
    await Promise.all([
      useChatStore.getState().fetchMessages(teamId),
      useAIInsightsStore.getState().fetchInsights(teamId)
    ])
    
    set({ isLoading: false })
  } catch (error) {
    console.error('[TeamStore] Failed to switch team:', error)
    
    set({ 
      error: 'Failed to join team. Retrying...',
      isLoading: false 
    })
    
    // Retry with exponential backoff
    await retryJoinTeam(teamId, { maxRetries: 3, backoffMs: 1000 })
  }
}

async function retryJoinTeam(teamId: string, options: RetryOptions): Promise<void> {
  return withRetry(
    () => socketService.joinTeamWithConfirmation(teamId),
    options
  )
}
```

### Backend Changes Required

```typescript
// === backend/src/socket/socketHandlers.ts ===
socket.on('team:join', ({ teamId }, callback) => {
  try {
    socket.join(`team:${teamId}`)
    const roomSize = io.sockets.adapter.rooms.get(`team:${teamId}`)?.size || 0
    
    console.log(`[SOCKET] ✅ ${socket.id} joined team:${teamId} (room size: ${roomSize})`)
    
    // Send acknowledgment
    callback({ success: true, roomSize })
  } catch (error) {
    console.error(`[SOCKET] Failed to join team:${teamId}:`, error)
    callback({ success: false, roomSize: 0 })
  }
})
```

### Implementation Checklist
- [ ] Add acknowledgment callback to `team:join` emit
- [ ] Update backend handler to send confirmation
- [ ] Implement `joinTeamWithConfirmation()` with timeout
- [ ] Add retry logic to `setCurrentTeam()`
- [ ] Add UI feedback for failed room joins
- [ ] Test disconnect/reconnect scenarios

---

## 9. Testing & Dependency Injection - LOW 🟡

### Current Problem
- Tight coupling makes unit testing hard
- EventBus is singleton (hard to isolate in tests)
- Services directly import global instances
- **Impact**: Low test coverage, hard to mock

### Modern Standard Implementation

```typescript
// === frontend/src/services/MessageService.ts (with DI) ===
export class MessageService {
  constructor(
    private api: ApiClient,
    private eventBus: EventBus,
    private idGenerator: IdGenerator = defaultIdGenerator
  ) {}
  
  async createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
    const requestId = this.idGenerator.generate('create-msg', data.teamId)
    const response = await this.api.post<MessageDTO>('/messages', data)
    
    this.eventBus.publish(
      EventTransformer.messageCreated(response.data, 'rest', requestId)
    )
    
    return response.data
  }
}

// === frontend/src/services/index.ts (Service Container) ===
class ServiceContainer {
  private static instance: ServiceContainer
  private services = new Map<string, unknown>()
  
  static getInstance(): ServiceContainer {
    if (!this.instance) {
      this.instance = new ServiceContainer()
    }
    return this.instance
  }
  
  register<T>(name: string, factory: () => T): void {
    this.services.set(name, factory())
  }
  
  get<T>(name: string): T {
    return this.services.get(name) as T
  }
}

// Setup in main.tsx
const container = ServiceContainer.getInstance()
container.register('eventBus', () => new EventBus())
container.register('api', () => api)
container.register('messageService', () => new MessageService(
  container.get('api'),
  container.get('eventBus')
))

// === Testing becomes trivial ===
describe('MessageService', () => {
  it('publishes event after creating message', async () => {
    const mockApi = createMockApi({
      post: jest.fn().mockResolvedValue({ data: { id: 'msg1', content: 'test' } })
    })
    const mockEventBus = createMockEventBus()
    const service = new MessageService(mockApi, mockEventBus)
    
    await service.createMessage({ teamId: 'team1', content: 'test' })
    
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'message:created' })
    )
  })
})
```

### Implementation Checklist
- [ ] Create `ServiceContainer` for dependency injection
- [ ] Refactor all services to accept dependencies via constructor
- [ ] Create mock factories for testing
- [ ] Add unit tests for all services (target 80% coverage)
- [ ] Add integration tests for Event Bus flow
- [ ] Add E2E tests for critical user flows

---

## Implementation Timeline

### Sprint 1 (Weeks 1-2) - Critical Fixes
- [ ] Offline detection + UI feedback
- [ ] Exponential backoff retry logic
- [ ] Circuit breaker pattern
- [ ] Basic IndexedDB setup

### Sprint 2 (Weeks 3-4) - Resilience
- [ ] Optimistic updates for messages
- [ ] Outbox pattern implementation
- [ ] Async Event Bus handlers
- [ ] Structured logging

### Sprint 3 (Weeks 5-6) - Stability
- [ ] Memory leak fixes (TTL cleanup)
- [ ] Socket room confirmation
- [ ] Type-safe event subscriptions
- [ ] Performance monitoring

### Sprint 4 (Weeks 7-8) - Optimization
- [ ] Request batching/deduplication
- [ ] Pagination + infinite scroll
- [ ] Virtual scrolling for messages
- [ ] Dependency injection

### Post-Sprint - Continuous
- [ ] Increase test coverage (target 80%)
- [ ] Production monitoring setup
- [ ] Documentation updates
- [ ] Performance audits

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| **Offline Support** | 0% | 100% (full CRUD) |
| **Failed Request Recovery** | 0% | >95% (auto-retry) |
| **Event Processing Latency** | ~20ms | <5ms (p95) |
| **Memory Growth** | Unbounded | <50MB/hour |
| **Test Coverage** | <20% | >80% |
| **First Paint (Offline)** | N/A | <500ms |

---

## References

- **Offline-First**: [Offline First Principles](https://offlinefirst.org/)
- **Event-Driven Architecture**: [Martin Fowler - Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- **Circuit Breaker**: [Microsoft - Circuit Breaker Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- **IndexedDB**: [MDN - IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- **React Virtuoso**: [Virtuoso Docs](https://virtuoso.dev/)

---

**Last Updated**: October 21, 2025  
**Next Review**: After Sprint 1 completion
