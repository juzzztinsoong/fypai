# Copilot Instructions for AI Coding Agents

This repository is a collaborative AI-enabled productivity app for students/teams. The app's core UX is:

- **Left sidebar**: Teams, project contexts, navigation, settings
- **Main (center) column**: Real-time team chat for collaboration  
- **Right column** (equal width): AI-generated insights (summaries, reports, actions, suggestions)

This file documents the architecture, conventions, and patterns so AI coding agents can be immediately productive.

---

## 🎯 Current Status (November 2025)

**Current Phase**: Phase 5 - RAG Enhancement & Validation  
**Branch**: `rag_1`  
**Last Major Milestone**: Phase 4 Complete (RAG Infrastructure - embeddings, vector search, worker queue)

### ✅ Completed Phases
- **Phase 1-3**: Full-stack foundation (React, Express, Socket.IO, Prisma, real-time chat)
- **Phase 4**: RAG Infrastructure (GitHub Models embeddings, Pinecone vector DB, BullMQ worker, basic integration)

### 🚧 Active Development
- **Phase 5 Tasks**: RAG context enhancement, end-to-end verification, similarity threshold tuning
- **Quick Wins**: Error tracking (Sentry), in-memory caching, batch embeddings, message preprocessing

### 📋 Next Up
- **Phase 6**: Multi-agent architecture (Tier 1 cheap + Tier 2 smart agents)
- **Phase 7**: Authentication (Clerk integration)
- **Phase 8**: Production deployment (PostgreSQL, Vercel/Railway)
- **Phase 9**: Adaptive UI (theme system, user preferences)

**Key Documents**:
- `CURRENT_PHASE_IMPLEMENTATION.md` - Actionable tasks for immediate implementation
- `PHASE_5_PLAN.md` - Comprehensive RAG enhancement checklist
- `FUTURE_ROADMAP.md` - Strategic vision for Phases 6-9

---

## Current Tech Stack (Implemented)

### Frontend
- **Framework**: React 18 + TypeScript + Vite 7.1.9
- **State Management**: Zustand (entityStore, uiStore, sessionStore) - **refactored from 6→3 stores**
- **Styling**: TailwindCSS
- **Real-time**: Socket.IO client (connection managed in realtimeInit.ts)
- **Markdown**: react-markdown with syntax highlighting

### Backend  
- **Runtime**: Node.js 20 + Express 4.18
- **Real-time**: Socket.IO 4.6
- **Database**: Prisma 5.7 ORM + SQLite (dev) / PostgreSQL (planned for prod)
- **AI Provider**: GitHub Models (Azure) - `gpt-4o` model for chat, `text-embedding-3-small` for embeddings
- **Vector DB**: Pinecone (serverless, us-east-1) for semantic search
- **Job Queue**: BullMQ + Redis for background embedding generation
- **API Design**: REST endpoints + WebSocket events

### RAG Infrastructure (Phase 4 Complete)
- **Embedding Service**: OpenAI-compatible SDK → GitHub Models endpoint (free tier)
- **Vector Storage**: Pinecone index `fypai-messages` (1536 dimensions)
- **Worker System**: BullMQ worker processes embedding queue (concurrency: 3)
- **Semantic Search**: RAG service retrieves relevant past messages (threshold: 0.7 similarity)
- **Usage Tracking**: Cumulative token/request counters + API endpoint (`GET /api/stats/embeddings`)

### Shared
- **Types Package**: `packages/types/` - shared DTOs between frontend/backend
- **Monorepo**: Simple workspace structure (npm workspaces)

---

## Architecture Overview

### Three-Column Layout

```
┌─────────────┬──────────────────────┬──────────────────────┐
│  Sidebar    │   Main Chat          │   AI Insights        │
│             │                      │                      │
│ • Teams     │ • Messages           │ • Summaries          │
│ • Settings  │ • @agent mentions    │ • Reports            │
│             │ • User messages      │ • Action Items       │
│             │                      │ • Suggestions        │
└─────────────┴──────────────────────┴──────────────────────┘
```

### Data Flow

```
User Action (Chat or AI Button)
  ↓
Frontend Component (ChatWindow or RightPanel)
  ↓
Service Layer (messageService or insightService)
  ↓
Backend API (/api/messages or /api/insights)
  ↓
Controller (MessageController or AIInsightController)
  ↓
Database (Prisma) + LLM Call (if AI)
  ↓
Socket.IO Broadcast (to team room: team:${teamId})
  ↓
All Clients in Room Receive Event
  ↓
Zustand Store Updates (chatStore or aiInsightsStore)
  ↓
React Components Re-render
```

---

## Folder Structure

