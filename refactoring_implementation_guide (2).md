# Production Refactoring Implementation Guide

**Project**: FYP AI - Collaborative Team AI Assistant  
**Purpose**: Step-by-step refactoring plan to production-ready architecture  
**Timeline**: 9-10 weeks across 4 phases  
**Target**: Claude Sonnet 4.5 / GitHub Copilot implementation

---

## EXECUTIVE SUMMARY

### What We're Fixing
- Event Bus adds 3 layers of unnecessary complexity
- Non-normalized data causes duplication and slow lookups
- 6 overlapping stores with unclear ownership
- Race conditions between REST and Socket events
- Missing production infrastructure (validation, caching, monitoring)
- Security vulnerabilities (hardcoded auth, no input validation)

### Target State
- Direct flow: Services → Stores → Components
- Normalized EntityStore with O(1) lookups
- 3 focused stores: EntityStore, UIStore, SessionStore
- Socket-first with optimistic updates
- Production-ready: validation, caching, job queue, observability
- Foundation for RAG and multi-agent systems

---

## PHASE 1: CRITICAL FIXES (Week 1-2)

### 1.1: Remove Event Bus Architecture

**Delete These Files:**
```
frontend/src/core/eventBus/EventBus.ts
frontend/src/core/eventBus/EventTransformer.ts
frontend/src/core/eventBus/EventDeduplicator.ts
frontend/src/core/eventBus/bridge.ts
frontend/src/services/realtime/socketBridge.ts
```

**Modify RealtimeProvider:**
- Remove Event Bus initialization
- Remove Event Bridge initialization
- Keep only: store initialization, socket connection, direct socket handlers
- Socket handlers call store methods directly

**Modify Services:**
- Remove Event Bus publishing after API calls
- Call store methods directly after successful API response
- Return typed response or throw typed error
- No more EventTransformer usage

**New Flow:**
```
API Success → Store.updateMethod() → Component re-renders
Socket Event → Store.updateMethod() → Component re-renders
```

---

### 1.2: Create Normalized EntityStore

**Create: `frontend/src/stores/entityStore.ts`**

**State Structure:**
```typescript
state: {
  entities: {
    users: Record<userId, UserDTO>
    teams: Record<teamId, TeamDTO>
    messages: Record<messageId, MessageDTO>
    insights: Record<insightId, InsightDTO>
  }
  
  relationships: {
    teamMessages: Record<teamId, messageId[]>
    teamInsights: Record<teamId, insightId[]>
    teamMembers: Record<teamId, userId[]>
    userTeams: Record<userId, teamId[]>
  }
}
```

**Core Methods:**
```
Users:
- addUser(user)
- updateUser(userId, updates)
- getUser(userId) → UserDTO | EMPTY_USER
- getUsers(userIds) → UserDTO[]

Teams:
- addTeam(team)
- updateTeam(teamId, updates)
- getTeam(teamId) → TeamDTO | EMPTY_TEAM

Messages:
- addMessage(message) → adds to entities + relationships
- updateMessage(messageId, updates)
- deleteMessage(messageId, teamId)
- getMessage(messageId)
- getTeamMessages(teamId) → messageId[] | EMPTY_ARRAY
- getTeamMessagesWithData(teamId) → MessageDTO[] with users populated

Insights:
- addInsight(insight)
- updateInsight(insightId, updates)
- deleteInsight(insightId, teamId)
- getTeamInsights(teamId) → insightId[] | EMPTY_ARRAY
- getTeamInsightsWithData(teamId) → InsightDTO[]

Optimistic Updates:
- addOptimisticMessage(tempMessage, correlationId)
- confirmMessage(correlationId, serverMessage)
- removeOptimisticMessage(tempId)
```

**Key Pattern: Stable Empty References**
```typescript
const EMPTY_USER = Object.freeze({...emptyUserShape})
const EMPTY_TEAM = Object.freeze({...emptyTeamShape})
const EMPTY_ARRAY = Object.freeze([])

// Always return same reference for empty
getTeamMessages: (teamId) => 
  state.relationships.teamMessages[teamId] || EMPTY_ARRAY
```

---

### 1.3: Migrate from RealtimeStore to EntityStore

**Strategy: Gradual Migration**

