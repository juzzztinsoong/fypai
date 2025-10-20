# Frontend Architecture Refactoring Plan

**Date:** October 21, 2025  
**Branch:** socket-refactoring  
**Goal:** Transform current ad-hoc socket integration into a properly layered, socket-aware architecture

---

## Current Architecture Problems

### 🔴 **Critical Issues**

1. **Domain Services Don't Know About Sockets**
   - `messageService.ts` only does HTTP REST calls
   - `insightService.ts` only does HTTP REST calls
   - Socket events bypass services entirely → data flows through 2 parallel channels
   - Result: Race conditions, duplicates, inconsistent state

2. **Stores Directly Listen to Sockets**
   - `chatStore.ts` → `socketService.onMessage()` (bypasses messageService)
   - `aiInsightsStore.ts` → `socketService.onAIInsight()` (bypasses insightService)
   - No deduplication logic
   - No central event coordination

3. **No Unified Event Bus**
   - Each store independently sets up socket listeners
   - Multiple sources of truth for same data
   - Can't coordinate between real-time events and API responses

4. **Socket Layer Not Abstracted**
   - Components know about `socketService`, `socketRoomManager`, `socketEventHub`
   - Hard to swap transport layer (WebSocket → WebRTC → GraphQL subscriptions)
   - Tight coupling to Socket.IO implementation

---

## Target Architecture (Layered)

```
┌─────────────────────────────────────────────────────────────┐
│                  LAYER 1: UI COMPONENTS                     │
│  - Chat (MessageList, MessageBubble, ChatWindow)           │
│  - RightPanel (InsightsList, SummaryCard, ReportCard)      │
│  - Sidebar (TeamSwitcher)                                   │
│  └─> ONLY call domain services, never sockets directly     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              LAYER 2: DOMAIN SERVICES (New)                 │
│  - TeamService: unified team operations                     │
│  - MessageService: REST + Socket-aware message ops         │
│  - InsightService: REST + Socket-aware insight ops         │
│  - UserService: user profile operations                     │
│  - PresenceService: online/offline/typing state            │
│  └─> Handle BOTH HTTP and real-time events                 │
│  └─> Deduplicate REST responses vs socket events           │
│  └─> Subscribe to Event Bus, not raw sockets               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│        LAYER 3: UNIFIED EVENT BUS / OBSERVABLE STORE        │
│  - EventBus: central event coordinator (pub/sub)           │
│  - RealtimeStore: single source of truth for RT data       │
│  - EventDeduplicator: prevent duplicate updates            │
│  - EventTransformer: normalize REST + Socket payloads      │
│  └─> Domain services publish/subscribe here                │
│  └─> Decouples services from transport implementation      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         LAYER 4: REALTIME LAYER (Already Built)             │
│  ├─ SocketConnectionManager: connection lifecycle          │
│  ├─ SocketEventHub: event routing to subscribers           │
│  ├─ EventQueue: resilient delivery (retry, dedup)          │
│  ├─ RoomManager: team room scoping                          │
│  └─ HealthMonitor: ping/pong diagnostics                    │
│  └─> Event Bus subscribes here, services don't             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              LAYER 5: TRANSPORT (Pluggable)                 │
│  - WebSocket (Socket.IO) ← current                          │
│  - WebRTC Data Channels ← future                            │
│  - GraphQL Subscriptions ← future                           │
│  - CRDT Sync (Yjs/Automerge) ← future                       │
│  └─> Realtime Layer is transport-agnostic                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           LAYER 6: BACKEND (Already Built)                  │
│  - Express Gateway (REST API)                               │
│  - Socket.IO Server (WebSocket)                             │
│  - Pub/Sub (team rooms)                                     │
│  - AI Streaming (OpenAI SDK)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Refactoring Phases (Step-by-Step)

### **Phase 1: Create Event Bus Layer** (Foundation)

**Goal:** Central event coordination system

**New Files:**
```
frontend/src/core/
├── eventBus/
│   ├── EventBus.ts              # Central pub/sub coordinator
│   ├── EventDeduplicator.ts     # Prevent duplicate events
│   ├── EventTransformer.ts      # Normalize REST + socket payloads
│   ├── RealtimeStore.ts         # Single source of truth for RT data
│   └── types.ts                 # Event type definitions
```

**Implementation:**

```typescript
// EventBus.ts
export class EventBus {
  private subscribers: Map<string, Set<EventCallback>>
  private deduplicator: EventDeduplicator
  
