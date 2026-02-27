# Sprint D: Rule Simplification + Gap Remediation

**Phase**: 6.5.7 (Final Sprint before User Testing)  
**Created**: February 18, 2026  
**Estimated Effort**: ~12-15 hours  
**Goal**: Consolidate the fragmented rule system into a single canonical model with ~5 rules, deliver three gap features (insight lifecycle, mutable actions, chime inline feedback), and introduce a shared task context system that replaces the Summaries tab as the team's persistent cognitive anchor.

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sync/Async paths | **Keep both, clean up** | Proven architecture; cleanup = type unification + dead code removal |
| Rule count | **5 essential rules** | Proactivity setting already controls behavior level; 18 rules is noise |
| Canonical type system | **`RuleDefinition` (numeric priority 0-100)** | Matches Prisma schema; eliminates `as any` casts |
| Rule customization level | **Toggle + cooldown + type/priority visibility** | Clean up backend to one type system, keep current frontend controls |
| Gap items | **Insight Lifecycle + Mutable Actions + Chime Feedback** | Strongest research signals for HCI study with least implementation risk |
| Shared task context | **Yes — replaces Summaries tab** | Core HCI concept (shared mental model / common ground); low effort, high research value |
| Context window monitoring | **No — skip** | Testing scale too small to hit limits; not a user-facing research question |
| Dropped gap items | Memory Context Control, Conversational Repair, Reply to Insights | Defer post-testing |

---

## Part 1: Rule System Simplification

### 1.1 Delete Dead Code

| File | Lines | Why Dead |
|------|-------|----------|
| `backend/src/ai/autonomous/detectors.ts` | ~369 | Never imported by unified engine |
| `backend/src/ai/reactive/reactiveRules.ts` | ~100 | Third rule system with callback-based `shouldRespond()`; superseded by `SYNC_AGENT_MENTION` and `SYNC_EXPECTS_REPLY` in `ruleDefinitions.ts` |

**Action**: Delete both files. Verify no imports reference them (`grep -r "detectors" src/` and `grep -r "reactiveRules" src/`).

### 1.2 Eliminate `systemRules.ts`

- **Delete**: `backend/src/ai/rules/systemRules.ts` (585 lines, 18 rules, old `ChimeRule` interface with string priority)
- **Why**: The newer `ruleDefinitions.ts` already defines the same rules more cleanly with numeric priority
- **Update**: `ruleProvider.ts` to import from `ruleDefinitions.ts` instead of `systemRules.ts`

### 1.3 Unify to One TypeScript Interface

**Problem**: Three competing type systems:

| Location | Priority Type | Used By |
|----------|---------------|---------|
| `chimeEngine.ts` → `ChimeRule` | `'low'\|'medium'\|'high'\|'critical'` (string) | `ChimeEvaluator`, `RuleProvider`, `systemRules.ts` |
| `ruleDefinitions.ts` → `RuleDefinition` | `number (0-100)` | `UnifiedRuleEngine`, async evaluation |
| Prisma `ChimeRule` model | `Int` | Database |

**Action**:
1. Keep `RuleDefinition` as the canonical interface (rename to `ChimeRule` for clarity)
2. Delete the old `ChimeRule` interface from `chimeEngine.ts`
3. Update `ChimeEvaluator` to use the new type
4. Remove all `as any` priority casts in `unifiedRuleEngine.ts`

### 1.4 Reduce to 5 Rules

**Keep** (in `ruleDefinitions.ts`):

| ID | Name | Execution | Type | Priority | Cooldown |
|----|------|-----------|------|----------|----------|
| `SYNC_AGENT_MENTION` | Agent Mention Response | sync | pattern | 100 | 0 min |
| `SYNC_EXPECTS_REPLY` | Conversation Continuation | sync | pattern | 90 | 0 min |
| `ASYNC_BLOCKER_ALERT` | Blocker Alert | async | intent | 85 | 15 min |
| `ASYNC_DECISION_CAPTURE` | Decision Capture | async | intent | 80 | 30 min |
| `ASYNC_COMMITMENT_TRACKER` | Commitment Tracker | async | intent | 65 | 10 min |

**Remove**:
- `ASYNC_FRUSTRATION_HELPER` — overlaps with proactivity setting
- `ASYNC_CONFUSION_DETECTOR` — already disabled, noisy
- `ASYNC_KNOWLEDGE_GAP` — already disabled, noisy