**Step A: Wrapper Phase**
- Keep RealtimeStore temporarily
- All methods delegate to EntityStore
- Test everything works

**Step B: Create Selector Hooks**
```typescript
useTeamMessages(teamId) → memoized MessageDTO[]
useTeamInsights(teamId) → memoized InsightDTO[]
useTeamMembers(teamId) → memoized UserDTO[]
useUser(userId) → UserDTO | null
useCurrentTeam() → TeamDTO | null
```

**Step C: Update Components One-by-One**
- Replace RealtimeStore imports with hooks
- Test each component thoroughly
- Verify no performance regression

**Step D: Delete RealtimeStore**
- Verify no references remain
- Delete file
- Update imports in all components

---

### 1.4: Fix Authentication System

**Create Files:**
```
frontend/src/stores/authStore.ts
frontend/src/services/authService.ts
frontend/src/components/Auth/LoginForm.tsx
frontend/src/components/Auth/ProtectedRoute.tsx
backend/src/middleware/authMiddleware.ts
backend/src/routes/authRoutes.ts
```

**AuthStore State:**
```typescript
{
  currentUser: UserDTO | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}
```

**AuthStore Methods:**
```
login(email, password) → POST /api/auth/login
logout() → clear tokens, disconnect socket
refreshAccessToken() → POST /api/auth/refresh
verifyToken() → validate token on app mount
```

**Token Storage:**
- AccessToken: in-memory only (AuthStore)
- RefreshToken: httpOnly cookie (set by backend)
- Never use localStorage (XSS risk)

**Backend Auth Middleware:**
```
1. Extract Bearer token from Authorization header
2. Verify JWT signature and expiration
3. Attach userId to request
4. Call next() or return 401
```

**Main.tsx Changes:**
- Remove hardcoded `userId="user1"`
- Call `authStore.verifyToken()` on mount
- If valid: set user, connect socket
- If invalid: redirect to /login

---

### 1.5: Add Input Validation with Zod

**Create Files:**
```
shared/schemas/userSchemas.ts
shared/schemas/teamSchemas.ts
shared/schemas/messageSchemas.ts
shared/schemas/insightSchemas.ts
frontend/src/utils/validation.ts
backend/src/middleware/validationMiddleware.ts
```

**Define Schemas:**
```typescript
MessageDTOSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  contentType: z.enum(['text', 'code', 'image']),
  createdAt: z.date(),
  updatedAt: z.date()
})

CreateMessageSchema = MessageDTOSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})
```

**Frontend Validation:**
```typescript
validateAndParse<T>(schema, data) → T or throw error
```

**Backend Validation Middleware:**
```typescript
validate(schema) → Express middleware
// Validates req.body, attaches parsed data to req.validated
```

**Apply to All Endpoints:**
```typescript
app.post('/api/messages', 
  validate(CreateMessageSchema), 
  messageController.create
)
```

---

## PHASE 2: STABILITY IMPROVEMENTS (Week 3-4)

### 2.1: Consolidate into Three Core Stores

**Create: `frontend/src/stores/uiStore.ts`**
```typescript
state: {
  currentTeamId: string | null
  loadingStates: Record<string, boolean>
  errorStates: Record<string, string | null>
  preferences: { theme, layout, sidebarCollapsed }
  viewStates: { 
    insightFilters: Record<teamId, FilterState>
    scrollPositions: Record<teamId, number>
    expandedInsights: Set<insightId>
  }
}
```

**Create: `frontend/src/stores/sessionStore.ts`**
```typescript
state: {
  currentUser: UserDTO | null
  socket: { isConnected, isReconnecting, reconnectAttempts }
  presence: { 
    onlineUsers: Set<userId>
    typingUsers: Record<teamId, userId[]>
  }
  apiStatus: {
    inFlightRequests: Map<requestId, metadata>
  }
}
```

**Delete These Stores:**
```
chatStore.ts → split to EntityStore + UIStore
aiInsightsStore.ts → split to EntityStore + UIStore
teamStore.ts → move to EntityStore + UIStore
presenceStore.ts → move to SessionStore
userStore.ts → move to SessionStore
```

**Migration Strategy:**
1. Extract logic into new stores
2. Create temporary compatibility layer
3. Update components one by one
4. Remove compatibility layer
5. Delete old stores

