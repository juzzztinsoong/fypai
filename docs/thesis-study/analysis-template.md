# Analysis Template (AI-on vs AI-light)

Use this template to consolidate run-level data and compute within-subject comparisons.

## 1. Run Register

| Group | Team | Order | Run | Condition | Scenario | Start Time | End Time | Duration (min) | Valid Run (Y/N) | Notes |
|---|---|---|---|---|---|---|---|---:|---|---|
| G01 | team1 | AB | 1 | AI-on | A |  |  |  |  |  |
| G01 | team1 | AB | 2 | AI-light | B |  |  |  |  |  |

## 2. Extracted Metrics Per Run

| Group | Run | Condition | Time to First Plan (s) | Time to Final Decision (s) | Accepted Actions | Dismissed Actions | Completed Actions | Rework Rate | Marker/Insight Jumps | Routing Fit (%) | Trust Score (1-7) | Deliverable Quality (1-7) | UMUX-Lite (0-100) | NASA-TLX Raw (0-100) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| G01 | 1 | AI-on |  |  |  |  |  |  |  |  |  |  |  |  |
| G01 | 2 | AI-light |  |  |  |  |  |  |  |  |  |  |  |  |

## 3. Within-Group Delta Sheet

Compute deltas as:

`Delta = AI-on - AI-light`

Interpretation:

- Lower is better for time metrics and rework rate.
- Higher is better for accepted/completed actions, routing fit, trust, and quality.

| Group | Delta First Plan (s) | Delta Final Decision (s) | Delta Accepted | Delta Dismissed | Delta Completed | Delta Rework | Delta Traceability Jumps | Delta Routing Fit | Delta Trust | Delta Quality | Delta UMUX-Lite | Delta NASA-TLX |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| G01 |  |  |  |  |  |  |  |  |  |  |  |  |

## 4. Aggregate Summary

| Metric | Median AI-on | Median AI-light | Median Delta | Direction Better | Observation |
|---|---:|---:|---:|---|---|
| Time to First Plan (s) |  |  |  | Lower |  |
| Time to Final Decision (s) |  |  |  | Lower |  |
| Accepted Actions |  |  |  | Higher |  |
| Dismissed Actions |  |  |  | Context-dependent |  |
| Completed Actions |  |  |  | Higher |  |
| Rework Rate |  |  |  | Lower |  |
| Traceability Jumps |  |  |  | Context-dependent |  |
| Routing Fit (%) |  |  |  | Higher |  |
| Trust Score |  |  |  | Higher |  |
| Deliverable Quality |  |  |  | Higher |  |
| UMUX-Lite |  |  |  | Higher |  |
| NASA-TLX Raw |  |  |  | Lower |  |

## 5. Qualitative Synthesis Prompts

1. What patterns explain faster or slower alignment?
2. When did AI routing appear mismatched to user intent?
3. Did action workflow mirror real teamwork behaviors?
4. Did traceability interactions increase confidence in decisions?
5. Which condition produced more usable deliverables and why?

## 6. Validity and Threat Log

Track per study:

1. Order effects (AB vs BA imbalance).
2. Team experience imbalance.
3. Familiarity effects after first run.
4. Telemetry gaps or export failures.
5. External interruptions.

## 7. Reporting Guidance

1. Report medians and interquartile range for small samples.
2. Pair quantitative deltas with representative participant quotes.
3. Clearly state that baseline is AI-light, not no-AI.
4. Separate usability findings from model-quality claims.
