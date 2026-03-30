# Study Seed Output

Template: cohort-3-solo3-team2
Title: 3 participants, 3 solo chats + 2 team chats
Description: Primary study seed for onboarding-first flow: three participant solo chats, one shared AI-on team chat, and one shared AI-light team chat.

## Condition Profiles

- AI-on: Autonomous support enabled; use as full-assist condition.
- AI-on settings: chime=true, preset=balanced, proactivity=helpful, length=balanced
- AI-light: Reduced autonomy and concise responses; use as baseline condition.
- AI-light settings: chime=false, preset=conservative, proactivity=silent, length=concise

## Team Assignments

| Team ID | Team Name | Participants | Run Order | Run 1 | Run 2 |
|---|---|---:|---|---|---|
| study-team-01 | Solo - Participant 1 | 1 | AB | AI_ON | AI_LIGHT |
| study-team-02 | Solo - Participant 2 | 1 | AB | AI_ON | AI_LIGHT |
| study-team-03 | Solo - Participant 3 | 1 | AB | AI_ON | AI_LIGHT |
| study-team-04 | Team - AI On | 3 | AB | AI_ON | AI_LIGHT |
| study-team-05 | Team - AI Light | 3 | BA | AI_LIGHT | AI_ON |

## Participant IDs

- study-team-01: study-user-01
- study-team-02: study-user-02
- study-team-03: study-user-03
- study-team-04: study-user-01, study-user-02, study-user-03
- study-team-05: study-user-01, study-user-02, study-user-03

## App Access Users (for immediate UI login/testing)

- user1, user2, user3
- These users are auto-added to each seeded study team to make teams visible in the current UI.

## Study Instructions

- Run onboarding in each solo chat first, then continue in the two shared team chats.
- Use Team - AI On for full-support condition and Team - AI Light for reduced-side-output condition.
- Collect Full JSON, Timeline JSON, and Metrics CSV after each condition.

## Suggested Next Steps

- Open docs/thesis-study/facilitator-runbook.md and run one pilot group.
- After each condition, export Full JSON, Timeline JSON, and Metrics CSV.
- Administer docs/thesis-study/post-task-survey.md after each condition.
