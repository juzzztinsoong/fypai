# System Design Chapter — Technical Implementation Notes

Verified against source code as of March 2026. All statements below reflect what the codebase actually does.

---

## 1. Routing Layer

### How classification works

Routing is performed entirely by rule-based pattern matching and weighted signal scoring in `backend/src/controllers/intentController.ts`. **No LLM call is made in the routing hot path.** The routing decision is made synchronously before the main model call.

The entry point is `IntentController.decideAgentRoute(content, teamId)`, which returns an `AgentRouteDecision` specifying:
- `channel`: `chat_message` | `insight` | `silent`
- `insightType` (if `channel === 'insight'`): `summary` | `document` | `action` | `suggestion`
- `confidence`: 0–1
- `explicit`: whether the decision was explicitly commanded by the user
- `clarify`: whether the agent should ask for clarification instead of acting

### Decision procedure

1. **Slash commands** (e.g. `/summary`, `/research`, `/actions`, `/help`, `/suggest`) are parsed first. If matched, routing is immediate with `confidence = 1.0` and `explicit = true`.

2. **Explicit `@agent` + request cue** — if the message contains `@agent` and matches an action-request verb (e.g. "summarise", "generate", "create"), it is routed to the matched insight type. If the input is too short (< 24 chars or < 4 words), the agent asks for clarification instead.

3. **Inferred auto-routing** — for messages without an explicit command, four parallel signal scores are computed using fixed regex pattern sets:

   | Insight type | Key patterns scored |
   |---|---|
   | `summary` | "summarize", "recap", "tl;dr", "meeting notes" |
   | `document` (research) | "research", "compare", "tradeoffs", "deep dive", "benchmark", "evidence" |
   | `action` | "action items", "tasks", "next steps", "owner", "deadline" |
   | `suggestion` | "help", "suggest", "recommend", "brainstorm", "what do you think" |

   An additional `scoreResearchSignal` function computes a composite score by counting strong-match patterns (+0.7), soft-match patterns (+0.08 each, capped at +0.24), message length (+0.08 if ≥ 18 tokens), and analytical question structure (+0.06).

4. The highest-scoring category is selected. The routing decision is:
   - Score ≥ `MIN_INFERRED_INSIGHT_CONFIDENCE` (default `0.72`): route to insight channel
   - Score ≥ `LOW_CONFIDENCE_CLARIFY_FLOOR` (default `0.55`) but < 0.72: route to chat, ask for clarification
   - Score < 0.55 or input ≤ 1 word: remain conversational

5. Minimum input length for auto-insight generation is enforced: ≥ 40 characters and ≥ 8 words. Explicit requests require ≥ 24 characters and ≥ 4 words.

### Sync classifier used inside routing

`IntentClassifier.classifySync(message)` is called within the routing function to provide an additional `classifierIntent` label (e.g. `question`, `action_commitment`, `blocker`, `confusion`). This is a pure regex function — no LLM call.

### Background async LLM classifier (separate from routing)

A separate `IntentClassifier.classifyAsync(message)` method does invoke the Tier 1 LLM model (`LLM_MODEL_TIER_1` env var, configured as a cheaper/faster model such as `gpt-4o-mini`). This runs in the BullMQ background embedding worker after a message is stored, **not** in the routing hot path. Its output (full classification: intent, sentiment, urgency, topics, confidence) is used for autonomous chime rule evaluation. Temperature is 0.1, max tokens = 150. The model is prompted with a strict JSON-only instruction.

### AI-Light mode effect on routing

When a team's AI is in AI-Light mode (`isChimeEnabled = false`), the routing layer coerces all decisions to `chat_message` channel regardless of the signal scores, and only processes messages with an explicit `@agent` mention or `forceAgentReply` metadata flag.

### Auditable routing metadata

Every message that triggers an AI response carries route metadata in its `metadata` field: `routeMode`, `routeConfidence`, `routeRationale`, `routeSource`, `routeOverrideUsed`. This supports RQ1 analysis of routing accuracy.

---

## 2. Layered Memory Architecture

### Working memory

Working memory is the most recent segment of the conversation history included verbatim in the LLM context as a sequence of `user`/`assistant` turn messages. The cutoff is **message count**, not token count:

- **Chat responses** (`@agent` mention, continuation): last **20 messages** — `buildConversationContext(messages, team, 20)`
- **Insight generation** (Summary, Research, Actions, Suggestions): last **50 messages** — `buildConversationContext(messages, team, 50)`

Messages are formatted as `"AuthorName: content"` for human senders, or plain `content` for agent messages (mapped to the `assistant` role).

### Long-term memory (RAG)

Older conversation history is indexed as vector embeddings in Pinecone (serverless, AWS `us-east-1`, index `fypai-messages`, 1536 dimensions, cosine similarity metric). Embeddings are generated using `text-embedding-3-small` via the GitHub Models endpoint, preprocessing input by stripping `@mentions` and collapsing whitespace.

At query time (`ragService.getRelevantContext`):
1. The current user message is embedded.
2. Pinecone is queried with `topK = 5` and `minScore = 0.7` (configurable via `RAG_SIMILARITY_THRESHOLD` env var).
3. The full message records for the returned IDs are fetched from the database.
4. Results are sorted by recency (descending). No explicit recency re-weighting formula is applied beyond Pinecone's cosine similarity ranking.

**Relevance scoring** is raw cosine similarity (0–1) as returned by Pinecone. Each retrieved chunk is labelled with its relevance percentage and a relative timestamp string (e.g. `[2d ago, 87% relevant]`).

**Retrieved context is included verbatim** — it is not summarised before inclusion. It is formatted as a plaintext block under the heading `IMPORTANT CONTEXT FROM PAST DISCUSSIONS:` and injected as a `system`-role message in the LLM prompt.

A circuit breaker protects the Pinecone dependency: after 5 consecutive failures the breaker opens for 60 seconds, and RAG is skipped with graceful degradation to working-memory-only responses.

### Important correction to the draft description

The draft section 3.4.1 states two things that differ from the implementation:

1. **"retrieved content is summarised before inclusion"** — this is incorrect. Retrieved messages are included verbatim with relevance labels.

2. **"For Research mode queries, both working memory and long-term retrieval are included. For Ask Assistant mode queries, only working memory is used."** — this is the reverse of what the code does. RAG retrieval is performed in **Ask Assistant chat responses** only (`generateChatResponse`). The insight generation methods (`generateSummary`, `generateReport`, `generateAction`, `generateSuggestion`) do **not** call `ragService.getRelevantContext` — they use working memory (50 messages) only.

The rationale in the code is that insight generation operates on a larger working-memory window (50 messages, which is sufficient for structured synthesis), while conversational responses benefit from RAG to surface relevant older context that would otherwise be cut off.

---

## 3. Context Packaging

### Ask Assistant (chat) mode

When a chat response is generated, the LLM receives the following messages in order, all as `system`-role unless otherwise noted:

| Position | Content | Present when |
|---|---|---|
| 1 | Team task context: `"TEAM TASK CONTEXT (ground truth…): {taskContext}"` | Team has a task context set |
| 2 | Recent insights: up to 6 most recent insight snippets, prefixed by timestamp and type | Recent insights exist |
| 3 | System prompt: `SYSTEM_PROMPTS.assistantWithRAG` if RAG returned results, `SYSTEM_PROMPTS.assistant` if no RAG, `SYSTEM_PROMPTS.assistantLight` in AI-Light mode | Always |
| 4 | RAG context: `"IMPORTANT CONTEXT FROM PAST DISCUSSIONS:\n[{time}, {relevance%}] Author: message…"` | Pinecone ready AND ≥ 1 result above threshold |
| 5 | Focus directive: draft context labels and preferred response framing | Message has `draftSourceInsightIds` |
| 6 | Concision directive: `"CONVERSATIONAL REPLY MODE: Keep the response concise…"` | Always |
| 7–N | Conversation history (last 20 messages) | `user` / `assistant` role turns |

Max tokens: `AI_ON_CHAT_MAX_TOKENS` env var, default 480. In AI-Light mode: `AI_LIGHT_CHAT_MAX_TOKENS`.

### Summary mode

| Position | Content |
|---|---|
| 1 | Task context (if set) |
| 2 | `SYSTEM_PROMPTS.summarizer` + optional prompt archetype modifier |
| 3–N | Conversation history (last 50 messages) |
| N+1 | User turn: fixed instruction to produce summary with discussion highlights, decisions, and open questions |

