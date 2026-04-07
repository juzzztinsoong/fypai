"""
Script 10 — Decision Workflow Distribution
===========================================
Aggregates insight action data across all sessions: how many insights were
generated, what types, and what was their final status (new/accepted/dismissed/
archived). Also captures any explicit status transition events from the timeline.

Input:
  All *-[teamId].json (full exports) under data/1/, data/2/, data/3/
  All *-timeline.json (for status-change event detail)
Output:
  output/insight_workflow.csv     — one row per insight
  output/insight_workflow_summary.csv — aggregated counts by session/condition/type/status

Why two outputs
---------------
insight_workflow.csv lets analysis threads do their own grouping.
insight_workflow_summary.csv gives an immediately readable cross-session table.

Insight status values observed in data
---------------------------------------
  new          Generated, never actioned by a study participant
  accepted     Participant marked as accepted (pinned/kept)
  dismissed    Participant dismissed/removed
  archived     Accepted then archived (moved from active panel)
  (empty)      Missing status field — treat as 'new'

Note on instrumentation
-----------------------
insight_status_changed events from study participants are absent for
Sessions 1 and 2 due to a known instrumentation gap (DATA_ISSUES.md A4).
ALL insight_status_changed events in the data were fired by user1 (the
facilitator/seed account). The status values in this output reflect the
terminal state in the export .json at session end, not the within-session
action lifecycle. Timeline status events are included in the transitions
column for reference but represent facilitator actions only.

Note on cross-session comparison (DATA_ISSUES.md A2)
-----------------------------------------------------
This script reads 1 row per insight from the export .json for ALL sessions,
so counts are directly comparable cross-session. Do NOT mix with raw counts
from insight_generations.csv for S1 — that file has 2 rows per generation
(request + complete event pairs) and will overcount if summed naively.

Note on session_id (DATA_ISSUES.md B2)
---------------------------------------
S1 JC solo and S1 Group AI_ON share the same session_id. Do not group or
join on session_id. Use file_key or team_id as the discriminating key.

Columns (insight_workflow.csv)
-------------------------------
session_num
file_key
team_id
condition
run_order
insight_id
insight_type         summary | document | action | suggestion | analysis | code
insight_title        First 100 chars
insight_created_at
final_status
tags                 JSON-like tags string from export
has_related_messages True if relatedMessageIds is non-empty
related_message_count
generated_by         source tag e.g. 'user-triggered', 'chime', 'agent-reply'
                     inferred from tags if present
status_transitions   Semicolon-joined list of "ts:fromStatus->toStatus" from timeline
                     (includes all actors, mostly seed user — see note above)
"""

import json
import csv
from pathlib import Path

DATA_DIR   = Path(__file__).parent
OUTPUT_DIR = DATA_DIR / "output"

EXCLUDED_STUDY_ACTORS = {"user1", "user2", "user3", "agent"}

# Seed filter — mirrors script3 (DATA_ISSUES.md A1).
# Pre-session onboarding insights are timestamped 12-24h before the session
# date and appear in bursts. They are excluded from all output rows.
SESSION_DATES = {
    "1": "2026-03-19",
    "2": "2026-03-25",
    "3": "2026-03-26",
    "4": "2026-03-29",
}


def is_genuine_insight(session_num, timestamp_iso):
    cutoff = SESSION_DATES.get(str(session_num), "")
    return bool(cutoff) and timestamp_iso[:10] >= cutoff

DETAIL_COLUMNS = [
    "session_num",
    "file_key",
    "team_id",
    "condition",
    "run_order",
    "insight_id",
    "insight_type",
    "insight_title",
    "insight_created_at",
    "final_status",
    "tags",
    "has_related_messages",
    "related_message_count",
    "generated_by",
    "status_transitions",
]

SUMMARY_COLUMNS = [
    "session_num",
    "condition",
    "insight_type",
    "final_status",
    "count",
]


def find_full_exports():
    """Yield (session_num, path) for every full export *.json (not timeline/metrics)."""
    for session_dir in sorted(DATA_DIR.glob("[1234]")):
        for f in sorted(session_dir.rglob("*.json")):
            if "timeline" in f.name or "metrics" in f.name:
                continue
            yield session_dir.name, f


def find_timeline_for(json_path):
    """Return the sibling *-timeline.json if it exists."""
    stem = json_path.stem  # e.g. session-study-team-04
    tl_path = json_path.with_name(stem + "-timeline.json")
    return tl_path if tl_path.exists() else None


