# Session 4 — Analysis

**Date:** 2026-03-29  
**Participants:** Val (P1), Jen (P2)  
**Structure:** Solo AI_ON (P1 & P2 separately) → Group AI_ON (flat planning, Singapore) → Group AI_LIGHT (trip planning, hiking constraint)  
**Researcher notes source:** `4-cleaned.md`  
**Data quality note:** Smallest participant group (2). Instrumentation tweaked mid-study: `insight_generate_completed` timeline events are back (absent in S2–S3), restoring direct generation telemetry. Reply-context bug fixed before this session. Auto-classification described as "largely non-functional" by the researcher — the classifier ran and accepted messages but defaulted to Ask for almost everything; participants had to manually override to Research mode. Some features deliberately disabled (end-of-day reminders, certain autonomous rule functions). No blocking bugs encountered during the session.

---

## Telemetry Summary

| Context | Total Msgs | Auto-Ask | Auto-Research | Manual-Ask | Manual-Research | Override Rate | Insights Generated | Traceability Clicks | Context Saves | Draft Promoted |
|---|---|---|---|---|---|---|---|---|---|---|
| Val Solo (AI_ON) | 11 | 3 | 0 | 4 | 4 | 73% | 6 | 2 | 0 | 2 |
| Jen Solo (AI_ON) | 10 | 1 | 0 | 8 | 1 | 90% | 6 | 21 | 3 | 3 |
| Group AI_ON — Val | 10 | 6 | 0 | 3 | 1 | 40% | — | 1 | 0 | 0 |
| Group AI_ON — Jen | 20 | 13 | 0 | 5 | 2 | 35% | — | 1 | 1 | 0 |
| Group AI_ON total | 30 | 19 | 0 | 8 | 3 | 37% | 3* | 2 | 1 | 0 |
| Group AI_LIGHT — Val | 7 | 1 | 0 | 6 | 0 | 86% | — | 0† | 0 | 0 |
| Group AI_LIGHT — Jen | 13 | 6 | 0 | 7 | 0 | 54% | — | 0† | 0 | 0 |

*Group AI_ON insight count: 3 unique insights (all research type, all titled "Context and Objective") per the export JSON. The timeline file records 6 `insight_generate_completed` events because each insight fires an event attributed to each participant's triggering message context. Export is authoritative.  
†AI_LIGHT condition: no right panel, no insights generated, no traceability possible. Zero is structural.

**Telemetry notes:**

