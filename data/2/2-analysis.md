# Session 2 — Analysis

**Date:** 2026-03-25
**Participants:** Willson (P1), Aly (P2), Royston (P3)
**Structure:** Solo AI_ON (P1, P2, P3 separately) → Group AI_ON (flat finding, Singapore) → Group AI_LIGHT (trip planning)
**Researcher notes source:** `2-cleaned.md`
**Data quality note:** Cleanest solo data in the study. Final survey instrument. No blocking bugs. All three participants' exports are structurally sound. Primary session for AQ3 and AQ4 multi-participant analysis. Session 2 team-05 (AI_LIGHT) had a tangent window cleaned — removed pre-task slur baiting (08:32:13–08:34:21) and post-task sexual content/harassment (08:43:42 onward). Legitimate trip-planning task data retained in full.

---

## Telemetry Summary

| Context | Total Msgs | Auto-Ask | Auto-Research | Manual-Ask | Manual-Research | Override Rate | Genuine Insights | Traceability Clicks | Context Saves | Draft Promoted |
|---|---|---|---|---|---|---|---|---|---|---|
| Willson Solo (AI_ON) | 33 | 20 | 0 | 11 | 2 | 39.4% | 6 | 1 | 1 | 0 |
| Aly Solo (AI_ON) | 10 | 0 | 0 | 5 | 5 | 100% | 6 | 4 | 1 | 0 |
| Royston Solo (AI_ON) | 6 | 0 | 0 | 3 | 3 | 100% | 2 | 5* | 0 | 0 |
| Group AI_ON — Willson | 9 | 4 | 0 | 4 | 1 | 55.6% | — | 3 | — | 2 |
| Group AI_ON — Aly | 26 | 17 | 0 | 8 | 1 | 34.6% | — | 0 | 1 | 2 |
| Group AI_ON — Royston | 8 | 5 | 0 | 3 | 0 | 37.5% | 6 total | 0 | 0 | 0 |
| Group AI_LIGHT — Willson | 22 | 22 | 0 | 0 | 0 | 0% | — | 0† | 2 | 0 |
| Group AI_LIGHT — Aly | 25 | 18 | 0 | 7 | 0 | 28% | 0† | 0† | — | 2 |
| Group AI_LIGHT — Royston | 11 | 8 | 0 | 3 | 0 | 27.3% | — | 0† | 0 | 0 |

*Royston solo traceability corrected from 6 to 5 — one click was to a pre-session seed insight (age ~1015 minutes, Quick Start Help created the day before). See AQ2.
†AI_LIGHT condition: no right panel, no insights generated, no traceability possible. Zero is structural.

**Telemetry notes:**

- **Genuine insight counts** are post-seed-filter (issue A1). Each participant's export contained one pre-seeded "Quick Start Help" suggestion timestamped 2026-03-24T14:39:17.6xx (day before session, tight millisecond burst). These are excluded. Post-filter: Willson 6, Aly 6, Royston **2** (not 3 — one seed removed). Group AI_ON: 6. All figures come from `export_fallback` source — the `insight_generate_requested/completed` instrumentation was absent in Sessions 2–3 (issue A2). Do not compare raw row counts against Session 1 Sam/Group AI_ON which used timeline-event pairs (2 rows/generation).

- **All routing splits** are exact values from `output/routing_summary.csv`.

- **Context saves and Draft Promoted** come from `output/context_events.csv` (issue A3), not `script6`. Script6 does not count `draft_context_promoted` events. Within Group AI_ON: Willson contributed 2 promotes (08:19:46, 08:19:57), Aly contributed 2 promotes (08:22:44, 08:23:06) plus 1 formal panel save (08:15:18). Within Group AI_LIGHT: Willson contributed 2 formal saves (08:35:12, 08:40:04), Aly contributed 2 promotes (08:36:50, 08:43:40). Royston used no context affordance in any phase.

- **Prompt archetype and override data** unavailable for Sessions 2–3 (issue A5). Only Session 1 Sam solo and S1 Group AI_ON have `has_prompt_override` and `prompt_archetype` populated. Prompt customisation behaviour cannot be compared cross-session.

- **Tab changes:** Willson in Group AI_ON registered 8 right-panel tab changes; all other participants across all Session 2 contexts registered 0 or 2. See AQ2.

---

