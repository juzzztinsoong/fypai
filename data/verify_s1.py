"""Verify Session 1 analysis table values against CSV ground truth."""
import csv
from collections import Counter

# --- Routing ---
print("=== S1 ROUTING (routing_summary.csv) ===")
with open("output/routing_summary.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        fk = row.get("file_key", "")
        if fk.startswith("1/"):
            print(
                f"  {row['context']}: total={row['total_messages']}, "
                f"auto_ask={row['auto_ask']}, auto_research={row['auto_research']}, "
                f"manual_ask={row['manual_ask']}, manual_research={row['manual_research']}, "
                f"override={row['override_rate']}"
            )

# --- Traceability ---
print("\n=== S1 TRACEABILITY (traceability_with_status.csv) ===")
with open("output/traceability_with_status.csv") as f:
    reader = csv.DictReader(f)
    s1_rows = [r for r in reader if r.get("file_key", "").startswith("1/")]
    by_part = Counter()
    for r in s1_rows:
        key = r["participant_id"] + " | " + r.get("context", "")
        by_part[key] += 1
    for k, c in sorted(by_part.items()):
        print(f"  {k}: {c} clicks")
    print(f"  Total S1 traceability clicks: {len(s1_rows)}")

# --- Context events ---
print("\n=== S1 CONTEXT (context_events.csv) ===")
with open("output/context_events.csv") as f:
    reader = csv.DictReader(f)
    s1_rows = [r for r in reader if r.get("file_key", "").startswith("1/")]
    by_key = Counter()
    for r in s1_rows:
        key = r["participant_id"] + " | " + r.get("event_type", "") + " | " + r.get("context", "")
        by_key[key] += 1
    for k, c in sorted(by_key.items()):
        print(f"  {k}: {c}")
    print(f"  Total S1 context events: {len(s1_rows)}")

# --- Insights ---
print("\n=== S1 INSIGHTS (insight_generations.csv) ===")
with open("output/insight_generations.csv") as f:
    reader = csv.DictReader(f)
    s1_rows = [r for r in reader if r.get("file_key", "").startswith("1/")]
    by_ctx = Counter()
    for r in s1_rows:
        by_ctx[r.get("context", "")] += 1
    for k, c in sorted(by_ctx.items()):
        print(f"  {k}: {c} rows")
    print(f"  Total S1 insight rows: {len(s1_rows)}")
    # show source breakdown
    with open("output/insight_generations.csv") as f2:
        reader2 = csv.DictReader(f2)
        s1_rows2 = [r for r in reader2 if r.get("file_key", "").startswith("1/")]
        by_source = Counter()
        for r in s1_rows2:
            by_source[r.get("source", "")] += 1
        print(f"  By source: {dict(by_source)}")
