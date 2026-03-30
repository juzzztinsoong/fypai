"""
Script 7 — Routing Summary
===========================
Aggregates routing_table.csv (produced by script1) into per-participant
mode counts, override rates, and early/late phase breakdown.

Input:  output/routing_table.csv
Output: output/routing_summary.csv

Columns
-------
session_num          Study session number
file_key             Source timeline file
team_id
participant_id
condition            AI_ON or AI_LIGHT
run_order            AB or BA
total_messages       Total messages sent by this participant
ask_count            Messages routed to ask mode
research_count       Messages routed to research mode
other_count          Messages with unrecognised or empty route_mode
ask_pct              ask_count / total_messages (0–1)
research_pct         research_count / total_messages
override_count       Messages where route_override_used == True
override_rate        override_count / total_messages
source_classifier    Count where route_source == server-classifier
source_override      Count where route_source == manual-override
source_fallback      Count where route_source == frontend-fallback
slash_command_count  Messages starting with "/"
research_job_count   Messages that triggered a background research job
early_ask            ask_count in first 50% of messages (by timestamp order)
early_research       research_count in first 50%
late_ask             ask_count in second 50%
late_research        research_count in second 50%
early_override       override_count in first 50%
late_override        override_count in second 50%

Phase definition
----------------
Messages are sorted by timestamp, then split at the midpoint (floor).
If a participant sent only 1 message, it counts as early only.
"""

import csv
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(__file__).parent
OUTPUT_DIR = DATA_DIR / "output"

INPUT_CSV = OUTPUT_DIR / "routing_table.csv"

COLUMNS = [
    "session_num",
    "file_key",
    "team_id",
    "participant_id",
    "condition",
    "run_order",
    "total_messages",
    "ask_count",
    "research_count",
    "other_count",
    "ask_pct",
    "research_pct",
    "override_count",
    "override_rate",
    "source_classifier",
    "source_override",
    "source_fallback",
    "slash_command_count",
    "research_job_count",
    "early_ask",
    "early_research",
    "late_ask",
    "late_research",
    "early_override",
    "late_override",
]


def bool_val(s):
    return s.strip().lower() in ("true", "1", "yes")


def pct(num, denom):
    return round(num / denom, 4) if denom > 0 else 0.0


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Read routing table; group by (session_num, file_key, team_id, participant_id)
    groups = defaultdict(list)
    with open(INPUT_CSV, encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            key = (
                row["session_num"],
                row["file_key"],
                row["team_id"],
                row["participant_id"],
                row["condition"],
                row["run_order"],
            )
            groups[key].append(row)

    out_rows = []
    for key, rows in sorted(groups.items()):
        session_num, file_key, team_id, participant_id, condition, run_order = key

        # Sort by timestamp for phase split
        rows.sort(key=lambda r: r["timestamp"])
        n = len(rows)
        midpoint = n // 2  # early = rows[:midpoint], late = rows[midpoint:]
        # Edge case: 1 message → all early
        if n == 1:
            midpoint = 1

        def counts(subset):
            return {
                "ask":      sum(1 for r in subset if r["route_mode"] == "ask"),
                "research": sum(1 for r in subset if r["route_mode"] == "research"),
                "override": sum(1 for r in subset if bool_val(r.get("route_override_used", ""))),
            }

        early = counts(rows[:midpoint])
        late  = counts(rows[midpoint:])
        total = counts(rows)

        ask      = total["ask"]
        research = total["research"]
        other    = n - ask - research
        override = total["override"]

        out_rows.append({
            "session_num":        session_num,
            "file_key":           file_key,
            "team_id":            team_id,
            "participant_id":     participant_id,
            "condition":          condition,
            "run_order":          run_order,
            "total_messages":     n,
            "ask_count":          ask,
            "research_count":     research,
            "other_count":        other,
            "ask_pct":            pct(ask, n),
            "research_pct":       pct(research, n),
            "override_count":     override,
            "override_rate":      pct(override, n),
            "source_classifier":  sum(1 for r in rows if r.get("route_source") == "server-classifier"),
            "source_override":    sum(1 for r in rows if r.get("route_source") == "manual-override"),
            "source_fallback":    sum(1 for r in rows if r.get("route_source") == "frontend-fallback"),
            "slash_command_count": sum(1 for r in rows if bool_val(r.get("is_slash_command", ""))),
            "research_job_count": sum(1 for r in rows if bool_val(r.get("has_research_job", ""))),
            "early_ask":      early["ask"],
            "early_research": early["research"],
            "late_ask":       late["ask"],
            "late_research":  late["research"],
            "early_override": early["override"],
            "late_override":  late["override"],
        })

    out_path = OUTPUT_DIR / "routing_summary.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"Written {len(out_rows)} rows to {out_path.relative_to(DATA_DIR)}")

    # Print a quick readable summary
    print()
    print(f"{'Participant':<22} {'Sess':>4} {'Cond':>8} {'N':>4} {'Ask%':>6} {'Res%':>6} {'OvRt':>6}  EarlyAsk/Res  LateAsk/Res")
    for r in out_rows:
        pid  = r["participant_id"]
        n    = r["total_messages"]
        apct = f"{r['ask_pct']:.0%}"
        rpct = f"{r['research_pct']:.0%}"
        ovrt = f"{r['override_rate']:.0%}"
        print(
            f"  {pid:<20} {r['session_num']:>4} {r['condition']:>8} {n:>4} "
            f"{apct:>6} {rpct:>6} {ovrt:>6}  "
            f"{r['early_ask']}/{r['early_research']}  {r['late_ask']}/{r['late_research']}"
        )


if __name__ == "__main__":
    main()
