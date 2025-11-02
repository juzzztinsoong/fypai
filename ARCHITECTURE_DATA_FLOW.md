# Application Architecture & Data Flow

**Project**: FYP AI - Collaborative Team AI Assistant  
**Last Updated**: October 22, 2025  
**Purpose**: Understand complete data flow to prevent React re-render and state management issues

---

## Architecture Overview

This is a **real-time collaborative chat application** with AI assistance, using a modern **Event Bus architecture** to coordinate between REST APIs, WebSocket events, and UI state.

### Three-Column Layout

```
┌─────────────┬──────────────────────┬──────────────────────┐
│  Sidebar    │   Main Chat          │   AI Insights        │
│  (Teams)    │   (Messages)         │   (Summaries/AI)     │
└─────────────┴──────────────────────┴──────────────────────┘
```

---

## Core Architecture Pattern: Event Bus

### The Central Data Flow

```
User Action
  ↓
Service Layer (REST API call)
  ↓
Event Bus (publish domain event)
  ↓
Event Bridge (subscribes to Event Bus)
  ↓
RealtimeStore (single source of truth - updates state)
  ↓
React Components (re-render via Zustand subscriptions)
```

**Parallel Path (Real-time):**

```
Backend Event (new message from another user)
  ↓
Socket.IO Broadcast
  ↓
Socket Bridge (transforms socket event → domain event)
  ↓
Event Bus (publish domain event)
  ↓
Event Deduplicator (prevents REST + Socket duplicates)
  ↓
Event Bridge → RealtimeStore → React Components
```

**Key Insight**: REST responses and Socket events flow through the **same Event Bus**, ensuring consistency and preventing duplicate state updates.

---

## Frontend Architecture

### 1. Entry Point & Initialization

**File**: `frontend/src/main.tsx`
- Wraps app in `<RealtimeProvider>` with hardcoded `userId="user1"`
- Renders `<App />` inside

**File**: `frontend/src/providers/RealtimeProvider.tsx`
- **Purpose**: Initialize real-time infrastructure before app renders
- **What it does**:
  1. Initialize Event Bridge (Event Bus → RealtimeStore)
  2. Connect to WebSocket via `presenceStore.connect(userId)`
  3. Initialize Socket Bridge (Socket.IO → Event Bus)
  4. Enable Event Bus logging
  5. Only renders children when all connections ready
- **What it passes**: Nothing (context-free, uses singleton services)
- **State**: `isReady`, `error` (loading/error UI states)

**File**: `frontend/src/App.tsx`
- **Purpose**: Main layout container, initializes user/team data
- **What it does**:
  1. Fetch user profile (`fetchUser('user1')`)
  2. Fetch teams for user (`fetchTeams('user1')`)
  3. Render three-column layout: `<Sidebar />`, `<ChatWindow />`, `<RightPanel />`
- **Stores used**: `useTeamStore`, `useUserStore`
- **What it passes**: Nothing (components read from stores)

---

### 2. State Management (Zustand Stores)

#### A. RealtimeStore (Single Source of Truth)

**File**: `frontend/src/core/eventBus/RealtimeStore.ts`

**Purpose**: **MASTER DATA STORE** - all real-time data lives here.

**State Structure**:
```typescript
{
  messages: Record<teamId, MessageDTO[]>,      // Messages per team
  insights: Record<teamId, AIInsightDTO[]>,    // AI insights per team
  presence: {
    onlineUsers: Set<userId>,                  // Online users
    typingUsers: Map<teamId, Set<userId>>      // Typing indicators
  },
  settings: {
    aiEnabled: Map<teamId, boolean>            // AI toggle per team
  }
}
```

**Key Methods**:
- `setMessages(teamId, messages[])` - Replace all messages for team
- `addMessage(teamId, message)` - Add new message (with duplicate check)
- `updateMessage(teamId, messageId, updates)` - Update message fields
- `deleteMessage(teamId, messageId)` - Remove message
- `getMessages(teamId)` - Returns messages array (or stable EMPTY_ARRAY)
- Same pattern for insights: `setInsights`, `addInsight`, `updateInsight`, `deleteInsight`, `getInsights`
- Presence: `setUserOnline`, `setUserOffline`, `setUserTyping`, `getTypingUsers`, `isUserOnline`
- Settings: `setAIEnabled`, `isAIEnabled`

**Critical Pattern**:
- Returns **stable empty arrays** (`EMPTY_ARRAY`, `EMPTY_INSIGHTS_ARRAY`) when no data exists
- Prevents React re-renders caused by `[] !== []` identity changes
- All writes go through Event Bridge (no direct mutations from components)

---

#### B. ChatStore (UI State + API Methods)

**File**: `frontend/src/stores/chatStore.ts`

