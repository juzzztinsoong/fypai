import csv
from collections import defaultdict

# Check auto-research across all sessions
print('=== AUTO-RESEARCH ACROSS ALL SESSIONS ===')
with open('output/routing_table.csv') as f:
    rows = list(csv.DictReader(f))

for s in ['1','2','3','4']:
    ar = [r for r in rows if r['session_num']==s and r['route_source']=='auto-classification' and r['final_route']=='research']
    print(f'  S{s} auto-research: {len(ar)} messages')

print()
print('=== OVERRIDE RATES SUMMARY ===')
for s in ['1','2','3','4']:
    session_rows = [r for r in rows if r['session_num']==s]
    groups = defaultdict(list)
    for r in session_rows:
        key = f"{r['participant_id']}|{r['file_key']}"
        groups[key].append(r)
    for key in sorted(groups.keys()):
        g = groups[key]
        total = len(g)
        overrides = len([r for r in g if r['route_source']=='manual-override'])
        pct = overrides/total*100 if total else 0
        print(f'  S{s} {key}: {pct:.0f}% ({overrides}/{total})')

print()
print('=== TRACEABILITY SUMMARY ===')
with open('output/traceability_with_status.csv') as f:
    trows = list(csv.DictReader(f))

for s in ['1','2','3','4']:
    srows = [r for r in trows if r['session_num']==s]
    by_part = defaultdict(int)
    for r in srows:
        by_part[r['participant_id']] += 1
    print(f'  S{s}: {len(srows)} total clicks')
    for p in sorted(by_part.keys()):
        print(f'    {p}: {by_part[p]}')

print()
print('=== INSIGHT COUNTS (genuine, by session) ===')
with open('output/insight_generations.csv') as f:
    irows = list(csv.DictReader(f))

for s in ['1','2','3','4']:
    srows = [r for r in irows if r['session_num']==s]
    print(f'  S{s}: {len(srows)} rows (includes seeds/dupes)')

print()
print('=== CONTEXT EVENTS SUMMARY ===')
with open('output/context_events.csv') as f:
    crows = list(csv.DictReader(f))

for s in ['1','2','3','4']:
    srows = [r for r in crows if r['session_num']==s]
    by_event = defaultdict(int)
    for r in srows:
        by_event[r['event_name']] += 1
    print(f'  S{s}:')
    for e in sorted(by_event.keys()):
        print(f'    {e}: {by_event[e]}')

print()
print('=== MESSAGE VOLUMES (AI_ON vs AI_LIGHT, group only) ===')
# Group messages only
for s in ['1','2','3','4']:
    session_rows = [r for r in rows if r['session_num']==s]
    # Find group file_keys (contain 'team')
    group_on = [r for r in session_rows if 'team' in r['file_key'] and r.get('condition','') != 'AI_LIGHT']
    group_light = [r for r in session_rows if 'team' in r['file_key'] and r.get('condition','') == 'AI_LIGHT']
    # alt: look at file_key patterns - team-04 is AI_ON, team-05 is AI_LIGHT typically
    on_keys = set(r['file_key'] for r in session_rows if 'team' in r['file_key'])
    print(f'  S{s} group file_keys: {on_keys}')
    for fk in sorted(on_keys):
        fk_rows = [r for r in session_rows if r['file_key']==fk]
        print(f'    {fk}: {len(fk_rows)} msgs')