## AQ1 — AI Routing Behaviour

**The clearest within-session routing learning arc in the study.**

**Aly and Royston entered with 100% manual override rates** — zero auto-classified messages accepted for either participant across their entire solo sessions. This is the sharpest AQ1 signal in Session 2: both participants arrived at the routing interface and immediately took full manual control, not through deliberate routing design comprehension but through exploration. Aly discovered what the action feature does by asking the AI directly rather than through the UI — a self-directed onboarding strategy that bypasses the routing legibility problem but is not a scalable or intentional path. Royston explicitly avoided features he did not understand and operated Ask-only through most of his session — yet the telemetry shows 3 manual-research and 3 manual-ask messages. The early/late phase split resolves this: Royston's early phase was 3 manual-ask messages only; he deferred all Research mode trials to the second half of his session. The notes reflect his settled post-exploration behaviour; the telemetry captures the full arc.

**Willson's 39% override rate is the modal pattern** — deferring to the classifier most of the time while occasionally correcting it. His 94% ask usage is consistent with solo project work (scoping, stats, drafting) where the research mode template adds friction rather than value.

**Early/late phase routing split confirms the learning arc in the telemetry.** Willson registered 0 overrides in his early phase (first half by message count) and 13 overrides in the late phase — all 2 research messages were also in the late phase. This is the most temporally structured routing arc in the study: Willson let the classifier run for the first half, then took increasingly deliberate manual control. Royston's split is the inverse in structure: 3 ask messages in the early phase (all manual), then 3 research messages in the late phase — also all manual. His early phase was exploratory Ask only; he deferred research trials to the second half. This resolves the apparent contradiction between the cleaned notes (which describe him as Ask-only) and the telemetry showing 3 research messages: the notes reflect his stated settled behaviour, the telemetry shows the exploration arc preceding it. Aly's override rate was 50/50 throughout (5 early, 5 late), confirming consistent deliberate engagement across the whole session rather than a learning arc.

**Research mode prompt rigidity is the recurring AQ1 obstacle.** Both Aly and Royston explicitly noted Research mode outputs felt templated and did not match their intent — the mode generated structured reports that restated the question rather than retrieving grounded information. This is not a routing bug but a design issue: the Research mode label creates a retrieval expectation the prompt structure does not meet. This finding bridges AQ1 (users tried research, were disappointed) and AQ2 (output epistemic status unclear).

**Post-session Q4:** All three reached mode distinction understanding by session end; Willson and Aly reported it changed their use. Royston understood clearly but did not report changed behaviour — consistent with his Ask-dominant pattern and explicit preference for familiar affordances.

**D3 flag — Royston insight count of 2:** Royston generated 2 genuine insights across a 6-message, ~42-minute solo session. Willson and Aly each generated 6 insights with far greater message volume. The low count most likely reflects his minimal message volume and feature-avoidance stance (explicitly did not touch features he did not understand) rather than a data quality gap. His export is structurally intact; the 2 remaining insights after seed removal are research type.

---

## AQ2 — Traceability and Trust

**Engagement without legibility payoff: the most analytically precise AQ2 finding in the dataset.**

Aly rated source legibility "Difficult" in the post-session survey, yet generated 4 traceability clicks and 2 tab changes — the second-highest solo interaction count of any Session 2 participant. She actively navigated the traceability UI and still could not resolve her provenance concern. This distinguishes her experience from non-engagement: she engaged and was not satisfied. Her explicit feedback framed the issue as output feeling like "opinion rather than fact" — not attribution legibility per se, but the epistemic status of AI output. She could not determine whether suggestions were grounded in anything verifiable, regardless of what the traceability UI showed.

Royston registered 5 genuine traceability clicks with 0 tab changes — the highest genuine click count in any Session 2 context — combined with 0 context saves and Ask-only usage (post-discovery). One of the 6 raw clicks was to a pre-session seed insight (the Quick Start Help suggestion, age ~1015 minutes at time of click — created the day before the session). This is excluded from the genuine count. His pattern suggests curiosity-driven traceability exploration early in the session, without sustained or directional use. The 5 genuine clicks against 0 tab changes indicates he was clicking markers in the chat view without navigating to the right panel, possibly not realising the two panels were linked.

