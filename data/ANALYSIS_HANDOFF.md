# Study Data Analysis — Handoff Prompt

You are continuing a research data analysis project for a thesis study on AI-assisted team collaboration. This document gives you everything needed to continue cleanly.

---

## Study Overview

**Tool being studied:** A collaborative AI workspace with three columns — left sidebar (teams/navigation), center (real-time team chat), right panel (AI-generated insights). Users interact via chat; the AI routes messages to either "ask" (conversational reply) or "research" (structured insight generation) modes. Users can manually override the auto-classifier.

**Two conditions:**
- **AI_ON**: Full feature set — right panel active, insights generated, traceability markers linking chat messages to insights, context panel for setting team task scope
- **AI_LIGHT**: Stripped-down mode — center chat only, no right-panel insights, minimal AI surface

**Study structure:** 4 sessions, 9 participants total (S1: 2, S2: 3, S3: 2, S4: 2). Run order: S1 AB, S2 BA, S3 AB, S4 AB. Each session has:
- Solo tasks (individual AI_ON use — project scoping type tasks)
- Group task A: AI_ON condition (team-04)
- Group task B: AI_LIGHT condition (team-05)

**Scenarios are deliberately different between AI_ON and AI_LIGHT group tasks** to avoid speed contamination on the second run — this is an intentional A/B design, not an error.

**Research questions (AQ framework):**
- AQ1: AI routing behaviour — do users use modes appropriately, do overrides indicate trust or confusion?
- AQ2: Traceability and trust — do users verify AI suggestions via source linkage?
- AQ3: Shared understanding — does the context panel propagate constraints across participants and into AI responses?
- AQ4: Coordination support — does the workspace model match collaborative mental models?
- AQ5: Contextual catch-up — can a new joiner get up to speed via AI artefacts? (Not tested in Sessions 1–3)

---

## Repository Location

`C:\Users\justin\Documents\GitHub\fypai\data\`

---

## Data Folder Structure

```
data/
  1/                        Session 1 (JC, Sam — solo; team-04 AI_ON, team-05 AI_LIGHT)
    test 1.txt              Raw facilitator notes (superseded)
    1-cleaned.md            ← CANONICAL cleaned record for Session 1
    1 jc/                   JC solo export
    3 sam/                  Sam solo export
    4 ai on/                Session 1 group AI_ON export
    5 ai light/             Session 1 group AI_LIGHT export

  2/                        Session 2 (Willson, Aly, Roys — solo; team-04 AI_ON, team-05 AI_LIGHT)
    2.txt                   Raw facilitator notes
    2-cleaned.md            ← CANONICAL cleaned record for Session 2
    1 willson/
    2 aly/
    3 roys/
    4 ai on/
    5 ai light/             ← Was cleaned (tangent trimmed); backups at *.bak

  3/                        Session 3 (Aung, Shanyl — solo; team-04 AI_ON, team-05 AI_LIGHT)
    3-cleaned.md            ← CANONICAL cleaned record for Session 3
    1 aung/
    2 shanyl/
    4 ai on/
    5 ai light/

  4/                        Session 4 (Val, Jen — solo; team-04 AI_ON, team-05 AI_LIGHT)
    4.txt                   Raw facilitator notes
    4-cleaned.md            ← CANONICAL cleaned record for Session 4
    4-analysis.md           ← Session 4 compiled analysis
    1 val/
    2 jen/
    4 ai on/
    5 ai light/

  output/                   Generated CSVs from analysis scripts
    routing_table.csv       414 rows — per-message routing data across all sessions (S4: +71)
    traceability_clicks.csv 77 rows — traceability/marker interaction events (S4: +25)
    panel_navigation.csv    23 rows — right-panel tab change events (S4: +0)
    insight_generations.csv 66 rows — insight generation events, post-seed-filter (S4: +18)
    insight_status_changes.csv  6 rows — accept/dismiss workflow (S4: +6, all facilitator)
    context_events.csv      147 rows — context panel opens/saves, AI toggles, draft promotes (S4: +19)
    condition_audit.csv     17 rows — per-file condition/message/override/insight summary (S4: +4)

  script1_routing_table.py    → routing_table.csv
  script2_traceability.py     → traceability_clicks.csv + panel_navigation.csv
  script3_insight_events.py   → insight_generations.csv + insight_status_changes.csv
  script4_context_events.py   → context_events.csv
  script5_condition_audit.py  → condition_audit.csv
  script6_session_metrics.py  → Terminal summary output (no file written)
  script7_routing_summary.py  → routing_summary.csv (per-participant summary with override rates)
  script8_traceability_with_status.py → traceability_with_status.csv (clicks with insight age/status)
  script9_context_timeline.py → context_timeline.csv (chronological context events)
  script10_insight_workflow.py → insight_workflow.csv (insight lifecycle events)
  clean_team05.py             → One-time cleaner for Session 2 team-05 tangent (already run)
  verify_analysis.py          → Comprehensive CSV verification tool
  README.md
  DATA_ISSUES.md              ← Cross-session instrumentation issues reference
  DATA_QUALITY.md
  ANALYSIS_HANDOFF.md         ← This file

  1/1-analysis.md             ← Session 1 compiled analysis (verified against CSVs)
  2/2-analysis.md             ← Session 2 compiled analysis (verified against CSVs)
  3/3-analysis.md             ← Session 3 compiled analysis (verified against CSVs)
  4/4-analysis.md             ← Session 4 compiled analysis
