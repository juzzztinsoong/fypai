# Master Implementation Plan: Phases 5-9

**Project**: FYP AI - Collaborative Team AI Assistant  
**Status**: Phase 6.5.5 Complete (LAN Testing Setup) / Sprint D Next  
**Last Updated**: February 18, 2026  
**Purpose**: Unified source of truth merging strategic vision, detailed planning, and actionable implementation steps for the remaining project phases.

> **Research Pivot**: This project is being prepared for **user testing as an HCI study**. Phases 7 (Auth) and 8 (Production) are **deprioritized**. Testing will occur on **localhost via LAN** with mock users. New focus: **Agent Transparency, Customization, and Interface Legibility**.

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

## 🚀 Phase 6: Multi-Agent & Dynamic Persona Architecture (In Progress)

**Goal**: Replace single-model approach with a tiered agent system for **90% cost reduction**, improved specialization, and **dynamic personality adaptation**.

### 6.1 Strategic Vision
*From Future Roadmap*

*   **Tier 1 (Monitoring/Drafting)**: `gpt-4o-mini` (configured via `.env`). Handles 90% of traffic. Fast, cheap ($0.0001/req). Used for pattern detection and simple replies.
*   **Tier 2 (Reasoning)**: `gpt-4o` (configured via `.env`). Handles 10% of traffic. Smart, expensive. Used for complex analysis and final decisions.
*   **Hybrid Execution**:
    *   **Sync (Fast Path)**: Regex/Keyword checks (e.g., `@agent`) run immediately in the request loop.
    *   **Async (Slow Path)**: Semantic analysis and "Chime" rules run in the background worker to preserve chat latency.

### 6.2 Implementation Steps (Updated Status)

1.  **Model Configuration** (✅ Complete)
    *   **Task**: Update `LLMService` to support dynamic model selection.
    *   **Task**: Add `LLM_MODEL_TIER_1` and `LLM_MODEL_TIER_2` to `.env`.
    *   **Status**: `GitHubModelsClient` updated to support `model` parameter and JSON mode.

2.  **Unified Rule Engine (Hybrid)** (✅ Complete)
    *   **Task**: Create `UnifiedRuleEngine` that manages both System and Team rules.
    *   **Logic**:
        *   **Sync Evaluation**: Checks Regex/Keyword rules immediately (e.g., `@agent`).
        *   **Async Evaluation**: Dispatches message to queue for Semantic/LLM rules.
    *   **Status**: `UnifiedRuleEngine` implemented and integrated into `AIAgentController`.

3.  **Conversational Continuity** (✅ Complete)
    *   **Task**: Enable agent to "listen" for replies to its own questions without `@agent` tag.
    *   **Logic**:
        *   **Implicit**: Regex check for `?` or "let me know" in previous agent message.
        *   **Explicit**: `expectsReply` metadata flag set by Tier 2 model during generation.
    *   **Status**: Implemented in `AIAgentController.handleNewMessage`.

4.  **Hybrid Intent Classifier** (✅ Complete)
    *   **Task**: Implement `IntentClassifier` service using Tier 1 (`gpt-4o-mini`).
    *   **Logic**:
        1.  **Fast Path**: Regex checks (e.g., `@agent`) -> Sync via `classifySync()`.
        2.  **Slow Path**: Tier 1 agent (Async) classifies Intent, Sentiment, Urgency, Topics via `classifyAsync()`.
    *   **Status**: `IntentClassifier` singleton with full `MessageClassification` output. Returns intent, sentiment, urgency, topics[], and confidence.

5.  **Async Semantic Chime (Vector Rules)** (✅ Complete)
    *   **Task**: Integrate rule evaluation into the **Embedding Worker**.
    *   **Logic**:
        1.  Worker generates embedding for new message.
        2.  Worker calls `IntentClassifier.classifyAsync()` to tag message.
        3.  Classification stored in Message metadata.
        4.  Worker calls `UnifiedRuleEngine.evaluateAsync()` with embedding + classification.
        5.  Rules can match on: `requiredIntents`, `minUrgency`, `triggerSentiments`, or `semanticQuery`.
    *   **Status**: Full integration complete. 4 new intent-based rules added (blocker alert, frustration helper, decision capture, commitment tracker).

6.  **Agent Metadata Tracking** (✅ Complete)
    *   **Task**: Update `Message` schema to store `agentMetadata` (model used, cost, tier).
    *   **Status**: Schema updated and `AIAgentController` populates this data.

7.  **Phase 6.2 Test Suite** (✅ Complete)
    *   **File**: `backend/tests/test-phase6.2-intent-classifier.ts`
    *   **Coverage**: 45 tests covering sync/async classification, rule matching, urgency thresholds, sentiment matching, metadata storage.
    *   **Run**: `npx tsx tests/test-phase6.2-intent-classifier.ts`

---

## 🔬 Phase 6.5: Agent Transparency & HCI Research Focus (IN PROGRESS)

**Goal**: Prepare the application for **user testing as an HCI study**. Focus on making AI behavior **legible, customizable, and observable** to support research into human-AI collaboration.

