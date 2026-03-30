import json

files = [
    ("Team-04 AI_ON", "2/4 ai on/session-study-team-04.json"),
    ("Willson solo", "2/1 willson/session-study-team-01.json"),
    ("Aly solo", "2/2 aly/session-study-team-02.json"),
    ("Royston solo", "2/3 roys/session-study-team-03.json"),
]

for label, path in files:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    print(f"\n--- {label}")
    print(f"    top-level keys: {list(data.keys())}")
    insights = data.get("insights", data.get("aiInsights", []))
    print(f"    insights count: {len(insights)}")
    if insights:
        print(f"    first insight keys: {list(insights[0].keys())}")
        for ins in insights[:5]:
            itype = ins.get("type", "?")
            title = str(ins.get("title", ""))[:60]
            created = str(ins.get("createdAt", ""))[11:19]
            print(f"      [{created}] type={itype} | {title}")

# Also check what ALL unique event names appear in team-04 timeline
print("\n\n--- Team-04 AI_ON: all unique eventNames in timeline ---")
with open("2/4 ai on/session-study-team-04-timeline.json", encoding="utf-8") as f:
    tdata = json.load(f)
events = tdata if isinstance(tdata, list) else tdata.get("events", [])
names = sorted(set(e.get("eventName", "?") for e in events))
for n in names:
    count = sum(1 for e in events if e.get("eventName") == n)
    print(f"  {n}: {count}")

# And for Willson solo
print("\n--- Willson solo: all unique eventNames in timeline ---")
with open("2/1 willson/session-study-team-01-timeline.json", encoding="utf-8") as f:
    tdata = json.load(f)
events = tdata if isinstance(tdata, list) else tdata.get("events", [])
names = sorted(set(e.get("eventName", "?") for e in events))
for n in names:
    count = sum(1 for e in events if e.get("eventName") == n)
    print(f"  {n}: {count}")