- **Instrumentation change from S2–S3.** Session 4 restores `insight_generate_completed` timeline events, providing direct generation telemetry comparable to Session 1. Sessions 2–3 relied on `export_fallback` (reading the full JSON export's `insights` array) because `insight_generate_requested/completed` events were not instrumented. The S4 data source is `timeline_event` for all 18 insight generation rows in `insight_generations.csv`. Cross-session insight counts remain comparable after seed filtering; the data source column in the CSV distinguishes the reconstruction mechanism.

- **Seed data.** Both participants have one pre-seeded "Quick Start Help" suggestion at 2026-03-29T07:33:22 (~21 minutes before session start). Unlike S2–S3 seeds (created the day before, 13–17h gap), S4 seeds were created the same day, making age-based detection less effective — at session start they were only ~21 minutes old. Both seeds were accepted within the first 4 minutes of the session (07:54:13 for Val, 07:58:05 for Jen — likely by the participants themselves; A4 instrumentation bug attributes all `insight_status_changed` events to `user1`). Neither participant clicked the seed insight during the session. Post-filter genuine insight counts: Val 6 (4 research, 1 action, 1 suggestion), Jen 6 (2 suggestion, 2 research, 1 summary, 1 action), Group AI_ON 3 (3 research).

- **All routing splits** are exact values from `output/routing_summary.csv`.

- **Research jobs.** Zero `research_job_requested` events across all S4 contexts — consistent with S2–S3. The async ResearchJobController pathway (exercised in S1 only) was not invoked. Research mode routed to `generateReport` with the `research-analyst` archetype.

- **Context saves and Draft Promoted** come from `output/context_events.csv`. Val had 0 formal context saves and 2 `draft_context_promoted` events (08:13:52, 08:18:11 — both late in the solo phase, after message 10/11). Jen had 3 context saves (first at 07:55:58, after message 1) and 3 draft promotes — active context management from the start of her session. In Group AI_ON: Jen 1 save (08:28:25), 0 promotes; Val 0 engagement. In Group AI_LIGHT: Val opened the context panel 4 times but made no saves or promotes.

- **AI toggle changes.** Jen made 4 `team_ai_toggle_changed` events in Group AI_ON between 08:30:56 and 08:31:14 (18 seconds). This is the only instance in the study of a participant toggling the AI on/off during group work. Consistent with Val's observation about "turning on and off assistant" being useful.

- **Tab changes:** 0 across all S4 contexts. No right-panel tab navigation events were recorded for either participant.

---

## Pre-Session Survey

| | Val (P1) | Jen (P2) |
|---|---|---|
| Group work frequency | Sometimes | Sometimes |
| Importance of AI source | Moderately important | Moderately important |
| Prior collaborative AI use | No, never | No, never |
| Confidence (pre-session) | 4/5 | 3/5 |

**Notable baseline:** Identical survey profiles — both "Sometimes" group work, both "Moderately important" AI source, both "No, never" collaborative AI use. This is the most homogeneous pre-session baseline in the study. Val's higher confidence (4/5 vs Jen's 3/5) is the only differentiator. Neither has prior collaborative AI experience, unlike S3's Shanyl (regular user) or Aung (thought about it). The post-session divergence (see below) is therefore not attributable to pre-existing AI literacy gaps.

---

## AQ1 — AI Routing Behaviour

**Val produced the highest solo Research mode usage rate in the study (36%) and the earliest sustained Research engagement — from her third message onward.**

Val's routing arc is the inverse of the S2–S3 pattern. Where S2–S3 participants deferred Research mode trials to the late phase (Royston: 0 early, 3 late; Aung: 1 early, 1 late), Val used force Research mode from the start: her 3rd through 6th messages were all manual-research overrides. Her early phase was 2 ask / 3 research (60% research); her late phase was 5 ask / 1 research. This is a front-loaded Research engagement arc — she explored Research mode first, then settled on Ask for the remainder. The cleaned notes confirm this interpretation: Val "used force Research mode, decided on theme without the help of the assistant" then found the fixed insight structure "less useful because of its rigidity" as complexity increased.

**Val discovered Ask Assistant late.** The cleaned notes record Val discovering Ask Assistant only "nearing end of solo section" — by which point she had already used 4 Research mode messages. This is the most notable AQ1 discovery ordering in the study: the participant used the more complex mode first and the simpler mode second, suggesting the Research button's visual prominence or positioning outcompeted Ask Assistant's discoverability.

