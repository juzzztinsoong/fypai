# Session 3 — Analysis

**Date:** 2026-03-26  
**Participants:** Aung (P1), Shanyl (P2, male)  
**Structure:** Solo AI_ON (P1 & P2 separately) → Group AI_ON (divergent creative project reconciliation) → Group AI_LIGHT (trip planning, shortened trip constraint)  
**Researcher notes source:** `3-cleaned.md`  
**Data quality note:** Good coverage for both participants. One reply+help interaction bug present (reply and help features cancelled each other out); consistent behaviour only for auto, Ask Assistant, and Research modes. Research mode produced research-type insights in the right panel but participants rated output quality as not substantively researched (see AQ1, cross-cutting). Survey is the final version.

---

## Telemetry Summary

| Context | Total Msgs | Auto-Ask | Auto-Research | Manual-Ask | Manual-Research | Override Rate | Insights Generated | Traceability Clicks | Context Saves | Draft Promoted |
|---|---|---|---|---|---|---|---|---|---|---|
| Aung Solo (AI_ON) | 11 | 1 | 0 | 8 | 2 | 91% | 3 | 7 | 1 | 21 |
| Shanyl Solo (AI_ON) | 10 | 0 | 0 | 8 | 2 | 100% | 5 | 5* | 1 | 0 |
| Group AI_ON (P1) | 17 | 8 | 0 | 8 | 1 | 53% | 0 | 0 | 1 | 8 |
| Group AI_ON (P2) | 13 | 9 | 0 | 4 | 0 | 31% | 0 | 0 | 0 | 0 |
| Group AI_LIGHT (P1) | 24 | 19 | 0 | 5 | 0 | 21% | 0 | 0 | 1 | 5 |
| Group AI_LIGHT (P2) | 27 | 21 | 0 | 6 | 0 | 22% | 0 | 0 | 1 | 0 |

*Shanyl traceability: 9 raw clicks; 4 excluded as clicks to pre-session seed insight (Quick Start Help, age ~773 min at click time). Genuine count: 5.

