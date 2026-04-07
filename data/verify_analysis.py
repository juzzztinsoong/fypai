"""
Verify analysis file claims against actual CSV data.
Prints discrepancies between what the analysis .md files state
and what the script-generated CSVs contain.
"""
import csv
import os
from collections import defaultdict

OUT = os.path.join(os.path.dirname(__file__), "output")


def load_csv(name):
    path = os.path.join(OUT, name)
    if not os.path.exists(path):
        print(f"  !! MISSING: {path}")
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ── Routing summary ──────────────────────────────────────────────
def check_routing():
    rows = load_csv("routing_summary.csv")
    if not rows:
        return

    print("\n=== ROUTING SUMMARY (from routing_summary.csv) ===")
    print(f"{'participant_id':<25} {'sess':>4} {'cond':<10} {'N':>3}  "
          f"{'ask%':>5} {'res%':>5} {'ovr%':>5}  {'early':>10} {'late':>10}")
    for r in rows:
        pid = r.get("participant_id", "?")
        sess = r.get("session_num", "?")
        cond = r.get("condition", "?")
        n = r.get("total_messages", "?")
        ask = r.get("ask_pct", "?")
        res = r.get("research_pct", "?")
        ovr = r.get("override_rate", "?")
        early = r.get("early_ask_res", r.get("early_phase", "?"))
        late = r.get("late_ask_res", r.get("late_phase", "?"))
        print(f"{pid:<25} {sess:>4} {cond:<10} {n:>3}  "
              f"{ask:>5} {res:>5} {ovr:>5}  {early:>10} {late:>10}")


# ── Routing table — per-file breakdown ───────────────────────────
def check_routing_detail():
    rows = load_csv("routing_table.csv")
    if not rows:
        return

    print("\n=== ROUTING TABLE DETAIL (from routing_table.csv) ===")

    # Group by file_key + participant
    groups = defaultdict(lambda: {"total": 0, "auto_ask": 0, "auto_research": 0,
                                   "manual_ask": 0, "manual_research": 0})
    for r in rows:
        fk = r.get("file_key", "?")
        pid = r.get("participant_id", "?")
        key = f"{fk} | {pid}"
        g = groups[key]
        g["total"] += 1

        route_mode = r.get("route_mode", "")
        route_source = r.get("route_source", "")
        override = r.get("route_override_used", r.get("override_used", ""))

        is_override = override in ("true", "True", "1", "yes")

        if route_mode == "research":
            if is_override:
                g["manual_research"] += 1
            else:
                g["auto_research"] += 1
        else:  # ask or empty
            if is_override:
                g["manual_ask"] += 1
            else:
                g["auto_ask"] += 1

    print(f"{'file_key | participant':<50} {'N':>3} "
          f"{'aAsk':>5} {'aRes':>5} {'mAsk':>5} {'mRes':>5} {'ovr%':>6}")
    for key in sorted(groups):
        g = groups[key]
        n = g["total"]
        ov = g["manual_ask"] + g["manual_research"]
        ovr_pct = f"{100*ov/n:.1f}%" if n else "n/a"
        print(f"{key:<50} {n:>3} "
              f"{g['auto_ask']:>5} {g['auto_research']:>5} "
              f"{g['manual_ask']:>5} {g['manual_research']:>5} {ovr_pct:>6}")


# ── Traceability ─────────────────────────────────────────────────
def check_traceability():
    rows = load_csv("traceability_with_status.csv")
    if not rows:
        rows = load_csv("traceability_clicks.csv")
    if not rows:
        return

    print("\n=== TRACEABILITY CLICKS (from traceability_with_status.csv) ===")

    # Per file_key + participant
    groups = defaultdict(lambda: {"total": 0, "seed": 0, "genuine": 0,
                                   "by_status": defaultdict(int)})
    for r in rows:
        fk = r.get("file_key", "?")
        pid = r.get("participant_id", "?")
        key = f"{fk} | {pid}"
        g = groups[key]
        g["total"] += 1

        # Detect seed clicks (age > 700 min)
        age_str = r.get("age_at_click_min", "")
        try:
            age = float(age_str) if age_str else 0
        except ValueError:
            age = 0

        if age > 700:
            g["seed"] += 1
        else:
            g["genuine"] += 1

        fs = r.get("final_status", "(empty)")
        if not fs:
            fs = "(empty)"
        g["by_status"][fs] += 1

    print(f"{'file_key | participant':<50} {'raw':>4} {'seed':>5} {'gen':>4}  status_dist")
    for key in sorted(groups):
        g = groups[key]
        dist = ", ".join(f"{k}={v}" for k, v in sorted(g["by_status"].items()))
        print(f"{key:<50} {g['total']:>4} {g['seed']:>5} {g['genuine']:>4}  {dist}")