---

### 2.2: Implement Proper Socket Management

**Create: `frontend/src/services/SocketManager.ts`**

**Features:**
- Connection with exponential backoff
- Automatic reconnection (max 5 attempts)
- Offline message queue
- Room management (auto-join/leave)
- Heartbeat (ping every 30s)
- Lifecycle events

**State Tracking:**
```typescript
connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
reconnectAttempts: number
offlineQueue: Array<{event, data, timestamp}>
currentRooms: Set<teamId>
```

**Reconnection Strategy:**
```
Attempt 1: wait 1s
Attempt 2: wait 2s
Attempt 3: wait 4s
Attempt 4: wait 8s
Attempt 5: wait 16s
Max 5 attempts then show error
```

**Offline Queue:**
- Store messages sent while disconnected
- Max 100 messages
- Max age 5 minutes
- Send in order on reconnection

**Room Management:**
- Auto-join current team room
- Auto-rejoin all rooms on reconnection
- Leave room when team changes

---

### 2.3: Fix Typing Indicators Performance

**Change Storage Structure:**
```typescript
// Old (triggers full Map re-render)
typingUsers: Map<teamId, Set<userId>>

// New (only affects specific team)
typingUsers: Record<teamId, {
  users: userId[]
  lastUpdate: timestamp
}>
```

**Client-Side Debouncing:**
```
1. User types → debounce 500ms
2. Still typing after 500ms → emit 'typing:start'
3. User stops → emit 'typing:stop' immediately
4. Auto-emit 'typing:stop' after 3s no input
5. Cancel all timers on unmount
```

**Server-Side TTL:**
```
Maintain: Map<teamId, Map<userId, timestamp>>

On 'typing:start':
- Add user with timestamp
- Broadcast only if set changed

Cleanup (every 5s):
- Remove entries >5s old
- Broadcast if changed
```

**Component Optimization:**
```typescript
// Subscribe to specific team only
const typingUsers = useSessionStore(
  state => state.presence.typingUsers[teamId] || []
)

// Memoize filtering
const displayNames = useMemo(
  () => typingUsers.map(uid => users[uid]?.name),
  [typingUsers, users]
)
```

---

### 2.4: Add Error Tracking and Monitoring

**Setup Sentry (or alternative):**
```
Frontend: @sentry/react
Backend: @sentry/node

Initialize with:
- DSN from environment
- Environment (dev/staging/prod)
- Release version
- User context after auth
```

**Create ErrorBoundary:**
```typescript
<ErrorBoundary name="MessageList">
  - Catches React errors
  - Logs to Sentry with stack
  - Shows fallback UI
  - Provides retry button
</ErrorBoundary>
```

**Create ErrorService:**
```typescript
captureException(error, context)
captureMessage(message, level, context)
setUser(user)
addBreadcrumb(category, message, data)
```

**Service Error Pattern:**
```typescript
try {
  const response = await api.post(url, data)
  return response
} catch (error) {
  ErrorService.captureException(error, { 
    action, teamId, userId 
  })
  
  // Transform to user-friendly
  if (error.status === 429) {
    throw new AppError('Rate limit exceeded', 'RATE_LIMIT')
  }
  throw new AppError('Operation failed', 'UNKNOWN')
}
```

---

## PHASE 3: PERFORMANCE & SCALE (Week 5-6)

### 3.1: Implement Caching Layer

**Setup Redis:**
```
Backend: ioredis
Configuration: host, port, connection pooling
Health check endpoint
```

**Create CacheService:**
```typescript
getConversationContext(teamId) → cached messages
setConversationContext(teamId, messages, ttl=300s)
getAIResponse(promptHash) → cached AI response
setAIResponse(promptHash, response, ttl=3600s)
invalidateTeamCache(teamId)
```

**Cache Middleware:**
```typescript
cache(keyGenerator, ttl) → Express middleware

app.get('/api/teams', 
  cache(req => `user:${req.userId}:teams`, 600),
  teamController.getTeams
)
```

**Invalidation Strategy:**
```
On message create → invalidate conversation:{teamId}:context
On team update → invalidate team:{teamId}:*
On member change → invalidate team:{teamId}:members
```

