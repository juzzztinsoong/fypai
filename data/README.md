# Study Data — Automated Analysis

This folder contains the exported session data from the FYP user study and the
Python scripts for automated log analysis.

## Folder Structure

```
data/
  1/                          Study session 1 (JC, Sam)
  2/                          Study session 2 (Willson, Aly, Roys)
  3/                          Study session 3 (Aung, Shanyl)
  output/                     Generated CSV files (populated by running scripts)
  script1_routing_table.py    All study-user messages with routing metadata
  script2_traceability.py     Insight/marker navigation and panel tab changes
  script3_insight_events.py   AI insight generation requests and status changes
  script4_context_events.py   AI toggle and context panel events
  script5_condition_audit.py  Per-file summary with aggregate counts
  README.md                   (this file)
  DATA_QUALITY.md             Known data issues and fixes applied
```

## Study Design

- **3 sessions** × ~3 participants each (9 participants total)
- **Within-subject AB/BA crossover**: each participant used both conditions
  - **AI_ON**: full AI features (auto routing, research mode, right panel insights)
  - **AI_LIGHT**: reduced AI feature set
- **Solo phase**: each participant uses their own team (team-01/02/03)
- **Group phase**: all participants in shared teams (team-04 = AI_ON, team-05 = AI_LIGHT)

## Export File Types

Each participant/team folder contains two files per team:
- `*-timeline.json` — event timeline export — **used by all scripts**
- `*.json` — full export with messages + insights arrays — not used by scripts

## Running the Scripts

All scripts are standalone; dependencies are Python stdlib only (no pip install needed).

```bash
cd data
python script1_routing_table.py
python script2_traceability.py
python script3_insight_events.py
python script4_context_events.py
python script5_condition_audit.py
```

Or run all at once (bash/zsh):
```bash
for s in data/script*.py; do python $s; done
```

PowerShell:
```powershell
Get-ChildItem data\script*.py | ForEach-Object { python $_.FullName }
```

## Output Files

| File | Script | Description |
|------|--------|-------------|
| `output/routing_table.csv` | Script 1 | One row per user message with full routing metadata |
| `output/traceability_clicks.csv` | Script 2 | Insight/marker link click events |
| `output/panel_navigation.csv` | Script 2 | Right-panel tab change events |
| `output/insight_generations.csv` | Script 3 | AI insight generation request + completion events |
| `output/insight_status_changes.csv` | Script 3 | Insight accept/dismiss/archive events |
| `output/context_events.csv` | Script 4 | AI toggle and context panel open/close events |
| `output/condition_audit.csv` | Script 5 | Per-file aggregate summary for cross-session comparison |

## Scope of This Phase

These scripts cover **automated log analysis** only. Not included here:

- Per-message task-type labels (manual annotation)
- Routing alignment ratings (was auto-routing appropriate?)
- Qualitative theme coding from think-aloud transcripts
- Manual coding scheme and inter-rater reliability

Those are handled separately in the manual coding phase.

## Requirements

Python 3.9+ with standard library only.
