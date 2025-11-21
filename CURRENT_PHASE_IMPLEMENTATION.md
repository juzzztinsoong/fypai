# Current Phase Implementation Guide

**Project**: FYP AI - Collaborative Team AI Assistant  
**Purpose**: Actionable tasks for Phases 5-9 based on production refactoring plan  
**Current Status**: Phase 4 complete (RAG infrastructure), ready for Phase 5  
**Last Updated**: November 20, 2025

---

## Overview

This document extracts **immediately actionable** items from the production refactoring guide that apply to the current development phase (Phases 5-9). It focuses on enhancements that can be implemented **now** without requiring the full Phase 1-4 refactoring.

---

## Phase 5: RAG Enhancement (Current Priority)

### 5.1 Message Processing Pipeline (READY TO IMPLEMENT)

**Status**: Infrastructure exists, needs optimization

**Current State:**
- ✅ Embedding generation working (via GitHub Models)
- ✅ Background worker operational (BullMQ)
- ✅ Pinecone storage functional
- ⚠️ No batch processing
- ⚠️ No preprocessing/cleaning

**Improvements Needed:**

#### Batch Embedding Generation
**File:** `backend/src/services/embeddingService.ts`

**Add method:**
```typescript
async generateBatch(texts: string[]): Promise<number[][]> {
  console.log(`[EmbeddingService] Generating embeddings for ${texts.length} texts...`);
  
  try {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: texts, // OpenAI supports array input
    });
    
    const embeddings = response.data.map(item => item.embedding);
    const totalTokens = response.usage.total_tokens;
    
    this.totalTokensUsed += totalTokens;
    this.totalRequests++;
    
    console.log(`[EmbeddingService] ✅ Generated ${embeddings.length} embeddings (${totalTokens} tokens)`);
    return embeddings;
  } catch (error) {
    console.error('[EmbeddingService] Batch generation failed:', error);
    throw error;
  }
}
```

**Use case:** Backfill script can process 20 messages at once instead of one-by-one.

---

#### Message Preprocessing
**File:** `backend/src/services/embeddingService.ts`

**Add helper:**
```typescript
private preprocessText(text: string): string {
  // 1. Remove @mentions (not meaningful for semantic search)
  let cleaned = text.replace(/@\w+/g, '');
  
  // 2. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // 3. Remove special characters (keep punctuation)
  cleaned = cleaned.replace(/[^\w\s.,!?-]/g, '');
  
  // 4. Truncate to 8000 characters (OpenAI limit)
  if (cleaned.length > 8000) {
    cleaned = cleaned.substring(0, 8000);
    console.log('[EmbeddingService] Truncated long message');
  }
  
  return cleaned;
}

// Update generateEmbedding to use preprocessing
async generateEmbedding(text: string): Promise<number[]> {
  const cleaned = this.preprocessText(text);
  // ... rest of existing code
}
```

**Benefits:**
- More consistent embeddings
- Better semantic search quality
- Avoid API errors from invalid characters

---

### 5.2 Error Tracking Integration (HIGH VALUE)

**Status**: No error tracking currently

**Quick Win:** Add Sentry or similar error tracking

**Setup (15 minutes):**

```bash
# Backend
cd backend
npm install @sentry/node @sentry/profiling-node

# Frontend  
cd frontend
npm install @sentry/react
```

**Backend Integration:**
**File:** `backend/src/index.ts`

**Add at top:**
```typescript
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

// Add after app initialization
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Add before other error handlers
app.use(Sentry.Handlers.errorHandler());
```

**Frontend Integration:**
**File:** `frontend/src/main.tsx`

**Add:**
```typescript
import * as Sentry from '@sentry/react';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

**Environment Variables:**
```env
# backend/.env
SENTRY_DSN=https://your-key@sentry.io/project-id