```
fypai/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar/        # Team switcher, navigation
│   │   │   ├── Chat/           # MessageList, MessageBubble, ChatHeader, MessageComposer
│   │   │   └── RightPanel/     # AI insights display
│   │   │       ├── RightPanel.tsx           # Main container with filtering
│   │   │       ├── ActionButtons.tsx        # Summary/Report generation triggers
│   │   │       ├── InsightsList.tsx         # Action/suggestion insights
│   │   │       ├── LongFormContentViewer.tsx # Routes to SummaryCard/ReportCard
│   │   │       ├── SummaryCard.tsx          # Blue-themed summary display
│   │   │       ├── ReportCard.tsx           # Green-themed report display
│   │   │       └── CodeOutputCard.tsx       # Syntax-highlighted code
│   │   ├── stores/             # Zustand stores
│   │   │   ├── entityStore.ts            # Normalized data (users, teams, messages, insights)
│   │   │   ├── uiStore.ts                # UI state (current team, sidebar open, etc.)
│   │   │   └── sessionStore.ts           # Session state (auth, connection status)
│   │   ├── services/           # API clients
│   │   │   ├── messageService.ts         # /api/messages
│   │   │   ├── insightService.ts         # /api/insights (includes AI generation)
│   │   │   ├── teamService.ts            # /api/teams
│   │   │   └── socketService.ts          # WebSocket connection
│   │   └── App.tsx             # Socket listener initialization
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── messageController.ts      # Message CRUD + socket broadcasts
│   │   │   ├── aiInsightController.ts    # Insight CRUD + AI generation
│   │   │   ├── aiAgentController.ts      # @agent handler + chime rules
│   │   │   ├── teamController.ts         # Team management
│   │   │   └── userController.ts         # User management
│   │   ├── routes/
│   │   │   ├── messageRoutes.ts          # /api/messages
│   │   │   ├── aiInsightRoutes.ts        # /api/insights (unified AI endpoints)
│   │   │   ├── teamRoutes.ts             # /api/teams
│   │   │   └── userRoutes.ts             # /api/users
│   │   ├── ai/
│   │   │   ├── llm/
│   │   │   │   ├── githubModelsClient.ts # GitHub Models API client
│   │   │   │   └── prompts.ts            # System prompts for AI
│   │   │   └── agent/
│   │   │       ├── rules.ts              # Chime rules engine (TODO: enhance)
│   │   │       └── patterns.ts           # Pattern matchers (TODO: implement)
│   │   ├── socket/
│   │   │   └── socketHandlers.ts         # Socket.IO connection/room management
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── types.ts            # Re-exports from @fypai/types
│   │   └── index.ts            # Express server + Socket.IO setup
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (Message, AIInsight, Team, User)
│   │   └── migrations/         # Database migrations
│   └── package.json
│
└── packages/
    └── types/
        └── src/
            └── dtos.ts         # Shared TypeScript types (MessageDTO, AIInsightDTO, etc.)
```

---

## Key Data Models

### MessageDTO (Chat Messages)
```typescript
{
  id: string,              // UUID
  teamId: string,
  authorId: string,        // User ID or 'agent'
  content: string,         // Message text
  contentType: 'text',     // Always 'text' for chat messages
  createdAt: string,       // ISO timestamp
  updatedAt?: string,
  metadata?: {
    mentions?: string[],   // @agent, @user mentions
    edited?: boolean,
    parentMessageId?: string
  }
}
```

### AIInsightDTO (AI-Generated Content)
```typescript
{
  id: string,              // UUID
  teamId: string,
  type: 'summary' | 'document' | 'action' | 'suggestion' | 'analysis' | 'code',
  title: string,
  content: string,         // Markdown-formatted content
  priority?: 'low' | 'medium' | 'high',
  tags: string[],          // e.g., ['auto-generated', 'summary', 'gpt-4o']
  createdAt: string,       // ISO timestamp
  relatedMessageIds?: string[], // Links to messages that triggered this
  metadata?: {
    prompt?: string,
    tokensUsed?: number,
    model?: string,        // e.g., 'gpt-4o'
    chimeRuleName?: string // e.g., 'decision-detected'
  }
}
```

**Key Architectural Principle:**  
- **Messages** = user/agent chat in main column (ephemeral, conversational)
- **Insights** = AI-generated long-form content in right panel (persistent, structured)
- They are stored separately (different tables, different stores, different UI)

---

## AI Agent Integration - Three Pillars

The AI system operates through three complementary interaction modes:

### 1. **Reactive Mode** - `@agent` Mentions (IMPLEMENTED ✅)

**Trigger**: User explicitly types `@agent` in chat  
**Response**: AI posts reply in chat thread

**Implementation:**
- File: `backend/src/controllers/aiAgentController.ts`
- Method: `handleNewMessage(message: MessageDTO)`
- Detection: Checks `message.content` for `@agent` string
- Response: Posts as chat message (authorId: 'agent')
- Broadcast: `message:new` event

**Flow:**
```
User types: "@agent what's the status?"
  ↓
Backend detects @agent mention
  ↓
Calls LLM with conversation history
  ↓
Generates response
  ↓
Saves as Message (authorId='agent')
  ↓
Broadcasts message:new
  ↓
Appears in ChatWindow
```

### 2. **User-Triggered Mode** - Insight Buttons (IMPLEMENTED ✅)

**Trigger**: User clicks "📝 Summary" or "📊 Report" button  
**Response**: AI generates structured insight in right panel

**Implementation:**
- File: `backend/src/controllers/aiInsightController.ts`
- Methods: `generateSummary(teamId)`, `generateReport(teamId, prompt?)`
- Endpoints: `POST /api/insights/generate/summary`, `POST /api/insights/generate/report`
- Storage: Saves as AIInsight to database
- Broadcast: `ai:insight:new` event

**Flow:**
```
User clicks "📝 Summary"
  ↓
Frontend calls POST /api/insights/generate/summary
  ↓
Backend fetches team messages
  ↓
Calls LLM to generate summary
  ↓
Saves as AIInsight (type='summary')
  ↓
Broadcasts ai:insight:new
  ↓
Appears in RightPanel "Summaries" tab
```

