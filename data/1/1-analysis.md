# Session 1 — Analysis

**Date:** 2026-03-19  
**Participants:** JC (P1), Samuel (P2)  
**Structure:** Solo AI_ON (P1 & P2 separately) → Group AI_ON (trip planning, KL) → Group AI_LIGHT (podcast concept)  
**Researcher notes source:** `1-cleaned.md`  
**Data quality caveat:** Thinnest data source of all three rounds. Bug encounters confound multiple signals (dismissed items reappearing, `/research` message deletion, response verbosity). Treat findings as directional baselines, not strong conclusions.

---

## Telemetry Summary

| Context | Total Msgs | Auto-Ask | Auto-Research | Manual-Ask | Manual-Research | Override Rate | Insight Requests | Traceability Clicks | Context Saves | Draft Promoted |
|---|---|---|---|---|---|---|---|---|---|---|
| JC Solo (AI_ON) | 7 | 1 | 1 | 5 | 0 | 71% | 1 | 0 | 0 | 4 |
| Samuel Solo (AI_ON) | 9 | 3 | 0 | 5 | 1 | 67% | 3 | 6 | 1 | 0 |
| Group AI_ON | 37 | 3 | 0 | 34 | 0 | 92% | 6 | 14 | 2 | 1 |
| Group AI_LIGHT | 29 | 22 | 0 | 7 | 0 | 24% | 0 | 0 | 0 | 1 |

**Telemetry notes:** JC solo insight count is 1 (export_fallback, the BGP document) — the original 0 reflected a timeline-event instrumentation gap, not absence of generation. Sam solo and Group AI_ON insight counts come from timeline events (`insight_generate_requested` + `insight_generate_completed` pairs = 2 rows per generation); sessions 2–3 use export_fallback (1 row per insight). Do not compare raw row counts cross-session. JC solo and Group AI_ON share `session_id = 0f54578d...` — discriminate by `file_key` or `team_id` in any join.

---

## AQ1 — AI Routing Behaviour

**Override rates are high but should be read as mode-locking, not per-message decisions.**

The telemetry pattern strongly suggests the routing override toggle behaved stickily: once a participant set a mode, subsequent messages retained that mode without re-engaging the classifier.

- **JC:** The auto-classifier correctly routed "compile some research on BGP..." to research mode (confidence 0.78). Immediately after seeing that output, JC manually overrode all 5 subsequent messages to ask and stayed there for the remainder of the session.
- **Samuel:** Manually overrode to research for the first technical question (MQTT/ESP32), then overrode all subsequent queries back to ask mode — including follow-up technical questions of comparable depth.
- **Group AI_ON:** Only 3 auto-classified messages (the very first few). From 09:41:15 onward — within 3 minutes of starting — every message was recorded as manual-override-ask. The team settled on ask mode collectively and early, making the 92% override rate an artifact of sticky mode selection rather than evidence of 92 active per-message routing decisions.

**Key finding:** Zero automatic research classifications occurred in the group AI_ON session. All insight generation (6 requests) was via slash command, which is a separate mechanism. This dissociation — mode override used to get chat responses, slash commands used for panel content — suggests participants understood the distinction operationally but did not reach it through the routing UI as designed.

JC explicitly noted that deciding which category to assign added cognitive load. Samuel's back-and-forth (research → ask for queries of similar depth) suggests the distinction was not stable or legible to either participant. The routing legibility problem is upstream of mode choice: JC did not know when a message would trigger the AI at all, making deliberate mode selection as a concept not yet possible at this exposure level.

**Bugs present in this session:** The `/research` slash command caused message deletion. This is likely why Samuel — who did use research mode in his solo session — sent zero research-mode messages via slash command in the group session, where the bug would have been live.

---

## AQ2 — Traceability and Trust

**22 traceability events total across Session 1 AI_ON contexts — the feature was discovered and used.**