  subscribe(event: string, callback: EventCallback) {
    // Register subscriber
    // Returns unsubscribe function
  }
  
  publish(event: string, payload: unknown) {
    // Check deduplicator
    // Transform payload if needed
    // Notify all subscribers
  }
  
  // Event types:
  // - 'message:created', 'message:updated', 'message:deleted'
  // - 'insight:created', 'insight:updated', 'insight:deleted'
  // - 'team:joined', 'team:left'
  // - 'presence:online', 'presence:offline', 'presence:typing'
}

// EventDeduplicator.ts
export class EventDeduplicator {
  private recentEvents: Map<string, number> // eventId -> timestamp
  
  isDuplicate(eventId: string, ttl: number = 5000): boolean {
    // Check if event seen in last 5 seconds
    // Auto-cleanup old entries
  }
}

// RealtimeStore.ts (Zustand)
export const useRealtimeStore = create((set, get) => ({
  // Single source of truth for all real-time data
  messages: {} as Record<teamId, MessageDTO[]>,
  insights: {} as Record<teamId, AIInsightDTO[]>,
  presence: {} as Record<userId, PresenceStatus>,
  
  // Event Bus subscribes here
  // Services read from here
}))
```

**Why This First?**
- Provides abstraction layer between services and transport
- Services can be refactored one at a time
- Easy rollback if issues arise

---

### **Phase 2: Refactor Domain Services** (Socket-Aware)

**Goal:** Services handle BOTH REST and real-time events

**Files to Modify:**
```
frontend/src/services/
├── messageService.ts           # Add socket awareness
├── insightService.ts           # Add socket awareness
├── teamService.ts              # Add socket awareness
├── presenceService.ts          # NEW: extract from presenceStore
└── index.ts                    # Update exports
```

**Example Refactor (messageService.ts):**

**BEFORE (Current - REST only):**
```typescript
export async function createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
  const response = await api.post<MessageDTO>('/messages', data)
  return response.data
  // Problem: Socket event arrives separately → race condition!
}
```

**AFTER (Socket-aware):**
```typescript
import { eventBus } from '@/core/eventBus'

class MessageService {
  private eventBus: EventBus
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
    this.setupEventListeners()
  }
  
  // API Methods (REST)
  async createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
    // 1. Call REST API (optimistic update)
    const response = await api.post<MessageDTO>('/messages', data)
    
    // 2. Publish to event bus (local state update)
    this.eventBus.publish('message:created', {
      source: 'rest',
      message: response.data,
      requestId: generateId(), // For deduplication
    })
    
    // 3. Socket event will arrive too, but deduplicator prevents double-add
    return response.data
  }
  
  async getMessages(teamId: string): Promise<MessageDTO[]> {
    const response = await api.get<MessageDTO[]>('/messages', { params: { teamId } })
    
    // Publish to event bus (merge with existing)
    this.eventBus.publish('messages:fetched', {
      source: 'rest',
      teamId,
      messages: response.data,
    })
    
    return response.data
  }
  
  // Real-time Event Handlers
  private setupEventListeners() {
    // Subscribe to event bus (not raw sockets!)
    this.eventBus.subscribe('message:new', (payload) => {
      // Socket event arrived from backend
      // EventBus already deduplicated with REST response
      // Just update store
      this.handleMessageCreated(payload.message)
    })
    
    this.eventBus.subscribe('message:edited', (payload) => {
      this.handleMessageUpdated(payload.message)
    })
  }
  
  private handleMessageCreated(message: MessageDTO) {
    // Update RealtimeStore (not Zustand chatStore directly!)
    const store = useRealtimeStore.getState()
    store.addMessage(message.teamId, message)
  }
}