# ── Context events ───────────────────────────────────────────────
def check_context():
    rows = load_csv("context_events.csv")
    if not rows:
        return

    print("\n=== CONTEXT EVENTS (from context_events.csv) ===")

    groups = defaultdict(lambda: defaultdict(int))
    for r in rows:
        fk = r.get("file_key", "?")
        pid = r.get("participant_id", "?")
        key = f"{fk} | {pid}"
        en = r.get("event_name", "?")
        groups[key][en] += 1

    print(f"{'file_key | participant':<50} {'saves':>6} {'promotes':>9} {'toggles':>8} {'other':>6}")
    for key in sorted(groups):
        g = groups[key]
        saves = g.get("task_context_saved", 0)
        promotes = g.get("draft_context_promoted", 0)
        toggles = g.get("task_context_panel_toggled", 0)
        other = sum(v for k, v in g.items()
                    if k not in ("task_context_saved",
                                 "draft_context_promoted",
                                 "task_context_panel_toggled"))
        print(f"{key:<50} {saves:>6} {promotes:>9} {toggles:>8} {other:>6}")


# ── Insight generations ──────────────────────────────────────────
def check_insights():
    rows = load_csv("insight_generations.csv")
    if not rows:
        return

    print("\n=== INSIGHT GENERATIONS (from insight_generations.csv) ===")

    groups = defaultdict(lambda: {"total": 0, "by_source": defaultdict(int),
                                   "by_type": defaultdict(int)})
    for r in rows:
        fk = r.get("file_key", "?")
        key = fk
        g = groups[key]
        g["total"] += 1
        src = r.get("data_source", "?")
        g["by_source"][src] += 1
        itype = r.get("type", r.get("insight_type", "?"))
        g["by_type"][itype] += 1

    print(f"{'file_key':<30} {'N':>3}  sources                types")
    for key in sorted(groups):
        g = groups[key]
        srcs = ", ".join(f"{k}={v}" for k, v in sorted(g["by_source"].items()))
        types = ", ".join(f"{k}={v}" for k, v in sorted(g["by_type"].items()))
        print(f"{key:<30} {g['total']:>3}  {srcs:<22} {types}")


# ── Panel navigation ─────────────────────────────────────────────
def check_panel_nav():
    rows = load_csv("panel_navigation.csv")
    if not rows:
        return

    print("\n=== PANEL NAVIGATION / TAB CHANGES (from panel_navigation.csv) ===")

    groups = defaultdict(int)
    for r in rows:
        fk = r.get("file_key", "?")
        pid = r.get("participant_id", "?")
        key = f"{fk} | {pid}"
        groups[key] += 1

    for key in sorted(groups):
        print(f"  {key:<50} {groups[key]:>3} tab changes")


# ── Insight workflow ─────────────────────────────────────────────
def check_workflow():
    rows = load_csv("insight_workflow.csv")
    if not rows:
        return

    print("\n=== INSIGHT WORKFLOW (from insight_workflow.csv) ===")

    groups = defaultdict(lambda: defaultdict(int))
    for r in rows:
        fk = r.get("file_key", "?")
        fs = r.get("final_status", "?")
        itype = r.get("type", r.get("insight_type", "?"))
        groups[fk][f"{itype}/{fs}"] += 1

    for fk in sorted(groups):
        dist = ", ".join(f"{k}={v}" for k, v in sorted(groups[fk].items()))
        print(f"  {fk:<30} {dist}")


# ── Main ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 70)
    print("DATA VERIFICATION — checking CSVs in output/")
    print("=" * 70)

    check_routing()
    check_routing_detail()
    check_traceability()
    check_context()
    check_insights()
    check_panel_nav()
    check_workflow()

    print("\n" + "=" * 70)
    print("Done. Compare above against analysis .md file claims.")
    print("=" * 70)
