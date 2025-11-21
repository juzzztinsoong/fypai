# Master Implementation Plan: Phases 5-9

**Project**: FYP AI - Collaborative Team AI Assistant  
**Status**: Phase 5 Complete / Phase 6 Started  
**Last Updated**: November 22, 2025  
**Purpose**: Unified source of truth merging strategic vision, detailed planning, and actionable implementation steps for the remaining project phases.

---

## 🎯 Phase 5: RAG Enhancement & Validation (Completed)

**Goal**: Verify, enhance, and productionize the RAG system to ensure high-quality, context-aware AI responses.

### 5.1 Infrastructure & Hygiene (Completed)
*From Current Phase Implementation Guide*

1.  **Batch Embedding Generation** (✅ Complete)
    *   **Task**: Add `generateBatch` to `EmbeddingService`.
    *   **Details**: Implemented batch processing with **Batch Size: 5** and **Concurrency: 3** in `embeddingWorker.ts`.
    *   **Why**: Optimize backfill scripts to process messages in chunks rather than serially.
    *   **File**: `backend/src/services/embeddingService.ts`

2.  **Message Preprocessing** (✅ Complete)
    *   **Task**: Implement `preprocessText` helper.
    *   **Details**: Clean text before embedding (remove @mentions, excessive whitespace) to improve semantic search quality.
    *   **File**: `backend/src/services/embeddingService.ts`

3.  **Error Tracking Integration** (✅ Complete)
    *   **Task**: Integrate Sentry for backend and frontend.
    *   **Why**: Catch production errors automatically with stack traces.
    *   **Files**: `backend/src/index.ts`, `frontend/src/main.tsx`

### 5.2 RAG Context Enhancement (Completed)
*From Phase 5 Plan*

1.  **Inject RAG as System Message** (✅ Complete)
    *   **Task**: Move retrieved context from user message to system message.
    *   **Why**: System messages have higher weight. Prevents LLM from ignoring context.
    *   **File**: `backend/src/controllers/aiAgentController.ts`

2.  **Relevance Scores & Citations** (✅ Complete)
    *   **Task**:
        *   Pass relevance scores from Pinecone to the prompt builder.
        *   Update prompt to include `[Relevance: 95%] [2 days ago]` metadata in context.
        *   Update system prompt to encourage explicit citations ("As discussed yesterday...").
    *   **Files**: `backend/src/ai/llm/prompts.ts`, `backend/src/controllers/aiAgentController.ts`

### 5.3 Verification & Tuning (Completed)
*From Phase 5 Plan*

1.  **Comprehensive RAG Test Suite** (✅ Complete)
    *   **Task**: Create `backend/test-rag-verification.js`.
    *   **Tests**:
        *   Basic Retrieval (Topic A -> Response A)
        *   Team Scoping (Team 1 context != Team 2 context)
        *   Recency vs Relevance (Old relevant message > New irrelevant message)
        *   Threshold check (No results for nonsense query)

2.  **Debug Endpoint** (✅ Complete)
    *   **Task**: Create `POST /api/debug/rag-search`.
    *   **Why**: Allow manual testing of retrieval logic without triggering the full LLM flow.

3.  **Backfill & Threshold Tuning** (✅ Scripts Ready)
    *   **Task**: Run backfill script for all existing messages.
    *   **Task**: Create `tune-similarity-threshold.js` to empirically determine the best similarity cutoff (currently 0.7).

### 5.4 Resilience & Performance (Completed)
*Merged from Phase 5 Plan & Implementation Guide*

1.  **RAG Fallback Logic** (✅ Complete)
    *   **Task**: Wrap RAG retrieval in try/catch. If Pinecone fails, proceed with standard generation (graceful degradation) and log the error.
    *   **File**: `backend/src/controllers/aiAgentController.ts`