**Jen's 90% override rate masks a substantially different problem.** Jen's first action was "wat can you do for me" — typed in the wrong input location (not the assistant chat). The classifier accepted this (auto-ask, no override). Her subsequent 9 messages were all manual overrides, but her early exploration was of the help and reply features, not the routing modes. Her override rate reflects exploration-driven correction rather than deliberate routing design comprehension. The cleaned notes confirm: she "tried what can you do for me, but not assistant chat, was not answered." Her routing behaviour is better characterised as compensatory (correcting the classifier's Ask default) rather than strategic (choosing between modes).

**Research mode prompt rigidity confirmed — now with explicit structural feedback.** Val's experience adds a new dimension to the S2–S3 Research mode critique. She reported that the fixed insight structure (Research report template with risks, open questions, etc.) was initially useful for the research paper task but became limiting as the task grew more complex. This is the first participant to express a conditional judgement: Research mode is useful when the task fits the template and limiting when it doesn't. S2–S3 participants characterised Research as uniformly disappointing; Val's view is more nuanced and suggests the mode has genuine utility for a subset of tasks.

**Auto-classification non-functional in practice.** The researcher noted auto-classification was "largely non-functional" during S4. The telemetry partially confirms this: the classifier routed ALL non-overridden messages to Ask mode (0 auto-research across all S4 contexts). However, "non-functional" is imprecise — the classifier was active and running (it returned route decisions with confidence scores averaging 0.836 for Val and 0.95 for Jen). The issue was that it never autonomously selected Research mode, making the routing distinction invisible to participants who did not manually override. Val's observation about the AI not routing correctly despite distinction being noted is consistent: she understood the modes conceptually but the auto-classifier never demonstrated the distinction in practice.

**Group phase override rates dropped substantially** — Val from 73% (solo) to 40% (group AI_ON), Jen from 90% to 35%. This matches the S2–S3 pattern: shorter, more conversational group messages are auto-classified as Ask without correction. The AI_LIGHT override rates present an unexpected inversion: Val 86% and Jen 54%. Val's high AI_LIGHT override rate reflects her manual Ask mode selections even in the chat-only condition — an over-engagement pattern consistent with her front-loaded routing exploration.

**Post-session Q4:** Val rated *Understood clearly* — the highest clarity score in the study alongside S1. Jen rated *Rough idea* — matching S3. The divergence maps directly to Research mode engagement depth: Val's sustained front-loaded Research use built experiential differentiation; Jen's Ask-dominant usage never provided a contrastive experience to distinguish the modes.

---

## AQ2 — Traceability and Trust

**Jen produced the highest individual traceability click count in the entire study (21 clicks) using a unique insights-panel-scroll strategy.**

Jen's 21 solo clicks are more than triple the next-highest solo count (Aung S3: 7, Shanyl S3: 5 genuine). All 21 occurred in the solo phase. Of these, 11 are `focus_chat_marker_from_insight`/`jump_to_chat_marker` pairs (bidirectional navigation from insight panel to chat), 6 are `focus_insight_from_marker` (chat to insight panel), 2 are `focus_insight_from_agent_message` (agent message to insight), indicating systematic cross-referencing between the two panels. The cleaned notes confirm: Jen used insights panel scroll as her traceability strategy — the only participant in the study to do so. Where other participants navigated from chat markers to insights (chat → panel direction), Jen primarily navigated from the insights panel back to chat (panel → chat direction), suggesting she treated the right panel as the primary navigation surface.

**Jen's clicks clustered around three insights with accepted status (likely Jen's own actions — solo phase, A4 instrumentation bug):**

| Time | Event | Insight | Type | Age | Status@Click | Final Status |
|---|---|---|---|---|---|---|
| 07:56:42 ×4 | bidirectional pairs | *Develop a Weekly News Aggregation Plan | suggestion | 23s | new | new |
| 08:04:40 ×4 | bidirectional pairs | *Outline the Research Paper Structure | suggestion | 46–51s | new | accepted |
| 08:05:31–52 ×2 | focus_insight_from_agent_message | Context and Objective | research | 13–34s | new | new |
| 08:13:50–08:15:30 ×11 | mixed bidirectional | Define specific focus areas | action | 27–127s | new | accepted |

The "*Outline the Research Paper Structure" insight was accepted at 08:04:40 — the exact same timestamp as Jen's clicks. This is most likely Jen accepting the insight and tracing its context in the same interaction (solo phase — A4 instrumentation bug attributes all `insight_status_changed` to `user1`). The "Define specific focus areas" action insight was accepted at 08:13:44, 6 seconds before Jen's first click at 08:13:50. In both cases `status_at_click=new`, indicating the acceptance had not yet propagated on the client when the traceability click was recorded. These timestamps represent Jen's natural accept-then-trace workflow — not a "coincidence" with an external actor.