**Purpose**: UI loading/error state + API methods that publish to Event Bus.

**State Structure**:
```typescript
{
  isLoading: boolean,              // API call in progress
  error: string | null,            // Last error message
  currentTeamId: string | null,    // Currently viewed team
}
```

**Methods** (API calls that publish to Event Bus):
- `fetchMessages(teamId)` → REST API → publishes `messages:fetched` event
- `sendMessage(data)` → REST API → publishes `message:created` event (with requestId for deduplication)
- `updateMessageById(messageId, updates)` → REST API → publishes `message:updated` event
- `deleteMessageById(messageId)` → REST API → publishes `message:deleted` event
- `setCurrentTeam(teamId)` → Updates UI state only
- `getMessages(teamId)` → **Delegates to RealtimeStore** (backward compatibility)
- `getCurrentMessages()` → **Delegates to RealtimeStore**

**Deprecated Fields** (for backward compatibility):
- `messages` getter → Returns `RealtimeStore.getMessages(currentTeamId)`
- `chat` getter → Returns `RealtimeStore.messages` (all teams)

**Critical Pattern**: 
- **Does NOT store messages directly** (delegated to RealtimeStore)
- Services publish to Event Bus → Event Bridge updates RealtimeStore
- Components read from RealtimeStore, not chatStore

---

#### C. AIInsightsStore (UI State + API Methods)

**File**: `frontend/src/stores/aiInsightsStore.ts`

**Purpose**: UI loading/error state + API methods for AI insights.

**State Structure**:
```typescript
{
  isLoading: boolean,
  error: string | null,
  aiEnabled: Record<teamId, boolean>  // Legacy field (now reads from RealtimeStore)
}
```

**Methods**:
- `fetchInsights(teamId)` → REST API → publishes `insights:fetched` event
- `createInsight(data)` → REST API → publishes `insight:created` event
- `deleteInsightById(insightId)` → REST API → publishes `insight:deleted` event
- `getTeamInsights(teamId)` → **Delegates to RealtimeStore**
- `isAIEnabled(teamId)` → Returns legacy field (should use RealtimeStore instead)
- `toggleAI(teamId)` → Updates legacy field (should use RealtimeStore instead)

**Deprecated Fields**:
- `insights` getter → Returns `RealtimeStore.insights` (all teams)

**Critical Pattern**: Same as ChatStore - delegates data to RealtimeStore.

---

#### D. TeamStore

**File**: `frontend/src/stores/teamStore.ts`

**Purpose**: Team selection, membership, and team metadata.

**State Structure**:
```typescript
{
  teams: TeamWithMembersDTO[],     // All teams with members
  currentTeamId: string | null,    // Selected team
  isLoading: boolean,
  error: string | null
}
```

**Methods**:
- `fetchTeams(userId)` → REST API → Sets `teams` array + syncs AI toggle state to RealtimeStore
- `setCurrentTeam(teamId)` → Updates `currentTeamId` + joins socket room + syncs chatStore
- `createTeam(data)` → REST API → Adds team to array
- `addMember(teamId, data)` → REST API → Updates team in array
- `removeMember(teamId, userId)` → REST API → Updates team in array

**What it passes to components**:
- `useCurrentTeam()` custom hook returns currently selected team object

**Critical Pattern**:
- When team selected, calls `socketService.joinTeam(teamId)` to join socket room
- When teams fetched, syncs `team.isChimeEnabled` to `RealtimeStore.setAIEnabled()`

---

#### E. PresenceStore

**File**: `frontend/src/stores/presenceStore.ts`

**Purpose**: Track online/offline users and socket connection.

**State Structure**:
```typescript
{
  onlineUsers: Set<userId>,
  isConnected: boolean,
  currentUserId: string | null
}
```

**Methods**:
- `connect(userId)` → Connects to WebSocket + registers presence listeners
- `disconnect()` → Disconnects socket
- `setUserOnline(userId)` → Adds to Set
- `setUserOffline(userId)` → Removes from Set
- `isUserOnline(userId)` → Boolean check

**Critical Pattern**:
- Called by `RealtimeProvider` during initialization
- Sets up socket listeners for `presence:update` and `presence:list` events
- Updates its own state (not via Event Bus for simplicity)

---

#### F. UserStore

**File**: `frontend/src/stores/userStore.ts` (not shown, but inferred)

**Purpose**: Current user profile.

**State Structure**:
```typescript
{
  user: UserDTO,
  isLoading: boolean,
  error: string | null
}
```

**Methods**:
- `fetchUser(userId)` → REST API → Sets `user`

---

### 3. Service Layer (API Clients)

#### A. MessageService

**File**: `frontend/src/services/messageService.ts`

