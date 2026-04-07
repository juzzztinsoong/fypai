"""
Script 2 — Traceability Events
===============================
Captures all navigation events where users followed insight-to-message links
or message-to-insight links (traceability interactions), and all right-panel
tab change events.

Input:  All *-timeline.json files under data/1/, data/2/, data/3/, data/4/
Output:
  output/traceability_clicks.csv  — marker/insight link navigation events
  output/panel_navigation.csv     — right-panel tab change events

Traceability event names captured
----------------------------------
focus_insight_from_marker        User clicked a chat marker to open the linked insight
focus_chat_marker_from_insight   User clicked an insight back-link to jump to the message
jump_to_chat_marker              User jumped to the source message from an insight
jump_to_insight_marker           User jumped to the linked insight from a message
focus_insight_from_reply_preview User followed a link via the reply preview panel
focus_insight_from_agent_message User followed a link from an agent message
"""

import json
import csv
from pathlib import Path

DATA_DIR = Path(__file__).parent
OUTPUT_DIR = DATA_DIR / "output"

EXCLUDED_ACTORS = {"user1", "user2", "user3", "agent"}

TRACEABILITY_EVENTS = {
    "focus_insight_from_marker",
    "focus_chat_marker_from_insight",
    "jump_to_chat_marker",
    "jump_to_insight_marker",
    "focus_insight_from_reply_preview",
    "focus_insight_from_agent_message",
}

CLICK_COLUMNS = [
    "session_num",
    "file_key",
    "team_id",
    "session_id",
    "participant_id",
    "condition",
    "run_order",
    "timestamp",
    "event_name",
    "message_id",
    "insight_id",
]

PANEL_COLUMNS = [
    "session_num",
    "file_key",
    "team_id",
    "session_id",
    "participant_id",
    "condition",
    "run_order",
    "timestamp",
    "from_tab",
    "to_tab",
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

    click_rows = []
    panel_rows = []

    for ev in timeline:
        actor = ev.get("actorUserId", "")
        if not is_study_user(actor):
            continue

        shared = {
            "session_num":    session_num,
            "file_key":       file_key,
            "team_id":        team_id,
            "session_id":     study_session_id,
            "participant_id": actor,
            "condition":      condition,
            "run_order":      run_order,
            "timestamp":      ev.get("createdAt", ""),
        }

        ev_name = ev.get("eventName", "")

        if ev_name in TRACEABILITY_EVENTS:
            click_rows.append({
                **shared,
                "event_name": ev_name,
                "message_id": ev.get("messageId", ""),
                "insight_id": ev.get("insightId", ""),
            })

        elif ev_name == "right_panel_tab_changed":
            meta = ev.get("metadata", {})
            panel_rows.append({
                **shared,
                "from_tab": meta.get("from", ""),
                "to_tab":   meta.get("to", ""),
            })

    return click_rows, panel_rows


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    all_clicks = []
    all_panels = []

    for session_num, path in find_timeline_files():
        export = load_json(path)
        clicks, panels = extract_rows(session_num, path, export)
        all_clicks.extend(clicks)
        all_panels.extend(panels)
        print(
            f"  {session_num}/{path.parent.name}: "
            f"{len(clicks)} traceability clicks, {len(panels)} tab changes"
        )

    for out_path, rows, cols in [
        (OUTPUT_DIR / "traceability_clicks.csv", all_clicks, CLICK_COLUMNS),
        (OUTPUT_DIR / "panel_navigation.csv",    all_panels, PANEL_COLUMNS),
    ]:
        with open(out_path, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=cols)
            writer.writeheader()
            writer.writerows(rows)
        print(f"Written {len(rows)} rows to {out_path.relative_to(DATA_DIR)}")


if __name__ == "__main__":
    main()