> **Testing Setup**: Host on localhost, allow LAN access via local IP (e.g., `192.168.x.x:3000`). Use mock users (`user1`, `user2`, `user3`) instead of real authentication.

### 6.5.1 Agent Transparency Layer (✅ Complete)

*Make AI decision-making visible to users and researchers.*

1.  **Response Metadata Display** (✅ Complete)
    *   **Task**: Show metadata below each AI message in the chat UI.
    *   **Display**:
        *   Model used (e.g., "gpt-4o-mini" or "gpt-4o")
        *   Tier (1 or 2)
        *   Response latency (ms)
        *   Tokens used (input/output)
        *   Triggered rule name (if chime)
    *   **Files**: 
        *   Created `frontend/src/components/Chat/AgentMetadataTag.tsx` - Expandable metadata display component
        *   Updated `frontend/src/components/Chat/MessageList.tsx` - Integration with conditional rendering
        *   Updated `frontend/src/stores/uiStore.ts` - Added `showAIDetails` preference
        *   Updated `frontend/src/components/Sidebar/Sidebar.tsx` - Added toggle switch
        *   Updated `packages/types/src/index.ts` - Exported `AgentMetadata` type
    *   **Toggle**: "AI Details" toggle in sidebar settings section (default: off)

2.  **RAG Context Viewer** (✅ Complete)
    *   **Task**: Create expandable "Context Used" section on AI messages.
    *   **Display**:
        *   Retrieved messages with relevance scores
        *   Timestamps and authors of source messages
        *   "Why this context?" tooltip
    *   **Files**: 
        *   Created `frontend/src/components/Chat/RAGContextPanel.tsx` - Expandable context viewer
        *   Updated `packages/types/src/dtos.ts` - Added `RAGContextItem` type and `ragContext` to `AgentMetadata`
        *   Updated `backend/src/controllers/aiAgentController.ts` - Returns RAG context items in response

3.  **Rule Trigger Indicators** (✅ Complete)
    *   **Task**: Show which chime rule triggered an autonomous AI message.
    *   **Display**: Badge "🔔 Chime" in collapsed view, full rule name in expanded view
    *   **Files**: Already integrated in `AgentMetadataTag.tsx` - uses `metadata.chimeRuleName`

4.  **Confidence Indicators** (✅ Complete)
    *   **Task**: Visual indicator of AI confidence level.
    *   **Display**: Color-coded badge (✓ High / ~ Med / ? Low) with percentage in expanded view
    *   **Files**: 
        *   Updated `AgentMetadataTag.tsx` - Confidence display in both collapsed and expanded views
        *   Updated `packages/types/src/dtos.ts` - Added `confidence` field to `AgentMetadata`

### 6.5.2 Agent Customization UI (✅ Complete)

*Let users/researchers adjust AI behavior in real-time without code changes.*

1.  **Agent Settings Panel** (✅ Complete)
    *   **Task**: Create settings modal/drawer accessible from sidebar.
    *   **Controls**:
        *   **Personality Slider**: Formal ↔ Casual (affects system prompt)
        *   **Proactivity Level**: Silent / Helpful / Proactive (controls chime frequency)
        *   **Response Length**: Concise / Balanced / Detailed
        *   **Model Tier Override**: Force Tier 1, Force Tier 2, or Auto
    *   **Files**: Create `frontend/src/components/Settings/AgentSettingsPanel.tsx`
    *   **State**: Add to `uiStore.ts` or create `agentPreferencesStore.ts`
    *   **Backend**: Create `POST /api/agent/preferences` endpoint

2.  **Prompt Template Editor** (✅ Complete - Researcher Tool)
    *   **Task**: Admin-only UI to edit system prompts without restarting server.
    *   **Features**:
        *   View current prompts (summarizer, agent, chime)
        *   Edit and save (persists to DB or JSON file)
        *   Reset to default
        *   Preview mode (test prompt without saving)
    *   **Files**: Create `frontend/src/components/Admin/PromptEditor.tsx`
    *   **Backend**: Create `GET/PUT /api/admin/prompts` endpoints
    *   **Storage**: Add `SystemConfig` table to Prisma or use `backend/config/prompts.json`

3.  **Rule Toggle Dashboard** (✅ Complete)
    *   **Task**: UI to enable/disable individual chime rules per team.
    *   **Features**:
        *   List all rules with descriptions
        *   Toggle switch for each
        *   Cooldown adjustment slider
        *   "Test Rule" button (simulate trigger)
    *   **Files**: Create `frontend/src/components/Settings/RuleTogglePanel.tsx`
    *   **Backend**: Already have `PATCH /api/chime-rules/:id` - extend for bulk updates

### 6.5.3 Feedback & Logging for Research (✅ Complete)

*Capture user reactions and AI decisions for analysis.*

1.  **Response Feedback Buttons** (✅ Complete)
    *   **Task**: Add 👍/👎 buttons to AI messages.
    *   **Data Captured**:
        *   Message ID
        *   Feedback type (positive/negative)
        *   Optional text comment
        *   Timestamp
    *   **Files**: Created `frontend/src/components/Chat/FeedbackButtons.tsx` and integrated in `frontend/src/components/Chat/MessageList.tsx`
    *   **Backend**: Implemented `POST /api/feedback`
    *   **Schema**: Added `Feedback` model to Prisma