These can be re-added later if research demands them.

### 1.5 Simplify Conditions Interface

Collapse `RuleConditions` and `ChimeRuleConditions` into one interface. Remove unused fields:

```typescript
export interface RuleConditions {
  // Pattern-based (sync)
  patterns?: string[];
  keywords?: string[];
  checkExpectsReply?: boolean;

  // Intent-based (async)
  requiredIntents?: string[];
  minUrgency?: 'low' | 'medium' | 'high' | 'critical';
  triggerSentiments?: string[];

  // Semantic-based (async)
  semanticQuery?: string;
  threshold?: number;
}
```

**Removed**: `messageCount`, `timeWindow` (unused by any of the 5 rules), `schedule` (no scheduled rules).

### 1.6 Update Supporting Files

- **`ruleProvider.ts`**: Import `ALL_SYSTEM_RULES` from unified `ruleDefinitions.ts` instead of `DEFAULT_RULES` from deleted `systemRules.ts`
- **`unifiedRuleEngine.ts`**: Remove dual-evaluator pattern; evaluate sync rules directly instead of building a separate `ChimeEvaluator` instance (engine already does this for async)
- **`seed.ts`**: Seed only the 5 canonical rules. Upsert by `sourceRuleId` for existing databases

### 1.7 Frontend Rule Toggle Panel

With only 5 rules, `RuleTogglePanel.tsx` becomes much cleaner. Remove any UI for editing conditions or patterns. Keep: rule name, description, type badge, execution badge, enable/disable toggle, cooldown dropdown.

---

## Part 2: Insight Lifecycle States

### 2.1 Schema Migration

Add to `AIInsight` model in `schema.prisma`:

```prisma
model AIInsight {
  // ... existing fields
  status     String    @default("new") // new, reviewed, accepted, dismissed, archived
  reviewedAt DateTime?
  reviewedBy String?   // userId who changed status
}
```

Run: `npx prisma migrate dev --name add_insight_lifecycle`

### 2.2 Backend

- **Endpoint**: `PATCH /api/insights/:id/status`
- **Body**: `{ status: string, userId: string }`
- **Validation**: Check status is valid value
- **Broadcast**: `ai:insight:status-changed` socket event to team room
- **File**: Modify `backend/src/controllers/aiInsightController.ts`

### 2.3 Shared Types

Add to `packages/types/src/dtos.ts`:

```typescript
export type InsightStatus = 'new' | 'reviewed' | 'accepted' | 'dismissed' | 'archived';

export interface UpdateInsightStatusRequest {
  status: InsightStatus;
  userId: string;
}
```

Rebuild: `cd packages/types && npm run build`

### 2.4 Frontend State

- Add `updateInsightStatus(id, status, userId)` to `entityStore.ts`
- Wire socket listener for `ai:insight:status-changed` in `realtimeInit.ts`

### 2.5 UI Components

| Component | Purpose |
|-----------|---------|
| `InsightStatusBadge.tsx` | Color-coded badge (blue=new, yellow=reviewed, green=accepted, gray=dismissed) |
| `InsightActions.tsx` | Button row: ✓ Accept, ✗ Dismiss, 👁 Mark Reviewed, 📁 Archive |

- Integrate into `InsightCard.tsx`
- Add status filter dropdown to `RightPanel.tsx` header (Show: All / New / Accepted / Archived)

---

## Part 3: Mutable Action Items

### 3.1 Schema Migration (combine with Part 2 migration)

Add nullable fields to `AIInsight`:

```prisma
model AIInsight {
  // ... existing + lifecycle fields
  assigneeId     String?
  dueDate        DateTime?
  completedAt    DateTime?
  actionPriority String?   // low, medium, high, urgent
}
```

### 3.2 Backend

- **Endpoint**: `PATCH /api/insights/:id` — Update action properties
- **Body**: `{ assigneeId?, dueDate?, completedAt?, actionPriority? }`
- **Guard**: Only allow updates on insights where `type === 'action'`
- **Broadcast**: `ai:insight:updated` socket event

### 3.3 UI Components

Controls shown conditionally when `insight.type === 'action'`:

- ☐/☑ Checkbox for completion (persists to DB)
- 👤 Assignee dropdown (populated from team members)
- 📅 Due date input (optional)
- 🏷️ Priority selector: Low / Medium / High / Urgent

Create `ActionItemCard.tsx` or extend `InsightCard.tsx` with action-specific controls.

---

## Part 4: Chime Rule Inline Feedback

### 4.1 Context

The wiring already exists:
- `FeedbackButtons.tsx` accepts `chimeRuleId` prop
- `Feedback` schema has `ruleId` and `ruleAction` fields
- Currently `ruleAction` is hardcoded to `'none'`

### 4.2 Extend `FeedbackButtons.tsx`

When `chimeRuleId` is present and user clicks 👎, show chime-specific popover:

| Option | `ruleAction` value | Backend effect |
|--------|-------------------|----------------|
| "🔇 Trigger less often" | `reduce-frequency` | `cooldownMinutes *= 1.5` |
| "🚫 Disable for this team" | `disable` | `enabled = false` |
| "❌ Response was wrong" | `none` | Just logs feedback |

### 4.3 Create `ChimeFeedbackPopover.tsx`

Small sub-component rendered inside `FeedbackButtons.tsx` when `chimeRuleId` is present. Replaces the generic reason picker for chime messages.

### 4.4 Backend Feedback Handler

Extend `feedbackController.ts` to act on `ruleAction`:

```typescript
if (ruleAction === 'reduce-frequency') {
  const rule = await prisma.chimeRule.findUnique({ where: { id: ruleId } });
  if (rule) {
    await prisma.chimeRule.update({
      where: { id: ruleId },
      data: { cooldownMinutes: Math.ceil(rule.cooldownMinutes * 1.5) }
    });
  }
}

if (ruleAction === 'disable') {
  await prisma.chimeRule.update({
    where: { id: ruleId },
    data: { enabled: false }
  });
}
```

### 4.5 Frontend Confirmation

Show toast after successful action: "Got it! I'll trigger [rule name] less often." or "Rule disabled for this team."

---

## Part 5: Shared Task Context (Replaces Summaries Tab)

### Thesis Justification

This feature directly operationalizes the HCI concept of **shared mental models** (also called *common ground* or *team situation awareness*). In collaborative work, breakdowns occur when team members — including AI agents — hold divergent understandings of the current goal, constraints, and progress. A persistent, co-editable task context creates an explicit **shared cognitive artifact** that:

- **Grounds AI responses**: The agent always knows what the team is working on, reducing irrelevant or off-topic outputs
- **Externalizes assumptions**: Forces the team to articulate goals that would otherwise remain implicit
- **Creates observable behavior**: Researchers can track who edits the context, how often, whether the agent's contributions are accepted/rejected — all measurable signals of human-AI alignment
- **Supports Clark & Brennan's grounding theory**: The task context serves as the "common ground" that both human and AI participants reference, reducing the coordination cost of establishing mutual understanding in each interaction

This supersedes the Summaries tab because summaries are **retrospective** ("what happened") while task context is **prospective** ("what we're doing and why"). The agent can still generate summaries — they become updates *to* the task context rather than standalone artifacts.

### 5.1 Schema

Add to `Team` model in `schema.prisma`:

```prisma
model Team {
  // ... existing fields
  taskContext    String?   // Markdown-formatted shared task brief
  taskContextUpdatedAt DateTime?
  taskContextUpdatedBy String?  // userId or 'agent'
}
```

This goes into the same migration as the insight lifecycle fields (Part 2).

### 5.2 Backend

- **Endpoint**: `GET /api/teams/:teamId/context` — Returns current task context
- **Endpoint**: `PUT /api/teams/:teamId/context` — Update task context
  - Body: `{ content: string, userId: string }`
  - Validates content length (max ~2000 chars to keep LLM context manageable)
  - Broadcasts `team:context-updated` socket event to team room
- **File**: Extend `backend/src/controllers/teamController.ts`
- **Route**: Add to `backend/src/routes/teamRoutes.ts`

### 5.3 AI Integration

The task context is injected as the **first system message** in every LLM call, before RAG context and conversation history:

```typescript
// In aiAgentController.ts / aiInsightController.ts
const messages = [
  { role: 'system', content: SYSTEM_PROMPTS.agent },
  // NEW — shared task context (highest priority context)
  ...(team.taskContext ? [{
    role: 'system' as const,
    content: `TEAM TASK CONTEXT (maintained by the team — treat as ground truth):\n${team.taskContext}`
  }] : []),
  // Existing RAG context
  ...(ragContext ? [{ role: 'system' as const, content: ragContext }] : []),
  // Conversation history
  ...conversationHistory,
];
```

The agent can also **propose updates** to the task context:
- When generating a summary, instead of creating a standalone insight, the agent can suggest appending key decisions/action items to the task context
- The "📝 Summary" button behavior changes: generates a summary and offers to merge it into the task context
- Agent proposals appear as a special message type: "I'd like to update the team context with: ..."

### 5.4 Frontend — Replace Summaries Tab

The current RightPanel tabs are: `All | Summaries | Actions | Suggestions | Rules`

Change to: `Context | Actions | Suggestions | Rules | All`

**Context tab** (replaces Summaries, becomes the default/first tab):

| Section | Description |
|---------|-------------|
| **Task Context Card** | Editable markdown card at the top. Shows current `team.taskContext`. Click to edit inline. "Last updated by {user} at {time}" footer. |
| **Context History** | Collapsible list of previous context versions (stored as insights with `type: 'summary'` for backward compat). Shows diff or timestamp. |
| **Generate Summary → Update Context** | The existing "📝 Summary" button now generates a summary and presents it as a proposed context update, not a standalone card. User can accept (merges into context), edit, or dismiss. |

**UI Components**:

| Component | Purpose |
|-----------|---------|
| `TaskContextCard.tsx` | Editable markdown viewer with save/cancel, character count, "last updated" metadata |
| `ContextProposalCard.tsx` | Shows agent-proposed context update with Accept/Edit/Dismiss buttons |

**Key UX details**:
- The task context card is always visible at the top of the Context tab, even when empty (shows placeholder: "No task context set. Describe what your team is working on...")
- Edits are saved on blur or Ctrl+Enter
- Socket broadcast ensures all team members see edits in real-time
- Old summaries still visible under "Context History" (collapsed by default)
- The `All` tab still shows everything including summaries

### 5.5 Shared Types

Add to `packages/types/src/dtos.ts`:

```typescript
export interface TaskContextDTO {
  content: string | null;
  updatedAt: string | null;  // ISO timestamp
  updatedBy: string | null;  // userId or 'agent'
}

export interface UpdateTaskContextRequest {
  content: string;
  userId: string;
}
```

### 5.6 Research Metrics

Trackable signals for the HCI study:

| Metric | What it reveals |
|--------|-----------------|
| Context edit frequency | How actively teams maintain shared understanding |
| Context edit authorship (user vs agent) | Who drives the shared model — humans or AI? |
| Context length over time | Does it grow unbounded or stabilize? |
| AI response quality with vs without context | Does grounding improve perceived helpfulness? |
| Proposal acceptance rate | Do teams trust agent-suggested context updates? |
| Time between context updates and next @agent query | Does updating context precede asking AI? (causal signal) |

All of these are exportable via the existing session export endpoint (`GET /api/export/session/:teamId`).

---

## Verification Checklist

### After Part 1 (Rule Cleanup)
- [ ] `npm run dev` in backend — no import errors, no TypeScript errors
- [ ] `@agent` still triggers reactive response
- [ ] At least one async rule (blocker alert) fires when matching intent detected
- [ ] `RuleTogglePanel` shows exactly 5 rules
- [ ] No references to deleted files (`detectors.ts`, `reactiveRules.ts`, `systemRules.ts`)

### After Parts 2-3 (Insights)
- [ ] Generate summary → lifecycle status buttons appear on insight card
- [ ] Generate action insight → checkbox/assignee/due date controls visible
- [ ] Status changes broadcast to other clients via socket
- [ ] Status filter dropdown works in RightPanel header
- [ ] Action completion persists across page reload

### After Part 4 (Chime Feedback)
- [ ] Trigger a chime rule → thumbs-down shows chime-specific options
- [ ] "Trigger less often" → verify cooldown increased in DB
- [ ] "Disable for this team" → verify rule disabled, no longer triggers
- [ ] Confirmation toast appears after action

