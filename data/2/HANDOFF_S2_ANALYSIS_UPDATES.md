# Session 2 Analysis — Handoff: Apply Telemetry Updates

**Target file:** `2-analysis.md` (this directory)  
**Do:** Edit `2-analysis.md` in place. Do not restructure the document, do not create new files.

All data below comes from `output/routing_summary.csv`, `output/traceability_with_status.csv`, and `output/context_timeline.csv` which have already been generated and verified. Do not rerun scripts — use the values given here.

---

## Change 1 — Replace the Telemetry Summary table with exact values

The current table uses `~` approximations for Willson solo and Group AI_ON rows. Replace the entire table and the approximation footnote with the following exact values. The table also needs to be split by participant for Group AI_ON and Group AI_LIGHT (the scripts produce per-participant rows).

**New table:**

| Context | Total Msgs | Auto-Ask | Auto-Research | Manual-Ask | Manual-Research | Override Rate | Genuine Insights | Traceability Clicks | Context Saves | Draft Promoted |
|---|---|---|---|---|---|---|---|---|---|---|
| Willson Solo (AI_ON) | 33 | 20 | 0 | 11 | 2 | 39.4% | 6 | 1 | 1 | 0 |
| Aly Solo (AI_ON) | 10 | 0 | 0 | 5 | 5 | 100% | 6 | 4 | 1 | 0 |
| Royston Solo (AI_ON) | 6 | 0 | 0 | 3 | 3 | 100% | 2 | 5* | 0 | 0 |
| Group AI_ON — Willson | 9 | 4 | 0 | 5 | 0 | 55.6% | — | — | — | 2 |
| Group AI_ON — Aly | 26 | 17 | 0 | 9 | 0 | 34.6% | — | — | 1 | 2 |
| Group AI_ON — Royston | 8 | 5 | 0 | 3 | 0 | 37.5% | 6 total | 3 total | — | 0 |
| Group AI_LIGHT — Willson | 22 | 22 | 0 | 0 | 0 | 0% | — | — | 2 | 0 |
| Group AI_LIGHT — Aly | 25 | 18 | 0 | 7 | 0 | 28% | 0 total | 0 total | — | 2 |
| Group AI_LIGHT — Royston | 11 | 8 | 0 | 3 | 0 | 27.3% | — | — | 0 | 0 |

*Royston solo traceability corrected from 6 to 5 — one click was to a pre-session seed insight (age ~1015 minutes, Quick Start Help created the day before). See Change 4.

In the **Telemetry notes** block below the table, **remove** the sentence: `"Auto/Manual routing splits for Willson solo and Group AI_ON are approximated from total message counts, overall ask/research percentages, and override rates from script6."` Replace it with: `"All routing splits are exact values from output/routing_summary.csv."`

---

## Change 2 — AQ1: Add early/late phase routing arc for Willson and Royston

In the AQ1 section, locate the paragraph beginning **"Willson's 39% override rate is the modal pattern"**. After that paragraph, insert:

> **Early/late phase routing split confirms the learning arc in the telemetry.** Willson registered 0 overrides in his early phase (first half by message count) and 13 overrides in the late phase — all 2 research messages were also in the late phase. This is the most temporally structured routing arc in the study: Willson let the classifier run for the first half, then took increasingly deliberate manual control. Royston's split is the inverse in structure: 3 ask messages in the early phase (all manual), then 3 research messages in the late phase — also all manual. His early phase was exploratory Ask only; he deferred research trials to the second half. This resolves the apparent contradiction between the cleaned notes (which describe him as Ask-only) and the telemetry showing 3 research messages: the notes reflect his stated settled behaviour, the telemetry shows the exploration arc preceding it. Aly's override rate was 50/50 throughout (5 early, 5 late), confirming consistent deliberate engagement across the whole session rather than a learning arc.

---

## Change 3 — AQ1: Update the Royston discrepancy note

In the AQ1 section, locate the paragraph beginning **"Royston explicitly avoided features..."** (first paragraph of AQ1). Update the sentence: `"This is a discrepancy with the cleaned notes (which describe him as Ask-only): either the notes simplify a verbal description, or he briefly tried research early and the notes refer to his settled behaviour."` 

Replace that sentence and the following one with: `"The early/late phase split resolves this: Royston's early phase was 3 manual-ask messages only; he deferred all Research mode trials to the second half of his session. The notes reflect his settled post-exploration behaviour; the telemetry captures the full arc."`

Also in the **Cross-Cutting Notes** section, locate the paragraph beginning **"Royston routing discrepancy:"** and update it to match — replace the speculation ("either the notes simplify...") with the same resolution: early phase Ask-only, late phase Research exploration.

---

## Change 4 — AQ2: Correct Royston's traceability count and note the seed click

In the AQ2 section, locate the paragraph beginning **"Royston registered 6 traceability clicks..."**. Change `"6 traceability clicks"` to `"5 genuine traceability clicks"`. Add a sentence after the first sentence: `"One of the 6 raw clicks was to a pre-session seed insight (the Quick Start Help suggestion, age ~1015 minutes at time of click — created the day before the session). This is excluded from the genuine count."`

---

## Change 5 — AQ2: Add note that all S2 genuine traceability reached live content

At the end of the AQ2 section (before the `---` separator), add:

> **No dismissed-content confound in Session 2.** All genuine traceability clicks in Session 2 reached insights with `final_status=new` — there is no equivalent to the Session 1 B3 confound where clicks reached facilitator-dismissed content. Aly's 4th click reached a document insight with age 31.6 minutes — a backward reference to content generated significantly earlier in the session, suggesting cross-checking rather than immediate follow-up. All other genuine clicks were to fresh content (age <6 minutes at click time).

---

## Change 6 — AQ3: Resolve D2 open issue

In the AQ3 section, locate the paragraph beginning **"AI_LIGHT context promotes (D2 — open issue):"**. Replace the entire paragraph with:

> **AI_LIGHT context promotes (D2 — resolved):** Aly promoted twice during the AI_LIGHT condition (08:36:50, 08:43:40). These promotes were **not** silently discarded. Code inspection confirms the same mechanism as Session 3: the frontend auto-prepends `@agent` to any message sent after a promote (`shouldForceAgentInvoke = draftContexts.length > 0`), routing it as an explicit agent request — the one AI invocation type permitted in AI_LIGHT. Aly's promoted context was live input to each subsequent agent response. The constraint behaviour seen in AI_LIGHT is therefore a context retention or instruction-following limitation across turns, not a mechanical drop of the promoted data.

---

## Change 7 — Open Items table: Remove D2 row

In the **Open Items Before Finalising** table, delete the row:
`| D2 / C2 | Does draft_context_promoted in AI_LIGHT discard the draft silently? Check backend route handler. | AQ3 AI_LIGHT context claims |`

---

## Done

After all changes, the document should have no `~` approximation markers in the telemetry table, a corrected Royston traceability count of 5, the D2 open issue resolved and removed from the table, and the early/late phase arc grounded with exact numbers.