Willson registered only 1 traceability click but rated source legibility "Easy" and found attribution clear from the inline UI. His limited click count alongside a positive legibility rating suggests the chat-inline display was sufficient for his needs — he did not need to navigate the traceability links because the AI attribution in the chat view was clear enough. This points to the chat-inline attribution as the more effective legibility surface for users who do not naturally explore panel navigation.

**Willson's 8 tab changes and 3 traceability clicks in Group AI_ON** (versus 0 tab changes and 1 click in solo) is the sharpest intra-participant engagement shift in Session 2. The 3 clicks were all to fresh content (ages 6s, 2s, 7s — all `final_status=new`) and reached three different insight types (research, action, suggestion), consistent with him systematically sampling the right panel rather than following up on a specific output. Combined with the 8 tab changes, this is a qualitatively different right-panel engagement pattern than any other participant in Group AI_ON — Aly and Royston each registered 0 traceability clicks in that phase. He was the only participant to actively navigate the right panel in the group context, which may reflect his role as the designated flat-search driver.

**Cross-participant pattern (AQ2 key finding):** All three entered with identical provenance concern (Q3 uniform: "moderately important"). They exited with substantially different experienced legibility: Willson easy, Royston very easy, Aly difficult. The divergence originated in depth of mode engagement, not in traceability feature access. Aly's Research mode use (5/10 messages) exposed her to templated, opinion-framed outputs; Willson's Ask-dominant use produced more conversational, apparently attributable responses. The traceability feature was equally accessible to all three, but the legibility outcome was shaped by what was being traced rather than whether tracing was possible.

**No dismissed-content concern in Session 2.** All genuine traceability clicks in Session 2 reached insights with `final_status=new` — no status changes occurred in S2 (zero `insight_status_changed` events from anyone). Aly's 4th click reached a research insight with age 31.6 minutes — a backward reference to content generated significantly earlier in the session, suggesting cross-checking rather than immediate follow-up. All other genuine clicks were to fresh content (age <6 minutes at click time).

**S2 traceability click evidence (from `traceability_with_status.csv`):**

| Time | Participant | Phase | Event | Type | Age | Status@Click | Title |
|---|---|---|---|---|---|---|---|
| 07:26:05 ×2 | Aly | Solo | focus_insight_from_marker | research | 37s | new | Research Analysis Report: Independent Samples t-Test |
| 07:26:40 | Aly | Solo | focus_insight_from_marker | action | 21s | new | Research how to run an independent samples t-test |
| 07:34:04 | Royston | Solo | focus_insight_from_agent_message | — | ~1015m† | new | (no insight metadata — Quick Start Help seed) |
| 08:05:22 | Royston | Solo | focus_insight_from_marker | research | 7s | new | Context and Objective |
| 08:07:41 | Willson | Solo | focus_insight_from_agent_message | summary | 38s | new | Key Discussion Points |
| 08:08:50 | Aly | Solo | focus_insight_from_marker | research | 1898s | new | Research Analysis Report: Cultural Issues in Singapore |
| 08:10:24 ×2 | Royston | Solo | focus_insight_from_marker | research | 126–309s | new | Context and Objective |
| 08:10:33 | Royston | Solo | focus_insight_from_marker | research | 318s | new | Context and Objective |
| 08:11:00 | Royston | Solo | focus_insight_from_marker | research | 162s | new | Context and Objective |
| 08:20:34 | Willson | Group AI_ON | focus_insight_from_marker | research | 6s | new | Context and Objective |
| 08:20:57 | Willson | Group AI_ON | focus_insight_from_marker | action | 2s | new | Explore rental listings in Bugis |
| 08:22:35 | Willson | Group AI_ON | focus_insight_from_marker | suggestion | 7s | new | *Explore Queenstown Housing Options |

†Seed: Quick Start Help created 2026-03-24T14:39:17 (day before session); clicked ~17 hours later at 07:34:04. `focus_insight_from_agent_message` events carry no insight metadata in the traceability export — identification as seed based on timing and absence of any participant-generated insight at that point in Royston's session. Excluded from the genuine count (5 genuine, not 6).