### 3. **Autonomous Mode** - Smart Chime Rules (TODO 🚧)

**Trigger**: Pattern detection, threshold reached, scheduled check, or semantic signal  
**Response**: AI proactively creates insight or chat message

**Purpose**: AI acts as an active team member, not just a reactive tool. It monitors conversation flow and intervenes when it detects:
- **Decision points** (e.g., "let's go with option B")
- **Action commitments** (e.g., "I'll finish this by Friday")
- **Confusion signals** (e.g., repeated questions, conflicting statements)
- **Topic drift** (conversation strays from agenda)
- **Knowledge gaps** (repeated unfamiliar terms)
- **Time-based triggers** (e.g., daily standup summary at 5pm)

**Implementation Plan:**

#### Core Components (New Files):

**`backend/src/ai/agent/chimeRulesEngine.ts`**
```typescript
interface ChimeRule {
  id: string;
  name: string;
  type: 'pattern' | 'threshold' | 'semantic' | 'schedule' | 'hybrid';
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  cooldownMinutes: number; // Prevent spam
  
  // Conditions
  conditions: {
    patterns?: string[]; // Regex patterns to match
    keywords?: string[]; // Keywords to detect
    messageCount?: number; // Trigger after N messages
    timeWindow?: number; // Within X minutes
    semanticQuery?: string; // Vector similarity search
    schedule?: string; // Cron expression
  };
  
  // Action
  action: {
    type: 'chat_message' | 'insight' | 'both';
    insightType?: 'action' | 'suggestion' | 'analysis' | 'summary';
    template: string; // Prompt template for LLM
  };
}
```

**`backend/src/ai/agent/patternDetectors.ts`**
```typescript
// Pattern detection utilities
export const detectDecision = (messages: MessageDTO[]): boolean => {
  // Patterns: "let's go with", "we decided", "agreed on", etc.
};

export const detectActionCommitment = (messages: MessageDTO[]): boolean => {
  // Patterns: "I'll do X by Y", "deadline", "will finish", etc.
};

export const detectConfusion = (messages: MessageDTO[]): boolean => {
  // Patterns: repeated questions, "I'm confused", "not sure", etc.
};

export const detectTopicDrift = (messages: MessageDTO[], topic: string): boolean => {
  // Semantic similarity drops below threshold
};
```

**`backend/src/ai/agent/chimeEvaluator.ts`**
```typescript
export class ChimeEvaluator {
  private rules: ChimeRule[];
  private lastChimeTimes: Map<string, Date>; // For cooldown
  
  async evaluate(teamId: string, newMessage: MessageDTO): Promise<ChimeDecision[]> {
    // 1. Fetch recent messages (sliding window)
    // 2. Check each active rule
    // 3. Evaluate patterns, thresholds, semantic matches
    // 4. Respect cooldown periods
    // 5. Return list of triggered rules (prioritized)
  }
  
  async executeChime(decision: ChimeDecision): Promise<void> {
    // 1. Build context from messages
    // 2. Call LLM with rule template
    // 3. Generate response
    // 4. Save as insight or message
    // 5. Broadcast to team
  }
}
```

#### Example Rules:

**Rule: Decision Detector**
```typescript
{
  id: 'decision-001',
  name: 'Decision Detected',
  type: 'pattern',
  priority: 'high',
  cooldownMinutes: 30,
  conditions: {
    patterns: [
      'let\\\'?s go with',
      'we (decided|agreed|chose)',
      'final decision',
      'settled on'
    ],
    messageCount: 1
  },
  action: {
    type: 'insight',
    insightType: 'action',
    template: 'A decision was just made. Extract: (1) What was decided, (2) Who decided, (3) Why, (4) Next steps. Format as action items.'
  }
}
```

**Rule: Action Commitment Tracker**
```typescript
{
  id: 'action-002',
  name: 'Action Commitment',
  type: 'pattern',
  priority: 'high',
  cooldownMinutes: 15,
  conditions: {
    patterns: [
      '(I\'ll|I will) .+ by (tomorrow|friday|next week|\\d{4}-\\d{2}-\\d{2})',
      'deadline.+(is|set for)',
      'will (finish|complete|deliver)'
    ]
  },
  action: {
    type: 'insight',
    insightType: 'action',
    template: 'Someone committed to an action. Extract: (1) Who, (2) What task, (3) Deadline, (4) Dependencies. Format as trackable action item.'
  }
}
```

**Rule: Confusion Intervention**
```typescript
{
  id: 'confusion-003',
  name: 'Confusion Detected',
  type: 'hybrid',
  priority: 'medium',
  cooldownMinutes: 10,
  conditions: {
    patterns: [
      '(I\'m|I am) (confused|lost|not sure)',
      'what (do you mean|does that mean)',
      '(can you|could you) (explain|clarify)'
    ],
    messageCount: 2, // Wait for 2 confusion signals
    timeWindow: 5 // Within 5 minutes
  },
  action: {
    type: 'chat_message',
    template: 'The team seems confused about a topic. Provide a clear, concise explanation addressing the confusion. Reference specific messages that show confusion.'
  }
}
```

