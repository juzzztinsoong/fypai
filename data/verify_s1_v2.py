"""Verify Session 1 analysis table against CSV ground truth.
Uses routing_table.csv per-message rows for auto/manual breakdown."""
import csv
from collections import Counter

def is_s1(fk):
    return fk.startswith("1/")

def ctx_label(fk, pid):
    if "team-01" in fk or "team-02" in fk or "team-03" in fk:
        return f"{pid} Solo"
    elif "team-04" in fk:
        return f"Group AI_ON - {pid}"
    elif "team-05" in fk:
        return f"Group AI_LIGHT - {pid}"
    return pid

# ---------- Routing ----------
print("=== S1 ROUTING (routing_table.csv per-message) ===")
with open("output/routing_table.csv") as f:
    rows = [r for r in csv.DictReader(f) if is_s1(r["file_key"])]

groups = {}
for r in rows:
    ctx = ctx_label(r["file_key"], r["participant_id"])
    if ctx not in groups:
        groups[ctx] = {"total": 0, "aa": 0, "ar": 0, "ma": 0, "mr": 0}
    g = groups[ctx]
    g["total"] += 1
    mode = r.get("route_mode", "").lower()
    src = r.get("route_source", "").lower()
    is_ov = "override" in src
    if mode == "ask" and not is_ov:     g["aa"] += 1
    elif mode == "ask" and is_ov:       g["ma"] += 1
    elif mode == "research" and not is_ov: g["ar"] += 1
    elif mode == "research" and is_ov:  g["mr"] += 1

for ctx, g in sorted(groups.items()):
    ov = g["ma"] + g["mr"]
    rate = f"{ov/g['total']*100:.0f}%" if g["total"] else "N/A"
    print(f"  {ctx}: total={g['total']}, auto_ask={g['aa']}, auto_res={g['ar']}, "
          f"man_ask={g['ma']}, man_res={g['mr']}, override={rate}")

# Combined group totals
for team_str, label in [("team-04", "Group AI_ON"), ("team-05", "Group AI_LIGHT")]:
    tr = [r for r in rows if team_str in r["file_key"]]
    if not tr: continue
    t = len(tr)
    aa = sum(1 for r in tr if r["route_mode"].lower()=="ask" and "override" not in r["route_source"].lower())
    ar = sum(1 for r in tr if r["route_mode"].lower()=="research" and "override" not in r["route_source"].lower())
    ma = sum(1 for r in tr if r["route_mode"].lower()=="ask" and "override" in r["route_source"].lower())
    mr = sum(1 for r in tr if r["route_mode"].lower()=="research" and "override" in r["route_source"].lower())
    ov = ma+mr
    print(f"  {label} COMBINED: total={t}, auto_ask={aa}, auto_res={ar}, "
          f"man_ask={ma}, man_res={mr}, override={ov/t*100:.0f}%")

# ---------- Traceability ----------
print("\n=== S1 TRACEABILITY (traceability_with_status.csv) ===")
with open("output/traceability_with_status.csv") as f:
    rows = [r for r in csv.DictReader(f) if is_s1(r["file_key"])]
by_ctx = Counter()
for r in rows:
    by_ctx[ctx_label(r["file_key"], r["participant_id"])] += 1
for k, c in sorted(by_ctx.items()):
    print(f"  {k}: {c}")
g04 = sum(c for k,c in by_ctx.items() if "AI_ON" in k)
g05 = sum(c for k,c in by_ctx.items() if "AI_LIGHT" in k)
print(f"  Group AI_ON total: {g04}, Group AI_LIGHT total: {g05}, S1 total: {len(rows)}")

# ---------- Context ----------
print("\n=== S1 CONTEXT (context_events.csv) ===")
with open("output/context_events.csv") as f:
    rows = [r for r in csv.DictReader(f) if is_s1(r["file_key"])]
by_det = Counter()
for r in rows:
    evt = r.get("event_type", "")
    ctx = ctx_label(r["file_key"], r["participant_id"])
    by_det[f"{ctx} | {evt}"] += 1
for k, c in sorted(by_det.items()):
    print(f"  {k}: {c}")
print(f"  Total: {len(rows)}")

# ---------- Insights ----------
print("\n=== S1 INSIGHTS (insight_generations.csv) ===")
with open("output/insight_generations.csv") as f:
    rows = [r for r in csv.DictReader(f) if is_s1(r["file_key"])]
by_ctx = Counter()
for r in rows:
    if "team-04" in r["file_key"]:
        by_ctx["Group AI_ON"] += 1
    elif "team-05" in r["file_key"]:
        by_ctx["Group AI_LIGHT"] += 1
    else:
        by_ctx[f"{r['participant_id']} Solo"] += 1
for k, c in sorted(by_ctx.items()):
    print(f"  {k}: {c} rows")
print(f"  Total: {len(rows)} rows (S1 uses 2 rows/generation for timeline events)")
