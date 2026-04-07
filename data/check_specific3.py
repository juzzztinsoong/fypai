"""Check S3 AI_LIGHT promotes and S1 group routing detail."""
import csv

# S3 context events - Aung AI_LIGHT
ctx = list(csv.DictReader(open("output/context_events.csv")))
aung_light = [r for r in ctx if "3/5" in r["file_key"] and "study-user-01" in r.get("participant_id","")]
print(f"Aung S3 AI_LIGHT context events: {len(aung_light)}")
for r in aung_light:
    en = r.get("event_name", "?")
    ts = r.get("timestamp", r.get("created_at", "?"))
    print(f"  {en}  {ts}")

# S3 Group AI_ON context - Aung promotes
aung_grpon = [r for r in ctx if "3/4" in r["file_key"] and "study-user-01" in r.get("participant_id","")]
print(f"\nAung S3 Group AI_ON context events: {len(aung_grpon)}")
for r in aung_grpon:
    en = r.get("event_name", "?")
    print(f"  {en}")

# S1 group AI_ON routing
rt = list(csv.DictReader(open("output/routing_table.csv")))
s1g = [r for r in rt if "1/4" in r["file_key"]]
print(f"\nS1 Group AI_ON: {len(s1g)} messages")
by_pid = {}
for r in s1g:
    pid = r.get("participant_id","?")
    if pid not in by_pid:
        by_pid[pid] = {"total":0,"auto_ask":0,"auto_research":0,"manual_ask":0,"manual_research":0}
    b = by_pid[pid]
    b["total"] += 1
    mode = r.get("route_mode","")
    ov = r.get("route_override_used","") in ("true","True","1")
    if mode == "research":
        b["manual_research" if ov else "auto_research"] += 1
    else:
        b["manual_ask" if ov else "auto_ask"] += 1

for pid, b in sorted(by_pid.items()):
    ovr = 100*(b["manual_ask"]+b["manual_research"])/b["total"] if b["total"] else 0
    print(f"  {pid}: N={b['total']} aAsk={b['auto_ask']} aRes={b['auto_research']} mAsk={b['manual_ask']} mRes={b['manual_research']} ovr={ovr:.0f}%")

# Check S1 analysis claims: Group AI_ON says 3 auto-ask, 0 auto-research, 34 manual-ask, 0 manual-research
# (37 total, 92% override)
print(f"\n  S1 Group AI_ON combined: {sum(b['total'] for b in by_pid.values())} messages")