**Rule: Daily Standup Summary**
```typescript
{
  id: 'schedule-004',
  name: 'Daily Standup Summary',
  type: 'schedule',
  priority: 'medium',
  cooldownMinutes: 1440, // Once per day
  conditions: {
    schedule: '0 17 * * 1-5', // 5pm weekdays
    messageCount: 5 // Only if team was active today
  },
  action: {
    type: 'insight',
    insightType: 'summary',
    template: 'Generate end-of-day standup summary: (1) What was discussed, (2) Decisions made, (3) Action items, (4) Blockers mentioned, (5) Tomorrow\'s focus.'
  }
}
```

**Rule: Knowledge Gap Detector**
```typescript
{
  id: 'semantic-005',
  name: 'Knowledge Gap',
  type: 'semantic',
  priority: 'low',
  cooldownMinutes: 60,
  conditions: {
    keywords: [
      'what is', 'explain', 'define', 'how does', 'unfamiliar with'
    ],
    messageCount: 3, // Same topic asked multiple times
    timeWindow: 30
  },
  action: {
    type: 'insight',
    insightType: 'suggestion',
    template: 'The team is asking about a concept repeatedly. Provide: (1) Clear definition, (2) Context, (3) Examples, (4) Relevant resources. Format as educational insight.'
  }
}
```

#### Integration Points:

**In `backend/src/controllers/aiAgentController.ts`:**
```typescript
static async handleNewMessage(message: MessageDTO): Promise<void> {
  // 1. Check @agent mentions (existing reactive mode)
  if (shouldAgentRespond(message)) {
    await this.generateChatResponse(message);
  }
  
  // 2. Evaluate chime rules (NEW autonomous mode)
  const chimeEvaluator = new ChimeEvaluator();
  const decisions = await chimeEvaluator.evaluate(message.teamId, message);
  
  for (const decision of decisions) {
    await chimeEvaluator.executeChime(decision);
  }
}
```

**Socket Event Stream:**
```typescript
// Message ingestion (already implemented)
socket.on('message:new', (message) => {
  // Store message
  // Trigger chime evaluation
});

// Insight ingestion (NEW - for cross-insight patterns)
socket.on('ai:insight:new', (insight) => {
  // Store insight
  // Check if patterns across insights emerge
  // e.g., 3 "action" insights in 10min → suggest creating project plan
});
```

#### Chime Rules Database Schema:

```prisma
model ChimeRule {
  id              String   @id @default(uuid())
  name            String
  type            String   // 'pattern' | 'threshold' | 'semantic' | 'schedule'
  enabled         Boolean  @default(true)
  priority        String   // 'low' | 'medium' | 'high' | 'critical'
  cooldownMinutes Int      @default(30)
  conditions      String   // JSON serialized conditions
  action          String   // JSON serialized action config
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Optional: team-specific rules
  teamId          String?
  team            Team?    @relation(fields: [teamId], references: [id])
}

model ChimeLog {
  id          String   @id @default(uuid())
  ruleId      String
  teamId      String
  triggeredAt DateTime @default(now())
  outcome     String   // 'success' | 'cooldown' | 'error'
  messageId   String?  // If created message
  insightId   String?  // If created insight
  
  rule        ChimeRule @relation(fields: [ruleId], references: [id])
  team        Team      @relation(fields: [teamId], references: [id])
}
```

#### Admin UI (Future):
- `/admin/chime-rules` page to enable/disable/configure rules
- Visual rule builder (like Zapier/IFTTT)
- Chime history dashboard (which rules fired, when, outcomes)
- Rule performance metrics (false positives, user feedback)

---

## Real-time Events (Socket.IO)

### Currently Implemented Events

| Event Name | Direction | Payload | Purpose |
|------------|-----------|---------|---------|
| `message:new` | Server → Client | `MessageDTO` | New chat message (user or agent) |
| `message:edited` | Server → Client | `MessageDTO` | Message updated |
| `message:deleted` | Server → Client | `{ messageId: string }` | Message removed |
| `ai:insight:new` | Server → Client | `AIInsightDTO` | New AI insight generated (user-triggered or chime) |

### Socket Rooms
- Format: `team:${teamId}` (e.g., `team:team1`)
- Clients join room when viewing a team: `socketService.joinTeam(teamId)`
- Broadcasts only go to users in the same team room
- Server-side: `io.to(\`team:\${teamId}\`).emit('event', data)`

### Event Naming Convention
- Use `resource:action` format (e.g., `message:new`, `insight:deleted`)
- Keep event names lowercase with colons
- Payloads should match DTO shapes from `packages/types`

---

## Frontend Component Patterns

### Zustand Store Usage

**✅ Correct (Subscribe to Data):**
```typescript
// Subscribes to actual data changes
const allInsights = useAIInsightsStore((state) => state.insights);
const messages = useChatStore((state) => state.messages);

// Component re-renders when data changes
const insights = useMemo(() => {
  return allInsights[teamId] || [];
}, [allInsights, teamId]);
```

**❌ Wrong (Subscribe to Function):**
```typescript
// Subscribes to function reference (never changes!)
const getTeamInsights = useAIInsightsStore((state) => state.getTeamInsights);

// Component won't re-render when data changes
const insights = useMemo(() => {
  return getTeamInsights(teamId);
}, [teamId, getTeamInsights]); // getTeamInsights reference never changes!
```

### Socket Room Joining Pattern

Every component displaying real-time data must join the team room:

```typescript
// Example from MessageList.tsx and RightPanel.tsx
useEffect(() => {
  if (teamId) {
    socketService.joinTeam(teamId);
    
    // Optional: Fetch initial data from API
    fetchMessages(teamId);
    fetchInsights(teamId);
  }
  
  return () => {
    if (teamId) {
      socketService.leaveTeam();
    }
  };
}, [teamId]);
```

