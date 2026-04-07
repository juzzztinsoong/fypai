"""
Script 8 — Traceability with Insight Status at Click Time
==========================================================
Enhances the traceability click record with insight metadata and the
insight's status at the moment the click occurred.

Input:  All *-timeline.json and sibling *-[teamId].json under data/1/, /2/, /3/
Output: output/traceability_with_status.csv

Why this matters
----------------
Traceability clicks to insights that were already dismissed or archived are
qualitatively different from clicks to active insights. The Session 1 analysis
surfaced a suspected confound where some clicks reached dismissed content.
This script makes that pattern measurable across all sessions.

How insight status is determined at click time
----------------------------------------------
1. Each insight starts with status 'new' when first generated
   (insight_generate_completed event or presence in export .json)
2. insight_status_changed events record transitions with timestamps
3. For each traceability click at time T toward insight I, the status is
   the most recent status of I before or at T, defaulting to 'new' if
   no earlier status change exists.

Note on data completeness
-------------------------
insight_status_changed events in the study data are almost entirely from
user1 (seed/test user, excluded from study analysis). Study participants'
accept/dismiss actions were NOT captured in timeline events — this is a
known instrumentation gap. The final insight status is available from the
export .json insights array, but intermediate transitions are not.
As a result, status_at_click will reflect the pre-study/seed state for most
rows, and insight_final_status shows the post-session terminal state.
The column data_complete=False flags rows where this gap may affect
interpretation.

Columns
-------
session_num
file_key
team_id
session_id
participant_id
condition
run_order
click_timestamp      When the traceability interaction occurred
event_name           Which traceability event type
message_id           Associated chat message id (if available)
insight_id           Associated insight id
insight_type         type field from insight object (summary, document, action, etc.)
insight_title        First 80 chars of insight title
insight_generated_at ISO timestamp when the insight was generated (if known)
insight_age_seconds  Seconds between insight generation and click
status_at_click      Insight status at click_timestamp (see note above)
insight_final_status Status from export .json at end of session
data_complete        False if insight_status_changed events from study users are
                     absent, meaning status_at_click may be unreliable
"""

import json
import csv
from pathlib import Path

DATA_DIR   = Path(__file__).parent
OUTPUT_DIR = DATA_DIR / "output"

EXCLUDED_ACTORS = {"user1", "user2", "user3", "agent"}

# Seed filter (mirrors script3): insights timestamped before the session date
# are pre-session onboarding artifacts and should not appear as click targets.
# See DATA_ISSUES.md A1.
SESSION_DATES = {
    "1": "2026-03-19",
    "2": "2026-03-25",
    "3": "2026-03-26",
    "4": "2026-03-29",
}


def is_genuine_insight(session_num, timestamp_iso):
    cutoff = SESSION_DATES.get(str(session_num), "")
    return bool(cutoff) and timestamp_iso[:10] >= cutoff

TRACEABILITY_EVENTS = {
    "focus_insight_from_marker",
    "focus_chat_marker_from_insight",
    "jump_to_chat_marker",
    "jump_to_insight_marker",
    "focus_insight_from_reply_preview",
    "focus_insight_from_agent_message",
}