---

### 3.2: Create Robust API Client

**Create: `frontend/src/services/apiClient.ts`**

**Features:**
- Centralized fetch wrapper
- Auto auth token injection
- Retry with exponential backoff
- Request cancellation (AbortController)
- Loading state coordination
- Error transformation

**Retry Logic:**
```
Retry on:
- Network errors
- 5xx server errors
- 429 rate limit
- Timeout

Don't retry:
- 4xx client errors (except 429)
- User cancellations

Backoff: 1s, 2s, 4s with jitter
```

**Token Refresh:**
```
Request interceptor:
1. Get accessToken from SessionStore
2. If expired: refresh first
3. Add Authorization header
4. Proceed

Response interceptor:
1. If 401: attempt token refresh
2. Retry original request
3. If refresh fails: logout
```

**Create: `frontend/src/hooks/useApiMutation.ts`**
```typescript
useApiMutation({
  mutationFn,
  onSuccess,
  onError
}) → { mutate, isLoading, error }
```

---

### 3.3: Add Observability and Analytics

**Frontend Analytics:**
```typescript
AnalyticsService.track(
  'message:sent',
  { teamId, contentLength, hasAttachments }
)

Track:
- Feature usage
- User actions
- Session duration
- Error occurrences
- Performance metrics
```

**Frontend Metrics:**
```typescript
MetricsService tracks:
- API response times per endpoint
- Component render times
- Socket latency
- Memory usage
- UI responsiveness

Send batch to backend every 60s
```

**Backend Metrics Middleware:**
```typescript
Tracks:
- Request count per endpoint
- Response time percentiles
- Error rate per endpoint
- Active WebSocket connections
- Database query times
- Cache hit/miss rates
```

**Monitoring Dashboard:**
```
Display:
- Real-time active users
- Messages per minute
- API response time graph
- Error rate graph
- Queue length
- Resource usage

Alert thresholds:
- Error rate > 5%
- API p99 > 3s
- Queue length > 100
```

---

## PHASE 4: ADVANCED FEATURES FOUNDATION (Week 7-10)

### 4.1: Implement Message Processing Pipeline

**Create: `backend/src/services/embeddingService.ts`**

**Methods:**
```typescript
generateEmbedding(text) → calls OpenAI API
generateBatch(texts[]) → batch processing
storeEmbedding(messageId, embedding) → save to vector DB
searchSimilar(queryEmbedding, teamId, limit)
```

**Setup Vector Database:**
```
Option A: pgvector (recommended for start)
- Add pgvector extension to PostgreSQL
- Create embeddings table with vector column
- Create IVFFlat index
- Store metadata as JSON

Option B: Pinecone (for scale)
- Create index with 1536 dimensions
- Namespace by teamId
- Store metadata
```

**Message Preprocessing:**
```
Before embedding:
1. Extract text content
2. Remove @mentions
3. Truncate to 8000 tokens
4. Clean special characters
5. Optionally include previous message for context
```

**Queue Embedding Generation:**
```
Don't block message creation:
1. Message created and stored
2. Job queued: {type: 'generate-embedding', messageId}
3. Background worker picks up
4. Worker generates and stores embedding
5. Mark job complete

Retry 3 times on failure
```

---

### 4.2: Implement Background Job Queue

**Setup BullMQ:**
```
Queues:
- embeddingQueue → generate embeddings
- aiAgentQueue → run agent pipelines
- insightQueue → generate summaries/reports
- scheduledQueue → periodic tasks

Configuration:
- Redis for queue storage
- Concurrency: 5-10 per worker
- Retry strategy per queue
- Timeout per queue
```

**Create Workers:**

**EmbeddingWorker:**
```typescript
Process:
1. Fetch message from DB
2. Generate embedding
3. Store in vector DB
4. Mark complete

Concurrency: 10 parallel
Timeout: 30s per job
```

**AIAgentWorker:**
```typescript
Process:
1. Load conversation context
2. Run agents in pipeline sequentially
3. Store outputs
4. Emit socket events
5. Mark complete

Concurrency: 5 parallel (LLM calls slow)
Timeout: 120s per job
```