### Auto-Scroll Pattern

Components with chronological content should auto-scroll to bottom:

```typescript
const scrollRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }
}, [contentArray.length, teamId]);

return (
  <div ref={scrollRef} className="overflow-y-auto">
    {contentArray.map(item => <ItemComponent key={item.id} {...item} />)}
  </div>
);
```

---

## Backend Controller Patterns

### Standard CRUD + Socket Broadcast

```typescript
// Example from MessageController
static async createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
  const message = await prisma.message.create({ data });
  const messageDTO = messageToDTO(message);
  
  // Broadcast to team room
  if (this.io) {
    this.io.to(`team:${message.teamId}`).emit('message:new', messageDTO);
    console.log(`[MessageController] 📨 Broadcasted message:new to team: ${message.teamId}`);
  }
  
  return messageDTO;
}
```

### AI Generation + Storage + Broadcast

```typescript
// Example from AIInsightController
static async generateSummary(teamId: string): Promise<AIInsightDTO> {
  // 1. Fetch context
  const messages = await MessageController.getMessages(teamId);
  const team = await TeamController.getTeamById(teamId);
  
  // 2. Build conversation history
  const conversationHistory = buildConversationContext(messages, team, 50);
  
  // 3. Call LLM
  const response = await this.llm.generate({
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.summarizer },
      ...conversationHistory,
      { role: 'user', content: 'Generate a comprehensive summary...' }
    ],
    maxTokens: 4096,
    temperature: 0.7
  });
  
  // 4. Save to DB
  const insight = await prisma.aIInsight.create({
    data: {
      teamId,
      type: 'summary',
      title: 'Conversation Summary',
      content: response.content,
      priority: 'medium',
      tags: JSON.stringify(['auto-generated', 'summary', response.model])
    }
  });
  
  const insightDTO = aiInsightToDTO(insight);
  
  // 5. Broadcast
  if (this.io) {
    this.io.to(`team:${teamId}`).emit('ai:insight:new', insightDTO);
    console.log(`[AIInsightController] 🤖 Broadcasted ai:insight:new to team: ${teamId}`);
  }
  
  // 6. Return
  return insightDTO;
}
```

### Chime Rule Execution (Future Pattern)

```typescript
// Example from ChimeEvaluator (TODO)
async executeChime(decision: ChimeDecision): Promise<void> {
  const { rule, teamId, triggeringMessages } = decision;
  
  // 1. Build context
  const messages = await MessageController.getMessages(teamId);
  const context = buildConversationContext(messages, team, 20);
  
  // 2. Call LLM with rule template
  const response = await this.llm.generate({
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.chimeAgent },
      ...context,
      { role: 'user', content: rule.action.template }
    ]
  });
  
  // 3. Create insight or message based on rule action
  if (rule.action.type === 'insight') {
    await AIInsightController.createInsight({
      teamId,
      type: rule.action.insightType,
      title: `AI ${rule.name}`,
      content: response.content,
      tags: ['auto-generated', 'chime', rule.name],
      metadata: { chimeRuleName: rule.name }
    });
  } else if (rule.action.type === 'chat_message') {
    await MessageController.createMessage({
      teamId,
      authorId: 'agent',
      content: response.content,
      metadata: { chimeRuleName: rule.name }
    });
  }
  
  // 4. Log chime execution
  await prisma.chimeLog.create({
    data: {
      ruleId: rule.id,
      teamId,
      outcome: 'success'
    }
  });
}
```

---

## Developer Workflows

### First-Time Setup
```powershell
# Clone repo
git clone https://github.com/juzzztinsoong/fypai.git
cd fypai

# Install dependencies (from root - uses npm workspaces)
npm install

# Build shared types package
cd packages/types
npm run build
cd ../..

# Set up environment variables
# Create backend/.env with:
GITHUB_TOKEN=your_personal_access_token
DATABASE_URL=file:./dev.db

# Run Prisma migrations
cd backend
npx prisma migrate dev
npx prisma generate
cd ..
```

### Daily Development
```powershell
# Terminal 1: Backend
cd backend
npm run dev
# Runs on http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm run dev
# Runs on http://localhost:3000
```

### Database Management
```powershell
# View database in browser
cd backend
npx prisma studio
# Opens on http://localhost:5555

# Create new migration
npx prisma migrate dev --name add_chime_rules_table

# Reset database (dev only!)
npx prisma migrate reset
```

### Type Changes
```powershell
# After modifying packages/types/src/dtos.ts
cd packages/types
npm run build

# Restart both frontend and backend servers
```

---

## Conventions to Follow

### File Naming
- Components: `PascalCase.tsx` (e.g., `MessageBubble.tsx`)
- Stores: `camelCase.ts` (e.g., `chatStore.ts`)
- Services: `camelCase.ts` (e.g., `messageService.ts`)
- Routes: `camelCase.ts` (e.g., `messageRoutes.ts`)
- Controllers: `PascalCase.ts` (e.g., `MessageController.ts`)

### Import Aliases
- Frontend: `@/` alias for `src/` directory
- Backend: Relative imports
- Shared types: `import { MessageDTO } from '@fypai/types'`