2.  **"Not Helpful" Expansion** (✅ Complete)
    *   **Task**: When user clicks 👎, show follow-up options:
        *   "Irrelevant to conversation"
        *   "Factually incorrect"
        *   "Too verbose / Too brief"
        *   "Didn't understand my question"
        *   "Other" (free text)
    *   **Files**: Implemented reason picker + optional comment in `FeedbackButtons.tsx`

3.  **Session Export for Research** (✅ Complete)
    *   **Task**: Export conversation + AI metadata as JSON/CSV for analysis.
    *   **Data Included**:
        *   All messages (user + AI)
        *   AI metadata (model, tokens, latency, triggered rules)
        *   Feedback received
        *   Timestamps
    *   **Files**: Created `backend/src/controllers/exportController.ts`, `backend/src/routes/exportRoutes.ts`, and frontend `exportService.ts` with Sidebar controls
    *   **Endpoint**: Implemented `GET /api/export/session/:teamId?format=json|csv`

4.  **AI Decision Log** (✅ Complete - Lightweight Logging)
    *   **Task**: Backend logging of every AI decision for post-hoc analysis.
    *   **Log Fields**:
        *   Timestamp
        *   Trigger type (mention, chime, button)
        *   Model used
        *   Prompt sent (sanitized)
        *   Response generated
        *   RAG context IDs
        *   Latency
    *   **Storage**: Lightweight runtime logging active via backend controller logs. Structured `jsonl` sink deferred to Sprint D instrumentation hardening.

### 6.5.4 Interface Legibility Improvements (✅ Complete)

*Visual clarity for understanding AI behavior.*

1.  **Message Type Indicators** (✅ Complete)
    *   **Task**: Visually distinguish message types.
    *   **Types**:
        *   User message (default style)
        *   AI reactive response (blue accent, "In reply to @agent")
        *   AI autonomous chime (orange accent, "🔔 AI noticed...")
        *   AI insight (green accent, link to right panel)
    *   **Files**: Implemented in `frontend/src/components/Chat/MessageList.tsx`

2.  **Typing Indicator Enhancement** (✅ Complete)
    *   **Task**: Show what the AI is doing while "typing".
    *   **States**:
        *   "AI is thinking..." (processing)
        *   "AI is searching memory..." (RAG retrieval)
        *   "AI is analyzing..." (Tier 2 reasoning)
    *   **Implementation**: Emit socket events for AI processing stages

3.  **Conversation Threading** (✅ Complete - Lightweight)
    *   **Task**: Visual threading to show which message AI is responding to.
    *   **Options**:
        *   Reply line connector
        *   "Replying to: [message preview]" header
    *   **Files**: Implemented in `frontend/src/components/Chat/MessageList.tsx` using `metadata.parentMessageId` preview

### 6.5.5 LAN Testing Setup (✅ Complete)

*Enable multi-user testing on local network.*

1.  **Network Access Configuration** (✅ Complete)
    *   **Task**: Document and script LAN access setup.
    *   **Steps**:
        ```powershell
        # Get local IP
        ipconfig | Select-String "IPv4"
        
        # Update frontend .env
        VITE_API_URL=http://192.168.x.x:5000
        VITE_WS_URL=http://192.168.x.x:5000
        
        # Allow firewall (run as admin)
        New-NetFirewallRule -DisplayName "FYP AI Frontend" -Direction Inbound -Port 3000 -Protocol TCP -Action Allow
        New-NetFirewallRule -DisplayName "FYP AI Backend" -Direction Inbound -Port 5000 -Protocol TCP -Action Allow
        ```
    *   **File**: Created `docs/LAN_TESTING_SETUP.md`

2.  **Mock User Switcher** (✅ Complete)
    *   **Task**: Dropdown in UI to switch between mock users.
    *   **Users**: `user1`, `user2`, `user3` (pre-seeded)
    *   **Files**: Implemented in `frontend/src/components/Sidebar/Sidebar.tsx`
    *   **State**: Uses existing `sessionStore.ts` session switching and presence sync

3.  **Session Reset Button** (✅ Complete)
    *   **Task**: Button to clear conversation and start fresh (for new test participant).
    *   **Action**: Clears messages and insights from current team, resets AI state
    *   **Files**: Added to Sidebar settings panel with backend endpoint `DELETE /api/messages/team/:teamId`

### 6.5.6 Implementation Priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 High | Response Metadata Display | 2h | Core transparency |
| 🔴 High | Agent Settings Panel | 4h | User customization |
| 🔴 High | Feedback Buttons (👍/👎) | 2h | Research data |
| 🔴 High | Mock User Switcher | 1h | Testing enabler |
| 🟡 Medium | RAG Context Viewer | 3h | Deep transparency |
| 🟡 Medium | Rule Toggle Dashboard | 3h | Researcher control |
| 🟡 Medium | Session Export | 2h | Research data |
| 🟡 Medium | Message Type Indicators | 2h | Visual clarity |
| 🟢 Low | Prompt Template Editor | 4h | Researcher tool |
| 🟢 Low | Confidence Indicators | 2h | Nice to have |
| 🟢 Low | Conversation Threading | 4h | Nice to have |