Max tokens: `AI_SUMMARY_MAX_TOKENS`, default 1200. Model: `LLM_MODEL_TIER_2`.

### Research (document) mode

| Position | Content |
|---|---|
| 1 | Task context (if set) |
| 2 | `SYSTEM_PROMPTS.reporter` + optional archetype modifier |
| 3–N | Conversation history (last 50 messages) |
| N+1 | User turn: custom prompt if provided, else a fixed analysis instruction covering context, topics, decisions, risks, open questions |

Max tokens: `AI_REPORT_MAX_TOKENS`, default 1400. Model: `LLM_MODEL_TIER_2`.

### Actions mode

| Position | Content |
|---|---|
| 1 | Task context (if set) |
| 2 | Action-focused system prompt + `execution-coach` archetype modifier |
| 3–N | Conversation history (last 50 messages) |
| N+1 | User turn: action item extraction instruction |

Max tokens: `AI_ACTION_MAX_TOKENS`, default 700. Model: `LLM_MODEL_TIER_2`.

### Suggestions (Help) mode

| Position | Content |
|---|---|
| 1 | Task context (if set) |
| 2 | Suggestion system prompt + `pragmatic-advisor` archetype modifier |
| 3–N | Conversation history (last 50 messages) |
| N+1 | User turn: recommendation extraction instruction |

Max tokens: `AI_SUGGESTION_MAX_TOKENS`, default 700. Model: `LLM_MODEL_TIER_2`.

### Key differences between modes

The meaningful differences are:
- **Depth of conversation history**: 20 messages for Ask (conversational), 50 for all insight modes.
- **RAG retrieval**: Only Ask mode uses Pinecone retrieval; insight modes do not.
- **Token budget**: Ask is capped at ~480 for concise replies; insight modes have higher caps (700–1400).
- **System prompt and archetype**: Each insight type uses a purpose-built prompt (`summarizer`, `reporter`, action/suggestion variants) with a different content structure instruction. Ask mode uses a general assistant prompt, or the RAG-aware variant if retrieval succeeded.
- **Task context**: Injected into all modes when set; it is always the first system message and treated as the highest-priority framing.

---

## 4. Logging Schema

### Database model: `SessionEvent`

All telemetry events are stored in the `SessionEvent` table. Fields:

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Auto-generated |
| `teamId` | string | Team scope |
| `sessionId` | string | Browser tab session (from `sessionStorage`) |
| `eventType` | enum | One of six categories (see below) |
| `eventName` | string | Specific action name |
| `actorUserId` | string? | User who triggered the action |
| `messageId` | string? | Associated message |
| `insightId` | string? | Associated insight |
| `content` | string? | Optional payload text |
| `metadata` | JSON? | Context-specific key-value data |
| `createdAt` | datetime | Client-side timestamp |

### Event type categories

| `eventType` | Covers |
|---|---|
| `chat` | Message send, draft promotion, reply context actions |
| `navigation` | Panel tab changes, team switches, marker jumps, UI toggles |
| `insight` | Insight status changes, link hovers |
| `context` | Task context edits, AI toggle state changes |
| `session` | Session lifecycle (init, export, reset) |
| `sync` | Timeline sync toggle and anchor events |

### Named event inventory

| `eventName` | Type | Emitted from | Key metadata |
|---|---|---|---|
| `session_initialized` | `session` | App.tsx on mount | — |
| `session_export_requested` | `session` | Sidebar | — |
| `session_export_completed` | `session` | Sidebar | — |
| `session_export_failed` | `session` | Sidebar | — |
| `session_reset_requested` | `session` | Sidebar | — |
| `session_reset_completed` | `session` | Sidebar | — |
| `session_reset_failed` | `session` | Sidebar | — |
| `team_switched` | `navigation` | Sidebar | `toTeamId` |
| `show_ai_details_toggled` | `navigation` | Sidebar | `visible` |
| `timeline_sync_toggled` | `sync` | Sidebar | `enabled` |
| `test_user_switched` | `navigation` | Sidebar | `toUserId` |
| `message_sent` | `chat` | ChatWindow | `routeMode`, `routeConfidence`, `routeSource`, `routeOverrideUsed` |
| `focus_reply_context_source` | `chat` | ChatWindow | `sourceMessageId` |
| `draft_context_promoted` | `chat` | ChatWindow | `sourceInsightIds`, `labels` |
| `right_panel_tab_changed` | `navigation` | RightPanel | `fromTab`, `toTab` |
| `team_ai_toggle_changed` | `context` | RightPanel | `enabled` |
| `jump_to_insight_marker` | `navigation`/`sync` | RightPanel | `insightId` |
| `jump_to_chat_marker` | `navigation`/`sync` | RightPanel | `messageId` |
| `link_hover` | `insight` | RightPanel | `insightId`, `linkType` |
| `task_context_saved` | `context` | TaskContextCard | `contextLength` |
| `insight_status_changed` | `insight` | InsightActions | `fromStatus`, `toStatus`, `insightId`, `insightType` |
| `jump_to_latest` | `navigation` | MessageList | — |