**Facilitator event scope — S2:** 183 raw facilitator (user1) events across S2 timeline files, of which 37 are substantive (excluding `link_hover`, `team_switched`). These include setup activities (`test_user_switched`, `task_context_panel_toggled`), pre-session navigation (`focus_insight_from_agent_message`, `right_panel_tab_changed`), and session exports (17:31:39–17:31:59). **Zero `insight_status_changed` events** in S2 from anyone — no accept/dismiss workflow activity occurred. All 22 S2 insights have `status_transitions=[]`. One facilitator `focus_insight_from_marker` event at 08:22:32 in Group AI_ON occurred 3s before Willson's 08:22:35 click to the same "*Explore Queenstown" suggestion — temporal proximity but `focus_insight_from_marker` is a navigation event, not a status change; the facilitator viewed but did not modify the insight. No status-change concern in Session 2.

---

## AQ3 — Shared Understanding

**Strongest proactive context engagement in the study, followed by individual divergence that decoupled it.**

Context was set at the start of the group AI_ON phase faster and more deliberately than in any other session. Aly opened and saved the panel within 70 seconds of the group task starting (08:14:08 → 08:15:18). This likely reflects the task's concrete parameter structure — flat finding involves obvious shared criteria (location, budget, commute), making the context panel's purpose immediately legible.

**Bilateral context management (D1):** Willson and Aly both promoted context via the draft pathway — Willson at 08:19:46 and 08:19:57, Aly at 08:22:44 and 08:23:06. This is the only instance in the study of multiple participants independently updating shared context during a live group task. Royston did not engage with context at any point in any phase. The bilateral activity is a positive AQ3 signal — two of three participants actively maintained shared context — but the third participant's complete non-engagement means the shared constraint layer was only partially owned.

**AI_LIGHT context promotes (D2 — resolved):** Aly promoted twice during the AI_LIGHT condition (08:36:50, 08:43:40). These promotes were **not** silently discarded. Code inspection confirms the same mechanism as Session 3: the frontend auto-prepends `@agent` to any message sent after a promote (`shouldForceAgentInvoke = draftContexts.length > 0`), routing it as an explicit agent request — the one AI invocation type permitted in AI_LIGHT. Aly's promoted context was live input to each subsequent agent response. The constraint behaviour seen in AI_LIGHT is therefore a context retention or instruction-following limitation across turns, not a mechanical drop of the promoted data.

**AQ3 central finding — context and coordination were decoupled:** Despite the well-set shared context, the group session proceeded as three parallel individual AI threads rather than a shared reasoning process. Each participant pursued private AI conversations, often on tangents from the group task. The context panel established shared parameters but did not produce shared reasoning. The AI's emergent facilitative role — making uncontroversial, group-safe decisions that kept the task loosely on track — was recognised and named by Aly ("a teammate giving opinions") but evaluated negatively: three people were already present for this function. The AI's coordination contribution was social rather than structural, and the mechanism (shared context panel) and the outcome (loose coordination) were effectively unconnected.

**Context artifacts as catch-up resource — new joiner observation (log-verified):** Willson disclosed a west-side commute constraint mid-conversation at 08:19:30 ("guys i need go the west"). The next agent response at 08:20:01 (31 seconds later) correctly incorporated it — reframing the recommendation from east/central to "a central location that accommodates everyone's needs" — without re-prompting or a context panel update. No other participant repeated or reinforced the constraint; the agent inferred the correct compromise from Willson's single statement. The constraint persisted through the session: the final recommendation at 08:25:40 (10 minutes later, after 13 more messages) remained consistent with it (Queenstown, Bugis, Toa Payoh — all central or westward-accessible). Both AI-generated summaries produced from 08:20:28 onward reference "Participant 01's need to be near the west" — confirming the constraint was captured and retained in the session's summary artifacts. The context and summary artifacts produced during a group session therefore appear to function simultaneously as catch-up resources for latecomers, with at least one participant independently identifying this function unprompted during debrief.

---

## AQ4 — Coordination Support

**Strongest session for AQ4 evidence across the study.**

All three pre-session mental models were personal productivity or note-taking frames — Notion-style organiser (Willson), lightweight summary layer (Aly), centralised tabs (Royston). None anticipated coordination support as the tool's primary function. This is a clean cross-participant baseline for the AQ4 expectation gap and replicates the Session 1 finding across a larger, different participant group.

**Unanimous AI_LIGHT preference post-session** is the clearest cross-participant preference signal in the data so far:

- **Willson:** Preferred AI_LIGHT explicitly; attributed this to information overload — the right-panel content felt overwhelming in the full version.
- **Royston:** AI_LIGHT felt faster and helped focus; seeing all right-panel features simultaneously was "a lot to process."
- **Aly:** Too many functions in the full version; AI_LIGHT is neater; does not have to figure out the limits of each feature.

This unanimous direction — three independent participants converging on the simpler condition — validates the Session 1 finding and strengthens the cross-session pattern. It is notable that feature preference converged despite different solo usage profiles: Willson (high engagement, 6 insights), Aly (moderate, 6 insights, Research mode explored), and Royston (minimal, 2 insights, Ask-only) all arrived at the same conclusion.

**Depth-first individual AI tangent pattern:** The workspace appears to subtly encourage individual AI interaction at the expense of group convergence. Rather than the AI facilitating shared decision-making, participants each developed private AI threads, using the shared workspace as a backdrop rather than a collaborative medium. The AI's facilitative outputs were sufficient to prevent complete task divergence but insufficient to drive convergence. This is the most nuanced AQ4 finding in this session.

**Aly's human reply prominence note** is the most actionable design-level AQ4 finding: the tool's visual hierarchy currently makes AI responses more prominent than human messages in the chat view, inverting the relational priority that a collaborative workspace should have. This specific observation — made spontaneously and unprompted — is precise enough to translate directly into a UI hierarchy requirement.

---

## Cross-Cutting Notes

**Royston routing arc:** The cleaned notes describe Royston as Ask-only; the telemetry shows 3 manual-ask and 3 manual-research messages (100% overridden). The early/late phase split resolves the apparent contradiction: his early phase was 3 manual-ask messages only, with all Research mode trials deferred to the second half of his session. The notes reflect his settled post-exploration behaviour; the telemetry captures the full learning arc.

**Willson Group AI_ON right-panel engagement:** Willson registered 8 right-panel tab changes and 3 traceability clicks (all fresh content, all `new`) in the group AI_ON phase versus 0 tab changes and 1 click in solo. No other S2 Group AI_ON participant registered any traceability clicks. This is either a task-driven effect (flat finding produced diverse insight types worth sampling) or a role effect (Willson as primary flat-search driver). See AQ2 for detail.

**Context pathway diversity:** Three distinct context management pathways were observed in Session 2: formal panel save (Willson and Aly solo, Aly group AI_ON), draft context promote (Willson and Aly group AI_ON, Aly group AI_LIGHT), and zero engagement (Royston, all phases). The diversity suggests the promote pathway is a genuine alternative affordance for participants who engage with the right panel, not a fallback for those who cannot find the save button.

**Insight workflow — all insights remained `new` throughout Session 2:** No `insight_status_changed` events were recorded for any S2 insight. All 22 S2 insights have `final_status=new` and `status_transitions=[]`. The workflow feature was present and functional; nobody used the accept/dismiss mechanism in this session. S2 is the only session with zero workflow events.

**No bugs to caveat:** Session 2 ran on the fixed codebase (dismissed items, `/research` deletion, and verbosity fixed before this session). Findings are not contaminated by known Session 1 confounds.

---

## Open Items Before Finalising

| Ref | Item | Needed for |
|---|---|---|
| B3 equivalent | ✅ Confirmed clean — zero `insight_status_changed` events in S2; all 22 insights have `status_transitions=[]`. No workflow operations by anyone. | — |

---

## AQ Contribution Summary

| AQ | Signal Strength | Key Finding |
|---|---|---|
| AQ1 | Moderate–strong | 100% override for Aly and Royston signals low initial classifier trust; within-session learning arc clear (all three reached mode understanding by end); Research mode prompt rigidity is the primary design-level routing obstacle |
| AQ2 | Moderate | Traceability engagement without legibility payoff (Aly); source legibility divergence from uniform pre-session provenance concern is the sharpest cross-participant AQ2 pattern |
| AQ3 | Strong | Fastest proactive context-setting in study; bilateral context promotes (D1) confirmed; depth-first individual AI threads decoupled context from coordination outcomes; west-side constraint uptake log-verified (31s, 08:19:30→08:20:01, no re-prompting required) |
| AQ4 | Strong | Unanimous AI_LIGHT preference across 3 independent participants; depth-first AI tangent pattern; human reply prominence as precise design requirement |