export const messageService = new MessageService(eventBus)
```

**Key Changes:**
1. ✅ Services subscribe to **Event Bus**, not raw sockets
2. ✅ REST responses publish to Event Bus (same channel as socket events)
3. ✅ EventDeduplicator prevents double-adds
4. ✅ Single data flow: REST/Socket → Event Bus → RealtimeStore

**Repeat for:**
- `insightService.ts` (AI insights)
- `teamService.ts` (team operations)
- `presenceService.ts` (online/typing status)

---

### **Phase 3: Bridge Realtime Layer to Event Bus**

**Goal:** Connect existing socket managers to Event Bus

**Files to Modify:**
```
frontend/src/services/
├── socketEventHub.ts           # Publish to Event Bus instead of direct callbacks
└── socketService.ts            # Remove listener methods (use Event Bus)
```

**Changes to `socketEventHub.ts`:**

**BEFORE (Current - Direct callbacks):**
```typescript
class SocketEventHub {
  on(event: string, callback: Function) {
    this.listeners.set(event, callback)
  }
  
  emit(event: string, data: unknown) {
    const callback = this.listeners.get(event)
    callback?.(data)
  }
}
```

**AFTER (Publish to Event Bus):**
```typescript
import { eventBus } from '@/core/eventBus'

class SocketEventHub {
  private eventBus: EventBus
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }
  
  setupSocketBridge(socket: Socket) {
    // Bridge ALL socket events to Event Bus
    socket.on('message:new', (message) => {
      this.eventBus.publish('message:new', {
        source: 'socket',
        message,
        eventId: message.id + Date.now(), // For deduplication
      })
    })
    
    socket.on('ai:insight:new', (insight) => {
      this.eventBus.publish('insight:created', {
        source: 'socket',
        insight,
        eventId: insight.id + Date.now(),
      })
    })
    
    socket.on('presence:update', (data) => {
      this.eventBus.publish('presence:update', {
        source: 'socket',
        ...data,
      })
    })
    
    // ... bridge all other socket events
  }
}
```

**Result:**
- ✅ Socket events flow through Event Bus (not directly to stores)
- ✅ Services subscribe to Event Bus (don't care if source is REST or socket)
- ✅ Transport layer is now swappable

---

### **Phase 4: Simplify Zustand Stores** (Remove Socket Logic)

**Goal:** Stores only handle UI state, not real-time subscriptions

**Files to Modify:**
```
frontend/src/stores/
├── chatStore.ts                # Remove socket listeners, subscribe to services
├── aiInsightsStore.ts          # Remove socket listeners, subscribe to services
└── presenceStore.ts            # Simplify to UI state only
```

**Changes to `chatStore.ts`:**

**BEFORE (Current - Direct socket listeners):**
```typescript
export const useChatStore = create((set, get) => ({
  chat: {},
  messages: [],
  
  // Problem: Store directly listens to sockets!
  initializeSocketListeners: () => {
    socketService.onMessage((message) => {
      get().addMessage(message.teamId, message)
    })
  },
  
  sendMessage: async (data) => {
    const message = await messageService.createMessage(data)
    // Problem: REST response separate from socket event!
    return message
  },
}))
```

**AFTER (Subscribe to RealtimeStore):**
```typescript
export const useChatStore = create((set, get) => ({
  // UI state only (current team, filter, loading)
  currentTeamId: null,
  filter: 'all',
  isLoading: false,
  
  // Data comes from RealtimeStore (single source of truth)
  getMessages: (teamId: string) => {
    const realtimeState = useRealtimeStore.getState()
    return realtimeState.messages[teamId] || []
  },
  
  // Actions delegate to services
  sendMessage: async (data) => {
    set({ isLoading: true })
    try {
      await messageService.createMessage(data)
      // Service handles REST + socket coordination
      // RealtimeStore updates automatically
    } finally {
      set({ isLoading: false })
    }
  },
  
  // No more socket listeners!
}))
```

**Key Changes:**
1. ✅ Store only manages UI state (filters, loading, current team)
2. ✅ Data comes from `RealtimeStore` (single source of truth)
3. ✅ Actions delegate to domain services
4. ✅ No direct socket awareness

**Repeat for:**
- `aiInsightsStore.ts`
- `presenceStore.ts`

---

### **Phase 5: Update Components** (Use Services, Not Sockets)

**Goal:** Components only interact with domain services

**Files to Modify:**
```
frontend/src/components/
├── Chat/
│   ├── MessageList.tsx         # Use messageService
│   ├── ChatWindow.tsx          # Use messageService
│   └── MessageComposer.tsx     # Use messageService
├── RightPanel/
│   ├── RightPanel.tsx          # Use insightService
│   ├── ActionButtons.tsx       # Use insightService
│   └── InsightsList.tsx        # Use insightService
└── Sidebar/
    └── Sidebar.tsx             # Use teamService