```

Each session folder's `4 ai on/` and `5 ai light/` subfolders contain:
- `session-study-teamXX.csv` — messages only (easy to scan)
- `session-study-teamXX.json` — full export with insights
- `session-study-teamXX-timeline.json` — chronological events ← **scripts read this file only**
- `session-study-teamXX-metrics.csv` — aggregated counters

---

## Export File Schema (Timeline JSON)

Events have: `id`, `teamId`, `sessionId`, `eventType`, `eventName`, `actorUserId`, `metadata`, `createdAt`

Key event names captured in scripts:
- `message_sent` (with routing metadata in message events)
- `task_context_saved`, `task_context_panel_toggled`
- `team_ai_toggle_changed`
- `right_panel_tab_changed`
- `focus_insight_from_marker`, `jump_to_chat_marker`, `focus_chat_marker_from_insight`, `focus_insight_from_agent_message`
- `insight_generated`
- `insight_status_changed` (empty in sessions 1–2; expected in later sessions)

---

## Data Cleaning Status

**Session 2, team-05 (AI_LIGHT):** Tangent trimmed. Two windows removed:
- Pre-task: `08:32:13` → `08:34:21` (slur baiting, LinkedIn lookup, boundary testing before task started)
- Post-task: `08:43:42` onward (sexual content, harassment — ran to end of file)

Kept: opening greeting (`08:32:11`) + warm-up messages from `08:34:43`, then the full legitimate trip-planning session.
Original files backed up as `.bak`. 165 timeline events and 152 CSV rows removed.

**All other files:** No cleaning applied.

---

## Scripts — How to Run

```powershell
Set-Location "C:\Users\justin\Documents\GitHub\fypai\data"
python script1_routing_table.py     # regenerates routing_table.csv
python script2_traceability.py      # regenerates traceability + panel_navigation
python script3_insight_events.py    # regenerates insight_generations + status_changes
python script4_context_events.py    # regenerates context_events
python script5_condition_audit.py   # regenerates condition_audit
python script6_session_metrics.py 1 # prints Session 1 summary
python script6_session_metrics.py 2 # prints Session 2 summary
python script6_session_metrics.py   # all sessions
```

---

## Per-Session Status

### Session 1
- **Participants:** JC (P1), Samuel (P2)
- **Canonical notes:** `data/1/1-cleaned.md`
- **Compiled analysis:** `data/1/1-analysis.md` ← verified against CSV data
- **Telemetry:** Run `python script6_session_metrics.py 1` to generate
- **Analysis status:** Complete. All telemetry table values verified against CSV ground truth.

### Session 2
- **Participants:** Willson (P1), Aly (P2), Royston (P3)
- **Raw notes:** `data/2/2.txt`
- **Canonical notes:** `data/2/2-cleaned.md`
- **Compiled analysis:** `data/2/2-analysis.md` ← verified against CSV data
- **Data cleaning:** team-05 tangent trimmed (see cleaning status section)
- **Telemetry:** Run `python script6_session_metrics.py 2` to generate
- **Analysis status:** Complete. All telemetry table values verified against CSV ground truth.

### Session 3
- **Participants:** Aung (P1), Shanyl (P2)
- **Canonical notes:** `data/3/3-cleaned.md`
- **Compiled analysis:** `data/3/3-analysis.md` ← verified against CSV data
- **Telemetry:** Run `python script6_session_metrics.py 3` to generate
- **Analysis status:** Complete. All telemetry table values verified against CSV ground truth.

### Session 4
- **Participants:** Val (P1), Jen (P2)
- **Raw notes:** `data/4/4.txt`
- **Canonical notes:** `data/4/4-cleaned.md`
- **Compiled analysis:** `data/4/4-analysis.md`
- **Telemetry:** Run `python script6_session_metrics.py 4` to generate
- **Instrumentation note:** `insight_generate_completed` events restored (present in S1, absent S2–S3, back in S4). Direct generation telemetry — no export_fallback needed.
- **Analysis status:** Complete. Facilitator events catalogued (6 insight_status_changed, all `new→accepted` by user1). Seed events identified and filtered (Quick Start Help, created same day at 07:33:22, ~21 min before session).

---

## Recommended Workflow Per Session

For each session, in order:
1. Read the canonical cleaned notes file (e.g. `1-cleaned.md`) — this is the authoritative qualitative record
2. Run `python script6_session_metrics.py <N>` and read the telemetry output
3. Cross-check notes against telemetry; flag discrepancies or ambiguous notes to the user
4. If no cleaned notes file exists yet, read the raw `.txt` notes, ask the user to clarify gaps, then compile a cleaned record
5. Produce a compiled metrics and findings summary for the session
6. After all sessions are done, produce cross-session synthesis across all AQs

---

## Important Design Notes

- Scenario order differs across sessions — always check `run_order` field (AB or BA)
- `study-user-*` participant IDs are the only valid participants for analysis — filter out `user1`, `user2`, `user3` (seed/test users)
- AI_LIGHT produces no right-panel insights by design — zero traceability/tab metrics are expected, not missing data
- Override rate differences between conditions partly reflect condition design (AI_LIGHT has fewer override affordances), not purely user behaviour
- Bugs fixed after Session 1: `/research` message-loss, dismiss-persistence. Both present in Session 1 only.
- `insight_status_changed` events were captured in Sessions 3 and 4 (all by facilitator — issue A4). Sessions 1–2 have no workflow events. Use `traceability_with_status.csv` (script8) and `insight_workflow.csv` (script10) for the available data.
- **Script updates for S4:** All upstream scripts (1–5, 8–10) updated glob from `[123]` to `[1234]`. Scripts 3, 8, 10 had `SESSION_DATES` dict — added `"4": "2026-03-29"` (critical: without this, all S4 insight events were silently filtered). `deep_audit.py` also updated with S4 subfolders.
