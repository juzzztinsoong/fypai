"""
Script 4 — Context Change Events
==================================
Captures all events that signal a change in workspace context or AI configuration:
AI toggle changes, context panel open/close interactions, and context saves.

Input:  All *-timeline.json files under data/1/, data/2/, data/3/
Output: output/context_events.csv

Event types captured
---------------------
team_ai_toggle_changed     User toggled the AI on or off
task_context_panel_toggled User opened or closed the Edit Context panel
task_context_saved         User saved a context update (included if present in data;
                           not yet confirmed in Session 1 — see DATA_QUALITY.md Issue 6)
draft_context_promoted     User promoted an AI reply or insight as a context draft
                           without opening the context panel (added Sessions 1+;
                           heavy use by Aung in Session 3). sourceType is 'message'
                           or 'insight'; sourceLabel is the content label.

Columns specific to each event type
--------------------------------------
team_ai_toggle_changed:      ai_enabled (true/false)
task_context_panel_toggled:  panel_visible, panel_source, panel_edit_mode
task_context_saved:          context_content (first 300 chars)
draft_context_promoted:      draft_source_type, draft_source_id, draft_source_label
"""

import json
import csv
from pathlib import Path

DATA_DIR = Path(__file__).parent
OUTPUT_DIR = DATA_DIR / "output"

EXCLUDED_ACTORS = {"user1", "user2", "user3", "agent"}

CONTEXT_EVENT_NAMES = {
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


def extract_rows(session_num, path, export):
    spec = export.get("sessionSpec", {})
    team_id = export.get("teamId", "")
    condition = spec.get("conditionFlag", "")
    run_order = spec.get("runOrder", "")
    timeline = export.get("timeline", [])
    file_key = f"{session_num}/{path.parent.name}/{path.name}"

    study_session_id = ""
    for ev in timeline:
        if is_study_user(ev.get("actorUserId", "")):
            study_session_id = ev.get("sessionId", "")
            break

    rows = []
    for ev in timeline:
        actor = ev.get("actorUserId", "")
        if not is_study_user(actor):
            continue

        ev_name = ev.get("eventName", "")
        if ev_name not in CONTEXT_EVENT_NAMES:
            continue

        meta = ev.get("metadata", {})
        content_raw = ev.get("content", "") or ""

        rows.append({
            "session_num":     session_num,
            "file_key":        file_key,
            "team_id":         team_id,
            "session_id":      study_session_id,
            "participant_id":  actor,
            "condition":       condition,
            "run_order":       run_order,
            "timestamp":       ev.get("createdAt", ""),
            "event_name":      ev_name,
            # team_ai_toggle_changed
            "ai_enabled":      meta.get("enabled", "") if ev_name == "team_ai_toggle_changed" else "",
            # task_context_panel_toggled
            "panel_visible":   meta.get("visible", "") if ev_name == "task_context_panel_toggled" else "",
            "panel_source":    meta.get("source", "") if ev_name == "task_context_panel_toggled" else "",
            "panel_edit_mode": meta.get("editMode", "") if ev_name == "task_context_panel_toggled" else "",
            # task_context_saved
            "context_content": content_raw[:300] if ev_name == "task_context_saved" else "",
            # draft_context_promoted
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
        rows = extract_rows(session_num, path, export)
        all_rows.extend(rows)
        print(f"  {session_num}/{path.parent.name}: {len(rows)} context events")

    out_path = OUTPUT_DIR / "context_events.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nWritten {len(all_rows)} rows to {out_path.relative_to(DATA_DIR)}")


if __name__ == "__main__":
    main()
