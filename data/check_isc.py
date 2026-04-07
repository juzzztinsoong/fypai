import csv
from collections import defaultdict

# 1. Check ALL insight status transitions
print('=== ALL INSIGHT STATUS TRANSITIONS ===')
with open('output/insight_workflow.csv') as f:
    rows = list(csv.DictReader(f))

for s in ['1','2','3','4']:
    srows = [r for r in rows if r['session_num']==s]
    has_transitions = [r for r in srows if r.get('status_transitions','') and r['status_transitions'] != '[]']
    print(f'S{s}: {len(srows)} insights total, {len(has_transitions)} with status transitions')
    for r in has_transitions:
        fk = r['file_key']
        itype = r['insight_type']
        title = r['insight_title'][:50]
        final = r['final_status']
        trans = r['status_transitions']
        print(f'  {fk} | {itype} | {title} | final={final} | {trans}')
    no_trans = [r for r in srows if not r.get('status_transitions','') or r['status_transitions'] == '[]']
    status_counts = defaultdict(int)
    for r in no_trans:
        status_counts[r.get('final_status','?')] += 1
    print(f'  No-transition insights: {dict(status_counts)}')
    print()

# 2. Check insight_status_changes.csv specifically
print('=== insight_status_changes.csv ===')
try:
    with open('output/insight_status_changes.csv') as f:
        sc_rows = list(csv.DictReader(f))
    print(f'Rows: {len(sc_rows)}')
    for r in sc_rows[:20]:
        print(f'  {r}')
except:
    print('File not found or empty')

# 3. Check raw timeline for insight_status_changed events
print()
print('=== RAW TIMELINE insight_status_changed EVENTS ===')
import json, glob
for session_dir in ['1','2','3','4']:
    timeline_files = glob.glob(f'{session_dir}/*/session-*.json')
    for tf in sorted(timeline_files):
        with open(tf, encoding='utf-8') as f:
            data = json.load(f)
        events = data.get('events', data.get('timeline', []))
        if isinstance(events, list):
            isc = [e for e in events if e.get('event_name','') == 'insight_status_changed' or e.get('eventName','') == 'insight_status_changed']
            if isc:
                print(f'{tf}: {len(isc)} events')
                for e in isc[:5]:
                    ts = e.get('timestamp', e.get('time', '?'))
                    user = e.get('user_id', e.get('userId', e.get('data',{}).get('userId','?')))
                    meta = e.get('metadata', e.get('data', {}))
                    print(f'  {ts} | user={user} | {meta}')

# 4. Check the scenario timelines for each session
print()
print('=== SESSION TIMELINES (first/last message per file_key) ===')
with open('output/routing_table.csv') as f:
    rt_rows = list(csv.DictReader(f))

for s in ['1','2','3','4']:
    srows = [r for r in rt_rows if r['session_num']==s]
    keys = sorted(set(r['file_key'] for r in srows))
    for k in keys:
        krows = [r for r in srows if r['file_key']==k]
        times = sorted([r['timestamp'] for r in krows if r.get('timestamp','')])
        if times:
            print(f'  S{s} {k}: {times[0][:19]} to {times[-1][:19]} ({len(krows)} msgs)')
        else:
            print(f'  S{s} {k}: no timestamps ({len(krows)} msgs)')
