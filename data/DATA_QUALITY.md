# Data Quality Notes

Known issues discovered during verification of Session 1 exports.
All issues are accounted for in the analysis scripts.

---

## Issue 1: Seed User Contamination

**Affected files:** All timeline exports  
**Severity:** High — seed events must be excluded from all analysis

All team exports contain events from `user1` (Alice), `user2` (Bob), `user3` (Charlie).
These are demo/seed users who accessed the teams before the study sessions began.
Their events have timestamps from 2026-03-18, one day before the study date (2026-03-19).

**Fix applied:** All scripts filter with `actorUserId.startswith("study-user-")` and
explicitly exclude the set `{"user1", "user2", "user3", "agent"}`.

---

## Issue 2: Multiple Session IDs Per Export File

**Affected files:** All timeline exports  
**Severity:** Medium — `sessionSpec.sessionId` is null at top level

Each export may contain events from two distinct sessions:
1. **Seed session** (`7df84d50-...`) — from 2026-03-18, actors are seed users
2. **Study session** (`0f54578d-...` for JC, slug format for Sam) — from 2026-03-19

`sessionSpec.sessionId` is `null` in all confirmed exports.

**Fix applied:** All scripts derive `session_id` by scanning the event timeline for the
first `study-user-*` actor and using that event's `sessionId` field.

---

## Issue 3: Session ID Format Inconsistency

**Affected files:** Confirmed in Session 1 — may affect later sessions  
**Severity:** Low — cosmetic, but affects any table joins on session ID

Session IDs are not uniform UUID format:
- JC (team-01): UUID — `0f54578d-f9a0-4a58-bfbe-17df9611f2e5`
- Sam (team-03): Slug — `session-1773912267195-y6grf9u3`

The slug format appears to be a client-side fallback when a UUID cannot be obtained.

**Fix applied:** Session IDs are treated as opaque strings. UUID format is not assumed.

---

## Issue 4: Timestamp Batching (4-Second Resolution)

**Affected files:** All timeline exports  
**Severity:** Medium — affects time-based ordering and dwell calculations

The frontend batches analytics events in 4-second intervals. Many events within
the same batch share identical `createdAt` timestamps. This means:
- Event ordering within a batch cannot be inferred from timestamps
- Dwell time calculations below 4-second resolution are unreliable
- Clusters of identical timestamps indicate a single batch flush

**Fix applied:** Scripts do not attempt sub-4-second ordering. Duration calculations
(e.g. insight generation time) use the minimum observable resolution.

---

## Issue 5: routeOverrideUsed Is on message_route_decision, Not message_sent

**Affected files:** All timeline exports  
**Severity:** Low — field is present, just on a different event

The two chat events sharing the same `messageId`:

| Field | message_route_decision | message_sent |
|-------|----------------------|--------------|
| `routeMode` | ✓ | ✓ |
| `routeConfidence` | ✓ | ✓ |
| `routeSource` | ✓ | ✓ |
| `routeOverrideUsed` | ✓ | ✗ |
| `routeRationale` | ✓ | ✗ |
| `overrideMode` | ✗ | ✓ |
| `routeArchetype` | ✓ | ✓ |

`message_route_decision` fires immediately before `message_sent` with the same timestamp.

**Fix applied:** Script 1 indexes `message_route_decision` events by `messageId` and
merges `routeOverrideUsed` and `routeRationale` into each `message_sent` row.

---

## Issue 6: insight_status_changed and task_context_saved Not Yet Confirmed

**Affected files:** Unknown — only Session 1 solo exports fully verified  
**Severity:** Informational — scripts handle gracefully with 0-row output

These event names were anticipated based on the codebase but were not observed
in the Session 1 solo exports. They may appear in:
- Group sessions (team-04, team-05) in any session
- Sessions 2 and 3

Scripts 3 and 4 will produce empty (header-only) CSVs if these events are absent.

---

## Confirmed Event Names (verified from Session 1)

| Event Name | Type | Found In |
|------------|------|---------|
| `message_sent` | chat | All solo exports |
| `message_route_decision` | chat | All solo exports |
| `research_job_requested` | chat | JC, Sam (research-routed messages) |
| `research_job_done` | chat | JC, Sam |
| `focus_insight_from_marker` | navigation | Both participants |
| `right_panel_tab_changed` | navigation | Sam (extensively) |
| `task_context_panel_toggled` | navigation | Both participants |
| `team_ai_toggle_changed` | navigation | Sam |
| `insight_generate_requested` | insight | Sam (slash command) |
| `insight_generate_completed` | insight | Sam |
| `link_hover` | navigation | Both (high volume — not extracted) |
| `team_switched` | navigation | Both (not extracted) |
| `jump_to_latest` | navigation | JC |

---

## Participant Reference (Session 1 Verified)

| Participant | User ID | Team | Session ID | Notable |
|-------------|---------|------|------------|---------|
| JC | study-user-01-01 | study-team-01 | `0f54578d-...` (UUID) | No manual overrides; 1× research auto-routed |
| Sam | study-user-03-01 | study-team-03 | `session-1773912267195-y6grf9u3` (slug) | Heavy override use; explored all right-panel tabs |
| (P2) | — | study-team-02 | — | No data folder present for Session 1 |

---

## Verification Status

| Export File | Status | Issues Found |
|-------------|--------|--------------|
| Session 1 / JC (team-01) | ✅ Partial | Seed contamination, null sessionSpec.sessionId |
| Session 1 / Sam (team-03) | ✅ Partial | Slug session ID format, heavy override use |
| Session 1 / AI ON (team-04) | ❌ Not yet read | — |
| Session 1 / AI LIGHT (team-05) | ❌ Not yet read | — |
| Session 2 (all) | ❌ Not yet read | — |
| Session 3 (all) | ❌ Not yet read | — |