### After Part 5 (Shared Task Context)
- [ ] Context tab is default/first tab in RightPanel
- [ ] Empty state shows placeholder prompt
- [ ] Edit context → save → other clients see update via socket
- [ ] Agent responses reference task context when present
- [ ] "📝 Summary" button generates context update proposal (not standalone card)
- [ ] Old summaries visible under "Context History" (collapsed)
- [ ] Session export includes task context data

### Full Build
- [ ] `cd frontend && npm run build` — zero errors
- [ ] `cd backend && npx tsc --noEmit` — zero errors
- [ ] `cd packages/types && npm run build` — zero errors

---

## Commit Sequence

1. **`refactor(rules): delete dead code (detectors, reactiveRules, systemRules)`**
2. **`refactor(rules): unify type system to single ChimeRule interface`**
3. **`refactor(rules): reduce to 5 essential rules + update seed`**
4. **`refactor(rules): simplify UnifiedRuleEngine evaluation`**
5. **`feat(db): add insight lifecycle + action item + task context fields (migration)`**
6. **`feat(types): add InsightStatus, action item, and TaskContext DTOs`**
7. **`feat(api): add insight status + action update + task context endpoints`**
8. **`feat(ui): insight lifecycle states (badge, actions, filter)`**
9. **`feat(ui): mutable action items (checkbox, assignee, due date)`**
10. **`feat(ui): chime inline feedback popover + backend handler`**
11. **`feat(ui): shared task context tab (replaces summaries)`**
12. **`feat(ai): inject task context into LLM calls + summary→context proposals`**

---

## Files Affected Summary

### Deleted
- `backend/src/ai/autonomous/detectors.ts`
- `backend/src/ai/reactive/reactiveRules.ts`
- `backend/src/ai/rules/systemRules.ts`

### Modified (Backend)
- `backend/prisma/schema.prisma` — AIInsight lifecycle + action fields + Team.taskContext
- `backend/src/ai/rules/ruleDefinitions.ts` — Canonical type + 5 rules
- `backend/src/ai/rules/ruleProvider.ts` — Import from ruleDefinitions
- `backend/src/ai/autonomous/chimeEngine.ts` — Remove old ChimeRule interface
- `backend/src/ai/autonomous/unifiedRuleEngine.ts` — Unified evaluation, remove `as any`
- `backend/src/controllers/aiInsightController.ts` — Status + action endpoints + summary→context flow
- `backend/src/controllers/aiAgentController.ts` — Inject task context into LLM calls
- `backend/src/controllers/teamController.ts` — Task context GET/PUT endpoints
- `backend/src/controllers/feedbackController.ts` — Rule action handler
- `backend/src/routes/aiInsightRoutes.ts` — New routes
- `backend/src/routes/teamRoutes.ts` — Task context routes
- `backend/src/seed.ts` — 5-rule seed
- `backend/src/socket/socketHandlers.ts` — New event types (team:context-updated)

### Modified (Frontend)
- `frontend/src/components/Chat/FeedbackButtons.tsx` — Chime popover
- `frontend/src/components/RightPanel/InsightCard.tsx` — Lifecycle + actions
- `frontend/src/components/RightPanel/RightPanel.tsx` — Tab restructure (Context replaces Summaries), status filter
- `frontend/src/components/RightPanel/ActionButtons.tsx` — Summary button → context proposal flow
- `frontend/src/components/Settings/RuleTogglePanel.tsx` — Simplified for 5 rules
- `frontend/src/stores/entityStore.ts` — updateInsightStatus, updateInsight, taskContext state
- `frontend/src/services/realtimeInit.ts` — New socket listeners (insight + context events)

### Created (Frontend)
- `frontend/src/components/RightPanel/TaskContextCard.tsx` — Editable shared context
- `frontend/src/components/RightPanel/ContextProposalCard.tsx` — Agent-proposed context updates
- `frontend/src/components/RightPanel/InsightStatusBadge.tsx`
- `frontend/src/components/RightPanel/InsightActions.tsx`
- `frontend/src/components/RightPanel/ActionItemCard.tsx`
- `frontend/src/components/Chat/ChimeFeedbackPopover.tsx`

### Modified (Shared)
- `packages/types/src/dtos.ts` — InsightStatus, action item types, TaskContextDTO