**Purpose**: API client for messages that publishes to Event Bus.

**Methods**:
- `getMessages(teamId)` → `GET /messages?teamId=X` → Publishes `messages:fetched` event
- `createMessage(data)` → `POST /messages` → Publishes `message:created` event (with requestId)
- `updateMessage(messageId, updates)` → `PUT /messages/:id` → Publishes `message:updated` event
- `deleteMessage(messageId, teamId)` → `DELETE /messages/:id` → Publishes `message:deleted` event

**What it passes**: Events to Event Bus (not direct state mutations)

**Critical Pattern**: 
- Every API call publishes domain event using `EventTransformer`
- Uses `requestId` for create/update to enable deduplication (same message from REST + Socket)

---

#### B. InsightService

**File**: `frontend/src/services/insightService.ts`

**Purpose**: API client for AI insights.

**Methods**:
- `getInsights(teamId)` → `GET /insights?teamId=X` → Publishes `insights:fetched` event
- `createInsight(data)` → `POST /insights` → Publishes `insight:created` event
- `deleteInsight(insightId, teamId)` → `DELETE /insights/:id` → Publishes `insight:deleted` event
- `generateSummary(teamId)` → `POST /insights/generate/summary` → Publishes `insight:created` event
- `generateReport(teamId, prompt?)` → `POST /insights/generate/report` → Publishes `insight:created` event

---

#### C. SocketService

**File**: `frontend/src/services/socketService.ts`

**Purpose**: WebSocket connection manager (Socket.IO client).

**Methods**:
- `connect(userId)` → Connects to server, returns Promise
- `joinTeam(teamId)` → Emits `team:join` event
- `leaveTeam()` → Emits `team:leave` event
- `sendMessage(message)` → Emits `message:new` event (NOT USED - use messageService instead)
- `sendTypingIndicator(teamId, userId, isTyping)` → Emits `typing:start/stop`
- `toggleTeamAI(teamId, enabled)` → Emits `ai:toggle`
- `getSocket()` → Returns socket instance (for Socket Bridge)
- Listener methods: `onMessage`, `onMessageEdit`, `onMessageDelete`, `onAIInsight`, `onPresenceUpdate`, etc.

**What it passes**: Socket instance to Socket Bridge

**Critical Pattern**:
- Singleton instance (`socketService`)
- Socket listeners are registered by Socket Bridge (not directly in stores)
- Components do NOT call `socketService` directly (except for typing/AI toggle)

---

#### D. TeamService

**File**: `frontend/src/services/teamService.ts` (not shown, but inferred)

**Purpose**: API client for teams.

**Methods**:
- `getTeamsForUser(userId)` → `GET /teams?userId=X`
- `createTeam(data)` → `POST /teams`
- `addMemberToTeam(teamId, data)` → `POST /teams/:id/members`
- `removeMemberFromTeam(teamId, userId)` → `DELETE /teams/:id/members/:userId`

---

### 4. Event Bus System

#### A. EventBus

**File**: `frontend/src/core/eventBus/EventBus.ts`

**Purpose**: Central pub/sub coordinator for all events.

**Methods**:
- `subscribe(eventType, callback)` → Returns unsubscribe function
- `publish(event)` → Publishes event to subscribers (with deduplication check)
- `setLogging(enabled)` → Enable debug logs
- `clear()` → Remove all subscriptions
- `getStats()` → Event counts for debugging

**Features**:
- Wildcard subscriptions (`message:*` matches all message events)
- Automatic deduplication via `EventDeduplicator`
- Statistics tracking (published, deduplicated, subscriber count)

---

#### B. EventTransformer

**File**: `frontend/src/core/eventBus/EventTransformer.ts` (not shown, but inferred)

**Purpose**: Transform API responses and socket events into domain events.

**Methods**:
- `messageCreated(message, source, requestId?)` → Returns `message:created` event
- `messagesFetched(teamId, messages, source)` → Returns `messages:fetched` event
- `messageUpdated(message, source)` → Returns `message:updated` event
- `messageDeleted(messageId, teamId, source)` → Returns `message:deleted` event
- Same pattern for insights: `insightCreated`, `insightsFetched`, etc.
- `presenceOnline(userId, source)` → Returns `presence:online` event
- `presenceTyping(teamId, userId, isTyping, source)` → Returns `presence:typing` event
- `generateEventId(prefix, context)` → Creates unique event ID for deduplication

**What it passes**: Standardized domain event objects

---

#### C. EventDeduplicator

**File**: `frontend/src/core/eventBus/EventDeduplicator.ts` (not shown, but inferred)

**Purpose**: Prevent duplicate events from being processed.

**Methods**:
- `isDuplicate(eventId)` → Boolean check (maintains LRU cache of seen event IDs)
- `clear()` → Reset cache
- `destroy()` → Cleanup