```

**Example Changes (MessageList.tsx):**

**BEFORE (Current - Direct store usage):**
```typescript
function MessageList({ teamId }: Props) {
  const messages = useChatStore((state) => state.messages)
  const fetchMessages = useChatStore((state) => state.fetchMessages)
  
  useEffect(() => {
    fetchMessages(teamId)
    socketService.joinTeam(teamId)
    // Problem: Component knows about sockets!
  }, [teamId])
  
  return <div>{messages.map(renderMessage)}</div>
}
```

**AFTER (Service-based):**
```typescript
function MessageList({ teamId }: Props) {
  // Get data from RealtimeStore (auto-updates)
  const messages = useRealtimeStore((state) => state.messages[teamId] || [])
  
  useEffect(() => {
    // Service handles everything (REST + socket coordination)
    messageService.subscribeToTeam(teamId)
    
    return () => {
      messageService.unsubscribeFromTeam(teamId)
    }
  }, [teamId])
  
  // No socket awareness!
  return <div>{messages.map(renderMessage)}</div>
}
```

**Key Changes:**
1. ✅ Component subscribes to `RealtimeStore` (reactive)
2. ✅ Actions call domain services (`messageService.subscribeToTeam`)
3. ✅ Service handles REST API + socket room joining
4. ✅ No direct socket imports

---

### **Phase 6: App-Level Initialization** (Clean Bootstrap)

**Goal:** Single initialization flow, clear lifecycle

**Files to Modify:**
```
frontend/src/
├── App.tsx                     # Simplify to service initialization only
└── core/
    └── bootstrap.ts            # NEW: App initialization orchestrator
```

**New `bootstrap.ts`:**
```typescript
export class AppBootstrap {
  private eventBus: EventBus
  private socketEventHub: SocketEventHub
  private services: {
    message: MessageService
    insight: InsightService
    team: TeamService
    presence: PresenceService
  }
  
  async initialize(userId: string) {
    // 1. Initialize Event Bus
    this.eventBus = new EventBus()
    
    // 2. Initialize domain services (subscribe to Event Bus)
    this.services = {
      message: new MessageService(this.eventBus),
      insight: new InsightService(this.eventBus),
      team: new TeamService(this.eventBus),
      presence: new PresenceService(this.eventBus),
    }
    
    // 3. Connect socket and bridge to Event Bus
    await socketService.connect(userId)
    this.socketEventHub = new SocketEventHub(this.eventBus)
    this.socketEventHub.setupSocketBridge(socketService.getSocket()!)
    
    // 4. Start realtime managers
    socketHealthMonitor.start(socketService.getSocket()!)
    socketConnectionManager.setState('connected')
    
    // 5. Fetch initial data
    await Promise.all([
      this.services.team.fetchUserTeams(userId),
      this.services.presence.connect(userId),
    ])
    
    return this.services
  }
  