### Derived metric fields (from `SessionMetricsDTO`)

The backend aggregates raw events into these computed metrics for research export:

| Metric | Derived from |
|---|---|
| `messageSentCount` | `eventName === 'message_sent'` |
| `insightStatusChangeCount` | `eventName === 'insight_status_changed'` |
| `tabSwitchCount` | `eventName === 'right_panel_tab_changed'` |
| `contextEditCount` | `eventName === 'task_context_saved'` |
| `exportCount` | `eventName === 'session_export_requested'` |
| `resetCount` | `eventName === 'session_reset_completed'` |
| `markerJumpCount` | `jump_to_chat_marker`, `jump_to_insight_marker`, `focus_chat_marker_from_insight`, `focus_insight_from_marker` |
| `timelineSyncCount` | `eventType === 'sync'` or `timeline_anchor_sync`, `timeline_sync_toggled` |
| `linkHoverCount` | `eventName === 'link_hover'` |
| `actionAcceptedCount` | `insight_status_changed` where `metadata.toStatus === 'accepted'` |
| `actionDismissedCount` | `insight_status_changed` where `metadata.toStatus === 'dismissed'` |
| `actionCompletedCount` | `insight_status_changed` where `metadata.toStatus === 'archived'` |
| `avgSecondsBetweenEvents` | Mean inter-event gap across all events |

### Client-side vs server-side

All events in this table are **emitted client-side** by the React frontend. The `AnalyticsService` singleton buffers them in a local queue (max 400 events) and batches up to 50 events per POST request to `POST /api/export/events/batch` every 4 seconds. On page hide or tab close, outstanding events are sent via `navigator.sendBeacon`. On the server, `SessionEventController` validates and persists them. There is no server-originated session event logging — backend AI processing stages (`ai:processing`, `ai:continuation`) are emitted as transient WebSocket events only, not persisted to `SessionEvent`.

---

## 5. Real-time Propagation

State updates are propagated via **WebSocket** using Socket.IO 4.x. There is no polling mechanism.

### Architecture

- The Express server initialises a Socket.IO server attached to the same HTTP server.
- Clients join a team-scoped room on connection: `team:{teamId}` (via `socket.emit('team:join', { teamId })`).
- All team-specific broadcasts are emitted as `io.to('team:{teamId}').emit(...)` — only clients in the room receive them.
- Socket.IO provides automatic WebSocket-to-HTTP long-polling fallback and built-in client reconnection.

### Persistent-state events (broadcast to all team members)

| Event | Direction | Payload | Trigger |
|---|---|---|---|
| `message:new` | Server → clients | `MessageDTO` | New chat message (user or agent) |
| `message:edited` | Server → clients | `MessageDTO` | Message content updated |
| `message:deleted` | Server → clients | `{ messageId }` | Message deleted |
| `ai:insight:new` | Server → clients | `AIInsightDTO` | New AI insight created |
| `insight:updated` | Server → clients | `AIInsightDTO` | Insight status or fields updated |
| `insight:deleted` | Server → clients | `{ id, teamId }` | Insight deleted |
| `ai:toggle` | Bidirectional | `{ teamId, enabled }` | AI mode toggle (sent by toggling client, rebroadcast to others) |

### Transient / UI-state events