**Val's 2 solo clicks are sparse but diagnostic.** Her clicks at 08:19:33 (research, age 835s) and 08:19:53 (action, age 505s) are both to insights created 8–14 minutes earlier — backward references to content from the mid-session Research phase, revisited during her late-session Ask phase. The ages triggered the deep audit's seed candidate flag (>600s threshold) but these are genuine insights, not seeds. The "Research Analysis Report: Local Urbanization" research insight was created at ~08:05:38 by Val's own Research message; the action "Research the impact of new infrastructure" was created at ~08:11:28. Val's traceability pattern is review-oriented: revisiting earlier structured outputs to inform later Ask interactions.

**Group AI_ON: 2 clicks (1 per participant).** Val clicked one insight at 08:29:32 (research, "Context and Objective", age 42s — fresh). The second group click is from Jen. These low counts are consistent with the S2–S3 group pattern where insight traceability drops sharply in collaborative phases.

**No seed clicks in S4.** Unlike S2 (Royston: 1 seed click, age ~1015 min) and S3 (Shanyl: 4 seed clicks during pre-session cycling), neither S4 participant clicked the Quick Start Help seed insight. This is structurally consistent with the seeds being accepted within the first 4 minutes (likely by the participants themselves) — the accepted status may have deprioritised them in the UI, or the participants simply navigated past them to newer content.

**Post-session Q1 divergence is the sharpest in the study and directly confirms the Q1 framing ambiguity.** Val rated source legibility "Easy" but verbally said "not sure where facts came from." Jen rated "Difficult." Both verbal responses express source provenance uncertainty. The survey question measures interface legibility ("can I see what the AI produced"), not epistemic provenance ("do I know where the AI's claims come from"). Val's "Easy" reflects that she could identify AI outputs in the interface; her verbal caveat reflects that she could not determine their epistemic grounding. This is the clearest within-session confirmation of the Q1 framing ambiguity flagged across S1–S3, and the two dimensions (interface legibility vs. epistemic provenance) should be treated as distinct in the AQ2 analysis.

---

## AQ3 — Shared Understanding (Context Panel & Constraint Propagation)

**Context panel was not used at the start of the team AI_ON phase by either participant — the latest context engagement onset in the study.**

In previous sessions, at least one participant engaged with context within the first 2 minutes of the group task (S2: Aly at 70s; S3: Shanyl immediately). In S4 Group AI_ON, the first context event was Jen opening the panel at 08:27:49 (296s / ~5 min after the group task started at ~08:23) and saving at 08:28:25. Val registered no context engagement in the group phase at all. The cleaned notes confirm: "no edit context used until midway through the planning."

**Solo context engagement diverged sharply.** Jen opened the context panel 86 seconds into her solo session (07:54:32), saved at 07:55:58 (after message 1), and made 3 total saves — the most systematic solo context management in S4. Val had no context saves and 2 late-session draft promotes (08:13:52, 08:18:11 — both after message 10 of 11). This matches the S3 pattern (Shanyl: immediate panel engagement; Aung: late context engagement via promotes) but in S4 neither solo participant matched Aung's intensive promote-driven context management (S3: 21 solo promotes).

**Constraint introduction and incorporation.** The east-commute constraint in Group AI_ON was introduced by the facilitator, not the participants — "a real user joining with that actual constraint would have resulted in more of a context update instead" (cleaned notes). The constraint was treated as a conversational planning parameter rather than a context panel update, consistent with the S1 P2 bypass pattern. Val noted the AI incorporating content from previous messages (private residence idea from an earlier solo message), suggesting the Ask Assistant prompt's conversation-history inclusion is doing the contextual heavy lifting rather than the explicit context panel.

**AI toggle changes as a context signal.** Jen's 4 AI toggle changes in Group AI_ON (08:30:56–08:31:14) are unique in the study. In the cleaned notes Val described "turning on and off assistant" as useful. This may reflect an emerging mental model where the AI toggle serves as a context control mechanism — enabling the AI when structured output is wanted and disabling it for free conversation — rather than the context panel serving that function. The panel was opened once; the toggle was changed 4 times.

**Group AI_LIGHT context engagement.** Val opened the context panel 4 times (08:45:56–08:47:16) but made no saves. This is browsing behaviour, not context management — consistent with the AI_LIGHT condition where the panel's utility is reduced (no insights generated to contextualise). Neither participant promoted context in AI_LIGHT, unlike S3 Aung's 5 promotes and S2 Aly's 2 promotes in AI_LIGHT.