**Critical Pattern**:
- REST response gets `requestId` based on operation (e.g., `create-msg-${teamId}-${timestamp}`)
- Socket event with same message may arrive shortly after
- Deduplicator uses `eventId` (derived from message.id or requestId) to skip duplicates

---

#### D. Event Bridge

**File**: `frontend/src/core/eventBus/bridge.ts`

**Purpose**: Connect Event Bus to RealtimeStore.

**What it does**:
- Subscribes to all domain events
- Calls RealtimeStore methods to update state
- Example: `eventBus.subscribe('message:created', (event) => store.addMessage(...))`

**Subscribes to**:
- `messages:fetched` → `store.setMessages`
- `message:created` → `store.addMessage`
- `message:updated` → `store.updateMessage`
- `message:deleted` → `store.deleteMessage`
- `insights:fetched` → `store.setInsights`
- `insight:created` → `store.addInsight`
- `insight:updated` → `store.updateInsight`
- `insight:deleted` → `store.deleteInsight`
- `presence:online` → `store.setUserOnline`
- `presence:offline` → `store.setUserOffline`
- `presence:typing` → `store.setUserTyping`
- `presence:list` → `store.setMultipleUsersOnline`

**Returns**: Cleanup function (called on unmount)

---

#### E. Socket Bridge

**File**: `frontend/src/services/realtime/socketBridge.ts`

**Purpose**: Transform Socket.IO events into Event Bus domain events.

**What it does**:
- Registers listeners on socket for: `message:new`, `message:edited`, `message:deleted`, `ai:insight:new`, `insight:deleted`, `presence:update`, `presence:list`, `typing:start`, `typing:stop`, `ai:toggle`
- Transforms each socket event into domain event using `EventTransformer`
- Publishes to Event Bus
- Event Bridge updates RealtimeStore

**Example Flow**:
```
Backend emits: socket.emit('message:new', messageDTO)
  ↓
Socket Bridge receives: socket.on('message:new', (message) => ...)
  ↓
Transforms: EventTransformer.messageCreated(message, 'socket')
  ↓
Publishes: eventBus.publish(event)
  ↓
Event Bridge receives: eventBus.subscribe('message:created', ...)
  ↓
Updates: store.addMessage(message.teamId, message)
  ↓
Components re-render: useRealtimeStore((state) => state.getMessages(teamId))
```

**Returns**: Cleanup function (removes all socket listeners)

---

### 5. React Components

#### A. Sidebar

**File**: `frontend/src/components/Sidebar/Sidebar.tsx` (not shown, but inferred)

**Purpose**: Team switcher and navigation.

**What it reads**:
- `teams` from `useTeamStore`
- `currentTeamId` from `useTeamStore`

**What it does**:
- Renders team list
- Calls `setCurrentTeam(teamId)` on click

**What it passes**: Nothing (calls store methods directly)

---

#### B. ChatWindow

**File**: `frontend/src/components/Chat/ChatWindow.tsx` (not shown, but inferred)

**Purpose**: Main chat container.

**What it renders**:
- `<ChatHeader />` - Team name, member count
- `<MessageList />` - Message history
- `<MessageComposer />` - Input field

**What it passes**: Nothing (children read from stores)

---

#### C. MessageList

**File**: `frontend/src/components/Chat/MessageList.tsx`

**Purpose**: Display chat messages for current team.

**What it reads**:
- `teamId` from `useCurrentTeam()`
- `messages` from `useRealtimeStore((state) => state.getMessages(teamId))`
- `typingUsersMap` from `useRealtimeStore((state) => state.presence.typingUsers)`
- `isLoading`, `error` from `useChatStore`
- `user` from `useUserStore`
- `members` from `useCurrentTeam()`
- `isUserOnline` from `usePresenceStore`

**What it does**:
- Calls `fetchMessages(teamId)` on mount/team change
- Renders message bubbles with different styles:
  - Current user: Right-aligned, blue background
  - Agent: Center-aligned, purple background
  - Other users: Left-aligned, bordered with avatar color
- Auto-scrolls to bottom when messages change
- Shows typing indicators

**What it passes**:
- `userNames` and `isAgentTyping` to `<TypingIndicator />`

**Critical Patterns**:
- Subscribes to `getMessages(teamId)` (returns stable empty array if no messages)
- Uses `useMemo` to filter typing users (prevents re-renders from Map changes)
- Uses `useEffect` with `[teamId]` dependency (NOT `[fetchMessages]` to avoid infinite loops)

---

#### D. MessageComposer

**File**: `frontend/src/components/Chat/MessageComposer.tsx` (not shown, but inferred)

**Purpose**: Message input field.

