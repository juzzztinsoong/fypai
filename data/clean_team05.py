"""
clean_team05.py
---------------
Trims off-task content from team-05 (AI_LIGHT, trip-planning scenario).

Two removal windows:
  PRE_TASK  08:32:13 – 08:34:21  (slur/LinkedIn/boundary-testing before task started)
  POST_TASK 08:43:42 onward      (sexual content / harassment starting with "show me boobs")

Warm-up kept:
  08:32:11  "hello senoritas awesome"    (opening greeting)
  08:34:43+                              (participants orient to task)

Originals are backed up with a .bak extension before any modification.
"""

import json
import shutil
from pathlib import Path

DATA_DIR = Path(__file__).parent

TEAM05_DIR = DATA_DIR / "2" / "5 ai light"

TIMELINE_FILE   = TEAM05_DIR / "session-study-team-05-timeline.json"
CSV_FILE        = TEAM05_DIR / "session-study-team-05.csv"
FULL_EXPORT_FILE = TEAM05_DIR / "session-study-team-05.json"

# Removal windows (inclusive, compared against first 19 chars of ISO timestamp)
PRE_TASK_START  = "2026-03-25T08:32:13"
PRE_TASK_END    = "2026-03-25T08:34:21"
POST_TASK_START = "2026-03-25T08:43:42"


def in_removal_window(ts: str) -> bool:
    t = ts[:19]
    if PRE_TASK_START <= t <= PRE_TASK_END:
        return True
    if t >= POST_TASK_START:
        return True
    return False


def backup(path: Path) -> None:
    bak = path.with_suffix(path.suffix + ".bak")
    if not bak.exists():
        shutil.copy2(path, bak)
        print(f"  Backed up → {bak.name}")
    else:
        print(f"  Backup already exists, skipping: {bak.name}")


# ── Timeline JSON ────────────────────────────────────────────────────────────
print("=== Cleaning timeline JSON ===")
backup(TIMELINE_FILE)

with open(TIMELINE_FILE, encoding="utf-8") as f:
    data = json.load(f)

original_count = len(data["timeline"])
data["timeline"] = [
    ev for ev in data["timeline"]
    if not in_removal_window(ev.get("createdAt", ""))
]
removed_count = original_count - len(data["timeline"])

with open(TIMELINE_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"  Removed {removed_count} timeline events  ({original_count} → {len(data['timeline'])})")


# ── CSV ──────────────────────────────────────────────────────────────────────
import csv
import io

print("\n=== Cleaning CSV ===")

# Always restore from backup so re-runs are idempotent
bak = CSV_FILE.with_suffix(CSV_FILE.suffix + ".bak")
if bak.exists():
    import shutil as _shutil
    _shutil.copy2(bak, CSV_FILE)
    print(f"  Restored from backup: {bak.name}")
else:
    backup(CSV_FILE)

raw = CSV_FILE.read_text(encoding="utf-8")

reader = csv.DictReader(io.StringIO(raw))
fieldnames = reader.fieldnames

kept_rows = []
removed_csv = 0
original_csv = 0

for row in reader:
    original_csv += 1
    ts = row.get("messageCreatedAt", "")
    if in_removal_window(ts):
        removed_csv += 1
        continue
    kept_rows.append(row)

out = io.StringIO()
writer = csv.DictWriter(out, fieldnames=fieldnames, lineterminator="\n")
writer.writeheader()
writer.writerows(kept_rows)

CSV_FILE.write_text(out.getvalue(), encoding="utf-8")
print(f"  Removed {removed_csv} CSV rows  ({original_csv} → {len(kept_rows)} data rows)")


# ── Full export JSON (session-study-team-05.json) ────────────────────────────
print("\n=== Cleaning full export JSON ===")
backup(FULL_EXPORT_FILE)

with open(FULL_EXPORT_FILE, encoding="utf-8") as f:
    full = json.load(f)

# Arrays keyed on createdAt that need pruning
for array_key in ("messages", "events", "timeline"):
    items = full.get(array_key, [])
    kept = [i for i in items if not in_removal_window(i.get("createdAt", ""))]
    removed = len(items) - len(kept)
    full[array_key] = kept
    print(f"  {array_key}: removed {removed}  ({len(items)} → {len(kept)})")

# insights: keyed on createdAt (currently 0 for this team, but clean anyway)
items = full.get("insights", [])
kept = [i for i in items if not in_removal_window(i.get("createdAt", ""))]
removed = len(items) - len(kept)
full["insights"] = kept
print(f"  insights: removed {removed}  ({len(items)} → {len(kept)})")

# feedback: keyed on createdAt
items = full.get("feedback", [])
kept = [i for i in items if not in_removal_window(i.get("createdAt", ""))]
removed = len(items) - len(kept)
full["feedback"] = kept
print(f"  feedback: removed {removed}  ({len(items)} → {len(kept)})")

with open(FULL_EXPORT_FILE, "w", encoding="utf-8") as f:
    json.dump(full, f, indent=2, ensure_ascii=False)

print("\nDone. Run the analysis scripts to regenerate output/.")