**Insight generation telemetry gap — script6 under-counts, export_fallback is authoritative.** `script6_session_metrics.py` reports 0 insights for all Session 3 contexts because it counts only `insight_generate_requested` / `insight_generate_completed` timeline events, which were not instrumented in session 3. The `script3_insight_events.py` export_fallback (reading directly from the `.json` export's `insights` array) recovers genuine session insights. Seed-data rows (timestamped the day before the session: one `suggestion` per participant at `18:51:04`) must be excluded. After filtering:

| Context | Genuine insights | Types |
|---|---|---|
| Aung solo | 3 | 1 action, 1 research, 1 suggestion |
| Shanyl solo | 5 | 2 action, 2 research, 1 summary |
| Group AI_ON | 1 | 1 research |
| Group AI_LIGHT | 0 | (by design) |

All 5 Research-mode messages have `has_research_job=False` — the async ResearchJobController pathway (which ran for 2 messages in Session 1 via a dedicated deep-research prompt and `research:job:updated` socket events) was not exercised. Instead, Research mode in S2–S3 routes to research-type insight generation (stored internally as `document`) via `AIInsightController.generateReport` with the `research-analyst` archetype. Research-mode messages are therefore the primary source of the research insights in S3 (Aung: 1, Shanyl: 2, Group AI_ON: 1). Output was produced and appeared in the right panel; the participant-reported quality issue is about depth and sourcing, not absence.

---

## Pre-Session Survey

| | Aung (P1) | Shanyl (P2) |
|---|---|---|
| Group work frequency | Very often | Often |
| Quick vs. deep research | Mix of both | Mix of both |
| Importance of AI source | Very important | Moderately important |
| Prior collaborative AI use | No, but thought about it | Yes, regularly |

**Notable baseline:** Aung is the first participant in the study to rate source provenance as *Very important*. Shanyl has the highest prior collaborative AI exposure of any participant. The analytical significance of this pair is discussed under AQ1 and AQ2.

---

## AQ1 — AI Routing Behaviour

**Research mode failed to function in any context. Ask Assistant is now the confirmed de facto primary mode across sessions 2 and 3.**

Override rates in solo — 91% (Aung) and 100% (Shanyl) — are the highest in the study for solo contexts. Research mode in S3 generated research-type insights in the right panel (confirmed in insight_generations.csv), but participants rated the output as not substantively more researched than Ask mode. The cleaned notes describe this directly: Research mode "does not sufficiently understand the prompt to return genuinely researched output." The technical reason: Research mode routes to `generateReport` with the `research-analyst` archetype modifier (compare options; surface risks; keep specific), which frames the LLM's response differently but draws on the same conversation-history context — no external sources, no web retrieval. The async ResearchJobController, which ran for S1 messages and used a deeper research-specific prompt, was not invoked in S2–S3. Participants experienced this as qualitative parity between Research and Ask modes:

- **Shanyl** defaulted to Ask Assistant as the most reliably useful mode after finding Research did not return genuinely researched output. His phrasing — "Research is not researching" — is the clearest participant description of the depth gap in the study.
- **Aung** used the reply function as a creative workaround to inject contextual specificity — a mechanism designed for conversational threading, used here to anchor AI prompts to prior content. This is a notable example of a user compensating for routing mode limitations by repurposing a secondary feature outside its intended workflow.

The reply+help interaction bug introduced an additional confound in Aung's solo session: consistent routing behaviour was only observable for Auto, Ask Assistant, and Research modes. Aung retrospectively noted the reply affordance could be more visible.

**Group AI_ON override rates drop substantially:** P1 at 53%, P2 at 31% — the lowest group AI_ON override rates in the study. This reflects the auto-classifier operating against a different message type: the creative reconciliation task generated shorter, more conversational messages that the classifier routed automatically. The lower override rate is not evidence of more deliberate mode engagement; it reflects message content driving auto-classification rather than participants using the routing UI.

**Post-session Q4 (mode distinction clarity):** Both participants rated *Rough idea* — the lowest clarity score in the study. This is analytically striking: Sessions 1 and 2 produced participants at *Understood* or *Understood and changed*, while Session 3's two most AI-literate participants reached the least confident mode distinction. The barrier is product-specific. Shanyl's substantial prior collaborative AI use did not confer clarity about this tool's routing modes because Research never behaved distinctively enough to establish experiential differentiation.

---

## AQ2 — Traceability and Trust

**Both solo participants showed the highest individual traceability engagement in the study, then no traceability engagement in the group AI_ON phase — a sharp inversion.**

- **Aung solo:** 7 traceability clicks, 4 tab changes — active cross-referencing between insight panel and chat during solo exploration.
- **Shanyl solo:** 5 genuine traceability clicks (9 raw; 4 excluded as clicks to pre-session seed insight), 1 tab change.
- **Group AI_ON:** 0 traceability clicks, 0 tab changes for both participants.

**Merged event sequence — S3 solo phases.** Session 3 has 10 `insight_status_changed` events across three contexts (Shanyl solo: 5, Aung solo: 4, Group AI_ON: 1). All carry `actorUserId=user1` due to the A4 instrumentation bug — in solo phases, the participant is the presumptive operator. Unlike Session 1 Group AI_ON (where dismissals preceded participant clicks to the same content), Session 3 events were predominantly accepts during solo work. The merged timelines show the interaction with participant traceability.

**Shanyl solo (status events from `insight_workflow.csv` transitions; participant clicks from `traceability_with_status.csv`). Status event actor is presumptively Shanyl (solo phase — A4 bug):**

| Time | Actor | Action | Insight |
|---|---|---|---|
| 07:44:37 | Likely Shanyl | new→accepted | Quick Start Help (seed) |
| 07:44:42 | Shanyl | click (`focus_insight_from_agent_message`) | (no insight metadata — during cycling) |
| 07:44:48 | Likely Shanyl | accepted→archived | Quick Start Help (seed) |
| 07:45:08 ×3 | Shanyl | click ×3 (`focus_insight_from_agent_message`) | (no insight metadata — during cycling) |
| 07:45:24 | Likely Shanyl | archived→new | Quick Start Help — reset complete |
| 07:51:10 ×2 | Shanyl | bidirectional pair | Context and Objective (research, `new`, 22s) |
| 07:54:09 | Likely Shanyl | new→accepted | Decide on theme/genre (action) |
| 07:54:56 ×2 | Shanyl | bidirectional pair | Decide on theme/genre (action, 64s) — 47s after accept |
| 08:01:06 | Likely Shanyl | new→accepted | Develop detailed storyline (action) |
| 08:02:27 | Shanyl | click (`focus_insight_from_marker`) | Develop detailed storyline (action, 96s) — 81s after accept |

Shanyl's 4 excluded clicks (07:44:42–07:45:08) fall within the pre-session seed cycling window. The 4 `focus_insight_from_agent_message` events carry no insight metadata in the traceability export (no type, title, or age); the Quick Start Help seed was created 2026-03-25T18:51:04 (~773 minutes before the clicks). Of the 5 genuine clicks, 2 went to insights that had been accepted — "Decide on theme/genre" 47s after acceptance, "Develop detailed storyline" 81s after. The `status_at_click` field shows `new` for both, indicating either a Socket.IO propagation gap or a reconstruction artifact in the traceability export. Since the accept events were most likely Shanyl's own actions (solo phase), these represent a natural workflow: accept an insight and then trace its context.

**Aung solo (status event actor presumptively Aung — solo phase, A4 bug):**

| Time | Actor | Action | Insight |
|---|---|---|---|
| 07:54:43 | Likely Aung | new→accepted | Quick Start Help (seed) |
| 07:55:15 | Aung | click (`focus_insight_from_marker`) | Design the homepage (action, `new`, 13s) |
| 07:55:27 ×3 | Aung | bidirectional pair + click | Design the homepage (action, `new`, 24s) |
| 08:04:21 | Likely Aung | new→accepted | Context and Objective (research) |
| 08:04:21 ×4 | Aung | bidirectional pair ×2 | Context and Objective (research, `new` @ click, 17s) |
| 08:04:27 | Likely Aung | new→dismissed | *Start with Wireframing (suggestion) |
| 08:06:25 | Likely Aung | accepted→archived | Context and Objective (research) |

Aung's 4 clicks at 08:04:21 share the exact timestamp with the "Context and Objective" acceptance — likely Aung performing both actions in quick succession (accept + trace context). The `status_at_click=new` and the coincident accept suggest the status update propagated after the traceability click. The subsequent archive at 08:06:25 (2 min later) changed `final_status` to `archived`. Aung dismissed "*Start with Wireframing" 6s after his last click — he chose to dismiss a suggestion he did not find relevant, consistent with active insight management.

**Group AI_ON:** 1 status event (08:10:19, Context and Objective accepted — attribution ambiguous in group phase). 0 participant traceability clicks — the single group insight was not interacted with via traceability.

**S3 vs S1 status event comparison:** Session 1's dismissed-content concern was higher-severity — dismissals preceded participant clicks and may have removed content from view, rendering 10 of 14 group clicks unreliable (though attribution of those S1 dismissals is also unknown due to A4). Session 3's events are lower-severity and mostly attributable to participants: primarily accepts during solo phases that preserve content visibility, with 1 dismiss (Aung's "*Start with Wireframing") directed at an insight no participant clicked via traceability. The S3 solo events represent genuine participant interaction with the insight lifecycle.

The individual engagement confirms the feature is discoverable and functional for motivated solo users. The collapse to zero under collaborative conditions is not explained by the notes in terms of a specific moment — the single group AI_ON insight (auto-generated "Context and Objective", accepted at 08:10:19 — attribution ambiguous in group phase) was never clicked via traceability by either participant. The near-zero is partially structural (only 1 auto-generated insight vs 3–5 in solo phases reduced the available triggers) and partially behavioural (group context shifted attention from right-panel content to chat). The individual solo engagement is therefore the more informative signal for AQ2 design judgements.

**Aung's traceability click destinations** (detail in merged timeline above): 4 of 7 clicks were to "Context and Objective" (research, `final_status=archived`) and 3 were to "Design the homepage" (action, `final_status=new`). All 7 registered `status_at_click=new` with ages of 13–24s — live, fresh content at time of interaction. The archived state of "Context and Objective" was a two-step process during the active session (likely Aung's own actions — solo phase, A4 bug): accepted at 08:04:21 (coincident with Aung's traceability clicks), then archived at 08:06:25 (2 minutes later). Aung also dismissed "*Start with Wireframing" at 08:04:27 — he never clicked this insight via traceability, consistent with an intentional dismissal of irrelevant content.

**Shanyl's traceability-by-scrolling behaviour** is a distinct AQ2 observation. The cleaned notes record him using chat history navigation as a provenance mechanism — scrolling through conversation rather than using the traceability UI. This occurred in his solo phase despite his 5 genuine traceability clicks: both mechanisms were in use simultaneously, with the chat history serving as a lower-friction, more familiar provenance fallback. Of his 5 genuine clicks, 2 reached action insights that he had previously accepted (likely his own actions — solo phase, A4 bug) — "Decide on theme/genre" accepted at 07:54:09, clicked 47s later at 07:54:56; "Develop detailed storyline" accepted at 08:01:06, clicked 81s later at 08:02:27 (see merged timeline above). 2 clicks reached a research insight ("Context and Objective") that remained `new` throughout. The accept-then-trace sequence represents a natural workflow: mark an insight as accepted and then examine its source context.

**The reply-context bug was a provenance confound during this session (fixed 2026-03-29).** Shanyl flagged suggestions surfacing from incorrect reply context — at the time of this session, the reply system prompt did not consistently anchor to the message being replied to, because `parentMessageId` was extracted from message metadata but never passed to the LLM call. The agent inferred context from recency only, failing for older messages. This generated output that appeared linked to a specific message but was grounded in misidentified context. The bug has since been fixed: `parentMessageId` is now propagated through to `generateResponse()`, and the replied-to message's full content is quoted verbatim as a system directive (`"REPLY CONTEXT: The user is replying to the following earlier message..."`). **Shanyl's experience during this session is valid study data** — the bug was real at collection time. The traceability concern he raised is a study-period finding about the tool's behaviour during the session, not about the tool's current state.

**Aung's AQ2 expectation gap is the sharpest in the study.** He entered with the highest provenance priority rating (*Very important*) and exited with a *Rough idea* mode distinction score — the widest gap between pre-session source importance and post-session source legibility of any participant. He anticipated source attribution; the tool's execution fell short of that expectation under the conditions encountered. This is a qualitatively different provenance concern than Sessions 1 and 2 (which were grounded in missing internet search access): Aung's concern was about understanding where AI outputs come from structurally, and the tool did not resolve it.

---

## AQ3 — Shared Understanding (Context Panel & Constraint Propagation)

**Session 3 produced the fastest unprompted context panel engagement in the study (Shanyl) and the highest-volume context promotion activity in the study (Aung via `draft_context_promoted`) — and the two participants used fundamentally different context interaction pathways.**

- **Shanyl** noticed and engaged with the edit context panel immediately in his solo phase, the fastest unprompted direct panel engagement across all sessions. He saved context once (1 `task_context_saved`), made 6 panel toggle interactions, and generated 0 `draft_context_promoted` events. He used the panel as the intended mechanism.

- **Aung** forgot to edit context at the session start (noted retrospectively), made 1 formal context save, but generated **21 `draft_context_promoted` events** in his solo phase alone — the highest context promotion activity in the study by a large margin. The `draft_context_promoted` event fires when a user promotes an AI reply or insight as a context draft without opening the context panel. Aung's pattern: after the missed session-start save, he found and repeatedly used the promote mechanism, sourcing context from AI replies and from the generated action insight ('Design the homepage...'). His total context interaction count — 22 events in solo — makes him the most context-active participant in the study; it was simply routed through a different affordance than panel saves.

  The context timeline confirms the exact sequence: Aung's first `draft_context_promoted` event fired at **07:50:22 (6.2 minutes from session start, before any chat message had been sent — messages_before=0)**. Two further promotes followed at 07:50:43 (still messages_before=0) and 07:51:00 (immediately after his first message — messages_before=1), with promotes resuming at 07:53:48 onward as messages accumulated. His formal panel save came at **08:03:40 (19.5 minutes in, after 10 messages)** — the promote burst began approximately 13 minutes before the formal save. This confirms the "alternative pathway after missed session-start save" interpretation: Aung found and extensively used the promote mechanism before resorting to the panel save, not after.

  This substantially reframes his retrospective note about forgetting to set context. He was not ignoring context management after the initial miss — he found an alternative pathway and used it extensively. His suggestion that the tool could **prompt context entry at session start** is therefore a session-onset guidance finding, not evidence of general context disengagement.

**Group AI_ON context promotion:** Aung generated 8 `draft_context_promoted` events in the group AI_ON phase (all P1 / study-user-01); P2 generated 0. The asymmetry — one participant driving all context promotion while the other does not engage with it at all — is an AQ3 coordination signal: context management became a single-participant activity rather than a shared team behaviour, which partially explains why the AI's facilitative outputs were insufficiently grounded to resolve the conceptual disagreement.

**AI_LIGHT constraint failure (shortened trip):** The constraint was introduced mid-session and the AI did not meaningfully incorporate it. Aung generated 5 `draft_context_promoted` events in AI_LIGHT. Code inspection and post-promote event logs confirm that promotes in AI_LIGHT mode are **not** silently discarded: the frontend auto-prepends `@agent` to any message sent after a promote (`shouldForceAgentInvoke = draftContexts.length > 0`), passing the promoted context metadata (`draftSourceInsightIds`, `draftSourceMessageIds`, `draftContextLabels`) to the backend, which processes it as an explicit `@agent` chat request — the one AI invocation type permitted in AI_LIGHT. Post-promote `message_sent` events in the AI_LIGHT timeline confirm this mechanism fired for all five cases (routeMode: `ask`, manual-override). The constraint failure is therefore not a mechanical drop issue; the context was live input to each agent response. The failure is more plausibly a context retention or instruction-following limitation under AI_LIGHT's conversational mode — the agent processed each promoted context in isolation rather than accumulating constraint state across turns.

**The participant-generated context visibility proposal** — displaying context updates like group chat name changes — was raised unprompted and framed in terms of traceability. Given the dual-pathway context behaviour observed (panel save vs. promote), the proposal has additional force: if promote events are also invisible to co-participants, there is a real shared-understanding gap even when context is being actively managed.

---

## AQ4 — Coordination Support

**The most AI-literate participant pair produced the strongest scepticism of the AI as a convergence tool, while generating the most pragmatic coordination strategy in the study.**

**Team AI_ON — creative convergence task:** Both participants arrived with different creative project framing from the solo phase. The AI's facilitative outputs in the group AI_ON phase were insufficiently specific to resolve the genuine conceptual disagreement. This replicates the Session 2 finding but in a more demanding scenario — the disagreement was about creative framing (a conceptual divergence) rather than task preferences, and generalised facilitative responses are less useful against conceptual divergence than against preference-based disagreement. The cleaned notes flag this as a scenario design observation: using divergent creative conceptualisations as a convergence task was ambitious, and the AI's tendency toward uncontroversial facilitative outputs is structurally inappropriate for resolving creative disagreement. Only 1 insight was generated in the group AI_ON phase (1 research), consistent with the "side cards surprisingly hard to activate" observation.

**Group AI_LIGHT message volume:** 51 messages in AI_LIGHT versus 30 in AI_ON — consistent with the pattern across sessions where the absence of right-panel affordances pushes more of the task load into chat. AI_LIGHT participants generate more conversational exchange because the right panel is not available to absorb structured output, not because AI_LIGHT is more productive.

**Pre-exposure mental models were the most sophisticated in the study — and were not met:**
- Aung anticipated a workspace that would aggregate multi-format outputs so the team would not have to go to other tools. This is a reasonable description of what AI_ON is designed to do.
- Shanyl anticipated an AI transparency indicator — specifically wanting to know when and what the AI had done. This is a precise description of the traceability feature.
Both entered with clearer conceptual models than Sessions 1–2 participants. Neither felt the tool had delivered on those models. Shanyl's *About what I expected* Q3 rating against his more structured pre-exposure model is a different kind of finding than it would be for a less-informed participant — he expected more, the tool met a lower version of that expectation.

**Aung's tandem use proposal** — using AI_ON and AI_LIGHT in combination for different task types — is the most pragmatic user-generated coordination strategy in the study. It reflects a user who has processed both conditions analytically rather than picking one, and reflects a mature understanding of the two modes' complementary strengths. This is qualitatively different from Sessions 1–2 where participants expressed preference for one condition over the other.

**Feature friction observations:**
- Side cards (insight panel) were noted as surprisingly hard to activate despite intent to use them — consistent with the passive discoverability flag Shanyl also raised.
- Shanyl's proposal for tag-based content organisation is a higher-level productivity function concept — essentially a classification layer above routing mode — and is more ambitious than any feature proposals from prior sessions.

---

## AQ5 — Contextual Catch-Up

**Shanyl independently identified summary as a catch-up mechanism for new joiners — the third session without a formal AQ5 scenario, but the most direct unprompted evidence for it in the study.**

His framing was specific: a new joiner could use the summary function to get up to speed without reading the full conversation history. This was raised in his post-session feedback without prompting. No new joiner scenario was run in Session 3, but this participant-generated observation from the participant with the highest prior collaborative AI exposure strengthens the case for the summary artifact as the primary AQ5 mechanism. It should be treated as convergent evidence alongside any formal AQ5 testing conducted in later sessions.

---

## Cross-Cutting Notes

**Insight generation — genuine but low, and telemetry-gapped.**
Session 3 solo contexts produced insights (Aung: 3, Shanyl: 5 after filtering seed data; Group AI_ON: 1). `script6_session_metrics.py` reports 0 across all contexts because `insight_generate_requested` / `insight_generate_completed` events were not instrumented in session 3 — the export_fallback in `script3` is the authoritative source. For comparison: Session 1 Samuel solo generated 3 insights (timeline-confirmed); Session 1 Group AI_ON generated 6 (timeline-confirmed). Session 3 solo generation is therefore broadly comparable, while Group AI_ON dropped to 1 — consistent with the "side cards surprisingly hard to activate" observation and the absence of group-phase insight use noted in the cleaned record.

The combination of Research mode depth limitations (same conversation-context LLM as Ask, no external retrieval) and side card discoverability issues reduced effective structured insight use in both solo and group contexts. Participants perceived value in the concept (Aung: "theoretical merit"; Shanyl: "summary is very useful") but experienced friction accessing the feature.

**Traceability inversion — solo vs. group.**
Solo traceability engagement (Aung 7 + Shanyl 5 genuine clicks) substantially exceeded all previous solo contexts. Group AI_ON traceability engagement was structurally zero (no insights to trace). The two facts together mean traceability UX was not the limiting factor in the solo phase, but the group AI_ON trajectory did not produce the artifacts that would make traceability actionable in the collaborative context.

**`draft_context_promoted` — dominant context mechanism for Aung, absent for Shanyl.**
Aung generated 21 promotes in solo, 8 in group AI_ON, 5 in AI_LIGHT (34 total). Shanyl generated 0 across all phases. The two participants used entirely different context interaction models in the same session. This is the sharpest within-session AQ3 contrast in the study. Note: this metric did not exist in `context_events.csv` until script4 was updated to capture it; prior per-participant context save counts (1 each) severely understated Aung's context engagement.

**`insight_status_changed` — 14 events exist but all actor=`user1` (excluded test account).**
14 insight status transitions were captured across sessions (S1 Group AI_ON: 4; S3 Aung solo: 4; S3 Shanyl solo: 5; S3 Group AI_ON: 1), but every event was fired by `user1`, not a study participant. `user1` is the excluded facilitator/test account; these events likely represent the researcher demonstrating or testing the accept/dismiss workflow during live sessions. `insight_status_changes.csv` is correctly empty for study participants. The workflow was physically present and operable, but no study participant independently operated accept/dismiss in any session.

**Session 3 insight workflow distribution (from script10):** The `insight_workflow_summary.csv` for S3 AI_ON shows: 2 actions accepted, 1 action new; 1 research accepted, 1 research archived, 2 research new; 1 suggestion accepted, 1 suggestion dismissed, 1 suggestion new; 1 summary new. Per DATA_ISSUES A4, all accept/dismiss/archive transitions were facilitator-operated. No study participant independently operated the workflow. The presence of accepted and archived content in the export confirms the workflow was functional during the session; absence of participant-driven events is consistent with Sessions 1 and 2.

**Post-session survey — Session 3 as a regression in Q4.**
Sessions 1–2 participants moved toward *Understood* or *Understood and changed* on Q4. Both Session 3 participants scored *Rough idea*. Combined with the pre-session survey showing the highest AI familiarity profile in the study, this is the clearest evidence that mode distinction clarity is product-specific knowledge, not general AI literacy — and that Research mode failure, not participant sophistication, is the primary driver of low mode clarity scores.

**Q1 source legibility — positive outlier.**
Both participants scored *Easy* on Q1 (source legibility) — the most uniformly positive result on this measure across the study. This is in apparent tension with Aung's high provenance priority and rough idea mode clarity, and with the reply-context bug. The likely explanation is that source legibility in Q1 is being interpreted as "can I see where the AI reply is in the interface" rather than "do I understand the epistemological provenance of the AI's claims" — a question framing ambiguity worth noting in the methodology chapter.

**Condition order note:** AI_ON ran before AI_LIGHT within Session 3 (run_order=AB for solo contexts; team-05 BA confirms AI_LIGHT ran after AI_ON for group). Timestamps in the timeline files are authoritative. No within-session order confound identified.

**Facilitator cycling before Shanyl's session start — confirmed low-risk (C3).** `user1` cycled the Quick Start Help seed through `new → accepted → archived → new` at 07:44:37–07:45:24. Shanyl was performing `link_hover` events in the right panel throughout this window — meaning the status changes were potentially visible on his screen. At 07:44:42 (between the first two status transitions) he fired a `focus_insight_from_agent_message` event, confirming right-panel engagement. However, the seed was reset to `new` by 07:45:24, a full 5+ minutes before his first message (07:50:43). His documented think-aloud observations during first impressions — edit context panel importance, semantic intent expectation, Ask Assistant visual clarity, insights panel passive discoverability — are structural observations about the interface, not reactions to a specific insight's status transitioning. The AQ1, AQ2, and Q4 responses are not materially confounded by this facilitator action.

**Bugs to flag for cross-session comparisons:**
- Reply+help cancelled each other out (present in Session 3 only, or at least first reported here) → Aung's routing metrics and reply-based workaround should be noted as confounded.
- Reply-context bug (Shanyl) — **fixed 2026-03-29**: parentMessageId was extracted but never passed to the LLM; agent inferred reply target from recency only. Fix: parentMessageId propagated to generateResponse(), replied-to content quoted verbatim as system directive ("REPLY CONTEXT: The user is replying to the following earlier message..."). AQ2 misleading-provenance observations are valid for the study period; they do not reflect the tool's current behaviour.
- Research mode output pipeline changed between S1 and S2/S3: S1 had the ResearchJobController async pathway (`research:job:updated` events, dedicated deep-research prompt) for some research messages; S2–S3 use `generateReport` with the `research-analyst` archetype only. Research-mode insight counts are comparable across sessions, but the quality ceiling and generation mechanism differ. Do not compare S1 research output quality directly against S2/S3 without this caveat.

---

## AQ Contribution Summary

| AQ | Signal Strength | Key Finding |
|---|---|---|
| AQ1 | Moderate | Research mode produced research insights but depth gap confirmed — `generateReport` with `research-analyst` archetype, no external retrieval; "Research is not researching" (Shanyl) is the clearest participant articulation in the study; both solo override rates (91%, 100%) are highest in study; mode clarity Q4 scored *Rough idea* for both despite highest AI familiarity profile in dataset |
| AQ2 | Strong | Aung 7 genuine clicks, Shanyl 5 genuine clicks (4 of 9 raw to pre-session seed); sharp inversion to zero in group AI_ON (1 auto-generated insight present but never clicked; reduced trigger density vs solo phases); Shanyl's simultaneous chat-scroll and traceability-UI use; reply-context bug created misleading provenance during this session (fixed 2026-03-29 — finding is study-period snapshot) |
| AQ3 | Strong | Sharpest within-session context pathway divergence in study: Aung 22 promotes (solo+group) vs Shanyl 0 promotes; fastest unprompted direct panel engagement (Shanyl); AI_LIGHT promotes confirmed live — processed as @agent chat, not discarded; constraint failure is retention-across-turns issue, not mechanical drop |
| AQ4 | Moderate–strong | Most AI-literate pair produced strongest scepticism of AI as convergence tool; Aung's tandem-use proposal (AI_ON + AI_LIGHT for different task types) is the most analytically mature coordination strategy in the study; Shanyl's tag-based organisation proposal is highest-ambition feature request in dataset |
| AQ5 | Weak–moderate | No new joiner scenario run; Shanyl's unprompted catch-up framing (summary as onboarding mechanism for new joiners) is strongest indirect evidence for AQ5 in study; treated as convergent qualitative evidence |