**What it reads**:
- `teamId` from `useCurrentTeam()`
- `user` from `useUserStore`
- `sendMessage` from `useChatStore`

**What it does**:
- Handles input change, submit
- Calls `sendMessage({ teamId, authorId, content, contentType: 'text' })`
- Emits typing indicators via `socketService.sendTypingIndicator()`

---

#### E. RightPanel

**File**: `frontend/src/components/RightPanel/RightPanel.tsx`

**Purpose**: Display AI insights and summaries.

**What it reads**:
- `teamId`, `teamName` from `useCurrentTeam()`
- `teamInsights` from `useRealtimeStore((state) => state.getInsights(teamId))`
- `isTeamAIEnabled` from `useRealtimeStore((state) => state.isAIEnabled(teamId))`
- `fetchInsights` from `useAIInsightsStore`

**What it does**:
- Calls `fetchInsights(teamId)` on mount/team change
- Renders filter tabs: All, Summaries, Actions, Suggestions
- Filters insights based on selected tab
- Renders `<LongFormContentViewer />` for summaries/documents
- Renders `<InsightsList />` for actions/suggestions
- Auto-scrolls to bottom when insights change
- Shows `<AIToggle />` and `<ActionButtons />`

**What it passes**:
- `insights` array to `<InsightsList />` and `<LongFormContentViewer />`
- `isEnabled`, `onToggle` to `<AIToggle />`

**Critical Patterns**:
- Uses `useMemo` to sort/filter insights (prevents re-sorting on every render)
- Uses `useEffect` with `[teamId]` dependency (NOT `[fetchInsights]`)
- Handles AI toggle with debounced socket emission (500ms delay to prevent race conditions)

---

#### F. ActionButtons

**File**: `frontend/src/components/RightPanel/ActionButtons.tsx`

**Purpose**: Buttons to generate AI content.

**What it reads**:
- `teamId` from `useCurrentTeam()`
- `generateSummary`, `generateReport` from `insightService` (via custom hook)

**What it does**:
- Renders buttons: 📝 Summary, 📊 Report, 🎤 Audio, 🎥 Video, etc.
- Calls `insightService.generateSummary(teamId)` on click
- Shows loading state during generation

---

---

## Backend Architecture

### 1. Entry Point

**File**: `backend/src/index.ts`

**Purpose**: Express server + Socket.IO setup.

**What it does**:
1. Create Express app + HTTP server
2. Initialize Socket.IO with CORS
3. Setup socket handlers (`setupSocketHandlers(io)`)
4. Pass `io` instance to controllers (`AIAgentController.setSocketIO(io)`, etc.)
5. Register REST routes
6. Start server on port 5000

---

### 2. Socket Handlers

**File**: `backend/src/socket/socketHandlers.ts` (not shown, but inferred)

**Purpose**: Handle WebSocket connections and room management.

**What it does**:
- `io.on('connection', (socket) => { ... })`
- Listen for `team:join` event → `socket.join('team:${teamId}')`
- Listen for `team:leave` event → `socket.leave('team:${teamId}')`
- Listen for `presence:online` event → Broadcast `presence:update` to all
- Listen for `typing:start/stop` → Broadcast to team room
- Listen for `ai:toggle` → Broadcast to team room, update team settings in DB

---

### 3. Controllers

#### A. MessageController

**File**: `backend/src/controllers/messageController.ts` (not shown, but inferred)

**Purpose**: Handle message CRUD operations.

**Methods**:
- `getMessages(teamId)` → Query Prisma for messages where `teamId = X`
- `createMessage(data)` → Insert message in DB → Broadcast `message:new` to `team:${teamId}`
- `updateMessage(messageId, updates)` → Update message in DB → Broadcast `message:edited`
- `deleteMessage(messageId)` → Delete message in DB → Broadcast `message:deleted`

**What it broadcasts**:
- `io.to('team:${teamId}').emit('message:new', messageDTO)`
- `io.to('team:${teamId}').emit('message:edited', messageDTO)`
- `io.to('team:${teamId}').emit('message:deleted', { messageId })`

---

#### B. AIInsightController

**File**: `backend/src/controllers/aiInsightController.ts` (not shown, but inferred)

**Purpose**: Handle AI insight CRUD + generation.

**Methods**:
- `getInsights(teamId)` → Query Prisma for insights
- `createInsight(data)` → Insert insight in DB → Broadcast `ai:insight:new`
- `deleteInsight(insightId)` → Delete insight in DB → Broadcast `insight:deleted`
- `generateSummary(teamId)` → Fetch messages → Call LLM → Create insight → Broadcast
- `generateReport(teamId, prompt?)` → Fetch messages → Call LLM → Create insight → Broadcast