### Code Organization
- Keep components under 300 lines (split if larger)
- Extract reusable logic into custom hooks (`hooks/`)
- Keep API calls in service layer, not directly in components
- Use Zustand for shared state, `useState` for local UI state
- Controllers handle business logic, routes delegate to controllers

### Error Handling
- Backend: Return proper HTTP status codes (200, 201, 400, 404, 500)
- Frontend: Handle errors in service layer, show user-friendly messages
- Log errors with context: `console.error('[ComponentName]', error)`
- Use try-catch in async functions

### Logging Convention
```typescript
// Backend
console.log('[ControllerName] Action description:', data);

// Frontend
console.log('[ComponentName] Action description:', data);

// Socket events
console.log('[Socket] 📨 Event name:', payload);
```

---

## What AI Agents Should Do

### When Asked to Add a Feature

1. **Identify the layer**: Is it UI (frontend), API (backend), or both?
2. **Check existing patterns**: Look at similar features (e.g., message flow for new entity)
3. **Update types first**: Add DTOs to `packages/types/src/dtos.ts` and rebuild
4. **Backend first**: 
   - Update Prisma schema if needed
   - Create/update controller methods
   - Add routes
   - Add socket event broadcasts
5. **Frontend next**:
   - Update service layer
   - Update Zustand store
   - Create/update components
6. **Test real-time**: Verify socket broadcasts work in multiple browser windows

### When Asked to Implement Chime Rules

1. **Define the rule clearly**: What pattern triggers it? What should AI do?
2. **Choose rule type**: Pattern, threshold, semantic, schedule, or hybrid?
3. **Add to `backend/src/ai/agent/rules.ts`**: Define the rule object
4. **Implement pattern detector**: Add to `patternDetectors.ts` if needed
5. **Update evaluator**: Ensure `ChimeEvaluator` can handle the new rule type
6. **Test with real conversations**: Verify rule triggers correctly, no false positives
7. **Add cooldown**: Prevent spam (default 30min between same rule)

### When Asked to Implement RAG Enhancements (Phase 5)

1. **Check current RAG status**: Is embedding worker running? Are messages being embedded?
2. **Verify Pinecone connection**: Use `GET /api/stats/embeddings` to check usage
3. **Test semantic search**: Use debug endpoint or write test script
4. **Enhance context injection**:
   - RAG context should be system message (not user message)
   - Include relevance scores and timestamps
   - Add citation encouragement to prompts
5. **Tune similarity threshold**:
   - Start at 0.7, adjust based on result quality
   - Higher threshold = more relevant but fewer results
   - Lower threshold = more results but lower quality
6. **Handle edge cases**:
   - Pinecone down → graceful degradation
   - No results found → continue without RAG
   - Embedding generation fails → log to dead letter queue

### When Asked to Fix a Bug

1. **Reproduce**: Understand exact steps to trigger the bug
2. **Check console**: Frontend (browser DevTools) and backend (terminal) logs
3. **Trace data flow**: Follow the path from user action → API → DB → socket → UI
4. **Identify root cause**: Don't just patch symptoms
5. **Fix and test**: Verify fix works, check for regressions
6. **Update types if needed**: Rebuild `packages/types` if DTOs changed

### When Unsure About Approach

1. **Ask clarifying questions** before implementing
2. **Propose options** with pros/cons
3. **Follow existing patterns** (look at similar code)
4. **Update this file** if you establish a new pattern

---

## Documentation Policy - IMPORTANT

**DO NOT create markdown documentation files after every fix or change unless explicitly requested by the user.**

- Only create documentation when the user specifically asks for it
- Only create documentation for major features or complex architectural changes
- Prefer updating existing documentation over creating new files
- Use inline code comments for explaining specific implementations
- Answer questions directly in chat instead of creating files

**Existing documentation files to update when relevant:**
- `.github/copilot-instructions.md` - this file (architecture, conventions)
- `README.md` - project overview and quick start
- Component-level README files (only if they already exist)

**Examples of when NOT to create documentation:**
- ❌ After fixing a bug
- ❌ After applying a code change
- ❌ After implementing a small feature
- ❌ After answering a question
- ❌ After debugging an issue

**Examples of when to create documentation:**
- ✅ User explicitly asks "can you document this?"
- ✅ New major feature with complex setup (e.g., auth system, chime rules engine)
- ✅ Significant architectural changes affecting multiple systems
- ✅ User asks for a guide or tutorial

---

## Current Status & Roadmap

### ✅ Implemented & Working (Phase 1-4 Complete)
- Real-time chat with Socket.IO (team rooms)
- **AI Reactive Mode**: `@agent` mentions in chat
- **AI User-Triggered Mode**: Summary/Report generation buttons
- **AI Autonomous Mode**: Smart chime rules engine (pattern-based)
  - Decision detector, action commitment tracker, problem detector
  - Anti-spam measures (cooldowns, priority-based execution)
  - ChimeLog tracking for analytics and debugging
- **RAG Infrastructure** (Phase 4 Complete):
  - Embedding generation (GitHub Models `text-embedding-3-small`)
  - Pinecone vector database (1536 dimensions, serverless)
  - BullMQ background worker (concurrency: 3)
  - Semantic message retrieval (similarity threshold: 0.7)
  - Usage tracking API (`GET /api/stats/embeddings`)