| Event | Payload | Purpose |
|---|---|---|
| `ai:processing` | `{ teamId, userId, stage, detail?, targetType? }` | Shows AI thinking indicator in UI |
| `ai:continuation` | `{ status, confidence, threshold, trigger, reason }` | Shows whether AI is in active conversation continuation mode |
| `typing:start` / `typing:stop` | `{ teamId, userId }` | Typing indicator (for both users and agent) |
| `presence:update` | `{ userId, status }` | User online/away/offline state |

### Flow for a context update

When a user sends a message:
1. Client emits `message:new` via Socket.IO.
2. Server persists the message and broadcasts `message:new` to all room members.
3. Server asynchronously triggers `AIAgentController.handleNewMessage`.
4. During AI processing, `ai:processing` events are emitted to the team room (stages: `thinking`, `searching-memory`, `analyzing`, `idle`).
5. On completion, `message:new` (agent reply) and/or `ai:insight:new` are broadcast.
6. All connected clients receive these events and update their Zustand stores simultaneously.

---

## 6. AI-Light Condition

### What it controls

AI-Light is a per-team binary mode stored as the `isChimeEnabled` boolean field on the `Team` database record. When `isChimeEnabled = false`, the system operates in a restricted mode.

### How it is toggled

- **Socket event**: `ai:toggle` — sent by any team member from the UI (RightPanel), persisted via `TeamController.updateTeamAIEnabled(teamId, enabled)`, and rebroadcast to all other room members so all clients switch state simultaneously.
- **In-memory cache**: `AIAgentController.teamAIEnabled` is a `Map<string, boolean>` that caches the state for the current process. It is populated from the DB on first use and updated on toggle.

### Behaviour differences

| Feature | AI-ON (`isChimeEnabled = true`) | AI-Light (`isChimeEnabled = false`) |
|---|---|---|
| Trigger condition | `@agent` mention, forced reply, continuation, explicit insight command, proactive inference | `@agent` mention or `forceAgentReply` metadata flag only |
| Autonomous chime rules | Evaluated | Skipped |
| Routing decision | Full insight/chat routing | Coerced to `chat_message` only |
| System prompt | `assistant` or `assistantWithRAG` | `assistantLight` (shorter, conversational) |
| RAG retrieval | Performed (if Pinecone ready) | Skipped |
| Token cap | `AI_ON_CHAT_MAX_TOKENS` (default 480) | `AI_LIGHT_CHAT_MAX_TOKENS` (default same) |
| Continuation gating | Active | Disabled |
| Proactive inference | Active | Disabled |

The design intent is to allow participants in the AI-off study condition to still invoke the assistant explicitly (as a minimal control comparison), while removing all autonomous and proactive behaviours. The `ai:continuation` event is emitted with `status: 'ended'` and `reason: 'AI-light mode allows only explicit Ask Assistant triggers or @agent mentions'` whenever a non-qualifying message arrives.

---

## 7. Metric Collection — Changes and Additions

### Routing metadata on messages

The `message_sent` event captures routing metadata that was not in the CA prototype: `routeMode` (`ask` or `research`), `routeConfidence` (0–1), `routeSource` (`manual-override`, `server-classifier`, `frontend-fallback`), and `routeOverrideUsed` (boolean). This directly supports RQ1 (routing accuracy analysis), as each message that received an AI response links the user-observed mode to the classifier's decision.

### Insight lifecycle events

`insight_status_changed` captures transitions between insight statuses with `fromStatus` and `toStatus` metadata. The three study-relevant terminal states are:
- `accepted` — user acted on the insight
- `dismissed` — user explicitly rejected it
- `archived` (via action item complete) — marked done

These map cleanly to the `actionAcceptedCount`, `actionDismissedCount`, and `actionCompletedCount` metrics in `SessionMetricsDTO`.

### Marker navigation events

`jump_to_chat_marker` and `jump_to_insight_marker` track cross-panel navigation — when a user clicks a traceability link to move between an insight and the chat message(s) that generated it. `markerJumpCount` aggregates these. These events exist because traceability (the ability to navigate from insight → source message and back) is a study feature under evaluation.

### Timeline sync events

`timeline_sync_toggled` and `timeline_anchor_sync` (type `sync`) track use of the experimental timeline anchor feature, which synchronises the scroll position across the chat and right panel when active. `timelineSyncCount` aggregates these.

### Link hover events