# frontend/.env
VITE_SENTRY_DSN=https://your-key@sentry.io/project-id
```

**Benefits:**
- Catch production errors automatically
- Stack traces and context
- Free tier: 5,000 events/month

---

### 5.3 Caching Layer (MEDIUM PRIORITY)

**Status**: No caching, repeated API/DB calls

**Quick Win:** Add in-memory cache for common operations

**Option A: Simple In-Memory Cache (No Redis)**

**File:** `backend/src/services/cacheService.ts` (NEW)

```typescript
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 300; // 5 minutes

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttlSeconds: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000),
    });
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  // Cleanup expired entries every 5 minutes
  startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 300000);
  }
}

export const cacheService = new CacheService();
```

**Usage Example:**

**File:** `backend/src/controllers/messageController.ts`

```typescript
import { cacheService } from '../services/cacheService.js';

static async getMessages(teamId: string): Promise<MessageDTO[]> {
  const cacheKey = `messages:${teamId}`;
  
  // Try cache first
  const cached = cacheService.get<MessageDTO[]>(cacheKey);
  if (cached) {
    console.log('[MessageController] 💾 Cache hit for team:', teamId);
    return cached;
  }
  
  // Fetch from DB
  const messages = await prisma.message.findMany({
    where: { teamId },
    include: { author: true },
    orderBy: { createdAt: 'asc' },
  });
  
  const messageDTOs = messages.map(messageToDTO);
  
  // Cache for 5 minutes
  cacheService.set(cacheKey, messageDTOs, 300);
  
  return messageDTOs;
}

// Invalidate cache on new message
static async createMessage(data: CreateMessageRequest): Promise<MessageDTO> {
  const message = await prisma.message.create({ data });
  
  // Invalidate team message cache
  cacheService.invalidate(`messages:${message.teamId}`);
  
  const messageDTO = messageToDTO(message);
  // ... rest of code
}
```

**Start cleanup in server:**
**File:** `backend/src/index.ts`

```typescript
import { cacheService } from './services/cacheService.js';

// Start cache cleanup
cacheService.startCleanup();
```

**Benefits:**
- No external dependencies (Redis not needed yet)
- Reduce DB queries by 70-80%
- Easy to implement (30 minutes)

---

## Phase 6: Multi-Agent Preparation

### 6.1 Response Classification Logic (FOUNDATION)

**Status**: All AI responses go to chat

**Needed:** Logic to route responses to chat vs insights panel

**File:** `backend/src/services/responseClassifier.ts` (NEW)

```typescript
export interface ClassificationResult {
  channel: 'chat' | 'insight';
  insightType?: 'summary' | 'document' | 'action' | 'suggestion' | 'analysis' | 'code';
  reasoning: string;
}

export class ResponseClassifier {
  classify(content: string, context?: any): ClassificationResult {
    // Rule 1: Length check
    if (content.length < 200) {
      return {
        channel: 'chat',
        reasoning: 'Short response (< 200 chars)',
      };
    }

    // Rule 2: Code blocks
    if (this.hasCodeBlock(content)) {
      return {
        channel: 'insight',
        insightType: 'code',
        reasoning: 'Contains code block',
      };
    }

    // Rule 3: Lists and structure
    if (this.isStructured(content)) {
      return {
        channel: 'insight',
        insightType: this.detectInsightType(content),
        reasoning: 'Structured content (lists, sections)',
      };
    }

    // Rule 4: Very long responses
    if (content.length > 500) {
      return {
        channel: 'insight',
        insightType: 'analysis',
        reasoning: 'Long-form content (> 500 chars)',
      };
    }

    // Default: chat for conversational responses
    return {
      channel: 'chat',
      reasoning: 'Conversational response',
    };
  }

  private hasCodeBlock(content: string): boolean {
    return /```[\s\S]*?```/.test(content);
  }

  private isStructured(content: string): boolean {
    // Check for markdown lists, headings, etc.
    const hasLists = /^[-*+]\s/m.test(content) || /^\d+\.\s/m.test(content);
    const hasHeadings = /^#{1,6}\s/m.test(content);
    return hasLists || hasHeadings;
  }

  private detectInsightType(content: string): 'summary' | 'action' | 'analysis' {
    const lower = content.toLowerCase();
    
    if (lower.includes('action item') || lower.includes('todo') || lower.includes('next step')) {
      return 'action';
    }
    
    if (lower.includes('summary') || lower.includes('recap') || lower.includes('overview')) {
      return 'summary';
    }
    
    return 'analysis';
  }
}