2.  **Circuit Breaker** (✅ Complete)
    *   **Task**: Implement simple failure counting in `PineconeService`. Stop calling API after N consecutive failures.
    *   **Details**: Implemented with **Max Failures: 5** and **Reset Timeout: 60s**.
    *   **File**: `backend/src/services/pineconeService.ts`

3.  **Caching Layer** (✅ Complete)
    *   **Task**: Implement `CacheService` (in-memory Map).
    *   **Usage**: Cache RAG results for identical queries (TTL 5 mins) and common DB lookups.
    *   **File**: `backend/src/services/cacheService.ts`

### 5.5 Refactoring & Architecture (Completed)
*Retrospective of recent architectural improvements*

1.  **AI Folder Restructure** (✅ Complete)
    *   **Task**: Refactored `backend/src/ai` into logical domains.
    *   **Structure**:
        *   `core/`: Shared utilities (Intent, Vibe, Prompts).
        *   `reactive/`: Direct responses (@agent).
        *   `autonomous/`: Background processes (Chime).
        *   `rules/`: Rule definitions and providers.

2.  **Rule Provider System** (✅ Complete)
    *   **Task**: Implemented `RuleProvider` class.
    *   **Logic**: Merges System Rules (hardcoded) with Team Rules (DB). DB rules override System rules by ID.
    *   **File**: `backend/src/ai/rules/ruleProvider.ts`

3.  **Database Hygiene** (✅ Complete)
    *   **Task**: Fixed Foreign Key constraints in `ChimeLog`.
    *   **Action**: Created and ran `seed-rules.ts` to populate `ChimeRule` table with default system rules.

4.  **Test Suite Cleanup** (✅ Complete)
    *   **Task**: Consolidated test files.
    *   **Action**: Deleted obsolete files (`test-rag-simple.js`, `test-rag-integration.js`) in favor of unified `test-phase4-rag.js`.

---

## 🚀 Phase 6: Multi-Agent & Dynamic Persona Architecture

**Goal**: Replace single-model approach with a tiered agent system for **90% cost reduction**, improved specialization, and **dynamic personality adaptation**.

### 6.1 Strategic Vision
*From Future Roadmap*

*   **Tier 1 (Monitoring/Drafting)**: `gpt-4o-mini`. Handles 90% of traffic. Fast, cheap ($0.0001/req). Used for pattern detection and simple replies.
*   **Tier 2 (Reasoning)**: `gpt-4o`. Handles 10% of traffic. Smart, expensive. Used for complex analysis and final decisions.
*   **Routing Logic**:
    *   **Output Routing**: Chat (short) vs. Insights Panel (long).
    *   **Behavioral Routing**: Adjusts "vibe" (Casual, Professional, Crisis) based on team context.

### 6.2 Implementation Steps
*From Current Phase Implementation Guide*

1.  **Unified Rule Engine** (New Priority)
    *   **Task**: Unify "Reactive" (@agent) and "Autonomous" (Chime) rules into a single engine.
    *   **Schema**: Update `ChimeRule` to support `type: 'mention'` and `intent` conditions.
    *   **Logic**: Ensure direct mentions (`type: 'mention'`) bypass the "AI Disabled" toggle, while other rules respect it.
    *   **File**: `backend/src/ai/autonomous/chimeEngine.ts`

2.  **Intent Classification Service**
    *   **Task**: Create `IntentClassifier` service.
    *   **Logic**: Classify intent as `direct_mention`, `question`, `code_request`, `summary_request`, `casual_chat`, or `none`.
    *   **File**: `backend/src/ai/core/intentClassifier.ts`

3.  **Migrate Reactive Rules**
    *   **Task**: Convert hardcoded `reactiveRules.ts` into declarative system rules.
    *   **Action**: Create `DIRECT_MENTION` rule with `priority: 'critical'` and `type: 'mention'`.

4.  **Context "Vibe" Analyzer**
    *   **Task**: Create `ContextAnalyzer` service.
    *   **Logic**: Analyze recent message history for emoji density, sentiment, and urgency to determine the "Team Vibe."
    *   **File**: `backend/src/ai/core/contextAnalyzer.ts`

