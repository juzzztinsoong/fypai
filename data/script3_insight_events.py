"""
Script 3 — Insight Generation Events
======================================
Captures AI insight generation requests and completions, and any insight
status changes (accept / dismiss / archive).

Input:  All *-timeline.json files under data/1/, data/2/, data/3/
Output:
  output/insight_generations.csv    — one row per insight_generate_requested or
                                      insight_generate_completed event (Session 1),
                                      or one row per insight object from the full
                                      export (Sessions 2+ fallback — see note below)
  output/insight_status_changes.csv — one row per insight_status_changed event
                                      (will be empty if none found in data)

Notes on insight_generations.csv
---------------------------------
Session 1: insight_generate_requested and insight_generate_completed events are
present in the timeline. Both are included in the same CSV, discriminated by the
event_name column. They do not share a messageId, so pairing them must be done by
filtering (same participant + condition + adjacent timestamps). The metadata fields
insight_type, source, has_prompt_override, and prompt_archetype are populated from
_requested events; _completed events may have different metadata.

Sessions 2+: the insight_generate_requested/completed instrumentation was removed
from the app between sessions. Insight objects were still generated and are present
in the full .json export's "insights" array. When no timeline events are found for
a file, this script falls back to reading the sibling .json export and emits one row
per insight object with event_name="insight_from_export" and
data_source="export_fallback". The fields source, has_prompt_override, and
prompt_archetype are unavailable in this path and will be empty. For group-condition
files (multiple study-users), participant_id is set to "" because the triggering
actor cannot be determined from the export alone.

The data_source column ("timeline_event" vs "export_fallback") must be used when
filtering for cross-session comparisons to ensure methodological consistency.
"""

import json
import csv
from pathlib import Path

DATA_DIR = Path(__file__).parent
OUTPUT_DIR = DATA_DIR / "output"

EXCLUDED_ACTORS = {"user1", "user2", "user3", "agent"}

# Minimum ISO date (YYYY-MM-DD) for a genuine insight in each session.
# Insights timestamped before this date are seed/onboarding artifacts injected at
# account-creation time (typically the evening before the session, in tight ms
# bursts). They are excluded from all output rows.
SESSION_DATES = {
    "1": "2026-03-19",
    "2": "2026-03-25",
    "3": "2026-03-26",
    "4": "2026-03-29",
}


def is_genuine_timestamp(session_num, timestamp_iso):
    """Return True if the timestamp falls on or after the session date."""
    cutoff = SESSION_DATES.get(session_num, "")
    return bool(cutoff) and timestamp_iso[:10] >= cutoff

GEN_COLUMNS = [
    "session_num",
    "file_key",
    "team_id",
    "session_id",
    "participant_id",
    "condition",
    "run_order",
    "timestamp",
    "event_name",
    "data_source",
    "insight_type",
    "source",
    "has_prompt_override",
    "prompt_archetype",
    "insight_id",
]

STATUS_COLUMNS = [
    "session_num",
    "file_key",
    "team_id",
    "session_id",
    "participant_id",
    "condition",
    "run_order",
    "timestamp",
    "insight_id",
    "from_status",
    "to_status",
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

    gen_rows = []
    status_rows = []

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
        }

        ev_name = ev.get("eventName", "")
        meta = ev.get("metadata", {})

        if ev_name in ("insight_generate_requested", "insight_generate_completed"):
            ts = ev.get("createdAt", "")
            if not is_genuine_timestamp(session_num, ts):
                continue
            gen_rows.append({
                **shared,
                "timestamp":          ts,
                "event_name":         ev_name,
                "data_source":        "timeline_event",
                "insight_type":       meta.get("insightType", ""),
                "source":             meta.get("source", ""),
                "has_prompt_override": meta.get("hasPromptOverride", ""),
                "prompt_archetype":   meta.get("promptArchetype", ""),
                "insight_id":         ev.get("insightId", "") or meta.get("insightId", ""),
            })

        elif ev_name == "insight_status_changed":
            status_rows.append({
                **shared,
                "timestamp":   ev.get("createdAt", ""),
                "insight_id":  ev.get("insightId", "") or meta.get("insightId", ""),
                "from_status": meta.get("fromStatus", ""),
                "to_status":   meta.get("toStatus", ""),
            })

    # Fallback: if no timeline insight events found, read from the sibling full export
    if len(gen_rows) == 0:
        full_export_path = path.with_name(path.name.replace("-timeline.json", ".json"))
        if full_export_path.exists():
            full_export = load_json(full_export_path)
            insights = full_export.get("insights", [])
            if insights:
                # Determine participant_id: use sole study-user for solo, "" for group
                study_users = [
                    p.get("userId", p.get("id", ""))
                    for p in full_export.get("participants", [])
                    if is_study_user(p.get("userId", p.get("id", "")))
                ]
                participant_id = study_users[0] if len(study_users) == 1 else ""

                for ins in insights:
                    ts = ins.get("createdAt", "")
                    if not is_genuine_timestamp(session_num, ts):
                        continue
                    gen_rows.append({
                        "session_num":        session_num,
                        "file_key":           file_key,
                        "team_id":            team_id,
                        "session_id":         study_session_id,
                        "participant_id":     participant_id,
                        "condition":          condition,
                        "run_order":          run_order,
                        "timestamp":          ins.get("createdAt", ""),
                        "event_name":         "insight_from_export",
                        "data_source":        "export_fallback",
                        "insight_type":       ins.get("type", ""),
                        "source":             "",
                        "has_prompt_override": "",
                        "prompt_archetype":   "",
                        "insight_id":         ins.get("id", ""),
                    })

    return gen_rows, status_rows


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    all_gen = []
    all_status = []

    for session_num, path in find_timeline_files():
        export = load_json(path)
        gen_rows, status_rows = extract_rows(session_num, path, export)
        all_gen.extend(gen_rows)
        all_status.extend(status_rows)
        timeline_rows = [r for r in gen_rows if r.get("data_source") == "timeline_event"]
        fallback_rows = [r for r in gen_rows if r.get("data_source") == "export_fallback"]
        parts = []
        if timeline_rows:
            parts.append(f"{len(timeline_rows)} timeline events")
        if fallback_rows:
            parts.append(f"{len(fallback_rows)} export fallback")
        if not parts:
            parts.append("0 generation events")
        print(
            f"  {session_num}/{path.parent.name}: "
            f"{', '.join(parts)}, {len(status_rows)} status changes"
        )

    for out_path, rows, cols in [
        (OUTPUT_DIR / "insight_generations.csv",    all_gen,    GEN_COLUMNS),
        (OUTPUT_DIR / "insight_status_changes.csv", all_status, STATUS_COLUMNS),
    ]:
        with open(out_path, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=cols)
            writer.writeheader()
            writer.writerows(rows)
        note = " (none found in data)" if not rows else ""
        print(f"Written {len(rows)} rows to {out_path.relative_to(DATA_DIR)}{note}")


if __name__ == "__main__":
    main()