**What it broadcasts**:
- `io.to('team:${teamId}').emit('ai:insight:new', insightDTO)`
- `io.to('team:${teamId}').emit('insight:deleted', { id: insightId })`

---

#### C. AIAgentController

**File**: `backend/src/controllers/aiAgentController.ts` (not shown, but inferred)

**Purpose**: Handle `@agent` mentions in chat.

**Methods**:
- `handleNewMessage(message)` → Check if `message.content` includes `@agent` → Call LLM → Create agent message → Broadcast

**What it broadcasts**:
- `io.to('team:${teamId}').emit('message:new', agentMessageDTO)`

---

#### D. TeamController

**File**: `backend/src/controllers/teamController.ts` (not shown, but inferred)

**Purpose**: Handle team CRUD.

**Methods**:
- `getTeamsForUser(userId)` → Query Prisma for teams where user is member
- `createTeam(data)` → Insert team in DB
- `addMemberToTeam(teamId, data)` → Insert team member in DB
- `removeMemberFromTeam(teamId, userId)` → Delete team member in DB

---

### 4. Routes

**File**: `backend/src/routes/messageRoutes.ts`, `aiInsightRoutes.ts`, `teamRoutes.ts`, `userRoutes.ts`

**Purpose**: Map HTTP endpoints to controller methods.

**Examples**:
- `GET /api/messages?teamId=X` → `MessageController.getMessages`
- `POST /api/messages` → `MessageController.createMessage`
- `POST /api/insights/generate/summary` → `AIInsightController.generateSummary`
- `GET /api/teams?userId=X` → `TeamController.getTeamsForUser`

---

### 5. Database (Prisma)

**File**: `backend/prisma/schema.prisma`

**Tables** (inferred):
- `User` (id, name, email, avatarUrl, role, createdAt, updatedAt)
- `Team` (id, name, description, isChimeEnabled, createdAt, updatedAt)
- `TeamMember` (id, teamId, userId, role, joinedAt)
- `Message` (id, teamId, authorId, content, contentType, metadata, createdAt, updatedAt)
- `AIInsight` (id, teamId, type, title, content, priority, tags, relatedMessageIds, metadata, createdAt, updatedAt)
- `ChimeRule` (id, name, type, enabled, priority, cooldownMinutes, conditions, action, teamId, createdAt, updatedAt)
- `ChimeLog` (id, ruleId, teamId, triggeredAt, outcome, messageId, insightId)

---

---

## Data Flow Examples

### Example 1: User Sends a Message

```
1. User types in MessageComposer, clicks send
   ↓
2. MessageComposer calls: chatStore.sendMessage({ teamId, authorId, content, contentType: 'text' })
   ↓
3. chatStore.sendMessage calls: messageService.createMessage(data)
   ↓
4. messageService.createMessage:
   - Generates requestId = `create-msg-${teamId}-${timestamp}`
   - POST /api/messages with data
   - Backend: MessageController.createMessage → Insert in DB → Broadcast socket event
   - Returns: messageDTO
   ↓
5. messageService publishes to Event Bus:
   - EventTransformer.messageCreated(messageDTO, 'rest', requestId)
   - eventBus.publish(event) → eventId = requestId
   ↓
6. Event Bridge receives event:
   - Calls: RealtimeStore.addMessage(teamId, messageDTO)
   - RealtimeStore checks for duplicate (none, first time)
   - Adds message to messages[teamId] array
   ↓
7. MessageList re-renders:
   - useRealtimeStore((state) => state.getMessages(teamId))
   - New message appears in UI
   ↓
8. Backend broadcasts socket event:
   - io.to('team:${teamId}').emit('message:new', messageDTO)
   ↓
9. Socket Bridge receives socket event:
   - Transforms to domain event (no requestId, uses message.id as eventId)
   - eventBus.publish(event)
   ↓
10. Event Deduplicator checks eventId:
    - First event (from REST) had eventId = requestId
    - Socket event has eventId = message.id
    - Different IDs? No, transformer uses requestId if available
    - Actually, socket events DON'T have requestId, so they get unique eventId
    - BUT message.id is same, so store's addMessage() checks for duplicate
    - Duplicate found, ignored by RealtimeStore.addMessage()
    ↓
11. No duplicate UI update!
```

**Key Insight**: 
- REST response arrives first → adds message
- Socket event arrives second → tries to add message → duplicate check prevents it
- If REST fails, socket event still arrives → message added via socket only

---

### Example 2: Another User Sends a Message