- AI Insights system (summaries, reports, actions, suggestions)
- Right panel with content filtering (All, Summaries, Actions, Suggestions)
- Markdown rendering for AI content
- Team switching and persistence
- Message/insight storage in SQLite (dev)
- Socket.IO broadcasts for real-time sync across clients
- **Zustand state management** (refactored to 3 stores: entityStore, uiStore, sessionStore)
- Online presence indicators
- Typing indicators (full implementation)

### 🚧 In Progress - Phase 5 (RAG Enhancement & Validation)
**High Priority:**
- Inject RAG context as system message (higher LLM weight)
- Add relevance scores and timestamps to retrieved context
- Add citation support in prompts
- Create comprehensive RAG test suite (end-to-end verification)
- Backfill existing 70+ messages for realistic testing
- Tune similarity threshold with real data

**Medium Priority:**
- Error tracking integration (Sentry)
- In-memory caching layer
- Batch embedding generation
- Message preprocessing (clean text before embedding)
- RAG fallback logic (graceful degradation)
- Pinecone circuit breaker

**Low Priority:**
- Semantic chime rules (vector similarity instead of regex)
- RAG performance metrics
- Result caching

### 📋 Planned - Phases 6-9
**Phase 6: Multi-Agent Architecture**
- Tier 1 agent (gpt-4o-mini) for monitoring/drafts - 90% cheaper
- Tier 2 agent (gpt-4o) for complex reasoning
- Chat/insight routing based on content type
- Bidirectional message-insight linking
- Agent orchestration system

**Phase 7: Authentication**
- Clerk integration (email/OAuth)
- Team membership and permissions
- User onboarding flow
- Replace hardcoded `user1`

**Phase 8: Production Deployment**
- PostgreSQL migration from SQLite
- Team creation and invitation system
- Cloud deployment (Vercel + Railway/Render)
- Email service integration

**Phase 9: Adaptive UI**
- Plain-language rule builder
- User preference system (AI behavior, theme, layout)
- Custom insight categories

### 🐛 Known Issues & Watch Points
- **RAG not verified end-to-end**: Code exists but no test shows @agent using retrieved context
- **Small dataset**: Only 5 messages embedded, insufficient for quality testing
- **Arbitrary threshold**: 0.7 similarity not tuned with real data
- **No cross-team verification**: Team scoping implemented but not tested
- **Backend TypeScript**: Ensure `npx prisma generate` after schema changes

---

## 🎓 Lessons Learned & Common Bugs to Avoid

### Critical Lessons from Refactoring

#### 1. **Store Architecture - Direct Flow is King**
**What We Learned:**
- Event Bus added 3 unnecessary layers of abstraction
- Direct `Service → Store → Component` flow is simpler and faster
- Fewer moving parts = fewer bugs

**Bug to Avoid:**
```typescript
// ❌ WRONG: Subscribing to function reference
const fetchMessages = useChatStore((state) => state.fetchMessages);
const messages = fetchMessages(teamId); // Component won't re-render!

// ✅ CORRECT: Subscribe to data
const messages = useEntityStore((state) => state.getMessages(teamId));
```

**Why it breaks:** Function references never change, so Zustand won't trigger re-renders. Always subscribe to actual data, not methods.

---

#### 2. **Stable Empty References Prevent Re-render Storms**
**What We Learned:**
- `[] !== []` in JavaScript - new arrays break React memoization
- Returning stable frozen empty objects prevents unnecessary re-renders

**Bug to Avoid:**
```typescript
// ❌ WRONG: Creates new array every call
getMessages: (teamId) => {
  return get().messages[teamId] || []; // NEW array each time!
}

// ✅ CORRECT: Stable frozen reference
const EMPTY_ARRAY = Object.freeze([]) as MessageDTO[];
getMessages: (teamId) => {
  return get().messages[teamId] || EMPTY_ARRAY; // Same reference
}
```

**Impact:** This single fix reduced typing indicator re-renders from 100+ to 3 per second.

---

#### 3. **TypeScript Type Inference Can Fail**
**What We Learned:**
- Literal types like `'user' | 'assistant' | 'system'` need explicit assertion
- Pinecone metadata types are stricter than expected

**Bug to Avoid:**
```typescript
// ❌ WRONG: TypeScript infers as string, not literal
const messages = [
  { role: 'system', content: '...' } // Error: Type 'string' not assignable to 'system'
];

// ✅ CORRECT: Use `as const` for literal type inference
const messages = [
  { role: 'system' as const, content: '...' }
];
```

**Fix applied:** Added `as const` to all LLM message role assignments.

---

#### 4. **Prisma Regeneration After Schema Changes**
**What We Learned:**
- TypeScript errors like "Property 'chimeLog' does not exist" mean Prisma client is stale
- Schema changes require regeneration AND server restart

**Bug to Avoid:**
```bash
# ❌ WRONG: Edit schema, restart server immediately
# Result: TypeScript compilation errors

# ✅ CORRECT: Regenerate Prisma client first
npx prisma generate
npm run dev
```

**Always do:** `npx prisma generate` after editing `schema.prisma`.

---

#### 5. **Socket Deduplication is Essential**
**What We Learned:**
- REST API response + Socket broadcast = potential duplicate
- Need correlation IDs and deduplication logic

**Bug to Avoid:**
```typescript
// ❌ WRONG: No deduplication
addMessage: (message) => set((state) => ({
  messages: [...state.messages, message] // Adds duplicate from socket
}))

// ✅ CORRECT: Check if message already exists
addMessage: (message) => set((state) => {
  if (state.entities.messages[message.id]) {
    return state; // Already exists, skip
  }
  // ... add message
})
```

