# Thesis Study Package (No-Code Protocol)

This folder contains a complete no-code package to run and analyze your HCI/UX study for collaborative human-AI interaction.

## Purpose

Use realistic student collaboration tasks in the app while leveraging existing telemetry and exports for analysis.

Participant behavior is in-app only.
Researcher control can stay manual using existing UI.
No product code changes are required for the core study.

## Included Files

- `scenario-handouts.md`: Two equivalent scenario variants (A/B) for repeated runs.
- `facilitator-runbook.md`: Step-by-step execution script, timing, conditions, reset/export process.
- `post-task-survey.md`: Per-condition self and peer questionnaire (7-point Likert).
- `metrics-data-mapping.md`: Metric dictionary mapped to telemetry/export fields.
- `analysis-template.md`: Run log and comparison template for AI-on vs AI-light.
- `preliminary-readiness-checklist.md`: Tomorrow-style readiness smoke test across conditions and domains.

## Quick Start

1. Pick one team and participant triad (2-3 participants).
2. Assign condition order (AB or BA).
3. Run one pilot using `facilitator-runbook.md`.
4. Export `Full JSON`, `Timeline JSON`, and `Metrics CSV` after each condition.
5. Administer survey from `post-task-survey.md` after each condition.
6. Enter results in `analysis-template.md`.

## Optional Seed Automation

If you want standardized study teams and participant counts preconfigured:

1. `npm --prefix backend run seed:study -- --list`
2. `npm --prefix backend run seed:study -- --template trio-abba-6`

Additional domain templates:

1. `npm --prefix backend run seed:study -- --template trio-campus-services-6`
2. `npm --prefix backend run seed:study -- --template trio-community-impact-6`

Generated outputs are written to:

- `docs/thesis-study/generated/study-seed-latest.md`
- `docs/thesis-study/generated/study-seed-latest.json`

Notes:

- The study seed command only cleans prior study data with prefixes `study-team-*` and `study-user-*`.
- Existing non-study teams and users are untouched.

## Conditions Used

- `AI-on`: default collaborative AI assistance with autonomous support enabled.
- `AI-light`: reduced autonomy and reduced verbosity/proactivity, still allowing explicit user-triggered AI interaction.

Important:

- `AI-light` is a condition profile, not a separate scenario type.
- Use the same scenario prompt under AI-on and AI-light for valid condition comparison.

## Notes

- This package treats AI-light as the practical baseline (not a full no-AI condition).
- If pilot reliability is low, add lightweight researcher scripts later for setup/export automation.