def load_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def infer_generated_by(tags_raw):
    """
    Infer insight source from the tags list.
    Tags are stored as a JSON string in the export (e.g. '["user-triggered","summary"]').
    """
    if not tags_raw:
        return ""
    try:
        tags = json.loads(tags_raw) if isinstance(tags_raw, str) else tags_raw
    except Exception:
        return ""
    for tag in tags:
        t = str(tag).lower()
        if "chime" in t:
            return "chime"
        if "user" in t:
            return "user-triggered"
        if "agent" in t or "auto" in t:
            return "auto"
    return ""


def extract_rows(session_num, path, export):
    spec      = export.get("sessionSpec", {})
    team_id   = export.get("teamId", "")
    condition = spec.get("conditionFlag", "")
    run_order = spec.get("runOrder", "")
    file_key  = f"{session_num}/{path.parent.name}/{path.name}"
    insights  = export.get("insights", [])

    # Build status-transition index from sibling timeline
    transitions = {}  # insight_id -> list of "ts:from->to"
    tl_path = find_timeline_for(path)
    if tl_path and tl_path.exists():
        tl_data = load_json(tl_path)
        for ev in tl_data.get("timeline", []):
            if ev.get("eventName") != "insight_status_changed":
                continue
            iid = ev.get("insightId", "")
            ts  = ev.get("createdAt", "")[:19]
            meta = ev.get("metadata", {})
            frm  = meta.get("fromStatus", "?")
            to   = meta.get("toStatus", "?")
            if iid:
                transitions.setdefault(iid, []).append(f"{ts}:{frm}->{to}")

    rows = []
    for ins in insights:
        iid        = ins.get("id", "")
        created_at = ins.get("createdAt", "")

        # Skip seed/onboarding insights (DATA_ISSUES.md A1)
        if not is_genuine_insight(session_num, created_at):
            continue

        tags_raw = ins.get("tags", "")
        # tags can be stored as JSON string or as a list depending on export version
        rel_msgs = ins.get("relatedMessageIds", []) or []

        rows.append({
            "session_num":           session_num,
            "file_key":              file_key,
            "team_id":               team_id,
            "condition":             condition,
            "run_order":             run_order,
            "insight_id":            iid,
            "insight_type":          ins.get("type", ""),
            "insight_title":         ins.get("title", "")[:100],
            "insight_created_at":    ins.get("createdAt", ""),
            "final_status":          ins.get("status", "new") or "new",
            "tags":                  str(tags_raw),
            "has_related_messages":  bool(rel_msgs),
            "related_message_count": len(rel_msgs),
            "generated_by":          infer_generated_by(tags_raw),
            "status_transitions":    "; ".join(transitions.get(iid, [])),
        })

    return rows


def summarise(detail_rows):
    from collections import Counter
    counts = Counter(
        (r["session_num"], r["condition"], r["insight_type"], r["final_status"])
        for r in detail_rows
    )
    return [
        {
            "session_num":  s,
            "condition":    c,
            "insight_type": t,
            "final_status": st,
            "count":        n,
        }
        for (s, c, t, st), n in sorted(counts.items())
    ]


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    all_rows = []

    for session_num, path in find_full_exports():
        try:
            export = load_json(path)
        except Exception as e:
            print(f"  SKIP {path}: {e}")
            continue

        # Only process files that look like study session exports
        if "sessionSpec" not in export:
            continue

        rows = extract_rows(session_num, path, export)
        if rows:
            all_rows.extend(rows)
            print(f"  {session_num}/{path.parent.name}: {len(rows)} insights")

    # Write detail
    detail_path = OUTPUT_DIR / "insight_workflow.csv"
    with open(detail_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=DETAIL_COLUMNS)
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"\nWritten {len(all_rows)} rows to {detail_path.relative_to(DATA_DIR)}")

    # Write summary
    summary_rows = summarise(all_rows)
    summary_path = OUTPUT_DIR / "insight_workflow_summary.csv"
    with open(summary_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=SUMMARY_COLUMNS)
        writer.writeheader()
        writer.writerows(summary_rows)
    print(f"Written {len(summary_rows)} rows to {summary_path.relative_to(DATA_DIR)}")

    # Print summary table
    print()
    print(f"{'Sess':>4} {'Cond':>8} {'Type':>12} {'Status':>10}  N")
    for r in summary_rows:
        print(
            f"  {r['session_num']:>4} {r['condition']:>8} "
            f"{r['insight_type']:>12} {r['final_status']:>10}  {r['count']}"
        )


if __name__ == "__main__":
    main()