---

## AQ4 — Coordination Support

**The AI compromised rather than splitting — the clearest demonstration of the AI's single-output limitation for multi-stakeholder coordination.**

In the Group AI_LIGHT trip planning scenario, the constraint was a friend who does not like hiking. The AI generated a compromise itinerary attempting to incorporate both hiking and non-hiking activities rather than proposing separate tracks for different preferences. Jen identified this as a coordination failure: "some may consider it the teammate dynamics in the prompt, whereas the users actually wanted to plan separate itineraries." This is the most precise participant description of the AI's coordination limitation in the study — the AI treats the group as a single entity with a single plan, when the coordination task requires managing divergent stakeholder needs.

**Jen's scenario swap observation is the most precise mode-to-task fit judgement in the study.** She concluded that Research mode would have been better suited to trip planning (research-heavy, lots of specific information needed) and AI_LIGHT better suited to flat planning (more conversational, less structured output needed). This directly addresses AQ4: the workspace supports coordination behaviour appropriate to the task, but the scenario-to-mode mapping must match. The current study design swapped the better mapping, producing a suboptimal experience.

**Group message volume: AI_ON 30 msgs, AI_LIGHT 20 msgs.** This inverts the S2–S3 pattern where AI_LIGHT consistently produced higher message volumes (S2: 30 vs 58; S3: 30 vs 51). The S4 inversion may reflect the smaller group size (2 vs 3), shorter group session spans (AI_ON ~11min, AI_LIGHT ~10min), or the specific task characteristics. With only 2 participants, the conversational overhead is lower and the AI_LIGHT "push to chat" effect is less pronounced.

**Pre-exposure mental models.** Val anticipated a workspace where she could "delegate tasks using the action items and the reply context" — envisioning sub-agents performing tasks like grading or reviewing work. This is the most forward-looking feature vision in the study, describing a multi-agent delegation model that exceeds the current tool's capabilities. Jen anticipated a moderator role for team dynamics and passive AI context reading — an ambient facilitation model fundamentally different from the tool's invocational design. Neither mental model was met, but both describe coherent design directions.

**Val's cross-participant AI invocation observation.** Val noticed that another user's message triggered AI responses in the group workspace — an unintended cross-participant invocation. This is an AQ4 coordination signal: in a shared workspace, one user's messages can trigger AI responses intended for another, creating coordination ambiguity about who the AI is responding to.

**Post-session survey divergence:**
- Val: Easy / Fully in control / Much more useful / Understood clearly — the most positive post-session profile in the study.
- Jen: Difficult / Mostly in control / Slightly more useful / Rough idea — moderate.

The divergence from identical pre-session profiles is substantial and traces to engagement depth: Val's front-loaded Research exploration and late Ask Assistant discovery produced a rich experiential basis for evaluation; Jen's initial orientation struggles and Ask-dominant usage did not.

---

## AQ5 — Contextual Catch-Up

No formal new joiner scenario run. Val's interest in delegating tasks to sub-processes through action items and reply context is tangentially relevant — it describes a persistent task tracking vision that would support catch-up, but is a future-facing design aspiration rather than observed behaviour. No participant-generated catch-up observations emerged in the post-session debrief, unlike S3's Shanyl (summary as onboarding mechanism for new joiners).

---

## Insight Status Events — Attribution Gap (A4)

**Session 4 has 6 `insight_status_changed` events, all carrying `actorUserId=user1` due to the A4 instrumentation bug.** In solo phases, the participant is the presumptive operator.

