"""Check traceability with correct field names, plus Aly S2 routing discrepancy."""
import csv

rows = list(csv.DictReader(open("output/traceability_with_status.csv")))

# Royston solo
roys = [r for r in rows if "roys" in r["file_key"]]
print(f"Royston solo: {len(roys)} clicks")
for r in roys:
    age_s = r.get("insight_age_seconds", "?")
    try:
        age_min = f"{float(age_s)/60:.1f}min"
    except (ValueError, TypeError):
        age_min = f"{age_s}s"
    title = r.get("insight_title", "?")[:50]
    fs = r.get("insight_final_status", "?")
    sa = r.get("status_at_click", "?")
    dc = r.get("data_complete", "?")
    print(f"  age={age_min}  at_click={sa}  final={fs}  data_complete={dc}  title={title}")

# Shanyl
shanyl = [r for r in rows if "shanyl" in r["file_key"]]
print(f"\nShanyl: {len(shanyl)} clicks")
for r in shanyl:
    age_s = r.get("insight_age_seconds", "?")
    try:
        age_min = f"{float(age_s)/60:.1f}min"
    except (ValueError, TypeError):
        age_min = f"{age_s}s"
    title = r.get("insight_title", "?")[:50]
    fs = r.get("insight_final_status", "?")
    sa = r.get("status_at_click", "?")
    print(f"  age={age_min}  at_click={sa}  final={fs}  title={title}")

# S2 Group AI_ON 
s2g = [r for r in rows if "2/4" in r["file_key"]]
print(f"\nS2 Group AI_ON: {len(s2g)} clicks")
for r in s2g:
    age_s = r.get("insight_age_seconds", "?")
    try:
        age_min = f"{float(age_s)/60:.1f}min"
    except (ValueError, TypeError):
        age_min = f"{age_s}s"
    pid = r.get("participant_id", "?")
    title = r.get("insight_title", "?")[:50]
    fs = r.get("insight_final_status", "?")
    sa = r.get("status_at_click", "?")
    print(f"  pid={pid}  age={age_min}  at_click={sa}  final={fs}  title={title}")

# Aung
aung = [r for r in rows if "aung" in r["file_key"]]
print(f"\nAung solo: {len(aung)} clicks")
for r in aung:
    age_s = r.get("insight_age_seconds", "?")
    try:
        age_min = f"{float(age_s)/60:.1f}min"
    except (ValueError, TypeError):
        age_min = f"{age_s}s"
    title = r.get("insight_title", "?")[:50]
    fs = r.get("insight_final_status", "?")
    sa = r.get("status_at_click", "?")
    print(f"  age={age_min}  at_click={sa}  final={fs}  title={title}")

# Aly Group AI_ON routing - count the actual breakdown
rt = list(csv.DictReader(open("output/routing_table.csv")))
aly_g = [r for r in rt if "2/4" in r["file_key"] and "study-user-02" in r.get("participant_id","")]
counts = {"auto_ask":0, "auto_research":0, "manual_ask":0, "manual_research":0}
for r in aly_g:
    mode = r.get("route_mode","")
    override = r.get("route_override_used","") in ("true","True","1")
    if mode == "research":
        counts["manual_research" if override else "auto_research"] += 1
    else:
        counts["manual_ask" if override else "auto_ask"] += 1
print(f"\nAly Group AI_ON routing breakdown: {counts}")
print(f"  Total: {sum(counts.values())}, Override rate: {100*(counts['manual_ask']+counts['manual_research'])/sum(counts.values()):.1f}%")
