# Metrics to Data Mapping

This sheet maps thesis metrics to existing app telemetry and exports.

## Export Sources

1. `Full JSON`: messages, insights, feedback, events, metrics.
2. `Timeline JSON`: chronological events plus computed metrics.
3. `Metrics CSV`: aggregated counters and pace metrics.

## Core Metrics

| Construct | Metric | Operational Definition | Data Source | How to Compute |
|---|---|---|---|---|
| Shared understanding | Time to first clear plan | Time from run start to first accepted planning action or explicit plan commitment | Timeline events + insights | `first(insight_status_changed to accepted for planning action) - run_start` |
| Shared understanding | Context alignment latency | Time from run start to first `task_context_saved` | Timeline events | `first(task_context_saved) - run_start` |
| Coordination quality | Message clarity proxy | Lower chat churn per decision | Full JSON messages + action status events | `message_sent_count / number_of_finalized_key_decisions` |
| Coordination quality | Handoff smoothness | Lower event gap volatility during handoffs | Timeline events | Use `avgSecondsBetweenEvents` plus manual handoff note checks |
| AI routing fit | Ask/Research appropriateness | Percentage of prompts where selected route matches task type rubric | Message metadata + scenario coding | `matches / total_coded_prompts` |
| AI routing fit | Override behavior | Rate of manual override during routing | Intent override endpoint or message metadata | `override_count / routed_messages` |
| AI routing fit | Trust/usefulness | Participant rating and helpfulness feedback | Survey + feedback records | Mean survey trust items and positive/negative feedback counts |
| Decision workflow | Accepted vs dismissed | Count accepted and dismissed action transitions | Timeline events | Count `insight_status_changed` where `toStatus` is accepted/dismissed |
| Decision workflow | Completed actions | Count action transitions to archived by run end | Timeline events | Count `insight_status_changed` where `toStatus=archived` |
| Decision workflow | Reopen/rework rate | Reversal transitions after prior decision | Timeline events by insightId | `(reversal_count / action_insight_count)` |
| Traceability | Verification interactions | Marker/insight cross-navigation usage | Timeline events | Count `jump_to_chat_marker`, `jump_to_insight_marker`, `focus_*_from_*` |
| Traceability | Verification completion | Required source-check step completion | Facilitator checklist + timeline | Binary per run (1 completed, 0 not) |
| Outcome quality | Time to final decision | Time from run start to final status of predefined key tasks | Timeline events + key-task mapping | `max(final_decision_timestamps) - run_start` |
| Outcome quality | Deliverable quality | Participant self/peer quality rating | Survey | Mean of quality items |

## Event Names to Validate Per Run

- `message_sent`
- `task_context_saved`
- `insight_status_changed`
- `research_job_requested`
- `right_panel_tab_changed`
- `jump_to_chat_marker`
- `jump_to_insight_marker`
- `focus_chat_marker_from_insight`
- `focus_insight_from_marker`

## Data Integrity Rules

1. Exclude runs missing Timeline JSON.
2. Flag runs where required checkpoint events are absent.
3. Keep anomaly log for disconnects/resets during active condition window.
4. Use identical run start/end anchors for all calculations.

## Notes on Baseline Interpretation

- This study uses `AI-light` as practical baseline.
- Do not claim pure no-AI effects unless you add a true no-AI condition.