**Impact:** Without this, users see duplicate messages from REST + Socket events.

---

#### 6. **Chime Rules Need Anti-Spam Measures**
**What We Learned:**
- Agent's own messages can trigger chime rules → infinite loops
- Multiple rules triggering on same message = spam
- Generic patterns ("error", "urgent") cause false positives

**Bugs Fixed:**
```typescript
// ✅ Skip agent's own messages
if (message.authorId === 'agent') {
  console.log('Skipping agent message to prevent loops');
  return;
}

// ✅ Execute only highest priority rule
const topDecision = decisions[0]; // Not all decisions
await this.executeChime(topDecision);

// ✅ Tightened patterns
// Before: 'urgent' (too broad)
// After: 'urgent.+(deadline|task|issue)' (requires context)
```

**Impact:** Reduced chime spam from 3-4 per message to max 1.

---

#### 7. **Embedding API Choice Matters**
**What We Learned:**
- GitHub Models (Azure) provides free embeddings vs OpenAI's paid tier
- Usage tracking requires manual implementation (not built-in)
- Different endpoint, same SDK (OpenAI-compatible)

**Bug to Avoid:**
```typescript
// ❌ WRONG: Using OPENAI_API_KEY with GitHub Models endpoint
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Won't work!
  baseURL: 'https://models.inference.ai.azure.com'
});

// ✅ CORRECT: Use GITHUB_TOKEN
const openai = new OpenAI({
  apiKey: process.env.GITHUB_TOKEN,
  baseURL: 'https://models.inference.ai.azure.com'
});
```

**Monitoring:** GitHub Models usage tracked at github.com/settings/models (not OpenAI dashboard).

---

#### 8. **RAG Context Placement Affects LLM Behavior**
**What We Learned:**
- User message role has lower weight than system message
- Appending RAG as user message can be ignored by LLM
- System messages before conversation = higher priority

**Bug to Avoid:**
```typescript
// ❌ WRONG: RAG as user message (low priority)
messages: [
  { role: 'system', content: systemPrompt },
  ...conversationHistory,
  { role: 'user', content: ragContext } // LLM may ignore this
]

// ✅ CORRECT: RAG as system message (high priority)
messages: [
  { role: 'system', content: systemPrompt },
  { role: 'system', content: `IMPORTANT CONTEXT:\n${ragContext}` },
  ...conversationHistory
]
```

**Status:** Identified in Phase 5 planning, not yet implemented.

---

#### 9. **React 18 Strict Effects Unmount/Remount**
**What We Learned:**
- React 18 automatically unmounts/remounts in dev mode
- `useEffect` with `[]` dependency runs once on first mount only
- Socket connections need to persist across remounts

**Bug to Avoid:**
```typescript
// ❌ WRONG: Socket handlers in useEffect with []
useEffect(() => {
  socket.on('message:new', handler);
  return () => socket.off('message:new', handler); // Cleanup removes handler
}, []); // After remount, handlers gone but effect doesn't re-run!

// ✅ CORRECT: Initialize socket outside React lifecycle
// File: services/realtimeInit.ts
let initPromise = null;
export async function initializeRealtime(userId) {
  if (initPromise) return initPromise; // Idempotent
  initPromise = connectAndRegisterHandlers(userId);
  return initPromise;
}
```

**Fix applied:** Moved socket initialization to `realtimeInit.ts` singleton pattern.

---

#### 10. **Dependencies vs DevDependencies**
**What We Learned:**
- `@types/*` packages should be in `devDependencies`
- Runtime packages must be in `dependencies`
- Monorepo shared packages need proper linking

**Bug to Avoid:**
```json
// ❌ WRONG: Types in dependencies
"dependencies": {
  "@types/node": "^20.0.0"
}

// ✅ CORRECT: Types in devDependencies
"devDependencies": {
  "@types/node": "^20.0.0"
}
```

**Impact:** Smaller production builds, clearer dependency tree.

---

### Quick Bug Checklist

Before pushing code, verify:
- [ ] `npx prisma generate` after schema changes
- [ ] `npm run build` in `packages/types` after DTO changes
- [ ] Subscriptions use data, not function references
- [ ] Empty arrays/objects are frozen constants
- [ ] TypeScript uses `as const` for literal types
- [ ] Deduplication logic for socket + REST events
- [ ] Agent messages skipped in chime evaluation
- [ ] RAG context as system message (if applicable)
- [ ] Socket initialization is idempotent
- [ ] No infinite loops in useEffect dependencies

---

## Questions for Maintainers

If you're an AI coding agent and need clarification:

1. **For new features**: Ask "Should this go in chat (MessageDTO) or insights (AIInsightDTO)?"
2. **For AI behavior**: Ask "Should this be reactive (@agent), user-triggered (button), or autonomous (chime rule)?"
3. **For UI changes**: Ask "Which column should this appear in (sidebar, chat, or right panel)?"
4. **For data persistence**: Ask "Should this be in the database or just in-memory?"
5. **For chime rules**: Ask "What pattern triggers this? What should AI do? How often can it chime?"

---

**Last Updated:** November 19, 2025  
**Current Phase:** Phase 5 - RAG Enhancement & Validation  
**Stack Version:** React 18, Node 20, Prisma 5, Socket.IO 4, Vite 7  
**Repository:** https://github.com/juzzztinsoong/fypai
