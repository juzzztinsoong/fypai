"""Quick check: Royston traceability ages and Aly group routing."""
import csv

# Royston traceability
rows = list(csv.DictReader(open("output/traceability_with_status.csv")))
roys = [r for r in rows if "roys" in r["file_key"]]
print("Royston solo traceability:")
for r in roys:
    age = r.get("age_at_click_min", "?")
    title = r.get("insight_title", "?")[:50]
    fs = r.get("final_status", "?")
    print(f"  age={age}  title={title}  final={fs}")

# Shanyl traceability  
shanyl = [r for r in rows if "shanyl" in r["file_key"]]
print(f"\nShanyl traceability ({len(shanyl)} clicks):")
for r in shanyl:
    age = r.get("age_at_click_min", "?")
    title = r.get("insight_title", "?")[:50]
    fs = r.get("final_status", "?")
    print(f"  age={age}  title={title}  final={fs}")

# Aly group AI_ON routing
rt_rows = list(csv.DictReader(open("output/routing_table.csv")))
aly_grp = [r for r in rt_rows if "2/4" in r["file_key"] and "study-user-02" in r.get("participant_id", "")]
print(f"\nAly group AI_ON routing ({len(aly_grp)} msgs):")
for r in aly_grp:
    rm = r.get("route_mode", "?")
    ov = r.get("route_override_used", r.get("override_used", "?"))
    src = r.get("route_source", "?")
    print(f"  mode={rm}  override={ov}  source={src}")