### 6.5.7 Interface Gap Remediation

*Address fundamental UX weaknesses in human-AI collaboration.*

> **Prioritization Criteria**: Ranked by (Implementation Feasibility × Research Value). Focus on gaps that are quick to fix AND provide observable user behavior differences.

#### 🔴 High Priority (Quick wins, high research value)

1.  **Insight Lifecycle States** (📋 TODO)
    *   **Gap**: Insights are static; right panel becomes cluttered graveyard.
    *   **Task**: Add status workflow to insights so users can triage AI outputs.
    *   **States**: `new` → `reviewed` → `accepted` / `dismissed` → `archived`
    *   **UI Components**:
        *   Status badge on each insight card (color-coded: blue=new, yellow=reviewed, green=accepted, gray=dismissed)
        *   Action buttons row: ✓ Accept | ✗ Dismiss | 👁 Mark Reviewed | 📁 Archive
        *   Filter dropdown in RightPanel header: "Show: All / New / Accepted / Archived"
        *   Bulk actions: "Archive all dismissed"
    *   **Files**:
        *   Modify: `frontend/src/components/RightPanel/InsightCard.tsx` (add status badge + buttons)
        *   Modify: `frontend/src/components/RightPanel/RightPanel.tsx` (add filter dropdown)
        *   Create: `frontend/src/components/RightPanel/InsightStatusBadge.tsx`
        *   Create: `frontend/src/components/RightPanel/InsightActions.tsx`
    *   **Backend**:
        *   Endpoint: `PATCH /api/insights/:id/status` - Update status
        *   Endpoint: `PATCH /api/insights/bulk` - Bulk status update
        *   Modify: `backend/src/controllers/aiInsightController.ts`
    *   **Schema Change**:
        ```prisma
        model AIInsight {
          // ... existing fields
          status     String    @default("new") // new, reviewed, accepted, dismissed, archived
          reviewedAt DateTime?
          reviewedBy String?   // userId who changed status
        }
        ```
    *   **Socket Events**: `ai:insight:status-changed` - Broadcast status changes to team
    *   **State**: Add `updateInsightStatus(id, status)` to `entityStore.ts`
    *   **Research Value**: Observe how users triage AI outputs, acceptance rates, time-to-review