- **JC solo:** 2 events — both on the same insight, a bidirectional pair (`jump_to_chat_marker` + `focus_chat_marker_from_insight`). JC navigated from the right panel back to the originating chat message once. No further traceability engagement.
- **Samuel solo:** 6 events — all `focus_insight_from_marker` (chat → right panel direction), on 4 distinct insights. Samuel actively cross-referenced research insights from the chat view.
- **Group AI_ON:** 14 events nominally, but a cross-reference of clicked insight IDs against facilitator `insight_status_changed` events (B3 resolved) reveals a significant confound. All 4 insight IDs that received clicks were also operated on by the facilitator. The merged event sequence:

  | Time | Actor | Action | Insight |
  |---|---|---|---|
  | 09:38:56 | Facilitator | dismissed | JB suggestion |
  | 09:39:22 | P1 | click | Context+Obj #2 (live ✓) |
  | 09:39:42 ×6 | P1 | click | JB suggestion (dismissed 46s earlier ✗) |
  | 09:40:10 | Facilitator | dismissed | Context+Obj #1 |
  | 09:40:20 | Facilitator | dismissed | Context+Obj #2 |
  | 09:43:54 ×4 | P1 | click | JB suggestion + both Context+Obj docs (all dismissed ✗) |
  | 09:52:47 | P1 | click | Bus operators doc (live ✓) |
  | 09:52:53 | P2 | click | Bus operators doc (live ✓) |
  | 09:55:21 | Facilitator | accepted | Bus operators doc |
  | 09:57:27 | P1 | click | Bus operators doc (accepted ✓) |

  Result: **10 of 14 clicks were to already-dismissed insights; only 4 were to live/accepted content.** Whether the UI hid dismissed insights at the time is not recoverable from the export — if dismissed items were hidden, most of the 09:39–09:43 traceability activity would have failed silently. If they remained visible, clicks still represent engagement with invalidated content. Either way, the group AI_ON traceability count is not reliable evidence of functional traceability use. The two solo contexts (JC 2 events, Samuel 6 events) are unaffected by this confound.

**However, trust remained low — and the driver was not the traceability design.** Explicit debrief feedback linked low confidence in AI output to the absence of live internet search access. Participants expected web-grounded responses and did not receive them. The traceability feature was visible and functional, but the underlying provenance concern ("where does this information actually come from?") was about internet access, not insight-to-message linkage. These are distinct concerns and should be kept separate in the AQ2 analysis: traceability was engaged with, but trust problems this session are a search-access confound rather than a traceability design signal.

---

## AQ3 — Shared Understanding (Context Panel & Constraint Propagation)

**The most analytically clean finding from Session 1 maps here.**

The context panel telemetry provides direct behavioral evidence of constraint bypass:

- P1 (`study-user-04-01`) saved context at 09:37:43: *"we are planning a weekend trip. it's got 2 people. it should be of middling budget - maybe $200."* Amended at 09:37:59 to add "from Singapore." Context was set deliberately and early.
- P2 (`study-user-04-02`) **opened the context panel at 09:47:14** — 10 seconds before stating the hiking constraint — then **closed without saving at 09:47:24**. Nine seconds later, at 09:47:33, P2 typed *"i dont like nature hikes"* directly into the chat.

This 10-second event window is the clearest observable signal in Session 1. P2 cognitively considered the context panel as the place to record the constraint but chose not to use it, defaulting immediately to verbal chat. Whether this reflects unclear affordance (not understanding what the panel is for), UI friction (inconvenient to type and save), or genuine preference for the conversational medium is not resolvable from telemetry alone — but the action sequence is unambiguous.

The downstream consequence: the constraint existed only as a chat message. There is no telemetry or route data showing any AI response that incorporated the hiking objection after P2 stated it. AI queries continued framing the trip as a food-and-hiking trip until the constraint was re-negotiated conversationally. This matches the AQ3 note in the cleaned record: the constraint bypassed the system, propagated via conversation, but was unverifiable in AI outputs.

**Additional signal:** JC solo opened the context panel once (09:19:01), opened it in edit mode, then closed it after 1 second without saving. However, JC used `draft_context_promoted` 4 times during his solo session (09:21–09:23) — twice from the BGP research insight and twice from an AI reply. This is a different context update pathway: rather than opening and editing the context panel, JC was promoting AI-generated content directly as a draft context. The 0 formal saves therefore does not mean JC ignored context management; it means he engaged with an alternative promotion mechanism. This reframes his AQ3 contribution: context engagement was present but routed through a different affordance than the panel save workflow.

---

## AQ4 — Coordination Support