**InsightWorker:**
```typescript
Process:
1. Fetch messages for team
2. Use embeddings for key topics
3. Call LLM to generate
4. Store insight
5. Emit socket event

Concurrency: 3 parallel (expensive)
Timeout: 180s per job
```

**Scheduled Tasks:**
```
- Daily summary: end of day for active teams
- Weekly report: Monday morning
- Cleanup old embeddings: messages >6 months
- Cache warmup: pre-load common contexts
```

---

### 4.3: Implement RAG Context Retrieval

**Create: `backend/src/services/ragService.ts`**

**Methods:**
```typescript
getRelevantContext(query, teamId, limit) → semantic search
getConversationContext(teamId, options) → recent + relevant
getSimilarMessages(messageId, limit)
getTopicClusters(teamId)
```

**Semantic Search Process:**
```
1. Generate embedding for query
2. Search vector DB for similar
3. Filter by teamId
4. Apply recency boost
5. Deduplicate similar messages
6. Return top K with metadata
```

**Create: `backend/src/services/contextAssembler.ts`**

**Context Assembly:**
```
Token Budget Allocation:
- 20% system prompt
- 30% recent messages (working memory)
- 30% retrieved messages (RAG)
- 20% structured state (needs, decisions)

Process:
1. Prioritize recent 10-20 messages
2. Fill with relevant retrieved messages
3. Add structured data
4. Compress if over budget
```

**Recency Boost:**
```
score = similarity_score * recency_weight

Weights:
- <1 hour: 1.5x
- <1 day: 1.2x
- <1 week: 1.0x
- <1 month: 0.8x
- >1 month: 0.5x
```

**Conversation State Caching:**
```
Cache key: team:{teamId}:context
Value: {recentMessages, needs, decisions, lastUpdate}
TTL: 5 minutes

Invalidate on:
- New message
- Need confirmed
- Decision made
```

---

### 4.4: Implement Multi-Agent Orchestration

**Create Base Agent:**
```typescript
abstract class BaseAgent {
  name: string
  systemPrompt: string
  model: string
  timeout: number
  
  abstract process(input, context) → output
  abstract validate(input) → boolean
}
```

**Create Specialized Agents:**

**NeedsDiscoveryAgent:**
```
Input: new message, context, existing needs
Process: extract explicit/implicit/latent needs
Output: { needs[], confidence scores }
```

**ValueAssessorAgent:**
```
Input: potential contribution, context, settings
Process: score on relevance, novelty, actionability, risk, timeliness
Output: { scores, compositeScore, shouldContribute, reasoning }
```

**QuestionRankerAgent:**
```
Input: potential questions, context, preferences
Process: group, prioritize, order
Output: { questionGroups, suggestedNext, batchSize }
```

**SolutionGeneratorAgent:**
```
Input: confirmed needs, context, domain knowledge
Process: retrieve via RAG, generate solution, create traceability
Output: { solution, traceabilityMap, alternatives }
```

**Create AgentOrchestrator:**
```typescript
runPipeline(name, input, context)
registerAgent(agent)
definePipeline(name, agentSequence)

Pipelines:
- 'message-processing': [NeedsDiscoveryAgent]
- 'proactive-check': [ValueAssessorAgent]
- 'clarification': [QuestionRankerAgent]
- 'solution-generation': [SolutionGeneratorAgent]

Execution modes:
- Sequential: one after another
- Parallel: independent agents concurrent
- Conditional: next depends on previous
```

---

### 4.5: Implement Proactive Contribution Engine

**Create: `backend/src/services/signalDetector.ts`**

**Signals to Detect:**
```
1. Inactivity: no messages for N seconds
2. Confusion: unanswered questions, reformulations
3. Topic drift: semantic distance from goal
4. Stalemate: back-and-forth without progress

Emit events: 'proactivity:inactivity', etc.
```

**Create: `backend/src/services/contributionGenerator.ts`**

**Generate Contributions:**
```
Based on signal:
- Inactivity → "Summarize what we've discussed?"
- Confusion → Answer question or clarify
- Drift → "Refocus on [topic]?"
- Stalemate → Suggest decision framework

Use RAG for context
Call LLM to generate
Return for value assessment
```

**Create: `backend/src/services/proactivityService.ts`**

