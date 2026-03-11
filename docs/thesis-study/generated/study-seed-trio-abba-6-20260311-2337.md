# Study Seed Output

Template: trio-abba-6
Title: 6 teams, 3 participants each, AB/BA counterbalance
Description: Primary recommendation for thesis runs. Balanced counter-order with equal scenario variant distribution.

## Condition Profiles

- AI-on: Autonomous support enabled; use as full-assist condition.
- AI-on settings: chime=true, preset=balanced, proactivity=helpful, length=balanced
- AI-light: Reduced autonomy and concise responses; use as baseline condition.
- AI-light settings: chime=false, preset=conservative, proactivity=silent, length=concise

## Team Assignments

| Team ID | Team Name | Participants | Run Order | Scenario | Run 1 | Run 2 |
|---|---|---:|---|---|---|---|
| study-team-01 | Study Team 01 | 3 | AB | A | AI_ON | AI_LIGHT |
| study-team-02 | Study Team 02 | 3 | BA | B | AI_LIGHT | AI_ON |
| study-team-03 | Study Team 03 | 3 | AB | B | AI_ON | AI_LIGHT |
| study-team-04 | Study Team 04 | 3 | BA | A | AI_LIGHT | AI_ON |
| study-team-05 | Study Team 05 | 3 | AB | A | AI_ON | AI_LIGHT |
| study-team-06 | Study Team 06 | 3 | BA | B | AI_LIGHT | AI_ON |

## Participant IDs

- study-team-01: study-user-01-01, study-user-01-02, study-user-01-03
- study-team-02: study-user-02-01, study-user-02-02, study-user-02-03
- study-team-03: study-user-03-01, study-user-03-02, study-user-03-03
- study-team-04: study-user-04-01, study-user-04-02, study-user-04-03
- study-team-05: study-user-05-01, study-user-05-02, study-user-05-03
- study-team-06: study-user-06-01, study-user-06-02, study-user-06-03

## App Access Users (for immediate UI login/testing)

- user1, user2, user3
- These users are auto-added to each seeded study team to make teams visible in the current UI.

## Study Instructions

- Run 2 conditions per team using assigned AB/BA order.
- Collect Full JSON, Timeline JSON, and Metrics CSV after each condition.
- Administer post-task survey immediately after each condition.

## Suggested Next Steps

- Open docs/thesis-study/facilitator-runbook.md and run one pilot group.
- After each condition, export Full JSON, Timeline JSON, and Metrics CSV.
- Administer docs/thesis-study/post-task-survey.md after each condition.