**Session 1 produced the strongest AQ4 signal of any session, confounds notwithstanding.**

Both participants' feedback converged independently on the same preference: a simpler, chat-integrated AI. Neither wanted a structured workspace:

- **JC:** Right panel not valued; preferred not querying via group chat; responses too long; interface too cluttered.
- **Samuel:** Wanted the AI to answer directly without mode selection; found the tool comparable to a generic chatbot; did not experience meaningful differentiation from standard AI assistants.

The group AI_LIGHT condition reinforced this: both participants described it as more structured and cleaner than AI_ON. Given AI_LIGHT is the stripped-back condition, this response reveals that the additional surface area of AI_ON (right panel, routing, context, traceability) was experienced as overhead rather than support at first exposure.

This is a classic onboarding/mental model mismatch pattern. The workspace paradigm assumes users will recognise the value of structured, persistent, linked AI artefacts — but both participants arrived with a group-chat-with-embedded-AI mental model, and the tool did not resolve that mismatch through onboarding or progressive disclosure. The onboarding cards were noted as confusing and were subsequently revised before Session 2.

**Important caveat:** Session 1 bugs (verbosity, deleted messages, disappearing dismissed items) amplified frustration. The AQ4 signals are directionally reliable but their magnitude may be inflated by the rough first-session UX. Additionally, the facilitator (`user1`) dismissed 3 insights and accepted 1 in the Group AI_ON session (`09:38–09:55`), with confirmed overlap with participant traceability activity (see AQ2, B3 resolved). The facilitator dismissed the JB suggestion 46 seconds before P1 attempted to click it 6 times, and dismissed both Context and Objective documents before the main 09:43:54 traceability burst. The right-panel state visible to participants during the session was being actively modified by the facilitator. This is a confirmed confound for both AQ2 group data and AQ4 first-impression perception of the right panel.

---

## AQ5 — Contextual Catch-Up

Not applicable to Session 1. No new joiner scenario was run.

---

## Cross-Cutting Notes

**Insight generation pattern:** Samuel was the more active insight generator in solo (3 requests: 1 summary, 2 suggestions; all `has_prompt_override=False`, `prompt_archetype=decision-brief/pragmatic-advisor`). In the group session, all 6 insight requests came from P1 (JC), using slash commands. Critically, JC's first group generation was with default prompt (`override=False`), but the subsequent 5 were all `override=True` with `prompt_archetype=research-analyst` — JC actively customised the research prompt after seeing the first default output. This override escalation is the strongest direct evidence of deliberate AQ1 mode engagement in Session 1, and is available only for this session (timeline instrumentation was removed before Session 2). The inversion — JC drove all structured insight generation in the collaborative context despite zero solo panel interaction — combined with his override pattern suggests the group context activated a different mode of tool engagement.

**Condition order note:** Timestamps confirm AI_ON was run before AI_LIGHT within Session 1 (team-04 started 09:37, team-05 started 09:53). The `condition_audit.csv` `run_order=BA` field for team-04 reflects a counterbalancing code, not the within-session presentation order. The timestamps and cleaned notes are the authoritative source.

**Bugs to exclude from cross-session comparisons:**
- Dismissed items reappearing → AQ2 traceability comparisons should note this was fixed before Session 2
- `/research` message deletion → routing comparisons for Session 1 slash-command research use are unreliable
- Response verbosity → satisfaction comparisons should be treated with caution for Session 1 specifically

---

## AQ Contribution Summary

| AQ | Signal Strength | Key Finding |
|---|---|---|
| AQ1 | Weak–moderate | Zero spontaneous research mode use; high override rate is a sticky-mode artifact; routing legibility was the upstream problem |
| AQ2 | Weak | Solo traceability was genuine (8 events, JC + Samuel unaffected); group AI_ON traceability largely confounded — 10 of 14 clicks were to facilitator-dismissed insights; trust problems driven by search-access confound |
| AQ3 | Moderate | Direct behavioral evidence of context panel bypass — P2 opened, closed, typed in chat instead; constraint did not propagate through the system |
| AQ4 | Moderate–strong | Both participants independently converged on workspace paradigm mismatch; AI_LIGHT perceived as cleaner despite fewer features |
| AQ5 | N/A | Not tested |