**Main Flow:**
```
1. SignalDetector emits trigger
2. Check proactivity enabled
3. Check contribution frequency
4. Generate potential contribution
5. Run ValueAssessorAgent
6. If score > threshold: post
7. Else: suppress and log
```

**Frequency Limiting:**
```
Track AI contributions per team
Maintain 20-30% ratio max
If exceeded: increase threshold
Reset after user messages
```

**Dynamic Threshold Adjustment:**
```
Adjust based on:
- Time of day (+2 evening/night)
- Conversation pace (+3 rapid, -1 slow)
- Recent AI frequency (+2 if in last 3)
- User feedback (+1 if dismissed, -0.5 if engaged)
```

---

## DEPLOYMENT & VALIDATION

### Pre-Production Checklist

**Security:**
- [ ] All endpoints have authentication
- [ ] Input validation everywhere
- [ ] Rate limiting implemented
- [ ] CORS configured
- [ ] CSRF protection enabled
- [ ] XSS sanitization
- [ ] Secrets in environment variables
- [ ] HTTPS enforced

**Performance:**
- [ ] API p95 < 500ms
- [ ] First load < 2s
- [ ] Socket connection < 1s
- [ ] Message display < 1s
- [ ] No memory leaks
- [ ] Queries optimized

**Functionality:**
- [ ] All features work end-to-end
- [ ] Real-time sync works
- [ ] Offline queue works
- [ ] Reconnection works
- [ ] Error handling graceful
- [ ] Mobile responsive

**Monitoring:**
- [ ] Error tracking live
- [ ] Metrics collection working
- [ ] Alerts configured
- [ ] Dashboard accessible

### Deployment Strategy

**Blue-Green Deployment:**
```
1. Deploy to green environment
2. Run smoke tests
3. Switch 10% traffic (canary)
4. Monitor for 1 hour
5. If good: 50% traffic
6. Monitor for 1 hour
7. If good: 100% traffic
8. Keep blue for 24h (rollback ready)
```

**Rollback Criteria:**
```
Instant rollback if:
- Error rate > 5%
- API p95 > 3s
- Socket failures > 10%
- Data corruption detected
```

### Post-Deployment

**First 24 Hours:**
- Monitor error rates continuously
- Check API response times
- Verify socket stability
- Confirm no data issues
- Review user feedback
- Check resource usage

**First Week:**
- Analyze engagement metrics
- Review error patterns
- Identify bottlenecks
- Gather user feedback
- Monitor costs
- Test backups

**First Month:**
- Security audit
- Analyze usage patterns
- Identify optimizations
- Plan next iterations
- Review technical debt
- Team retrospective

---

## QUICK REFERENCE

### New Data Flow

**Message Send:**
```
User → useSendMessage()
→ EntityStore.addOptimistic(tempMsg)
→ UI updates instantly
→ messageService.create(data, correlationId)
→ API POST
→ Backend saves, queues job, emits socket
→ Socket: message:new arrives
→ EntityStore.confirmMessage(correlationId, serverMsg)
→ UI updates with final (no duplicate)
```

**AI Insight:**
```
User → useGenerateSummary()
→ UIStore.setLoading(true)
→ insightService.generate(teamId)
→ API POST
→ Backend queues job, returns jobId
→ Worker: fetch → RAG → LLM → store → emit
→ Socket: insight:created
→ EntityStore.addInsight(insight)
→ UIStore.setLoading(false)
→ UI shows insight
```

### Store Responsibilities

**EntityStore:** All domain entities, normalized, relationships, CRUD, optimistic updates

**UIStore:** Route/team selection, loading/error states, preferences, view state

**SessionStore:** Authenticated user, socket state, presence, typing, in-flight requests

### Success Criteria

**Phase 1 Done (Week 2):**
- Event Bus removed
- EntityStore operational
- Auth functional
- Validation everywhere

**Phase 2 Done (Week 4):**
- 3 stores only
- SocketManager working
- Typing performant
- Error tracking live

**Phase 3 Done (Week 6):**
- Caching operational
- API client robust
- Observability working
- Metrics collecting

**Phase 4 Done (Week 10):**
- Embeddings auto-generating
- Vector DB operational
- Job queue processing
- RAG context retrieval working
- Agent orchestration ready
- Proactive contributions functional

---

**END OF GUIDE**