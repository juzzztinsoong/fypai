"""
Script 9 — Context Save/Edit Timeline
=======================================
Annotates every context interaction event with elapsed time from session
start and the number of participant messages sent before that event.
This enables AQ3 analysis: do participants engage with context before or
after constraints are introduced, and how quickly?

Input:  All *-timeline.json files under data/1/, data/2/, data/3/
Output: output/context_timeline.csv

Events captured (same as script4, with additional time columns)
--------------------------------------------------------------
team_ai_toggle_changed
task_context_panel_toggled
task_context_saved
draft_context_promoted

Session start definition
------------------------
The timestamp of the first study-user event in the timeline.
This is the earliest moment a study participant was active.

Columns
-------
session_num
file_key
team_id
session_id
participant_id
condition
run_order
timestamp            ISO timestamp of the event
event_name
seconds_from_start   Seconds elapsed since session_start_ts
minutes_from_start   Rounded to 1 dp
messages_before      Number of participant messages sent BEFORE this event
                     (across all study participants in this file, not just actor)
actor_messages_before Number of messages sent by THIS participant before this event
sequence_index       1-based rank of this event within all context events for
                     this file, sorted by timestamp
participant_seq_index 1-based rank within this participant's context events only
-- event-specific columns --
ai_enabled
panel_visible
panel_source
panel_edit_mode
context_content      First 300 chars of saved context
draft_source_type
draft_source_id
draft_source_label
"""

import json
import csv
from pathlib import Path

DATA_DIR   = Path(__file__).parent
OUTPUT_DIR = DATA_DIR / "output"

EXCLUDED_ACTORS  = {"user1", "user2", "user3", "agent"}
CONTEXT_EVENTS   = {
    "team_ai_toggle_changed",
    "task_context_panel_toggled",
    "task_context_saved",
    "draft_context_promoted",
}

COLUMNS = [
    "session_num",
    "file_key",
    "team_id",
    "session_id",
    "participant_id",
    "condition",
    "run_order",
    "timestamp",
    "event_name",
    "seconds_from_start",
    "minutes_from_start",
    "messages_before",
    "actor_messages_before",
    "sequence_index",
    "participant_seq_index",
    "ai_enabled",
    "panel_visible",
    "panel_source",
    "panel_edit_mode",
    "context_content",
    "draft_source_type",
    "draft_source_id",
    "draft_source_label",
]


def find_timeline_files():
    for session_dir in sorted(DATA_DIR.glob("[1234]")):
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


def ts_seconds(ts):
    if not ts:
        return None
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return None


def extract_rows(session_num, path, export):
    spec       = export.get("sessionSpec", {})
    team_id    = export.get("teamId", "")
    condition  = spec.get("conditionFlag", "")
    run_order  = spec.get("runOrder", "")
    timeline   = export.get("timeline", [])
    file_key   = f"{session_num}/{path.parent.name}/{path.name}"

    study_session_id = ""
    for ev in timeline:
        if is_study_user(ev.get("actorUserId", "")):
            study_session_id = ev.get("sessionId", "")
            break

    # Session start: first study-user event timestamp
    session_start_ts = None
    for ev in timeline:
        if is_study_user(ev.get("actorUserId", "")):
            session_start_ts = ts_seconds(ev.get("createdAt", ""))
            break

    # Build cumulative message counts at each point in timeline
    # (sorted by timestamp — same caveat as script1: batch flushing means
    #  ties; we process in file order for ties)
    message_timestamps = []       # (ts_str, actor) for all study-user message_sent events
    for ev in timeline:
        if (ev.get("eventName") == "message_sent"
                and is_study_user(ev.get("actorUserId", ""))):
            message_timestamps.append((ev.get("createdAt", ""), ev.get("actorUserId", "")))

    def messages_before_ts(ts_str, actor_filter=None):
        """Count study-user messages with timestamp strictly before ts_str."""
        count = 0
        for m_ts, m_actor in message_timestamps:
            if m_ts < ts_str:
                if actor_filter is None or m_actor == actor_filter:
                    count += 1
        return count

    # Extract context event rows (all study users in file)
    raw_rows = []
    for ev in timeline:
        actor   = ev.get("actorUserId", "")
        ev_name = ev.get("eventName", "")
        if not is_study_user(actor):
            continue
        if ev_name not in CONTEXT_EVENTS:
            continue
        raw_rows.append((ev, actor))

    # Sort by timestamp for sequence numbering
    raw_rows.sort(key=lambda x: x[0].get("createdAt", ""))

    # Per-participant sequence counter
    participant_seq = {}
    rows = []
    for seq_idx, (ev, actor) in enumerate(raw_rows, start=1):
        meta       = ev.get("metadata", {})
        ts_str     = ev.get("createdAt", "")
        ev_name    = ev.get("eventName", "")
        ts_secs    = ts_seconds(ts_str)
        content_raw = ev.get("content", "") or ""

        elapsed = ""
        mins    = ""
        if session_start_ts is not None and ts_secs is not None:
            elapsed = round(ts_secs - session_start_ts)
            mins    = round(elapsed / 60, 1)

        participant_seq[actor] = participant_seq.get(actor, 0) + 1

        rows.append({
            "session_num":       session_num,
            "file_key":          file_key,
            "team_id":           team_id,
            "session_id":        study_session_id,
            "participant_id":    actor,
            "condition":         condition,
            "run_order":         run_order,
            "timestamp":         ts_str,
            "event_name":        ev_name,
            "seconds_from_start": elapsed,
            "minutes_from_start": mins,
            "messages_before":   messages_before_ts(ts_str),
            "actor_messages_before": messages_before_ts(ts_str, actor_filter=actor),
            "sequence_index":       seq_idx,
            "participant_seq_index": participant_seq[actor],
            # event-specific
            "ai_enabled":    meta.get("enabled", "") if ev_name == "team_ai_toggle_changed" else "",
            "panel_visible": meta.get("visible", "") if ev_name == "task_context_panel_toggled" else "",
            "panel_source":  meta.get("source", "")  if ev_name == "task_context_panel_toggled" else "",
            "panel_edit_mode": meta.get("editMode", "") if ev_name == "task_context_panel_toggled" else "",
            "context_content":   content_raw[:300] if ev_name == "task_context_saved" else "",
            "draft_source_type":  meta.get("sourceType", "")  if ev_name == "draft_context_promoted" else "",
            "draft_source_id":    meta.get("sourceId", "")    if ev_name == "draft_context_promoted" else "",
            "draft_source_label": meta.get("sourceLabel", "") if ev_name == "draft_context_promoted" else "",
        })

    return rows


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    all_rows = []

    for session_num, path in find_timeline_files():
        export = load_json(path)
        rows   = extract_rows(session_num, path, export)
        all_rows.extend(rows)
        print(f"  {session_num}/{path.parent.name}: {len(rows)} context events")

    out_path = OUTPUT_DIR / "context_timeline.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nWritten {len(all_rows)} rows to {out_path.relative_to(DATA_DIR)}")

    # Quick summary
    from collections import Counter
    event_counts = Counter(r["event_name"] for r in all_rows)
    print("\nEvent type breakdown:")
    for ev, cnt in sorted(event_counts.items()):
        print(f"  {cnt:3d}  {ev}")


if __name__ == "__main__":
    main()