  async cleanup() {
    // Proper shutdown order
    socketHealthMonitor.stop()
    socketRoomManager.clearAll()
    socketService.disconnect()
    this.eventBus.clear()
  }
}
```

**Simplified `App.tsx`:**
```typescript
function App() {
  const [services, setServices] = useState<AppServices | null>(null)
  
  useEffect(() => {
    const bootstrap = new AppBootstrap()
    
    bootstrap.initialize('user1').then((svcs) => {
      setServices(svcs)
    })
    
    return () => {
      bootstrap.cleanup()
    }
  }, [])
  
  if (!services) return <LoadingScreen />
  
  return (
    <ServicesProvider value={services}>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <ChatWindow />
        <RightPanel />
      </div>
    </ServicesProvider>
  )
}
```

**Key Changes:**
1. ✅ Single initialization entry point
2. ✅ Clear dependency order (Event Bus → Services → Socket Bridge)
3. ✅ Proper cleanup on unmount
4. ✅ Services provided via React Context (no global singletons)

---

## Migration Strategy (Safe Rollout)

### **Week 1: Foundation (No Breaking Changes)**
- ✅ Create Event Bus infrastructure
- ✅ Create RealtimeStore (parallel to existing stores)
- ✅ Add EventDeduplicator
- ✅ Test Event Bus in isolation

### **Week 2: Services (One at a Time)**
- ✅ Refactor `messageService` to socket-aware
- ✅ Test message flow: REST + socket → Event Bus → RealtimeStore
- ✅ Keep old `chatStore` working (dual write)
- ✅ Verify no regressions

### **Week 3: Bridge Realtime Layer**
- ✅ Connect `socketEventHub` to Event Bus
- ✅ Refactor `insightService` to socket-aware
- ✅ Test AI insights flow
- ✅ Verify deduplication works

### **Week 4: Stores Simplification**
- ✅ Refactor `chatStore` to use RealtimeStore
- ✅ Remove socket listeners from stores
- ✅ Test all components still work
- ✅ Delete old socket listener code

### **Week 5: Component Updates**
- ✅ Update all components to use services
- ✅ Remove direct socket imports
- ✅ Test full user flows
- ✅ Performance testing

### **Week 6: Cleanup + Documentation**
- ✅ Remove deprecated code
- ✅ Update architecture docs
- ✅ Add migration guide
- ✅ Final integration tests

---

## Benefits After Refactoring

### **Developer Experience**
- ✅ Clear separation of concerns (UI → Services → Event Bus → Transport)
- ✅ Easy to add new features (just extend Event Bus events)
- ✅ Testable (mock Event Bus, not sockets)
- ✅ No more race conditions (single event coordinator)

### **Performance**
- ✅ Automatic deduplication (REST + socket events)
- ✅ Efficient re-renders (RealtimeStore is normalized)
- ✅ Easy to add optimistic updates
- ✅ Queue resilience (events replay on reconnect)

### **Flexibility**
- ✅ Swap transport layer (WebSocket → WebRTC) without changing services
- ✅ Add GraphQL subscriptions alongside REST
- ✅ Easy to add CRDT sync later
- ✅ Services can work offline (queue events)

### **Debugging**
- ✅ Event Bus logs all events (single source of truth)
- ✅ Can replay events for debugging
- ✅ Clear data flow (no "ghost updates")
- ✅ Easy to add event monitoring

---

## File Structure After Refactoring

```
frontend/src/
├── core/                         # NEW: Core infrastructure
│   ├── eventBus/
│   │   ├── EventBus.ts
│   │   ├── EventDeduplicator.ts
│   │   ├── EventTransformer.ts
│   │   ├── RealtimeStore.ts     # Single source of truth
│   │   └── types.ts
│   ├── bootstrap.ts             # App initialization
│   └── ServicesProvider.tsx     # React context for services
│
├── services/                     # REFACTORED: Socket-aware
│   ├── domain/                  # NEW: Domain services
│   │   ├── MessageService.ts    # REST + realtime aware
│   │   ├── InsightService.ts    # REST + realtime aware
│   │   ├── TeamService.ts       # REST + realtime aware
│   │   ├── PresenceService.ts   # NEW: Extracted from store
│   │   └── index.ts
│   │
│   ├── realtime/                # Existing socket managers
│   │   ├── socketService.ts     # SIMPLIFIED: Transport only
│   │   ├── socketEventHub.ts    # MODIFIED: Publishes to Event Bus
│   │   ├── socketConnectionManager.ts
│   │   ├── socketHealthMonitor.ts
│   │   ├── socketRoomManager.ts
│   │   └── socketEventQueue.ts
│   │
│   └── api.ts                   # REST client (unchanged)
│
├── stores/                       # SIMPLIFIED: UI state only
│   ├── chatStore.ts             # REFACTORED: No socket listeners
│   ├── aiInsightsStore.ts       # REFACTORED: No socket listeners
│   ├── teamStore.ts             # REFACTORED: Reads from RealtimeStore
│   ├── userStore.ts             # (unchanged)
│   └── presenceStore.ts         # DELETED: Moved to PresenceService
│
├── components/                   # UPDATED: Use services
│   ├── Chat/
│   │   ├── MessageList.tsx      # Uses messageService
│   │   ├── ChatWindow.tsx       # Uses messageService
│   │   └── MessageComposer.tsx  # Uses messageService
│   │
│   ├── RightPanel/
│   │   ├── RightPanel.tsx       # Uses insightService
│   │   ├── ActionButtons.tsx    # Uses insightService
│   │   └── InsightsList.tsx     # Uses insightService
│   │
│   └── Sidebar/
│       └── Sidebar.tsx          # Uses teamService
│
└── App.tsx                       # SIMPLIFIED: Bootstrap only
```

---

## Testing Strategy

### **Unit Tests**
```typescript
// EventBus.test.ts
describe('EventBus', () => {
  it('should deduplicate events with same ID', () => {
    const bus = new EventBus()
    const callback = jest.fn()
    
    bus.subscribe('message:created', callback)
    
    bus.publish('message:created', { id: '123', eventId: 'evt-1' })
    bus.publish('message:created', { id: '123', eventId: 'evt-1' }) // Duplicate
    
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

// MessageService.test.ts
describe('MessageService', () => {
  it('should handle REST and socket events without duplication', async () => {
    const service = new MessageService(mockEventBus)
    
    // Simulate REST response
    await service.createMessage({ content: 'Hello' })
    
    // Simulate socket event arrives (duplicate)
    mockEventBus.publish('message:new', { id: '123' })
    
    const messages = useRealtimeStore.getState().messages
    expect(messages).toHaveLength(1) // Not 2!
  })
})
```

### **Integration Tests**
```typescript
// Full flow: User sends message → REST API → Socket broadcast → UI update
describe('Message Flow', () => {
  it('should sync message across REST and socket channels', async () => {
    // 1. User sends message (REST)
    await messageService.createMessage({ content: 'Test' })
    
    // 2. Simulate socket event arrives
    mockSocket.emit('message:new', { id: '123', content: 'Test' })
    
    // 3. Check UI receives message exactly once
    const messages = screen.getAllByTestId('message-bubble')
    expect(messages).toHaveLength(1)
  })
})
```

---

## Rollback Plan

**If refactoring introduces bugs:**

1. **Event Bus issues** → Revert to direct socket listeners (1 day)
2. **Service issues** → Keep old REST-only services (2 days)
3. **Store issues** → Revert store changes, keep services (3 days)
4. **Full rollback** → Git revert entire branch (1 hour)

**Safety nets:**
- Feature flags for new Event Bus system
- Parallel implementation (old + new side-by-side)
- Incremental rollout (one service at a time)
- Extensive logging for debugging

---

## Success Criteria

### **Functional Requirements**
- ✅ All existing features work (messages, insights, typing, presence)
- ✅ No race conditions (REST vs socket)
- ✅ No duplicate messages/insights
- ✅ Real-time updates still instant

### **Code Quality**
- ✅ Components don't import socket services
- ✅ Services handle both REST + real-time
- ✅ Single source of truth (RealtimeStore)
- ✅ Clear data flow (UI → Services → Event Bus → Transport)

### **Performance**
- ✅ No regression in render performance
- ✅ Event deduplication works (< 5ms overhead)
- ✅ Memory usage stable (no leaks from event listeners)

### **Developer Experience**
- ✅ New features easy to add (just extend Event Bus)
- ✅ Clear testing strategy
- ✅ Documentation updated
- ✅ Migration guide for team

---

## Next Steps

1. **Review this plan** with team
2. **Spike Event Bus implementation** (2 days)
3. **Refactor messageService** as proof-of-concept (3 days)
4. **Test message flow** end-to-end (2 days)
5. **Decide on rollout** (incremental vs big bang)

---

**Estimated Timeline:** 6 weeks  
**Risk Level:** Medium (incremental rollout reduces risk)  
**Team Buy-in Required:** Yes (architecture change affects all devs)