5.  **Dynamic Prompt Engineering**
    *   **Task**: Create `PromptBuilder` service.
    *   **Logic**: Replace static `SYSTEM_PROMPTS` with a builder that injects the detected "Vibe" and "Intent" into the system instruction.
    *   **File**: `backend/src/ai/core/promptBuilder.ts`

6.  **Agent Metadata Tracking**
    *   **Task**: Update `Message` and `AIInsight` schema to store `agentMetadata` (model used, cost, tier).
    *   **Task**: Implement cost calculation in `aiAgentController`.

7.  **Semantic Chime Rules**
    *   **Task**: Replace Regex pattern matching with Vector Similarity.
    *   **Concept**: Embed rule descriptions (e.g., "User is confused"). Compare new messages against rule embeddings.

---

## 🔐 Phase 7: Authentication & User Management

**Goal**: Replace hardcoded `user1` with real authentication (Clerk) and team management.

### 7.1 Strategic Vision
*From Future Roadmap*

*   **Auth Provider**: Clerk (Email, OAuth).
*   **Team Model**: Users belong to Teams with roles (Owner, Admin, Member).
*   **Onboarding**: Sign up -> Create Profile -> Create/Join Team.

### 7.2 Implementation Steps
*From Current Phase Implementation Guide*

1.  **Remove Hardcoded User References**
    *   **Task**: Audit codebase for `'user1'`.
    *   **Refactor**: Replace with `useAuthStore` state.

2.  **Auth Store Placeholder**
    *   **Task**: Create `frontend/src/stores/authStore.ts`.
    *   **Details**: Centralize user state management to make swapping in Clerk easier later.

3.  **Clerk Integration**
    *   **Task**: Install Clerk SDKs.
    *   **Task**: Update Prisma schema for `User` (map to Clerk ID) and `TeamMember`.

---

## ☁️ Phase 8: Production Deployment

**Goal**: Migrate from local development (SQLite) to cloud production (PostgreSQL, Vercel, Railway).

### 8.1 Strategic Vision
*From Future Roadmap*

*   **Database**: PostgreSQL (Supabase or Railway). Required for concurrent connections and `pgvector`.
*   **Hosting**: Frontend on Vercel, Backend on Railway/Render.
*   **CI/CD**: GitHub Actions for automated testing and deployment.

### 8.2 Implementation Steps
*From Current Phase Implementation Guide*

1.  **Schema Validation**
    *   **Task**: Review `schema.prisma` for PostgreSQL compatibility (UUIDs, JSON fields).
    *   **Task**: Prepare migration strategy for `MessageEmbedding` (using `pgvector` natively instead of Pinecone optional, or keep Pinecone). *Decision: Stick with Pinecone for now to avoid complex PG setup, or migrate to pgvector for cost.*

2.  **Connection Pooling**
    *   **Task**: Configure Prisma for connection pooling in `backend/src/db.ts`.
    *   **Why**: Prevent "too many connections" errors in serverless environments.

---

## 🎨 Phase 9: Adaptive UI & Personalization

**Goal**: Allow users to customize AI behavior and UI preferences.

### 9.1 Strategic Vision
*From Future Roadmap*

*   **Plain-Language Rule Builder**: UI for non-technical users to create Chime rules ("Remind me if...").
*   **User Preferences**: Theme, AI proactivity level, notification settings.
*   **Custom Insights**: Teams define their own insight categories (e.g., "Bug Report").

### 9.2 Implementation Steps
*From Current Phase Implementation Guide*

1.  **Theme System**
    *   **Task**: Add `theme` state to `uiStore` (light/dark/auto).
    *   **Task**: Implement CSS variable switching or Tailwind dark mode class toggling.

2.  **Preference Schema**
    *   **Task**: Create `UserPreference` model in Prisma.
