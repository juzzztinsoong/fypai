"""
Script 1 — Routing Table
========================
Extracts every message sent by study participants, with full routing metadata.
One row per message_sent event.

Input:  All *-timeline.json files under data/1/, data/2/, data/3/
Output: output/routing_table.csv

Columns
-------
session_num          Study session number (1, 2, or 3 — from directory name)
file_key             Relative path, e.g. "1/1 jc/session-study-team-01-timeline.json"
team_id              teamId from the export root
session_id           Study session ID (derived from first study-user event; see DATA_QUALITY.md)
participant_id       actorUserId (e.g. study-user-01-01)
condition            AI_ON or AI_LIGHT (sessionSpec.conditionFlag)
run_order            AB or BA (sessionSpec.runOrder)
timestamp            ISO createdAt of the message_sent event
message_content      Full message text
route_mode           ask | research
route_confidence     Float 0–1
route_source         server-classifier | manual-override | frontend-fallback
route_override_used  true/false — from matched message_route_decision event
override_mode        auto | ask | research — what the selector showed
route_archetype      pragmatic-advisor | research-analyst
route_rationale      Classifier reasoning string — from message_route_decision event
is_slash_command     true if message starts with "/"
has_research_job     true if this messageId appears in a research_job_requested event

Notes
-----
- Seed users (user1, user2, user3) and agent are excluded.
- route_override_used and route_rationale are drawn from the paired
  message_route_decision event (same messageId, fires just before message_sent).
- 4-second batch flushing means many events share identical timestamps;
  do not infer ordering within the same timestamp value.
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
    "session_id",
    "participant_id",
    "condition",
    "run_order",
    "timestamp",
    "message_content",
    "route_mode",
    "route_confidence",
    "route_source",
    "route_override_used",
    "override_mode",
    "route_archetype",
    "route_rationale",
    "is_slash_command",
    "has_research_job",
]


def find_timeline_files():
    """Yield (session_num, Path) for every *-timeline.json under data/1/, /2/, /3/."""
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

    # Derive the study session ID from the first study-user event
    # (sessionSpec.sessionId is null; see DATA_QUALITY.md Issue 2)
    study_session_id = ""
    for ev in timeline:
        if is_study_user(ev.get("actorUserId", "")):
            study_session_id = ev.get("sessionId", "")
            break

    # Index: messageId -> {routeRationale, routeOverrideUsed}
    # from message_route_decision events (fires before message_sent, same messageId)
    route_decisions = {}
    for ev in timeline:
        if ev.get("eventName") == "message_route_decision":
            mid = ev.get("messageId")
            if mid:
                meta = ev.get("metadata", {})
                route_decisions[mid] = {
                    "routeRationale": meta.get("routeRationale", ""),
                    "routeOverrideUsed": meta.get("routeOverrideUsed", ""),
                }

    # Index: messageIds that triggered a background research job
    research_job_messages = set()
    for ev in timeline:
        if ev.get("eventName") == "research_job_requested":
            mid = ev.get("messageId")
            if mid:
                research_job_messages.add(mid)

    rows = []
    for ev in timeline:
        if ev.get("eventType") != "chat":
            continue
        if ev.get("eventName") != "message_sent":
            continue
        actor = ev.get("actorUserId", "")
        if not is_study_user(actor):
            continue

        meta = ev.get("metadata", {})
        mid = ev.get("messageId", "")
        content = ev.get("content", "")
        decision = route_decisions.get(mid, {})

        rows.append({
            "session_num":        session_num,
            "file_key":           file_key,
            "team_id":            team_id,
            "session_id":         study_session_id,
            "participant_id":     actor,
            "condition":          condition,
            "run_order":          run_order,
            "timestamp":          ev.get("createdAt", ""),
            "message_content":    content,
            "route_mode":         meta.get("routeMode", ""),
            "route_confidence":   meta.get("routeConfidence", ""),
            "route_source":       meta.get("routeSource", ""),
            "route_override_used": decision.get("routeOverrideUsed", ""),
            "override_mode":      meta.get("overrideMode", ""),
            "route_archetype":    meta.get("routeArchetype", ""),
            "route_rationale":    decision.get("routeRationale", ""),
            "is_slash_command":   content.strip().startswith("/") if content else False,
            "has_research_job":   mid in research_job_messages,
        })

    return rows


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    all_rows = []

    for session_num, path in find_timeline_files():
        export = load_json(path)
        rows = extract_rows(session_num, path, export)
        all_rows.extend(rows)
        print(f"  {session_num}/{path.parent.name}: {len(rows)} messages")

    out_path = OUTPUT_DIR / "routing_table.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nWritten {len(all_rows)} rows to {out_path.relative_to(DATA_DIR)}")


if __name__ == "__main__":
    main()