COLUMNS = [
    "session_num",
    "file_key",
    "team_id",
    "session_id",
    "participant_id",
    "condition",
    "run_order",
    "click_timestamp",
    "event_name",
    "message_id",
    "insight_id",
    "insight_type",
    "insight_title",
    "insight_generated_at",
    "insight_age_seconds",
    "status_at_click",
    "insight_final_status",
    "data_complete",
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


def ts_to_seconds(ts):
    """Convert ISO timestamp to float seconds since epoch (rough, for delta only)."""
    if not ts:
        return None
    from datetime import datetime, timezone
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return None


def extract_rows(session_num, path, export):
    spec     = export.get("sessionSpec", {})
    team_id  = export.get("teamId", "")
    condition  = spec.get("conditionFlag", "")
    run_order  = spec.get("runOrder", "")
    timeline   = export.get("timeline", [])
    file_key   = f"{session_num}/{path.parent.name}/{path.name}"

    study_session_id = ""
    for ev in timeline:
        if is_study_user(ev.get("actorUserId", "")):
            study_session_id = ev.get("sessionId", "")
            break

    # ── Build insight metadata index ───────────────────────────────────────
    # Start with insights from the full export .json sibling.
    # Seed insights (pre-session onboarding artifacts, A1) are excluded via
    # is_genuine_insight(). Seed insights have timestamps 12-24h before the
    # session and are recognisable by that date check.
    insight_meta = {}  # insight_id -> {type, title, generated_at, final_status}

    full_export_path = path.with_name(path.name.replace("-timeline.json", ".json"))
    if full_export_path.exists():
        full = load_json(full_export_path)
        for ins in full.get("insights", []):
            iid = ins.get("id", "")
            created_at = ins.get("createdAt", "")
            if iid and is_genuine_insight(session_num, created_at):
                insight_meta[iid] = {
                    "type":         ins.get("type", ""),
                    "title":        ins.get("title", "")[:80],
                    "generated_at": created_at,
                    "final_status": ins.get("status", "new"),
                }

    # Also capture generation timestamps from insight_generate_completed events
    for ev in timeline:
        if ev.get("eventName") == "insight_generate_completed":
            iid = ev.get("insightId", "") or ev.get("metadata", {}).get("insightId", "")
            if iid and iid not in insight_meta:
                insight_meta[iid] = {
                    "type":         ev.get("metadata", {}).get("insightType", ""),
                    "title":        "",
                    "generated_at": ev.get("createdAt", ""),
                    "final_status": "new",
                }
            elif iid and not insight_meta[iid].get("generated_at"):
                insight_meta[iid]["generated_at"] = ev.get("createdAt", "")

    # ── Build status-change timeline per insight ────────────────────────────
    # insight_id -> sorted list of (timestamp, new_status)
    # Only study-user transitions are included. Per DATA_ISSUES.md A4, ALL
    # insight_status_changed events in the study data were fired by user1
    # (the facilitator/seed account), so has_study_status_events will be
    # False for every file and status_at_click will always default to 'new'.
    # data_complete=False on every row is the correct signal of this gap.
    study_status_changes = {}  # insight_id -> [(ts, status)]
    has_study_status_events = False

    for ev in timeline:
        if ev.get("eventName") != "insight_status_changed":
            continue
        actor = ev.get("actorUserId", "")
        iid   = ev.get("insightId", "")
        ts    = ev.get("createdAt", "")
        to_status = ev.get("metadata", {}).get("toStatus", "")
        if not iid or not ts:
            continue
        if is_study_user(actor):
            has_study_status_events = True
            study_status_changes.setdefault(iid, []).append((ts, to_status))

    # Sort each list
    for iid in study_status_changes:
        study_status_changes[iid].sort(key=lambda x: x[0])

    def status_at(insight_id, click_ts):
        """Return insight status at click_ts. Defaults to 'new'."""
        changes = study_status_changes.get(insight_id, [])
        status = "new"
        for ts, new_status in changes:
            if ts <= click_ts:
                status = new_status
            else:
                break
        return status

    # ── Extract traceability click rows ────────────────────────────────────
    rows = []
    for ev in timeline:
        actor   = ev.get("actorUserId", "")
        ev_name = ev.get("eventName", "")
        if not is_study_user(actor):
            continue
        if ev_name not in TRACEABILITY_EVENTS:
            continue

        click_ts  = ev.get("createdAt", "")
        iid       = ev.get("insightId", "") or ev.get("metadata", {}).get("insightId", "")
        meta_info = insight_meta.get(iid, {}) if iid else {}

        gen_at   = meta_info.get("generated_at", "")
        gen_secs = ts_to_seconds(gen_at)
        clk_secs = ts_to_seconds(click_ts)
        age_secs = ""
        if gen_secs is not None and clk_secs is not None and gen_secs > 0:
            age_secs = round(clk_secs - gen_secs)

        rows.append({
            "session_num":        session_num,
            "file_key":           file_key,
            "team_id":            team_id,
            "session_id":         study_session_id,
            "participant_id":     actor,
            "condition":          condition,
            "run_order":          run_order,
            "click_timestamp":    click_ts,
            "event_name":         ev_name,
            "message_id":         ev.get("messageId", ""),
            "insight_id":         iid,
            "insight_type":       meta_info.get("type", ""),
            "insight_title":      meta_info.get("title", ""),
            "insight_generated_at": gen_at,
            "insight_age_seconds":  age_secs,
            "status_at_click":    status_at(iid, click_ts) if iid else "",
            "insight_final_status": meta_info.get("final_status", ""),
            "data_complete":      has_study_status_events,
        })

    return rows


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    all_rows = []

    for session_num, path in find_timeline_files():
        export = load_json(path)
        rows   = extract_rows(session_num, path, export)
        all_rows.extend(rows)
        print(f"  {session_num}/{path.parent.name}: {len(rows)} traceability clicks")

    out_path = OUTPUT_DIR / "traceability_with_status.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nWritten {len(all_rows)} rows to {out_path.relative_to(DATA_DIR)}")

    # Quick status summary
    from collections import Counter
    status_counts = Counter()
    for r in all_rows:
        status_counts[(r["status_at_click"], r["insight_final_status"])] += 1
    print("\nStatus at click -> final status distribution:")
    for (at_click, final), count in sorted(status_counts.items()):
        print(f"  at_click={at_click or '(empty)':12}  final={final or '(empty)':10}  n={count}")


if __name__ == "__main__":
    main()
