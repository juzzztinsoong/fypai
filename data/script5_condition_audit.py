"""
Script 5 — Condition Audit
===========================
One row per timeline export file. Summarises study design metadata and aggregate
usage counts for quick cross-session comparison and condition verification.

Input:  All *-timeline.json files under data/1/, data/2/, data/3/
Output: output/condition_audit.csv

Use this table to verify:
  - Each participant has one AI_ON file and one AI_LIGHT file
  - Run orders match the study design
  - Message counts are plausible for each condition
  - No study-user data is unexpectedly missing

Routing count columns
-----------------------
messages_auto_ask       routeSource != manual-override AND routeMode == ask
messages_auto_research  routeSource != manual-override AND routeMode == research
messages_manual_ask     routeSource == manual-override AND routeMode == ask
messages_manual_research routeSource == manual-override AND routeMode == research
total_overrides         messages_manual_ask + messages_manual_research
"""

import json
import csv
from pathlib import Path

DATA_DIR = Path(__file__).parent
OUTPUT_DIR = DATA_DIR / "output"

EXCLUDED_ACTORS = {"user1", "user2", "user3", "agent"}

COLUMNS = [
    "session_num",
    "file_key",
    "team_id",
    "team_name",
    "session_id",
    "condition",
    "run_order",
    "run_one_condition",
    "run_two_condition",
    "participant_count",
    "exported_at",
    "study_session_start",
    "study_session_end",
    "total_messages",
    "messages_auto_ask",
    "messages_auto_research",
    "messages_manual_ask",
    "messages_manual_research",
    "total_overrides",
    "total_insight_requests",
    "total_traceability_clicks",
    "total_context_panel_opens",
    "total_ai_toggles",
]


def find_timeline_files():
    for session_dir in sorted(DATA_DIR.glob("[123]")):
        for f in sorted(session_dir.rglob("*-timeline.json")):
            yield session_dir.name, f


def load_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def is_study_user(user_id):
    return (
        user_id
        and user_id not in EXCLUDED_ACTORS
        and user_id.startswith("study-user-")
    )


def extract_row(session_num, path, export):
    spec = export.get("sessionSpec", {})
    team_id = export.get("teamId", "")
    timeline = export.get("timeline", [])
    file_key = f"{session_num}/{path.parent.name}/{path.name}"

    # Study session ID and time bounds — from study-user events only
    study_session_id = ""
    study_timestamps = []
    for ev in timeline:
        if is_study_user(ev.get("actorUserId", "")):
            if not study_session_id:
                study_session_id = ev.get("sessionId", "")
            ts = ev.get("createdAt", "")
            if ts:
                study_timestamps.append(ts)

    study_start = min(study_timestamps) if study_timestamps else ""
    study_end   = max(study_timestamps) if study_timestamps else ""

    # Participant count — non-agent, non-seed users listed in the export
    participants = [
        p for p in export.get("participants", [])
        if not p.get("isAgent") and is_study_user(p.get("userId", ""))
    ]

    # Routing breakdowns
    msg_auto_ask = msg_auto_research = 0
    msg_manual_ask = msg_manual_research = 0
    for ev in timeline:
        if ev.get("eventName") != "message_sent":
            continue
        if not is_study_user(ev.get("actorUserId", "")):
            continue
        meta = ev.get("metadata", {})
        mode = meta.get("routeMode", "")
        src  = meta.get("routeSource", "")
        is_manual = (src == "manual-override")
        if   mode == "ask"      and not is_manual: msg_auto_ask      += 1
        elif mode == "ask"      and     is_manual: msg_manual_ask    += 1
        elif mode == "research" and not is_manual: msg_auto_research += 1
        elif mode == "research" and     is_manual: msg_manual_research += 1

    total_messages = msg_auto_ask + msg_auto_research + msg_manual_ask + msg_manual_research
    total_overrides = msg_manual_ask + msg_manual_research

    # Other aggregate counts
    def count_event(event_name, extra_check=None):
        total = 0
        for ev in timeline:
            if ev.get("eventName") != event_name:
                continue
            if not is_study_user(ev.get("actorUserId", "")):
                continue
            if extra_check and not extra_check(ev):
                continue
            total += 1
        return total

    insight_requests     = count_event("insight_generate_requested")
    traceability_clicks  = count_event("focus_insight_from_marker")
    context_panel_opens  = count_event(
        "task_context_panel_toggled",
        extra_check=lambda ev: ev.get("metadata", {}).get("visible") is True,
    )
    ai_toggles           = count_event("team_ai_toggle_changed")

    return {
        "session_num":              session_num,
        "file_key":                 file_key,
        "team_id":                  team_id,
        "team_name":                spec.get("teamName", ""),
        "session_id":               study_session_id,
        "condition":                spec.get("conditionFlag", ""),
        "run_order":                spec.get("runOrder", ""),
        "run_one_condition":        spec.get("runOneCondition", ""),
        "run_two_condition":        spec.get("runTwoCondition", ""),
        "participant_count":        len(participants),
        "exported_at":              export.get("exportedAt", ""),
        "study_session_start":      study_start,
        "study_session_end":        study_end,
        "total_messages":           total_messages,
        "messages_auto_ask":        msg_auto_ask,
        "messages_auto_research":   msg_auto_research,
        "messages_manual_ask":      msg_manual_ask,
        "messages_manual_research": msg_manual_research,
        "total_overrides":          total_overrides,
        "total_insight_requests":   insight_requests,
        "total_traceability_clicks": traceability_clicks,
        "total_context_panel_opens": context_panel_opens,
        "total_ai_toggles":         ai_toggles,
    }


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    rows = []

    for session_num, path in find_timeline_files():
        export = load_json(path)
        row = extract_row(session_num, path, export)
        rows.append(row)
        print(
            f"  {row['file_key']}: "
            f"condition={row['condition']}, "
            f"msgs={row['total_messages']}, "
            f"overrides={row['total_overrides']}, "
            f"insights={row['total_insight_requests']}"
        )

    out_path = OUTPUT_DIR / "condition_audit.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWritten {len(rows)} rows to {out_path.relative_to(DATA_DIR)}")


if __name__ == "__main__":
    main()
