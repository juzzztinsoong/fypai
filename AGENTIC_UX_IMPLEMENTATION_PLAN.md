# Agentic UX Implementation Plan

## Goal
Build a collaboration-first, agentic workflow where chat drives execution artifacts, long-form outputs are trustworthy, and teams can safely tune autonomous behavior.

## Current Baseline (Done)
- Frontend composer supports `Auto / Ask / Research` override with heuristic routing.
- Reports surface removed from UX; long-form content is unified in Summaries.
- Archived controls are scoped per category section.
- **Phase 1 MVP started**: frontend research run-state (`queued/running/done/failed`) is visible in Summaries.

---

## Phase 1 — Research Pipeline Trust Layer

### Objective
Make research generation observable so users trust the pipeline.

### Scope
- Run-state row in Summaries (`queued`, `running`, `done`, `failed`).
- Status updates from research trigger path.
- Keep UI lightweight and non-blocking.

### Tasks
- [x] Add frontend run-state storage model (per-team, latest-first).
- [x] Update Chat research send path to write state transitions.
- [x] Render compact run-state row at top of Summaries.
- [ ] Add backend `ResearchJob` model and API endpoints.
- [ ] Broadcast job updates via socket (`research:job:updated`).
- [ ] Switch frontend row source from local state to backend jobs.

### Acceptance Criteria
- User sees live transition: `queued -> running -> done|failed`.
- Failure shows clear state and does not block future sends.
- Row remains concise (no overwhelming panel clutter).

---

## Phase 2 — Promote Long-form to Action

### Objective
Close the loop from analysis to execution.

### Scope
- Select a bullet/line in long-form output.
- Promote selection into a new action insight.
- Preserve source linkage for traceability.

### Tasks
- [ ] Add selectable list-item affordance in long-form viewer.
- [ ] Add `Promote to Action` CTA near selected item.
- [ ] Create action via existing insight create API.
- [ ] Store `sourceInsightId` + `sourceExcerpt` metadata.
- [ ] Show source reference in created action card.

### Acceptance Criteria
- Single-click promotion creates an actionable card.
- Created action appears in Actions section immediately.
- Source trace is visible in action metadata.

---

## Phase 3 — Harden Intent Routing

### Objective
Make auto-routing reliable and auditable.

### Scope
- Server-side classifier endpoint with confidence.
- Frontend heuristic fallback retained.
- Route decision metadata persisted.

### Tasks
- [ ] Add backend endpoint: `POST /api/intent/classify`.
- [ ] Return `{ mode, confidence, rationale }`.
- [ ] Add message metadata fields for route decision.
- [ ] Display post-send route chip in chat.
- [ ] Add telemetry for override rate.

### Acceptance Criteria
- Manual override always wins.
- Auto-route can be explained (confidence/rationale).
- No regression to send latency beyond acceptable UX threshold.

---

## Phase 4 — Team Rule Presets + Preview

### Objective
Enable safe, team-level autonomous behavior tuning.

### Scope
- Presets: `conservative`, `balanced`, `proactive`.
- Preview mode before applying preset/custom rules.
- Team-scoped persistence + rollback path.

### Tasks
- [ ] Add preset config model (thresholds, cooldowns, max triggers/hour).
- [ ] Add preview endpoint to simulate triggers on recent data.
- [ ] Add rule preset UI with `Preview` then `Apply` flow.
- [ ] Add reset/rollback controls.
- [ ] Add feedback capture to improve rule quality.

### Acceptance Criteria
- Teams can preview impact before enabling changes.
- Preset application is reversible and transparent.
- Trigger spam risk is reduced by preset defaults.

---

## Metrics to Track
- Auto-route override rate.
- Research run success/failure rate.
- Time from research completion to action creation.
- Promote-to-action usage rate.
- Rule false-positive feedback rate.

## Risks
- UI clutter in right panel as states/features accumulate.
- Duplicate task content across long-form and actions.
- Realtime drift between local optimistic state and backend truth.

## Mitigations
- Keep progressive disclosure and compact status surfaces.
- Canonical action objects; long-form references actions instead of duplicating.
- Move from local run-state to backend job model in Phase 1 completion.
