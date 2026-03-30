"""
script6_session_metrics.py
--------------------------
Aggregates all output CSVs into per-participant, per-condition metrics.
Prints a human-readable summary for each session.

Usage:  python script6_session_metrics.py [session_num]
        python script6_session_metrics.py 1      ← Session 1 only
        python script6_session_metrics.py        ← All sessions
"""

import csv
import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent / "output"

# ── helpers ──────────────────────────────────────────────────────────────────

def read_csv(name):
    path = OUTPUT_DIR / name
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def ts(s):
    """Parse ISO timestamp, return datetime or None."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def fmt_dur(seconds):
    m, s = divmod(int(seconds), 60)
    return f"{m}m{s:02d}s"


# ── load tables ──────────────────────────────────────────────────────────────

routing    = read_csv("routing_table.csv")
trace      = read_csv("traceability_clicks.csv")
insights   = read_csv("insight_generations.csv")
context_ev = read_csv("context_events.csv")
condition  = read_csv("condition_audit.csv")

# ── filter helper ─────────────────────────────────────────────────────────────

def rows(table, session=None):
    if session is None:
        return table
    return [r for r in table if r.get("session_num") == str(session)]


# ── per-participant routing aggregation ──────────────────────────────────────

def routing_stats(session=None):
    """
    Returns dict keyed by (session_num, file_key, participant_id) →
    { messages, route_ask, route_research, overrides, tier2_msgs,
      avg_confidence, first_ts, last_ts, duration_s }
    """
    stats = defaultdict(lambda: {
        "messages": 0,
        "route_ask": 0, "route_research": 0,
        "overrides": 0, "has_research_job": 0,
        "confidences": [],
        "timestamps": [],
        "condition": "", "run_order": "", "file_key": "",
    })
    for r in rows(routing, session):
        key = (r["session_num"], r["file_key"], r["participant_id"])
        s = stats[key]
        s["messages"] += 1
        s["condition"] = r.get("condition", "")
        s["run_order"] = r.get("run_order", "")
        s["file_key"]  = r.get("file_key", "")
        if r.get("route_mode") == "ask":      s["route_ask"] += 1
        if r.get("route_mode") == "research": s["route_research"] += 1
        if r.get("route_override_used", "").lower() == "true":
            s["overrides"] += 1
        if r.get("has_research_job", "").lower() == "true":
            s["has_research_job"] += 1
        c = r.get("route_confidence", "")
        if c:
            try:
                s["confidences"].append(float(c))
            except ValueError:
                pass
        t = ts(r.get("timestamp", ""))
        if t:
            s["timestamps"].append(t)
    # post-process
    result = {}
    for key, s in stats.items():
        avg_conf = sum(s["confidences"]) / len(s["confidences"]) if s["confidences"] else 0
        tss = sorted(s["timestamps"])
        dur = (tss[-1] - tss[0]).total_seconds() if len(tss) >= 2 else 0
        result[key] = {
            **s,
            "avg_confidence": round(avg_conf, 3),
            "duration_s": dur,
            "session_num": key[0],
        }
    return result


def trace_stats(session=None):
    """Returns dict: (session_num, file_key, participant_id) → {clicks}"""
    stats = defaultdict(lambda: {"clicks": 0})
    for r in rows(trace, session):
        key = (r["session_num"], r["file_key"], r["participant_id"])
        # every row in traceability_clicks.csv is one traceability interaction
        stats[key]["clicks"] += 1
    return stats


panel_nav = read_csv("panel_navigation.csv")


def panel_nav_stats(session=None):
    """Returns dict: (session_num, file_key, participant_id) → {tab_changes}"""
    stats = defaultdict(lambda: {"tab_changes": 0})
    for r in rows(panel_nav, session):
        key = (r["session_num"], r["file_key"], r["participant_id"])
        stats[key]["tab_changes"] += 1
    return stats


def context_stats(session=None):
    """Returns dict: (session_num, file_key, participant_id) → {panel_opens, context_saves, ai_toggles}"""
    stats = defaultdict(lambda: {"panel_opens": 0, "context_saves": 0, "ai_toggles": 0})
    for r in rows(context_ev, session):
        key = (r["session_num"], r["file_key"], r["participant_id"])
        en = r.get("event_name", "")
        if en == "task_context_panel_toggled" and r.get("panel_visible", "").lower() == "true":
            stats[key]["panel_opens"] += 1
        elif en == "task_context_saved":
            stats[key]["context_saves"] += 1
        elif en == "team_ai_toggle_changed":
            stats[key]["ai_toggles"] += 1
    return stats


def insight_stats(session=None):
    """Returns dict: (session_num, file_key) → {total_insights, types}"""
    stats = defaultdict(lambda: {"total": 0, "types": defaultdict(int)})
    for r in rows(insights, session):
        key = (r["session_num"], r["file_key"])
        stats[key]["total"] += 1
        stats[key]["types"][r.get("insight_type", "?")] += 1
    return stats


# ── print a session summary ───────────────────────────────────────────────────

def print_session(session_num):
    rs = routing_stats(session_num)
    ts_map = trace_stats(session_num)
    pn_map = panel_nav_stats(session_num)
    cs_map = context_stats(session_num)
    is_map = insight_stats(session_num)

    print(f"\n{'='*72}")
    print(f"  SESSION {session_num} — METRICS SUMMARY")
    print(f"{'='*72}")

    # group by file_key
    from itertools import groupby
    by_file = defaultdict(dict)
    for (sn, fk, pid), data in sorted(rs.items()):
        by_file[fk][pid] = data

    for fk in sorted(by_file.keys()):
        participants = by_file[fk]
        # get condition from first participant
        cond = next(iter(participants.values()))["condition"]
        run  = next(iter(participants.values()))["run_order"]
        print(f"\n  ┌─ {fk}  [{cond}  run_order={run or '—'}]")

        for pid in sorted(participants.keys()):
            d = participants[pid]
            tk = (str(session_num), fk, pid)
            tc = ts_map.get(tk, {})
            cc = cs_map.get(tk, {})

            total     = d["messages"]
            ask_pct   = round(d["route_ask"] / total * 100) if total else 0
            res_pct   = round(d["route_research"] / total * 100) if total else 0
            ovr_pct   = round(d["overrides"] / total * 100) if total else 0
            dur       = fmt_dur(d["duration_s"]) if d["duration_s"] else "—"

            print(f"  │  {pid}")
            print(f"  │    messages       : {total}  (ask {ask_pct}%  research {res_pct}%)")
            print(f"  │    overrides      : {d['overrides']} / {total}  ({ovr_pct}%  of messages)")
            print(f"  │    avg confidence : {d['avg_confidence']}")
            print(f"  │    research jobs  : {d['has_research_job']}")
            print(f"  │    session span   : {dur}")
            print(f"  │    panel opens    : {cc.get('panel_opens', 0)}")
            print(f"  │    context saves  : {cc.get('context_saves', 0)}")
            print(f"  │    ai toggles     : {cc.get('ai_toggles', 0)}")
            pn = pn_map.get(tk, {})
            print(f"  │    trace clicks   : {tc.get('clicks', 0)}   tab changes: {pn.get('tab_changes', 0)}")

        # insights for this file
        ik = (str(session_num), fk)
        ig = is_map.get(ik, {"total": 0, "types": {}})
        if ig["total"] > 0:
            types_str = "  ".join(f"{t}×{n}" for t, n in ig["types"].items())
            print(f"  │  insights generated: {ig['total']}  [{types_str}]")
        else:
            print(f"  │  insights generated: 0")
        print(f"  └{'─'*50}")

    # cross-condition comparison for group tasks
    print(f"\n  ── GROUP TASK COMPARISON (Session {session_num}) ──")
    on_fk    = next((fk for fk in by_file if "ai on" in fk.lower()), None)
    light_fk = next((fk for fk in by_file if "ai light" in fk.lower()), None)

    def group_totals(fk):
        if not fk:
            return None
        pdata = by_file[fk]
        total_msgs  = sum(d["messages"] for d in pdata.values())
        total_ovr   = sum(d["overrides"] for d in pdata.values())
        total_res   = sum(d["has_research_job"] for d in pdata.values())
        unique_part = len(pdata)
        return total_msgs, total_ovr, total_res, unique_part

    for label, fk in [("AI_ON  ", on_fk), ("AI_LIGHT", light_fk)]:
        if not fk:
            continue
        tot, ovr, rjobs, n = group_totals(fk)
        ik = (str(session_num), fk)
        ai_ins = is_map.get(ik, {"total": 0})["total"]
        print(f"    {label}  participants={n}  msgs={tot}  overrides={ovr}  "
              f"research_jobs={rjobs}  insights={ai_ins}")


# ── main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    sessions = [target] if target else ["1", "2", "3"]
    for s in sessions:
        print_session(s)
    print()