| Time | Context | Event | Detail | Likely Actor |
|---|---|---|---|---|
| 07:54:13 | Val Solo | insight_status_changed | new→accepted, suggestion (Quick Start Help seed) | Val |
| 07:58:05 | Jen Solo | insight_status_changed | new→accepted, suggestion (Quick Start Help seed) | Jen |
| 08:04:40 | Jen Solo | insight_status_changed | new→accepted, suggestion (*Outline the Research Paper Structure) | Jen |
| 08:11:56 | Val Solo | insight_status_changed | new→accepted, action (Research the impact of new infrastructure) | Val |
| 08:12:32 | Jen Solo | insight_status_changed | new→accepted, summary (Key Discussion Points) | Jen |
| 08:13:44 | Jen Solo | insight_status_changed | new→accepted, action (Define specific focus areas) | Jen |

Of these, 2 are Quick Start Help seed acceptances (events 1–2) and 4 are genuine insight acceptances (events 3–6). All transitions are `new→accepted`. No dismissals, no archives. All occurred during solo phases where participants were the active interface users.

**Impact on insight_workflow.csv:** The 5 `accepted` final statuses in S4 insight_workflow.csv most likely reflect participant judgement (Val and Jen accepting insights during their solo work). The `insight_status_changes.csv` being empty for these events is a consequence of the A4 bug (script3 filters on `is_study_user(actorUserId)`, which fails for the misattributed `user1` value).

**Jen's accept-then-trace workflow:**
- Event 3 (08:04:40 accept) and Jen's first traceability click at 08:04:40: same timestamp — Jen accepted the insight and traced its context in the same interaction.
- Event 6 (08:13:44 accept) and Jen's first click at 08:13:50: 6-second gap — Jen accepted the insight, then began tracing it.
- Both show `status_at_click=new`, confirming the acceptance had not yet propagated to the client when the traceability click was recorded.

Other user1-attributed events: 3 `session_export_requested`/`session_export_completed` at 08:59 (facilitator exporting session data — genuine facilitator actions).

---

## Cross-Cutting Notes

**Instrumentation change — S4 restores direct insight generation telemetry.** The `insight_generate_completed` events, absent in S2–S3 (requiring export_fallback reconstruction), are present in S4 timelines. This means S4 and S1 share direct timeline-event insight data, while S2–S3 use export fallback. The `data_source` column in `insight_generations.csv` distinguishes these: `timeline_event` for S1/S4, `insight_from_export` for S2–S3. Generation counts remain comparable after seed filtering; the reconstruction mechanism is the difference. Script3's `is_genuine_timestamp` filter required the addition of `"4": "2026-03-29"` to the `SESSION_DATES` map (without this, all S4 insight events were silently excluded).

**Val's Research-first routing arc is unique in the study.** Every other participant who used Research mode did so after an initial Ask-dominant phase (S2 Royston: Ask early, Research late; S3 Aung: mixed throughout). Val is the only participant to front-load Research mode and transition to Ask. Her conditional assessment of Research mode utility (good for structured tasks, limiting for complex ones) is therefore grounded in deeper mode experience than any other participant's Research evaluation.

**Jen's 21 traceability clicks vs 0 tab changes is an anomalous combination.** In S2, Willson registered 8 tab changes alongside 3 traceability clicks in Group AI_ON; in S3, Aung registered 4 tab changes alongside 7 clicks. Jen's pattern — maximum clicks with zero tab changes — indicates she navigated exclusively within the insights panel and chat view using marker links, without ever changing the right-panel tab filter. This may reflect the `focus_chat_marker_from_insight` / `jump_to_chat_marker` events being panel-internal navigation that doesn't trigger tab change events, or it may indicate she never explored the filtered views (Summaries, Actions, Suggestions tabs).

**Group AI_ON — 3 duplicate "Context and Objective" research insights.** All 3 insights generated in the group AI_ON phase share the same title ("Context and Objective") and type (research). This is a system-level observation: the insight generation pipeline produced identical-looking outputs for different triggering messages, suggesting the generation prompt template produces generic framing when the conversation context is still sparse (the group session was only ~11 minutes long with 30 messages).