`link_hover` tracks hover engagement with traceability links in the insight panel without navigation. This provides a lower-cost engagement signal (attention without action) distinct from full marker jumps.

### Context edit events

`task_context_saved` records when a user modifies the shared team task context, capturing the context length in metadata. `contextEditCount` measures how frequently teams actively managed their project framing during a session.

---

## 8. Notable Implementation Details and Major Changes

### Prompt archetype system

Each response type has a default prompt archetype that modifies the base system prompt:

| Insight type / mode | Default archetype | Effect |
|---|---|---|
| Summary | `decision-brief` | Prioritise clarity on decisions, rationale, tradeoffs |
| Research/Document | `research-analyst` | Compare options, surface risks and confidence |
| Actions | `execution-coach` | Focus on concrete next steps, dependency order |
| Suggestions/Help | `pragmatic-advisor` | Practical recommendations, low-complexity options |
| Code in chat | `implementation-partner` | Implementation-oriented, safe defaults |

Archetypes are appended as structured modifier text to the base system prompt. The feature is feature-flagged via `ENABLE_PROMPT_ARCHETYPES=true`. Custom archetypes can also be requested per-message via `metadata.routeArchetype`.

### Two-tier LLM model architecture

The system uses two LLM model tiers configured by environment variables:

| Tier | Env var | Default | Used for |
|---|---|---|---|
| Tier 1 (fast/cheap) | `LLM_MODEL_TIER_1` | — | Background async message classification, reply-need assessment |
| Tier 2 (smart/main) | `LLM_MODEL_TIER_2` | `gpt-4o` | All main AI responses (chat, insights) |

For the study deployment, both tiers use the GitHub Models endpoint (`https://models.inference.ai.azure.com`) with a `GITHUB_TOKEN` for authentication. The provider is selected at startup by checking `LLM_PROVIDER` env var, falling back to GitHub if a token is present.

### Team agent preferences (Phase 6.5.2)

Teams can configure three AI behaviour dimensions via `AgentPreferences`:
- **Personality**: `formal` / `balanced` / `casual` — injected as tone modifier to system prompt
- **Response length**: `concise` / `balanced` / `detailed` — injected as length constraint modifier
- **Proactivity**: `silent` / `helpful` / `proactive` — controls whether agent volunteers suggestions
- **Model tier override**: `auto` / `tier1` / `tier2` — allows forcing the cheaper model

These preferences are applied via `applyPreferences(basePrompt, preferences)` in both chat and long-form generation paths.

### Continuation gating

Rather than responding to every message, the agent uses a confidence-gated continuation mechanism. When the immediately preceding message was from the agent (within `CONTINUATION_WINDOW_MINUTES`, default 5 minutes), new messages are assessed against `CONTINUATION_MIN_CONFIDENCE` (default 0.60). If the routing confidence for the new message meets the threshold, the conversational thread continues. If not, an `ai:continuation` event is broadcast with `status: 'ended'` and the agent stays silent, preventing unsolicited replies to acknowledgements or off-topic messages.

### Insight deduplication and execution locking

Each insight generation attempt acquires an in-memory execution lock keyed by `{teamId}:{routeExecutionId}:{insightType}` with a TTL of `INSIGHT_EXECUTION_LOCK_TTL_MS` (default 3 minutes). This prevents duplicate insight generation from race conditions (e.g. REST + Socket.IO both triggering the same route). Additionally, before generation, the controller checks whether an insight of the same type already exists linked to the triggering message.

### Insight provenance tracking

Every insight record stores derived provenance metadata:
- `provenanceSource`: `ai-generation`, `autonomous-rule`, `reactive-chat`, `auto-escalation`, `user-request`, `promoted-content`, `seed-onboarding`
- `provenanceTrigger`: how the insight was initiated
- `provenanceCreatedBy`: `agent` or `user`

This supports post-study analysis of which AI modes produced insights that users interacted with.

### Marker messages as traceability anchors

When an insight is created, a companion "marker message" is posted by the agent in the chat timeline. This message contains metadata linking it to the insight (`linkedInsightId`, `linkedInsightType`, `markerLabel`, `markerPreview`). The marker appears in the chat column as a visual anchor, allowing users to navigate forward to the insight panel or backward from the panel to the originating conversation turn. This bidirectional linking is the core traceability mechanism under study.
