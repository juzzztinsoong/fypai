# Study Matrix Implementation Contract

Status: Authoritative
Owner: Product + Engineering
Scope: Entire application (global behavior)
Last Updated: 2026-03-19

## 1. Contract Intent
This file is the single source of truth for implementing and validating the study matrix requirements.
All changes described here apply globally across the app. There is no separate study mode.

## 2. Non-Negotiable Decisions
1. The main AI toggle is the only participant-facing condition control.
2. AI-light behavior must be enforced by backend policy, not only by frontend UI.
3. Rule behavior is hardcoded by condition profile; participant-level per-rule toggles are removed.
4. Seeding must be scenario-neutral in-product. Scenario details are verbally delivered by facilitators.
5. Session/export packaging must include minimum fields needed for A/B analysis.
6. If full metric automation is costly, export must still support manual inference cleanly.

## 3. Condition Semantics
1. AI-On:
- Reactive chat behavior enabled.
- Proactive/autonomous behavior enabled per backend policy.
- Insight generation routes allowed.

2. AI-Light:
- Explicit conversational @agent path allowed.
- Autonomous/chime behavior disabled.
- Condition-restricted generation routes blocked per matrix-aligned policy.
- UI must not expose misleading controls that appear available but are blocked.

## 4. Required Feature Matrix Fulfillment
1. Keep in both conditions:
- Basic chat history and message flow.
- Saved insights panel.
- Presence indicators and multi-user collaboration surfaces.

2. Enforce by condition:
- AI toggle state drives effective condition.
- Research/deep generation affordances in AI-Light are hidden or disabled consistently.
- Context editing behavior follows chosen matrix policy and is enforced consistently.

3. Remove participant rule controls:
- Individual rule toggles are not participant-facing.
- Rule set remains hardcoded and condition-driven.

## 5. Seeding Contract
1. Seed data contains only operational study identifiers and onboarding guidance.
2. Session/team info in seeded content may include:
- Team number/id
- Run order (AB/BA)
- Run index/condition label
3. Seed data must not include scenario narrative details or task prompts.
4. Onboarding markers may remain, but their content should be scenario-neutral.

## 6. Export and Session Packaging Contract
Minimum required fields in export package:
1. Session metadata:
- teamId
- sessionId
- condition flag (AI-On or AI-Light)
- run order when available (AB/BA)
- export timestamp and session window

2. Event-level telemetry support:
- routing metadata (mode, confidence, source) where captured
- decision lifecycle events (accept, dismiss, complete/archive)
- navigation/provenance events (marker jumps and link focus)
- context update events (at least lengths; preferred before and after text)

3. Output artifacts:
- messages
- insights
- timeline events
- metrics summary

4. Manual-analysis fallback:
- Export format must preserve enough granularity for offline coding if automated metrics are incomplete.

## 7. Condition Signaling UI Contract
Condition signaling should reduce confusion without biasing participant behavior.
1. Show a compact, persistent condition indicator (AI-On or AI-Light).
2. Use one-line neutral capability description.
3. Do not expose implementation details, hidden features, or treatment rationale.

## 8. Acceptance Criteria (Must Pass)
1. Toggling main AI toggle updates effective condition and backend behavior deterministically.
2. AI-Light blocks autonomous behavior and restricted generation paths even via direct API call.
3. Participant-facing rule toggles are removed.
4. Seeded onboarding/session content is scenario-neutral.
5. Export package includes required session metadata and event/artifact payloads.
6. Frontend and backend build/type-check pass after changes.

## 9. Out of Scope
1. In-app survey administration UI.
2. In-app observer note-taking workflows.
3. Full inferential statistics pipeline inside product.

## 10. Change Control
Any deviation from this contract must update this file first, then implementation.