**AI toggle as an interaction modality.** Jen's 4 AI toggle changes in 18 seconds during Group AI_ON are the only recorded toggle events in the study. Combined with Val's "turning on and off assistant is good" observation, this suggests the AI toggle is being discovered and used as a real-time AI engagement control — a lightweight alternative to routing mode selection that operates at the team level rather than the individual message level. This is a distinct interaction pattern from any prior session.

**No Research jobs in any S4 context.** `research_job_requested` count is 0 across all 4 S4 timeline files. This is consistent with S2–S3 (where the ResearchJobController async pathway was also inactive) and contrasts with S1 (where it ran for 2 messages). Val's 4 manual-research messages generated research-type insights (stored internally as `document`) via the synchronous `generateReport` pathway, the same pipeline as S2–S3 Research. The absence of the deeper async research prompt may partially explain Val's "rigidity" complaint — the template structure is the synchronous report format, not the broader research deep-dive.

**Session timeline:**
- 07:33:22 — Seeds created (Quick Start Help, both participants)
- 07:54:13 — Facilitator accepts Val's seed
- 07:54:14 — Jen's first message (session start)
- 07:54:21 — Val's first message
- ~08:14:15 — Val's last solo message (solo span: ~20 min)
- ~08:13:23 — Jen's last solo message (solo span: ~19 min)
- 08:25:21 — Group AI_ON first message (Jen: "haii")
- 08:37:49 — Group AI_ON last message (span: ~12 min)
- 08:47:45 — Group AI_LIGHT first message (Jen: "HAIIII")
- 08:58:33 — Group AI_LIGHT last message (span: ~11 min)
- Total session duration: ~64 minutes

**Bugs to flag for cross-session comparisons:**
- Reply-context bug was **fixed** before S4 (fixed 2026-03-29). S3 Shanyl's misleading-provenance observation is a study-period snapshot; S4 participants did not encounter it.
- Auto-classification described as "largely non-functional" — 0 auto-research classifications across all S4 contexts. The classifier was active (returned confidence scores 0.655–0.957) but never triggered Research autonomously. This is consistent with S2–S3 where auto-research was also essentially zero, suggesting a systemic classifier bias toward Ask rather than an S4-specific failure.
- Some features deliberately disabled (end-of-day reminders, certain autonomous rule functions) — these affect feature discoverability observations but not the core AQ analyses.
- Research mode output pipeline: same `generateReport` + `research-analyst` archetype as S2–S3 (not the S1 ResearchJobController async pathway). Val's conditional assessment ("initially useful, then limiting") applies to this synchronous template format.

---

## AQ Contribution Summary

| AQ | Signal Strength | Key Finding |
|---|---|---|
| AQ1 | Moderate–strong | Val's 36% Research rate is highest solo in study; front-loaded Research→Ask arc is unique in dataset; conditional Research mode assessment (useful for structured tasks, limiting for complex ones) is the most nuanced mode evaluation; auto-classifier never triggered Research autonomously (0 auto-research across all S4 contexts); Q4 divergence (Val *Understood clearly* vs Jen *Rough idea*) maps to Research engagement depth |
| AQ2 | Strong | Jen 21 solo traceability clicks (highest individual count in study, unique insights-panel-scroll strategy); Q1 divergence (Val *Easy* + "not sure where facts came from" verbal) is clearest confirmation of Q1 framing ambiguity; no seed clicks; 4 facilitator accepts with temporal proximity to Jen's clicks (lower-severity confound, see Facilitator Event Scope) |
| AQ3 | Moderate | Latest group-phase context onset in study (neither participant used context at group start); solo divergence (Jen: systematic from msg 1; Val: late promotes only); east-commute constraint treated conversationally not via context panel; AI toggle changes used as real-time AI engagement control (unique to S4) |
| AQ4 | Moderate | AI compromised rather than splitting itineraries — clearest single-output limitation for multi-stakeholder coordination; Jen's scenario swap conclusion is most precise mode-to-task fit observation in study; Val's cross-participant AI invocation observation is a coordination ambiguity signal |
| AQ5 | Weak | No new joiner scenario; Val's delegation vision is forward-facing design aspiration; no direct catch-up observations |
