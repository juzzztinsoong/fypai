import json, sys

def load_timeline(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    for key in ('events', 'timeline', 'data'):
        if key in data:
            return data[key]
    return list(data.values())[0] if isinstance(data, dict) else []

def get_routing(meta):
    # routing may be nested under message or at top level
    msg = meta.get('message', meta)
    r = msg.get('routing', meta.get('routing', {}))
    if not isinstance(r, dict):
        r = {}
    return r

def print_messages(label, path, user_filter=None):
    events = load_timeline(path)
    msg_events = [e for e in events if e.get('eventName') == 'message_sent']
    if user_filter:
        msg_events = [e for e in msg_events if e.get('actorUserId','').startswith(user_filter)]
    else:
        msg_events = [e for e in msg_events if e.get('actorUserId','').startswith('study-user')]
    print(f"\n=== {label} ({len(msg_events)} msgs) ===")
    for e in msg_events:
        meta = e.get('metadata', {})
        r = get_routing(meta)
        msg = meta.get('message', meta)
        content = str(msg.get('content', meta.get('content', '')))[:70]
        mode = r.get('mode', r.get('finalMode', '?'))
        override = r.get('wasOverridden', '?')
        conf = r.get('confidence', '?')
        ts = str(e.get('createdAt',''))
        if len(ts) > 19:
            ts = ts[11:19]
        print(f"  [{ts}] mode={mode} override={override} conf={conf} | {content}")

def print_insight_events(label, path):
    events = load_timeline(path)
    insight_evts = [e for e in events if 'insight' in e.get('eventName','').lower()]
    print(f"\n=== {label} - insight-related events ({len(insight_evts)}) ===")
    for e in insight_evts:
        ts = str(e.get('createdAt',''))[11:19]
        meta = e.get('metadata', {})
        print(f"  [{ts}] {e.get('eventName')} | {json.dumps(meta)[:120]}")

def print_panel_events(label, path, user='study-user-01'):
    events = load_timeline(path)
    panel_evts = [e for e in events if any(k in e.get('eventName','').lower() for k in ('panel', 'context', 'tab', 'toggle')) and e.get('actorUserId','').startswith(user)]
    print(f"\n=== {label} - panel/context events for {user} ({len(panel_evts)}) ===")
    for e in panel_evts:
        ts = str(e.get('createdAt',''))[11:19]
        meta = e.get('metadata', {})
        print(f"  [{ts}] {e.get('eventName')} | {json.dumps(meta)[:120]}")

# --- DISCREPANCY 1: Royston solo routing ---
print_messages("DISCREPANCY 1 - Royston solo routing", "2/3 roys/session-study-team-03-timeline.json")

# --- DISCREPANCY 2: AI_ON group - any insight events at all ---
print_insight_events("DISCREPANCY 2 - Team AI_ON insight events", "2/4 ai on/session-study-team-04-timeline.json")

# Also check solo files for insight events
print_insight_events("DISCREPANCY 2 - Willson solo insight events", "2/1 willson/session-study-team-01-timeline.json")
print_insight_events("DISCREPANCY 2 - Aly solo insight events", "2/2 aly/session-study-team-02-timeline.json")
print_insight_events("DISCREPANCY 2 - Royston solo insight events", "2/3 roys/session-study-team-03-timeline.json")

# --- DISCREPANCY 3: Willson AI_LIGHT panel opens ---
print_panel_events("DISCREPANCY 3 - Willson AI_LIGHT panel events", "2/5 ai light/session-study-team-05-timeline.json", "study-user-01")

# --- DISCREPANCY 4: Aly solo trace clicks despite Difficult legibility ---
events = load_timeline("2/2 aly/session-study-team-02-timeline.json")
trace_evts = [e for e in events if any(k in e.get('eventName','').lower() for k in ('trace', 'marker', 'focus_insight', 'jump'))]
print(f"\n=== DISCREPANCY 4 - Aly solo trace/marker events ({len(trace_evts)}) ===")
for e in trace_evts:
    ts = str(e.get('createdAt',''))[11:19]
    meta = e.get('metadata', {})
    print(f"  [{ts}] {e.get('eventName')} | {json.dumps(meta)[:120]}")