2.  **Mutable Action Items** (📋 TODO)
    *   **Gap**: AI-generated actions can't be edited, assigned, or completed.
    *   **Task**: Extend action-type insights with full task management properties.
    *   **Features**:
        *   ☐ / ☑ Checkbox to mark complete (persists to DB)
        *   👤 Assignee dropdown (populated from team members)
        *   ✏️ Inline edit of action text (click to edit, blur to save)
        *   📅 Due date picker (optional)
        *   🏷️ Priority selector: Low / Medium / High / Urgent
        *   Progress indicator for multi-step actions
    *   **Files**:
        *   Modify: `frontend/src/components/RightPanel/ActionItemCard.tsx` (or create if doesn't exist)
        *   Create: `frontend/src/components/RightPanel/ActionItemEditor.tsx` (inline edit mode)
        *   Create: `frontend/src/components/RightPanel/AssigneeDropdown.tsx`
        *   Create: `frontend/src/components/RightPanel/DueDatePicker.tsx`
    *   **Backend**:
        *   Endpoint: `PATCH /api/insights/:id` - Update action properties
        *   Endpoint: `GET /api/teams/:teamId/members` - Fetch assignee options (likely exists)
        *   Modify: `backend/src/controllers/aiInsightController.ts`
    *   **Schema Change**:
        ```prisma
        model AIInsight {
          // ... existing fields
          // Action-specific fields (nullable for non-action insights)
          assigneeId  String?
          assignee    User?     @relation(fields: [assigneeId], references: [id])
          dueDate     DateTime?
          completedAt DateTime?
          actionPriority String? // low, medium, high, urgent
        }
        ```
    *   **Socket Events**: `ai:insight:updated` - Broadcast action changes
    *   **State**: Add `updateInsight(id, partial)` to `entityStore.ts`
    *   **Display Logic**: Only show action controls when `insight.type === 'action'`
    *   **Research Value**: Observe if users adopt AI suggestions as real tasks, completion rates

3.  **Chime Rule Inline Feedback** (📋 TODO)
    *   **Gap**: 👎 feedback on chime messages doesn't influence future AI behavior.
    *   **Task**: Connect negative feedback to actionable rule adjustments.
    *   **Flow**:
        1.  User clicks 👎 on a chime-triggered AI message
        2.  Popover appears: "This was triggered by **[Rule Name]**. What should I do?"
        3.  Options presented:
            *   "🔇 Trigger less often" → Increase cooldown by 50%
            *   "🚫 Disable for this team" → Set `enabled = false`
            *   "❌ This response was wrong" → Just log feedback, no rule change
            *   "Cancel"
        4.  Confirmation toast: "Got it! I'll trigger [rule] less often."
    *   **Files**:
        *   Modify: `frontend/src/components/Chat/FeedbackButtons.tsx` (detect chime messages)
        *   Create: `frontend/src/components/Chat/ChimeFeedbackPopover.tsx`
        *   Modify: `frontend/src/services/feedbackService.ts` (add rule adjustment calls)
    *   **Backend**:
        *   Modify: `POST /api/feedback` - Accept optional `ruleId` and `action` fields
        *   Endpoint: `PATCH /api/chime-rules/:id/adjust` - Apply feedback-driven adjustments
        *   Logic in `backend/src/controllers/chimeRuleController.ts`:
            ```typescript
            // If action === 'reduce-frequency'
            rule.cooldownMinutes = Math.ceil(rule.cooldownMinutes * 1.5);
            // If action === 'disable'
            rule.enabled = false;
            ```
    *   **Schema Change**:
        ```prisma
        model Feedback {
          id          String   @id @default(uuid())
          messageId   String
          message     Message  @relation(fields: [messageId], references: [id])
          userId      String
          type        String   // positive, negative
          reason      String?  // irrelevant, incorrect, verbose, brief, other
          comment     String?
          ruleId      String?  // If feedback on chime message
          ruleAction  String?  // reduce-frequency, disable, none
          createdAt   DateTime @default(now())
        }
        ```
    *   **Detection**: Check `message.metadata.chimeRuleName` to identify chime messages
    *   **Research Value**: Observe if users actively shape AI behavior, rule adjustment patterns

#### 🟡 Medium Priority (More effort, solid value)

4.  **Memory Context Control** (📋 TODO)
    *   **Gap**: Users don't know what AI "remembers" or how to correct misinformation.
    *   **Task**: Give users agency over RAG context inclusion/exclusion.
    *   **Features**:
        *   📌 **Pin message**: Always include in RAG context (max 10 pinned per team)
        *   🚫 **Exclude message**: Never use for RAG context
        *   💬 **"Forget this" button**: Exclude + delete from vector DB
        *   👁 **Memory indicator**: Small icon on messages showing if pinned/excluded
    *   **UI Components**:
        *   Message hover menu: Pin 📌 | Exclude 🚫 | Forget 💬
        *   Pinned messages panel (collapsible section in sidebar or settings)
        *   Visual indicator on message bubble (pin icon, strikethrough for excluded)
    *   **Files**:
        *   Modify: `frontend/src/components/Chat/MessageBubble.tsx` (add hover menu, indicators)
        *   Create: `frontend/src/components/Chat/MessageContextMenu.tsx`
        *   Create: `frontend/src/components/Settings/PinnedMessagesPanel.tsx`
        *   Modify: `frontend/src/services/messageService.ts` (add pin/exclude APIs)
    *   **Backend**:
        *   Endpoint: `PATCH /api/messages/:id/context` - Set ragPinned/ragExcluded
        *   Endpoint: `DELETE /api/messages/:id/embedding` - Remove from Pinecone
        *   Modify: `backend/src/services/ragService.ts`:
            ```typescript
            // In retrieveContext():
            // 1. Always include pinned messages (fetch from DB first)
            // 2. Exclude messages with ragExcluded = true from vector search
            // 3. Merge pinned + vector results, dedupe
            ```
    *   **Schema Change**:
        ```prisma
        model Message {
          // ... existing fields
          ragPinned   Boolean @default(false)
          ragExcluded Boolean @default(false)
        }
        ```
    *   **Pinecone Handling**: On "Forget", call `pineconeService.deleteVector(messageId)`
    *   **Socket Events**: `message:context-updated` - Update indicators in real-time
    *   **Research Value**: Observe desire for memory control, what users pin vs exclude

5.  **Conversational Repair Flow** (📋 TODO)
    *   **Gap**: No graceful recovery when AI misunderstands; must re-prompt from scratch.
    *   **Task**: Add repair mechanisms to AI messages for easy correction.
    *   **Features**:
        *   🔄 **"Try again"**: Regenerate response with same context
        *   ❓ **"Let me clarify"**: Opens composer with "What I meant was: " prefix
        *   ✂️ **Length adjustment**: "Too long" / "Too short" buttons
        *   🎯 **"Focus on..."**: Quick prompts like "Focus on the technical details"
    *   **UI Components**:
        *   Repair button row below AI messages (only visible on hover or toggle)
        *   Modal for "Let me clarify" with pre-filled text
        *   Dropdown for "Focus on..." with common options
    *   **Files**:
        *   Create: `frontend/src/components/Chat/RepairButtons.tsx`
        *   Create: `frontend/src/components/Chat/ClarifyModal.tsx`
        *   Modify: `frontend/src/components/Chat/MessageBubble.tsx` (integrate repair buttons)
        *   Modify: `frontend/src/services/messageService.ts` (add regenerate API)
    *   **Backend**:
        *   Endpoint: `POST /api/messages/:id/regenerate` - Regenerate AI response
        *   Request body: `{ hint?: 'shorter' | 'longer' | 'focus', focusTopic?: string }`
        *   Logic in `backend/src/controllers/aiAgentController.ts`:
            ```typescript
            // Fetch original message context from agentMetadata
            // Append repair instruction to prompt:
            // - "shorter": "Provide a more concise response."
            // - "longer": "Provide more detail and examples."
            // - "focus": "Focus specifically on: {focusTopic}"
            // Generate new response, save as new message with parentMessageId
            ```
    *   **Metadata Storage**: Store original prompt context in `message.metadata.originalPrompt`
    *   **UI Indication**: Show "🔄 Regenerated response" badge on new message
    *   **Limit**: Max 3 regenerations per original message (prevent abuse)
    *   **Research Value**: Observe error recovery patterns, which repair options used most

6.  **Reply to Insights** (📋 TODO - Lower Priority)
    *   **Gap**: Insights are one-way broadcast; can't continue dialogue about them.
    *   **Task**: Enable threaded conversation on insights.
    *   **Features**:
        *   💬 Reply input at bottom of each insight card
        *   Replies generate follow-up insights (threaded)
        *   "Expand on point 2" → AI generates child insight
        *   Thread collapse/expand
    *   **Files**:
        *   Modify: `frontend/src/components/RightPanel/InsightCard.tsx` (add reply input)
        *   Create: `frontend/src/components/RightPanel/InsightThread.tsx`
        *   Modify: `frontend/src/services/insightService.ts` (add reply API)
    *   **Backend**:
        *   Endpoint: `POST /api/insights/:id/reply` - Generate follow-up insight
        *   Request body: `{ content: string }` (user's reply/request)
        *   Logic: Use parent insight as context, generate child insight
    *   **Schema Change**:
        ```prisma
        model AIInsight {
          // ... existing fields
          parentInsightId String?
          parentInsight   AIInsight?  @relation("InsightThread", fields: [parentInsightId], references: [id])
          childInsights   AIInsight[] @relation("InsightThread")
        }
        ```
    *   **Complexity Note**: Similar behavior achievable via @agent in chat; this is enhancement
    *   **Research Value**: Observe if users prefer insight threads vs chat for follow-ups

7.  **Collaborative Insight Refinement** (📋 TODO - Future Scope)
    *   **Gap**: Team can't collectively edit, comment, or vote on AI outputs.
    *   **Task**: Add collaboration layer to insights.
    *   **Features**:
        *   💬 Comment thread on each insight
        *   👍👎 Team voting (thumbs up/down with counts)
        *   ✏️ Suggest edit (creates pending edit for owner approval)
        *   📝 Edit history log
    *   **Files**:
        *   Create: `frontend/src/components/RightPanel/InsightComments.tsx`
        *   Create: `frontend/src/components/RightPanel/InsightVoting.tsx`
        *   Create: `frontend/src/components/RightPanel/InsightEditHistory.tsx`
    *   **Backend**:
        *   Endpoint: `POST /api/insights/:id/comments` - Add comment
        *   Endpoint: `POST /api/insights/:id/vote` - Cast vote
        *   Endpoint: `GET /api/insights/:id/history` - Get edit history
    *   **Schema Changes**:
        ```prisma
        model InsightComment {
          id        String   @id @default(uuid())
          insightId String
          insight   AIInsight @relation(fields: [insightId], references: [id])
          authorId  String
          author    User     @relation(fields: [authorId], references: [id])
          content   String
          createdAt DateTime @default(now())
        }
        
        model InsightVote {
          id        String   @id @default(uuid())
          insightId String
          insight   AIInsight @relation(fields: [insightId], references: [id])
          userId    String
          user      User     @relation(fields: [userId], references: [id])
          value     Int      // 1 = upvote, -1 = downvote
          createdAt DateTime @default(now())
          @@unique([insightId, userId]) // One vote per user per insight
        }
        ```
    *   **Socket Events**: `insight:comment:new`, `insight:vote:updated`
    *   **Complexity Note**: Adds significant complexity; defer unless collaboration is core research question
    *   **Research Value**: Low for initial HCI study (adds confounding variables)

#### Updated Priority Table (Including Gap Remediation)

| Priority | Task | Effort | Category | Impact |
|----------|------|--------|----------|--------|
| 🔴 High | Insight Lifecycle States | 2h | Gap Fix | Core usability |
| 🔴 High | Mutable Action Items | 2h | Gap Fix | Task adoption |
| 🔴 High | Chime Rule Inline Feedback | 3h | Gap Fix | Behavior shaping |
| 🔴 High | Response Metadata Display | 2h | Transparency | Core transparency |
| 🔴 High | Mock User Switcher | 1h | Testing | Testing enabler |
| 🔴 High | Feedback Buttons (👍/👎) | 2h | Research | Research data |
| 🟡 Medium | Memory Context Control | 3h | Gap Fix | Memory agency |
| 🟡 Medium | Conversational Repair | 4h | Gap Fix | Error recovery |
| 🟡 Medium | Agent Settings Panel | 4h | Customization | User control |
| 🟡 Medium | RAG Context Viewer | 3h | Transparency | Deep transparency |
| 🟡 Medium | Session Export | 2h | Research | Research data |
| 🟢 Low | Reply to Insights | 5h | Gap Fix | Nice to have |
| 🟢 Low | Collaborative Refinement | 6h | Gap Fix | Future scope |

---

## ⏸️ Phase 7: Authentication & User Management (DEPRIORITIZED)

> **Status**: Deprioritized for HCI testing phase. Use mock users (`user1`, `user2`, `user3`) with the User Switcher component instead. Revisit if deploying to production.

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

## ⏸️ Phase 8: Production Deployment (DEPRIORITIZED)

> **Status**: Deprioritized for HCI testing phase. Local network testing via LAN is sufficient for user studies. SQLite is adequate for testing scale. Revisit if scaling beyond 10 concurrent users or deploying publicly.

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

---

## 📊 Phase Summary & Recommended Execution Order

| Phase | Status | Priority | Notes |
|-------|--------|----------|-------|
| Phase 5 | ✅ Complete | - | RAG infrastructure done |
| Phase 6 | ✅ Core Complete | High | Tiered agent + hybrid rule engine completed |
| **Phase 6.5** | 🚧 In Progress (6.5.1 + 6.5.2 + 6.5.3 + 6.5.4 + 6.5.5 complete) | **Highest** | HCI focus - LAN readiness and research instrumentation |
| Phase 7 | ⏸️ Deprioritized | Low | Use mock users for testing |
| Phase 8 | ⏸️ Deprioritized | Low | LAN testing sufficient |
| Phase 9 | 📋 Planned | Medium | Some tasks merged into 6.5 |

### Recommended Implementation Sequence (Post-6.5.2)

1. **Sprint A: Feedback & Research Logging (6.5.3)** (✅ Complete)
    - Delivered feedback capture UI + backend persistence
    - Delivered structured "Not Helpful" reasons + optional comments
    - Delivered session export (JSON/CSV)
    - Migration and runtime validation completed

2. **Sprint B: Interface Legibility (6.5.4)** (✅ Complete)
    - Message type indicators implemented (reactive, chime, insight-linked)
    - Typing indicators enhanced with stage states (`thinking/searching-memory/analyzing/idle`)
    - Lightweight conversation threading implemented (`Replying to: <preview>`)
    - Frontend/backend implementation files compile clean in diagnostics

3. **Sprint C: LAN Testing Enablement (6.5.5)** (✅ Complete)
    - LAN setup documentation and startup checklist completed
    - Mock user switcher (`user1`, `user2`, `user3`) completed
    - Session reset control for participant handoff completed
    - Session reset extended to clear both messages and insights

4. **Sprint D: Gap Remediation Priority Items (6.5.7 High)** (~8-10 hours)
    - Insight lifecycle states (`new/reviewed/accepted/dismissed/archived`)
    - Mutable action items (assignee, due date, completion)
    - Chime rule inline feedback loop (reduce frequency / disable)
    - Add acceptance checks: actionable insight conversion + reduced repeated false-positive chimes

5. **Execution Governance (Continuous)**
    - Use feature flags for research-sensitive features
    - Run quick usability checkpoints after each sprint (3 mock users, 15-20 min each)
    - Track metrics: feedback rate, insight acceptance rate, chime disable frequency, repair attempts

### Sprint A Detailed Execution Checklist (6.5.3)

**Objective**: Deliver end-to-end feedback capture and research export with minimal UX disruption and strong data quality.

#### A1. Data Model + Types (start here)

1. **Prisma schema updates**
    - File: `backend/prisma/schema.prisma`
    - Add `Feedback` model (messageId, userId, type, reason, comment, ruleId, ruleAction, createdAt)
    - Add indexes for `messageId`, `userId`, `createdAt`, and optional `ruleId`

2. **Migration + client generation**
    - Commands:
      - `cd backend`
      - `npx prisma migrate dev --name add_feedback_model`
      - `npx prisma generate`

3. **Shared DTO updates**
    - File: `packages/types/src/dtos.ts`
    - Add `FeedbackDTO`, `CreateFeedbackRequest`, `FeedbackReason`, `FeedbackType`
    - Ensure `MessageDTO.metadata` can carry `chimeRuleName`/`ruleId` link for chime-specific feedback

4. **Types package build**
    - Commands:
      - `cd packages/types`
      - `npm run build`

#### A2. Backend APIs

5. **Feedback controller**
    - Create file: `backend/src/controllers/feedbackController.ts`
    - Add `createFeedback()` with validation:
      - Require `messageId`, `userId`, `type`
      - If `type === 'negative'`, accept optional `reason` and `comment`
      - If chime-related, accept optional `ruleId` and `ruleAction`

6. **Feedback route**
    - Create file: `backend/src/routes/feedbackRoutes.ts`
    - Endpoint: `POST /api/feedback`
    - Register route in `backend/src/index.ts`

7. **Session export controller**
    - Create file: `backend/src/controllers/exportController.ts`
    - Endpoint behavior for `GET /api/export/session/:teamId?format=json|csv`:
      - Fetch messages + AI metadata + feedback
      - Return deterministic shape for `json`
      - Return flat rows for `csv`

8. **Session export route**
    - Create file: `backend/src/routes/exportRoutes.ts`
    - Register route in `backend/src/index.ts`

9. **Validation and guardrails**
    - Ensure export excludes secrets/internal tokens
    - Sanitize nullable fields in CSV output
    - Return `400` for unsupported format

#### A3. Frontend UX + Services

10. **Feedback API client**
     - Create file: `frontend/src/services/feedbackService.ts`
     - Add `submitFeedback(payload)` for `POST /api/feedback`

11. **Feedback UI components**
     - Create file: `frontend/src/components/Chat/FeedbackButtons.tsx`
     - Behavior:
        - Always show 👍/👎 on AI messages
        - On 👎, open reason picker + optional free-text comment
        - Submit feedback and show success/failure inline state

12. **Integrate into message rendering**
     - Modify file: `frontend/src/components/Chat/MessageBubble.tsx` (or active AI message renderer)
     - Render `FeedbackButtons` only for agent-authored messages

13. **Export action in UI**
     - Modify file: `frontend/src/components/Sidebar/Sidebar.tsx` (or Settings area)
     - Add “Export Session” control with JSON/CSV options
     - Create/extend service: `frontend/src/services/exportService.ts`

#### A4. Verification + Acceptance

14. **Backend verification script/tests**
     - Add/update tests under `backend/tests/`:
        - Feedback create success
        - Negative feedback reason persistence
        - Export JSON schema includes feedback and agent metadata
        - Export CSV shape/headers stable

15. **Manual UX verification checklist**
     - Submit 👍 and 👎 on at least 5 AI messages
     - Verify “Not Helpful” reason is stored and queryable
     - Export both JSON and CSV for one team
     - Confirm exported rows include timestamps + message linkage

16. **Definition of Done (Sprint A)**
     - `POST /api/feedback` active and validated
     - 👎 flow captures structured reason + optional comment
     - Session export works for JSON and CSV with stable schema
     - At least one backend test and one manual run pass for each endpoint

### Sprint A Commit Sequence (Recommended)

1. **`feat(db): add feedback model and migration`**
    - `backend/prisma/schema.prisma` + migration files

2. **`feat(types): add feedback and export DTO contracts`**
    - `packages/types/src/dtos.ts` (+ exports)

3. **`feat(api): add feedback endpoint`**
    - `backend/src/controllers/feedbackController.ts`
    - `backend/src/routes/feedbackRoutes.ts`
    - `backend/src/index.ts`

4. **`feat(api): add session export endpoint (json/csv)`**
    - `backend/src/controllers/exportController.ts`
    - `backend/src/routes/exportRoutes.ts`
    - `backend/src/index.ts`

5. **`feat(ui): add ai feedback buttons with not-helpful reasons`**
    - `frontend/src/components/Chat/FeedbackButtons.tsx`
    - `frontend/src/components/Chat/MessageBubble.tsx`
    - `frontend/src/services/feedbackService.ts`

6. **`feat(ui): add session export action`**
    - `frontend/src/components/Sidebar/Sidebar.tsx`
    - `frontend/src/services/exportService.ts`

7. **`test: add sprint-a feedback/export verification`**
    - `backend/tests/*` additions/updates

### Sprint B Detailed Execution Checklist (6.5.4)

**Objective**: Improve interface legibility so participants can quickly identify why AI responded and what the AI is doing in real time.

#### B1. Message Type Indicators

1. **Define visible message types in chat renderer**
    - User message (default)
    - AI reactive response (`In reply to @agent`)
    - AI autonomous chime (`🔔 Auto`)
    - AI long-form/insight-linked response (`📄 Insight`)

2. **Implementation files**
    - Modify `frontend/src/components/Chat/MessageList.tsx`
    - Add compact badges and type-specific label copy

3. **Acceptance check**
    - In a pilot run, users identify message origin (reactive vs auto) without opening metadata panel

#### B2. AI Typing Stage Transparency

4. **Backend stage events**
    - Emit `ai:processing` socket events with stage values:
      - `thinking`
      - `searching-memory`
      - `analyzing`
      - `idle`
    - Modify `backend/src/controllers/aiAgentController.ts`

5. **Frontend state wiring**
    - Add AI processing stage state to `sessionStore`
    - Listen to `ai:processing` in `realtimeInit`
    - Show stage-specific text in `TypingIndicator`
    - Files:
      - `frontend/src/stores/sessionStore.ts`
      - `frontend/src/services/realtimeInit.ts`
      - `frontend/src/components/Chat/TypingIndicator.tsx`
      - `frontend/src/components/Chat/MessageList.tsx`

6. **Acceptance check**
    - While AI is responding, users see stage transitions instead of generic "Generating response"

#### B3. Lightweight Conversation Threading

7. **Minimal reply context (no full thread model yet)**
    - If AI message has `metadata.parentMessageId`, show `Replying to: <preview>` above bubble
    - Use truncated preview (80-100 chars)
    - Modify `frontend/src/components/Chat/MessageList.tsx`

8. **Acceptance check**
    - Users can identify target message for at least 90% of AI replies in quick test

#### B4. Verification

9. **Build checks**
    - `cd frontend && npm run build`
    - `cd backend && npm run dev` (manual runtime verification)

10. **Manual scenario script**
    - Send `@agent summarize this thread`
    - Confirm `thinking -> searching-memory -> analyzing -> idle` flow appears
    - Confirm reply context shows originating message preview
    - Trigger a chime and confirm `🔔 Auto` indicator appears
