# Facilitator Runbook

This runbook is designed for 2-3 participants and a 30-45 minute total session.

## 1. Pre-Session Setup

Optional standardized setup (recommended for repeatability):

1. `npm --prefix backend run seed:study -- --template trio-abba-6`
2. Open `docs/thesis-study/generated/study-seed-latest.md` for team assignments.

1. Confirm backend and frontend are running.
2. Confirm participants are in the same team workspace.
3. Confirm timeline sync and telemetry are active in normal app usage.
4. Assign participant roles:
- Coordinator
- Analyst
- Executor
5. Assign condition order:
- `AB`: Condition 1 AI-on, Condition 2 AI-light
- `BA`: Condition 1 AI-light, Condition 2 AI-on

## 2. Condition Profiles

Important:

- `AI-light` is a condition profile, not a separate scenario.
- Run the same scenario prompt under both conditions for valid comparison.

## AI-on Profile

1. Master AI toggle: On.
2. Rule preset: Balanced (or Proactive for stronger AI-on behavior).
3. Agent preferences:
- Proactivity: Helpful
- Response length: Balanced
- Model tier: Auto

## AI-light Profile

1. Master AI toggle: Off for autonomous chime behavior.
2. Rule preset: Conservative.
3. Agent preferences:
- Proactivity: Silent
- Response length: Concise
- Model tier: Auto or Tier1

Note: AI-light still permits explicit user-triggered AI interactions.

## 3. Session Timeline (Per Condition)

1. Minute 0-2: Read scenario handout and objective.
2. Minute 2-4: Team sets/updates task context.
3. Minute 4-12: Team plans and decides key tasks.
4. Minute 8: Facilitator injects mid-run change.
5. Minute 12-15: Team finalizes deliverable and verifies one source link.

## 4. Telemetry-Critical Reminders During Run

1. Ensure at least one Ask interaction occurs.
2. Ensure at least one Research interaction occurs.
3. Ensure at least one action is accepted and one dismissed.
4. Ensure at least one accepted action is marked complete.
5. Ensure one marker-to-insight or insight-to-marker jump is performed.

## 5. Between-Condition Reset

1. Use Session Reset for the current team.
2. Confirm chat and insights are cleared.
3. Apply next condition profile.
4. Start second condition timer.

## 6. End-of-Condition Data Capture

After each condition, export all:

1. Full JSON
2. Timeline JSON
3. Metrics CSV

Use file naming convention:

`group-{GID}_team-{TEAMID}_condition-{AION|AILIGHT}_order-{AB|BA}_run-{1|2}_timestamp-{YYYYMMDD-HHMM}`

## 7. Survey Administration

1. Immediately after each condition, collect self and peer survey.
2. Keep survey anonymous by participant code (P1/P2/P3).
3. Record condition label and run order on each survey form.

### Validated Instrument Modules (Recommended)

Add at least two validated scales to strengthen thesis rigor:

1. `UMUX-Lite` (2-item perceived usability)
2. `NASA-TLX` raw workload scoring (6 dimensions)
3. `Trust in Automation` scale (Jian et al.)

Practical recommendation for 30-45 min sessions:

1. Mandatory: UMUX-Lite + Trust in Automation
2. Optional: NASA-TLX if participant fatigue is manageable

## 8. Pilot Quality Checks

1. Check exported timeline contains key events for this run.
2. Check accepted/dismissed/completed counts are non-zero where required.
3. Check session duration and timestamps are plausible.
4. Record anomalies (disconnects, accidental reset, participant drop).

## 9. Minimum Viable Dataset Recommendation

1. At least 6 groups for pilot inference.
2. At least 10-12 groups for stronger within-subject comparison.
3. Balanced AB/BA assignments.

## 10. Preliminary Readiness Pilot (Recommended Before Full Study)

Use this section for your pre-study check (for example, tomorrow) to verify operational readiness.

### Should You Test All Domains?

Yes, but as smoke coverage, not full statistical testing.

Recommended principle:

1. Broad coverage across all domain packs.
2. Shallow depth per domain.
3. Strict go/no-go criteria before full participant sessions.

### Suggested Readiness Matrix

1. Condition check (same scenario, same team):
- Run AI-on once (10-15 min)
- Run AI-light once (10-15 min)

2. Domain smoke coverage:
- Run one short session from Domain Pack 1
- Run one short session from Domain Pack 2
- Run one short session from Domain Pack 3

Total recommended readiness runs: 5 short runs.

### Go/No-Go Criteria

Proceed to full study only if all are satisfied:

1. No critical app failures (crash, freeze, unrecoverable sync issue).
2. Session reset works reliably between runs.
3. Exports succeed for Full JSON, Timeline JSON, and Metrics CSV.
4. Required telemetry events appear in Timeline JSON.
5. Condition manipulation is visible in behavior/logs (AI-on vs AI-light).
6. At least one accepted, one dismissed, and one completed action flow is observed in pilot.
7. Marker/insight traceability jump works in both directions.

If any criterion fails, fix and re-run readiness pilot before recruiting full sample.