```
1. User B sends message from their browser
   ↓
2. Backend receives POST /api/messages
   ↓
3. Backend inserts in DB, broadcasts socket event:
   - io.to('team:${teamId}').emit('message:new', messageDTO)
   ↓
4. User A's browser receives socket event:
   - Socket Bridge: socket.on('message:new', (message) => ...)
   ↓
5. Socket Bridge transforms and publishes:
   - EventTransformer.messageCreated(message, 'socket')
   - eventBus.publish(event)
   ↓
6. Event Bridge receives event:
   - RealtimeStore.addMessage(teamId, message)
   - Message added to array
   ↓
7. MessageList re-renders:
   - New message appears in User A's UI
```

**Key Insight**: Socket-only path (no REST response for User A, since they didn't send it).

---

### Example 3: User Generates AI Summary

```
1. User clicks "📝 Summary" button in RightPanel
   ↓
2. ActionButtons calls: insightService.generateSummary(teamId)
   ↓
3. insightService.generateSummary:
   - POST /api/insights/generate/summary with { teamId }
   - Backend: AIInsightController.generateSummary:
     - Fetch team messages
     - Build conversation context
     - Call LLM (GitHub Models GPT-4o)
     - Create insight in DB
     - Broadcast socket event: io.to('team:${teamId}').emit('ai:insight:new', insightDTO)
   - Returns: insightDTO
   ↓
4. insightService publishes to Event Bus:
   - EventTransformer.insightCreated(insightDTO, 'rest')
   - eventBus.publish(event)
   ↓
5. Event Bridge receives event:
   - RealtimeStore.addInsight(teamId, insightDTO)
   - Insight added to insights[teamId] array
   ↓
6. RightPanel re-renders:
   - useRealtimeStore((state) => state.getInsights(teamId))
   - New summary appears in UI
   ↓
7. Backend broadcasts socket event (same as step 3)
   ↓
8. Socket Bridge receives and publishes:
   - eventBus.publish(insightCreatedEvent)
   ↓
9. Event Deduplicator checks:
   - Same insight.id already processed
   - Duplicate ignored
```

---

### Example 4: User Toggles AI Assistant

```
1. User clicks AI toggle in RightPanel
   ↓
2. RightPanel calls: handleToggleAI()
   ↓
3. handleToggleAI:
   - Optimistic update: RealtimeStore.setAIEnabled(teamId, !currentState)
   - Debounced (500ms): socketService.toggleTeamAI(teamId, newState)
   ↓
4. socketService emits:
   - socket.emit('ai:toggle', { teamId, enabled: newState })
   ↓
5. Backend socket handler receives:
   - Update team.isChimeEnabled in DB
   - Broadcast to all team members: io.to('team:${teamId}').emit('ai:toggle', { teamId, enabled })
   ↓
6. All team members' browsers receive socket event:
   - Socket Bridge: socket.on('ai:toggle', (data) => ...)
   - Directly updates: RealtimeStore.setAIEnabled(data.teamId, data.enabled)
   ↓
7. All team members' RightPanels re-render:
   - AI toggle switches to new state
```

**Key Insight**: Optimistic UI update + broadcast to all team members for sync.

---

### Example 5: User Types in Chat (Typing Indicator)

```
1. User types in MessageComposer
   ↓
2. MessageComposer calls: socketService.sendTypingIndicator(teamId, userId, true)
   ↓
3. socketService emits:
   - socket.emit('typing:start', { teamId, userId })
   ↓
4. Backend broadcasts to team:
   - io.to('team:${teamId}').emit('typing:start', { teamId, userId, isTyping: true })
   ↓
5. Socket Bridge receives:
   - socket.on('typing:start', (data) => ...)
   - Transforms: EventTransformer.presenceTyping(teamId, userId, true, 'socket')
   - eventBus.publish(event)
   ↓
6. Event Bridge receives:
   - RealtimeStore.setUserTyping(teamId, userId, true)
   - Adds userId to typingUsers Map
   ↓
7. MessageList re-renders:
   - useRealtimeStore((state) => state.presence.typingUsers)
   - useMemo filters typing users for this team
   - TypingIndicator shows "Alice is typing..."
   ↓
8. User stops typing (debounced 3s later):
   - Emits 'typing:stop' → Same flow but isTyping=false
   - Removes userId from Set
```

---

---

## Critical Patterns to Prevent Re-render Issues

### 1. Subscribe to Data, Not Functions

**❌ Wrong** (subscribes to function reference, never re-renders):
```typescript
const fetchMessages = useChatStore((state) => state.fetchMessages);
const messages = fetchMessages(teamId); // Component won't re-render when data changes!
```

**✅ Correct** (subscribes to data, re-renders when data changes):
```typescript
const messages = useRealtimeStore((state) => state.getMessages(teamId));
```

---

### 2. Use Stable Empty Arrays

**❌ Wrong** (creates new array reference on every selector call):
```typescript
getMessages: (teamId) => {
  return get().messages[teamId] || []; // [] !== [] (new array each time!)
}
```

**✅ Correct** (returns same empty array reference):
```typescript
const EMPTY_ARRAY = Object.freeze([]) as MessageDTO[];
getMessages: (teamId) => {
  return get().messages[teamId] || EMPTY_ARRAY; // Stable reference
}
```

---

### 3. Use useMemo for Derived State

**❌ Wrong** (re-sorts on every render, even if insights unchanged):
```typescript
const sortedInsights = insights.sort((a, b) => ...);
```

**✅ Correct** (only re-sorts when insights array changes):
```typescript
const sortedInsights = useMemo(() => {
  return [...insights].sort((a, b) => ...);
}, [insights]);
```

---

### 4. Dependency Arrays in useEffect

**❌ Wrong** (infinite loop - fetchMessages changes on every render):
```typescript
useEffect(() => {
  fetchMessages(teamId);
}, [teamId, fetchMessages]); // fetchMessages reference changes!
```

**✅ Correct** (only re-fetch when teamId changes):
```typescript
useEffect(() => {
  fetchMessages(teamId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [teamId]); // Ignore fetchMessages dependency
```

---

### 5. Subscribe to Map/Set Directly, Transform in useMemo

**❌ Wrong** (creates new array on every render):
```typescript
const typingUsers = useRealtimeStore((state) => {
  const teamTyping = state.presence.typingUsers.get(teamId);
  return teamTyping ? Array.from(teamTyping) : []; // New array!
});
```

**✅ Correct** (subscribe to Map, transform in useMemo):
```typescript
const typingUsersMap = useRealtimeStore((state) => state.presence.typingUsers);
const typingUsers = useMemo(() => {
  const teamTyping = typingUsersMap.get(teamId);
  return teamTyping ? Array.from(teamTyping) : [];
}, [typingUsersMap, teamId]);
```

---

### 6. Delegate Data Storage to RealtimeStore

**❌ Wrong** (duplicate state across multiple stores):
```typescript
// chatStore has messages
// aiInsightsStore has insights
// Each store manages its own socket listeners
// Data can get out of sync!
```

**✅ Correct** (single source of truth):
```typescript
// RealtimeStore stores ALL data
// chatStore/aiInsightsStore only store UI state (loading, error)
// Event Bus coordinates all updates
// Components read from RealtimeStore
```

---

### 7. Debounce Frequent Actions

**❌ Wrong** (emits socket event on every toggle):
```typescript
const handleToggleAI = () => {
  socketService.toggleTeamAI(teamId, !isEnabled);
};
```

**✅ Correct** (debounce to prevent race conditions):
```typescript
const handleToggleAI = () => {
  // Optimistic update
  RealtimeStore.setAIEnabled(teamId, !isEnabled);
  
  // Debounced socket emission
  if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
  toggleTimeoutRef.current = setTimeout(() => {
    socketService.toggleTeamAI(teamId, !isEnabled);
  }, 500);
};
```

---

---

## Summary: What Each Layer Does

| Layer | Responsibility | What It Passes |
|-------|----------------|----------------|
| **RealtimeProvider** | Initialize Event Bus + Socket | Nothing (context-free) |
| **App** | Main layout, fetch initial data | Nothing (children read from stores) |
| **RealtimeStore** | Single source of truth for data | Data via selectors |
| **ChatStore / AIInsightsStore** | UI state + API methods | Nothing (delegates data to RealtimeStore) |
| **TeamStore / UserStore / PresenceStore** | Domain-specific state | Data via selectors |
| **Services** | API clients, publish to Event Bus | Events to Event Bus |
| **Event Bus** | Pub/sub coordinator | Events to subscribers |
| **Event Bridge** | Event Bus → RealtimeStore glue | Nothing (internal coordination) |
| **Socket Bridge** | Socket → Event Bus transformer | Events to Event Bus |
| **Components** | UI rendering, read from stores | Props to children (minimal) |
| **Backend Controllers** | Business logic, DB, socket broadcasts | Socket events, REST responses |

---

## Key Takeaways

1. **RealtimeStore is the single source of truth** - All data (messages, insights, presence) lives here
2. **Event Bus coordinates everything** - REST and Socket events flow through same channel
3. **Services publish, stores subscribe** - Services don't mutate store directly
4. **Components read, don't write** - Components subscribe to store selectors, call service methods
5. **Stable references prevent re-renders** - Use frozen empty arrays, useMemo for derived state
6. **Dependency arrays must be stable** - Only include primitive values or stable references
7. **Deduplication is automatic** - Event Bus + RealtimeStore prevent duplicate updates
8. **Optimistic updates + broadcasts** - Update local state immediately, broadcast to sync others

---

**End of Document**