export const responseClassifier = new ResponseClassifier();
```

**Integration:**
**File:** `backend/src/controllers/aiAgentController.ts`

```typescript
import { responseClassifier } from '../services/responseClassifier.js';

static async generateResponse(...): Promise<void> {
  // ... existing code to generate response
  
  const aiResponse = response.content;
  
  // Classify response
  const classification = responseClassifier.classify(aiResponse);
  
  if (classification.channel === 'chat') {
    // Post as chat message (existing behavior)
    await MessageController.createMessage({
      teamId,
      authorId: 'agent',
      content: aiResponse,
      contentType: 'text',
      metadata: { classification: classification.reasoning },
    });
  } else {
    // Create insight instead
    await AIInsightController.createInsight({
      teamId,
      type: classification.insightType!,
      title: this.generateTitle(aiResponse),
      content: aiResponse,
      priority: 'medium',
      tags: ['auto-generated', 'agent-response'],
      metadata: { 
        classification: classification.reasoning,
        triggeringMessage: currentMessage.id,
      },
    });
    
    // Post short summary in chat
    await MessageController.createMessage({
      teamId,
      authorId: 'agent',
      content: `💡 I've created a ${classification.insightType} insight. Check the right panel.`,
      contentType: 'text',
    });
  }
}

private static generateTitle(content: string): string {
  // Extract first line or first sentence
  const firstLine = content.split('\n')[0];
  const firstSentence = content.split('.')[0];
  
  const candidate = firstLine.length < firstSentence.length ? firstLine : firstSentence;
  
  // Truncate and clean
  return candidate
    .replace(/^#+\s*/, '') // Remove markdown headings
    .substring(0, 60)
    .trim() + (candidate.length > 60 ? '...' : '');
}
```

**Benefits:**
- Cleaner chat history
- Insights panel becomes useful
- Foundation for multi-agent routing

---

### 6.2 Agent Metadata Tracking

**Status**: No tracking of which agent/model generated responses

**Needed:** Track agent type, model, costs for multi-agent optimization

**Database Schema Update:**
**File:** `backend/prisma/schema.prisma`

**Add to Message model:**
```prisma
model Message {
  // ... existing fields
  
  metadata        String? // JSON
  agentMetadata   String? // NEW - JSON with agent info
}

model AIInsight {
  // ... existing fields
  
  metadata        String? // Already exists, but expand usage
}
```

**Metadata Structure:**
```typescript
interface AgentMetadata {
  modelUsed: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo';
  agentType?: 'monitor' | 'summary' | 'analysis' | 'code'; // For future
  tokensUsed: number;
  estimatedCost: number;
  latencyMs: number;
  tier: 1 | 2; // For multi-agent tracking
}
```

**Update aiAgentController:**
```typescript
static async generateResponse(...): Promise<void> {
  const startTime = Date.now();
  
  const response = await this.llm.generate({
    messages,
    maxTokens: 2000,
    temperature: 0.7,
  });
  
  const latencyMs = Date.now() - startTime;
  const tokensUsed = response.usage.total_tokens;
  const estimatedCost = this.calculateCost(response.model, tokensUsed);
  
  const agentMetadata: AgentMetadata = {
    modelUsed: response.model,
    tokensUsed,
    estimatedCost,
    latencyMs,
    tier: 1, // Will be 2 for Tier 2 agents later
  };
  
  // Store in message/insight
  await MessageController.createMessage({
    // ... existing fields
    agentMetadata: JSON.stringify(agentMetadata),
  });
}

private static calculateCost(model: string, tokens: number): number {
  const pricing = {
    'gpt-4o': 0.005 / 1000,           // $5 per 1M tokens
    'gpt-4o-mini': 0.00015 / 1000,    // $0.15 per 1M tokens
    'gpt-3.5-turbo': 0.0005 / 1000,   // $0.50 per 1M tokens
  };
  
  return (pricing[model] || 0) * tokens;
}
```

**Benefits:**
- Track cost per agent type
- Identify which agents to optimize
- Foundation for Tier 1/Tier 2 cost analysis

---

## Phase 7: Authentication Preparation

### 7.1 Remove Hardcoded User References

**Status**: `userId: 'user1'` hardcoded in multiple places

**Quick Audit:** Find all hardcoded references

```bash
# Search for hardcoded user IDs
cd frontend
grep -r "user1" src/

cd backend  
grep -r "user1" src/
```

**Refactor Pattern:**

**Frontend - Current:**
```typescript
// ❌ Bad - hardcoded
const userId = 'user1';
```

**Frontend - Better:**
```typescript
// ✅ Good - from store
const userId = useUserStore((state) => state.currentUser?.id);

if (!userId) {
  // Handle unauthenticated state
  return <LoginPrompt />;
}
```

**Create placeholder AuthStore:**
**File:** `frontend/src/stores/authStore.ts` (NEW)

```typescript
import { create } from 'zustand';
import type { UserDTO } from '@fypai/types';

interface AuthState {
  currentUser: UserDTO | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Temporary: set hardcoded user
  setHardcodedUser: (user: UserDTO) => void;
  
  // Future: real auth methods
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  isAuthenticated: false,
  isLoading: false,
  
  // Temporary implementation
  setHardcodedUser: (user) => set({ 
    currentUser: user, 
    isAuthenticated: true 
  }),
  
  // Placeholder for future
  login: async (email, password) => {
    throw new Error('Authentication not yet implemented');
  },
  
  logout: () => set({ 
    currentUser: null, 
    isAuthenticated: false 
  }),
}));
```

**Initialize in App:**
**File:** `frontend/src/App.tsx`

```typescript
import { useAuthStore } from './stores/authStore';

