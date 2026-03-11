# Preliminary Readiness Checklist (Tomorrow)

Purpose: determine whether the app and protocol are ready for full usability testing.

This is not hypothesis testing.
This is operational readiness verification.

## A. Pre-Run Setup Checklist

1. Backend starts successfully.
2. Frontend starts successfully.
3. Team assignment file is available from generated seed output.
4. Condition profile settings can be applied (AI-on and AI-light).
5. Session reset works before first run.

## B. Recommended Run Plan (All-Domain Smoke + Condition Check)

Run short sessions (10-15 min each):

1. Run 1: Domain Pack 1, AI-on.
2. Run 2: Domain Pack 1, AI-light.
3. Run 3: Domain Pack 2, AI-on.
4. Run 4: Domain Pack 3, AI-on.
5. Run 5: Any pack, AI-light (stability confirmation).

Notes:

- Keep participant instructions consistent.
- Use the same required checkpoints across runs.
- Do not interpret performance differences as final results.

## C. Per-Run Verification Checklist

For each run, confirm all items:

1. Task context updated at least once.
2. Ask flow used at least once.
3. Research flow used at least once.
4. At least one action accepted.
5. At least one action dismissed.
6. At least one action completed.
7. Marker/insight navigation performed.
8. Full JSON export succeeds.
9. Timeline JSON export succeeds.
10. Metrics CSV export succeeds.

## D. Data Integrity Checks (After Each Run)

1. Timeline includes key events:
- message_sent
- task_context_saved
- insight_status_changed
- research_job_requested
- jump_to_chat_marker or jump_to_insight_marker

2. Event timestamps are plausible and ordered.
3. Session duration aligns with facilitator timer.
4. Export files are named with condition and run metadata.

## E. Go/No-Go Gate

Go to full testing only if all conditions are true:

1. No critical runtime failures in any readiness run.
2. Export pipeline worked for every run.
3. Required telemetry events are present in every run.
4. Condition difference is observable in practice (AI-on vs AI-light behavior).
5. Facilitator can execute protocol without ambiguity.

If any item fails:

1. Log exact failure and reproducible steps.
2. Patch protocol or app behavior.
3. Re-run only failed readiness runs.

## F. Recommended Commands

List templates:

1. npm --prefix backend run seed:study -- --list

Seed software baseline pack:

1. npm --prefix backend run seed:study -- --template trio-abba-6

Seed campus services pack:

1. npm --prefix backend run seed:study -- --template trio-campus-services-6

Seed community impact pack:

1. npm --prefix backend run seed:study -- --template trio-community-impact-6

Reminder:

- Each seed run replaces prior study-prefixed data.
- Export and archive run artifacts before reseeding.
