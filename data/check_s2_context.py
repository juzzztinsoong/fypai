import csv

rows = list(csv.DictReader(open('output/context_events.csv', encoding='utf-8')))
s2 = [r for r in rows if r['session_num'] == '2']
print('S2 context events:')
for r in s2:
    ctx = r['file_key'].split('/')[1]
    pid = r['participant_id']
    evname = r['event_name']
    ts = r['timestamp'][11:19]
    meta = r.get('metadata', '')
    print(f'  {ctx:20s}  {pid:15s}  {evname:35s}  {ts}  {meta[:80]}')