function App() {
  const setHardcodedUser = useAuthStore((state) => state.setHardcodedUser);
  
  useEffect(() => {
    // Temporary: set hardcoded user on mount
    setHardcodedUser({
      id: 'user1',
      name: 'Alice',
      email: 'alice@example.com',
      // ... other fields
    });
  }, []);
  
  // ... rest of app
}
```

**Benefits:**
- Centralized user state
- Easy to swap for real auth later
- No breaking changes to existing code

---

## Phase 8: Database Migration Preparation

### 8.1 PostgreSQL-Compatible Schema Review

**Status**: Using SQLite, need to ensure Prisma schema works with PostgreSQL

**Action:** Review schema for SQLite-specific features

**File:** `backend/prisma/schema.prisma`

**Check:**
- ✅ UUID vs auto-increment IDs (UUID is cross-DB)
- ✅ JSON fields (supported in both)
- ⚠️ DateTime defaults (`@default(now())` works differently)

**Recommended Changes:**

```prisma
model Message {
  id          String   @id @default(uuid())  // ✅ UUID works everywhere
  createdAt   DateTime @default(now())       // ✅ Supported
  updatedAt   DateTime @updatedAt            // ✅ Supported
  
  // ⚠️ Avoid SQLite-specific:
  // embedding   Bytes // Bad for Postgres, use separate table
}
```

**For embeddings with pgvector:**

```prisma
model MessageEmbedding {
  id          String   @id @default(uuid())
  messageId   String   @unique
  embedding   String   // Store as JSON string for now, migrate to vector type later
  createdAt   DateTime @default(now())
  
  message     Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  
  @@index([messageId])
}
```

**Migration Strategy:**
1. Test schema in local PostgreSQL first
2. Use `prisma migrate diff` to compare
3. Create migration script for data transfer
4. Run migration on staging before production

---

### 8.2 Connection Pooling Setup

**Status**: Single database connection

**Needed:** Handle concurrent users in production

**File:** `backend/src/db.ts`

**Update:**
```typescript
import { PrismaClient } from '@prisma/client';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const prisma = new PrismaClient({
  log: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  
  // Connection pool settings
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Connection pool limits (for PostgreSQL)
if (process.env.DATABASE_URL?.startsWith('postgresql')) {
  prisma.$connect();
  console.log('[DB] PostgreSQL connection pool initialized');
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  console.log('[DB] Disconnected');
});
```

**Environment Variable (Production):**
```env
DATABASE_URL="postgresql://user:pass@host:5432/dbname?connection_limit=20&pool_timeout=10"
```

**Benefits:**
- Prevent "too many connections" errors
- Better performance under load
- Ready for production deployment

---

## Phase 9: UI Preferences Foundation

### 9.1 Theme System (QUICK WIN)

**Status**: No theme switching

**Quick Implementation:** Add dark/light theme toggle

**File:** `frontend/src/stores/uiStore.ts` (NEW or update existing)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  theme: 'light' | 'dark' | 'auto';
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'auto',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-preferences', // localStorage key
    }
  )
);
```

**File:** `frontend/src/App.tsx`

```typescript
import { useUIStore } from './stores/uiStore';

function App() {
  const theme = useUIStore((state) => state.theme);
  
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // Auto: check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [theme]);
  
  // ... rest of app
}
```

**Add Toggle Button:**
**File:** `frontend/src/components/Sidebar/Sidebar.tsx`

```typescript
import { useUIStore } from '../../stores/uiStore';

function Sidebar() {
  const { theme, setTheme } = useUIStore();
  
  return (
    <div className="sidebar">
      {/* ... existing sidebar content */}
      
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="theme-toggle"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  );
}
```

**Benefits:**
- User preference persisted in localStorage
- System preference support (auto mode)
- Foundation for more UI customization

---

## Implementation Priority Matrix

### Immediate (This Week):
1. ✅ **Error Tracking** (Sentry setup - 15 min)
2. ✅ **In-Memory Cache** (30 min)
3. ✅ **Message Preprocessing** (20 min)
4. ✅ **Batch Embeddings** (30 min)

### Short-Term (Next 2 Weeks):
5. ✅ **Response Classification** (2 hours)
6. ✅ **Agent Metadata Tracking** (1 hour)
7. ✅ **Auth Store Placeholder** (1 hour)
8. ✅ **Theme System** (1 hour)

### Medium-Term (Next Month):
9. ✅ **PostgreSQL Schema Validation** (2 hours)
10. ✅ **Connection Pooling** (1 hour)
11. ✅ **Hardcoded User Cleanup** (3 hours)

---

## Success Metrics

### Phase 5 Enhanced:
- [ ] Error tracking captures production issues
- [ ] Cache reduces DB queries by 70%+
- [ ] Message preprocessing improves RAG quality
- [ ] Batch backfill completes in <5 minutes

### Phase 6 Foundation:
- [ ] Response classification accuracy >90%
- [ ] Agent metadata tracked for all AI responses
- [ ] Cost tracking operational

### Phase 7 Foundation:
- [ ] No hardcoded user IDs in codebase
- [ ] Auth store centralized
- [ ] Ready for Clerk integration

### Phase 8 Foundation:
- [ ] Schema works with PostgreSQL
- [ ] Connection pooling configured
- [ ] Migration script tested

### Phase 9 Foundation:
- [ ] Theme switching works
- [ ] Preferences persist across sessions

---

## Quick Reference Commands

### Setup Error Tracking:
```bash
# Backend
cd backend
npm install @sentry/node
# Add to .env: SENTRY_DSN=...

# Frontend
cd frontend
npm install @sentry/react
# Add to .env: VITE_SENTRY_DSN=...
```

### Test Batch Embeddings:
```bash
cd backend
node backfill-embeddings.js
```

### Check for Hardcoded Users:
```bash
grep -r "user1" frontend/src/
grep -r "user1" backend/src/
```

### Test PostgreSQL Schema:
```bash
# Update DATABASE_URL to PostgreSQL
npx prisma migrate dev --name test_postgres
npx prisma studio # Verify
```

---

## Next Steps

1. **Implement immediate tasks** (error tracking, caching)
2. **Complete Phase 5 RAG verification** (see PHASE_5_PLAN.md)
3. **Prototype response classification** (foundation for multi-agent)
4. **Plan Clerk integration** (when ready for real auth)
5. **Test PostgreSQL migration** (on staging data)

---

**Document Status:** Active Implementation Guide  
**Last Updated:** November 20, 2025  
**Owner:** Justin Soong
