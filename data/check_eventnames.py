import json

# Just print event names from timelines
for label, path in [
    ("Team-04 AI_ON", "2/4 ai on/session-study-team-04-timeline.json"),
    ("Willson solo", "2/1 willson/session-study-team-01-timeline.json"),
]:
    print(f"\n--- {label}: all unique eventNames ---")
    with open(path, encoding="utf-8") as f:
        tdata = json.load(f)
    events = tdata if isinstance(tdata, list) else tdata.get("events", [])
    names = sorted(set(e.get("eventName", "?") for e in events))
    for n in names:
        count = sum(1 for e in events if e.get("eventName") == n)
        print(f"  {count:4d}  {n}")

# Also check routing metadata structure
print("\n--- Royston solo: first message_sent raw metadata ---")
with open("2/3 roys/session-study-team-03-timeline.json", encoding="utf-8") as f:
    tdata = json.load(f)
events = tdata if isinstance(tdata, list) else tdata.get("events", [])
msg_events = [e for e in events if e.get("eventName") == "message_sent"]
if msg_events:
    print(json.dumps(msg_events[0], indent=2)[:1500])
