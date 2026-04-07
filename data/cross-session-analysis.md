# Cross-Session Analysis

**Study:** AI-Assisted Team Collaboration Workspace  
**Sessions:** 4 (2026-03-19, 2026-03-25, 2026-03-26, 2026-03-29)  
**Participants:** 9 total (S1: JC + Samuel; S2: Willson + Aly + Royston; S3: Aung + Shanyl; S4: Val + Jen)  
**Conditions:** Solo AI_ON → Group AI_ON → Group AI_LIGHT (all sessions)  
**Total messages analysed:** 414  
**Research questions:** AQ1 (Routing), AQ2 (Traceability & Trust), AQ3 (Shared Understanding), AQ4 (Coordination Support), AQ5 (Contextual Catch-Up)

**Sources:** Per-session analysis files (`1-analysis.md` through `4-analysis.md`), cleaned observational notes (`1-cleaned.md` through `4-cleaned.md`), telemetry CSVs generated from `script1`–`script10`.

---

## 1. Study-Wide Telemetry Overview

### 1.1 Message Volumes

| Session | Solo Msgs (all participants) | Group AI_ON | Group AI_LIGHT | Total |
|---|---|---|---|---|
| S1 | 16 (JC 7, Samuel 9) | 37 | 29 | 82 |
| S2 | 49 (Willson 33, Aly 10, Royston 6) | 43 | 58 | 150 |
| S3 | 21 (Aung 11, Shanyl 10) | 30 | 51 | 102 |
| S4 | 21 (Val 11, Jen 10) | 30 | 20 | 71 |
| **Total** | **107** | **140** | **158** | **405** |

Note: Totals may differ from 414 due to routing_table.csv inclusion criteria; 9 additional messages exist in raw timeline data but were excluded from routing analysis (e.g. system events, empty messages).

**Cross-session pattern — Group AI_LIGHT message volumes exceed AI_ON in 3 of 4 sessions.** S2 (43 vs 58), S3 (30 vs 51), and S1 (37 vs 29 — marginal difference) follow the pattern; S4 inverts it (30 vs 20). The dominant pattern is consistent with the hypothesis that AI_LIGHT pushes task load into conversational exchange by removing the right-panel affordances that absorb structured output. S4's inversion is attributable to its smaller group size (2 participants) and shorter session spans (~12 min AI_ON, ~11 min AI_LIGHT), which reduce the conversational overhead that produces the AI_LIGHT volume increase in larger or longer groups.

### 1.2 Solo Override Rates

| Participant | Session | Solo Msgs | Override Rate | Research Msgs | Ask Msgs (manual) | Auto-Classified |
|---|---|---|---|---|---|---|
| JC | S1 | 7 | 71% | 0 | 5 | 2 |
| Samuel | S1 | 9 | 67% | 1 | 5 | 3 |
| Willson | S2 | 33 | 39% | 2 | 11 | 20 |
| Aly | S2 | 10 | 100% | 5 | 5 | 0 |
| Royston | S2 | 6 | 100% | 3 | 3 | 0 |
| Aung | S3 | 11 | 91% | 2 | 8 | 1 |
| Shanyl | S3 | 10 | 100% | 2 | 8 | 0 |
| Val | S4 | 11 | 73% | 4 | 4 | 3 |
| Jen | S4 | 10 | 90% | 1 | 8 | 1 |

**Study-wide mean solo override rate: 81%.** Only Willson (39%) was a clear outlier — he deferred to the auto-classifier significantly more than anyone else. Four participants (Aly, Royston, Shanyl, and effectively Aung at 91%) took full manual control from the outset.

### 1.3 Auto-Research Classification

**Zero auto-research classifications in routing_table.csv across all sessions.** JC's S1 analysis describes 1 auto-classified research message ("compile some research on BGP...", confidence 0.78) — this was identified from the raw timeline data rather than the routing summary CSV. The practical implication is unchanged: the auto-classifier never autonomously routed a message to Research mode in any session captured by the routing pipeline. The near-zero auto-research rate reflects the classifier's requirement for explicit research-intent keywords combined with a high confidence threshold (~0.75–0.80), not a broken classifier.

### 1.4 Insight Generation

| Session | Solo Insights (genuine) | Group AI_ON Insights | Source |
|---|---|---|---|
| S1 | JC 1, Samuel 3–4 | 6 | `timeline_event` |
| S2 | Willson 6, Aly 6, Royston 2 | 6 | `export_fallback` |
| S3 | Aung 3, Shanyl 5 | 1 | `export_fallback` |
| S4 | Val 6, Jen 6 | 3 | `timeline_event` |

All counts are post-seed-filter. S1 and S4 used direct `insight_generate_completed` timeline events (2 rows per generation in S1, 1 in S4). S2–S3 used export fallback (reading JSON export `insights` array). Cross-session insight counts are comparable after seed filtering; do not compare raw CSV row counts.

**Research mode pipeline shift:** S1 used the `ResearchJobController` async pathway for some messages (deeper research-specific prompt, `research:job:updated` socket events). S2–S4 used `AIInsightController.generateReport` with the `research-analyst` archetype modifier (synchronous, same conversation-history context, no external retrieval). Research-type insight counts are comparable; quality ceiling and generation mechanism differ. Do not compare S1 research output quality directly against S2–S4 without this caveat.

### 1.5 Traceability Clicks

| Participant | Session | Solo Clicks | Group AI_ON Clicks | Total (genuine) |
|---|---|---|---|---|
| JC | S1 | 2 | 13 | 15* |
| Samuel | S1 | 6 | 1 | 7 |
| Willson | S2 | 1 | 3 | 4 |
| Aly | S2 | 4 | 0 | 4 |
| Royston | S2 | 5† | 0 | 5 |
| Aung | S3 | 7 | 0 | 7 |
| Shanyl | S3 | 5‡ | 0 | 5 |
| Val | S4 | 2 | 1 | 3 |
| Jen | S4 | 21 | 1 | 22 |

*S1 Group AI_ON traceability is affected by dismissed content: 10 of 13 P1 clicks were to insights with `dismissed` status (attribution of the dismissals unknown — A4 instrumentation bug). Only 3 P1 group clicks + 1 P2 click were to live content. See §3 for detail.  
†Royston: 6 raw, 1 excluded (click to pre-session seed, age ~1015 min).  
‡Shanyl: 9 raw, 4 excluded (clicks during pre-session cycling of seed insight).

### 1.6 Context Events

| Participant | Session | Panel Saves | Draft Promotes | AI Toggles | Panel Toggles |
|---|---|---|---|---|---|
| JC | S1 | 0 | 4 | — | 3 |
| Samuel | S1 | 1 | 0 | — | 2 |
| — (S1 Group) | S1 | 2 | 2 | 4 | 9 |
| Willson | S2 | 1 (solo) + 2 (AI_LIGHT) | 2 (Group AI_ON) | — | 2 |
| Aly | S2 | 1 (solo) + 1 (Group AI_ON) | 2 (Group AI_ON) + 2 (AI_LIGHT) | — | 3 |
| Royston | S2 | 0 | 0 | — | 0 |
| Aung | S3 | 1 (solo) + 1 (Group) + 1 (AI_LIGHT) | 21 (solo) + 8 (Group) + 5 (AI_LIGHT) | — | 8 |
| Shanyl | S3 | 1 (solo) + 1 (AI_LIGHT) | 0 | — | 11 |
| Val | S4 | 0 | 2 (solo) | — | 4 (AI_LIGHT panel opens) |
| Jen | S4 | 3 (solo) + 1 (Group) | 3 (solo) | 4 | 4 |

**Context pathway diversity:** Three distinct context management pathways were observed:
1. **Formal panel save** (explicit open → edit → save workflow) — used by 7 of 9 participants at least once.
2. **Draft context promote** (`draft_context_promoted`) — AI-generated content promoted as context without opening the panel. Used by 5 of 9 participants. Aung was the extreme outlier (34 total promotes across all phases).
3. **Non-engagement** — Royston used no context affordance in any phase. Samuel and Val only engaged minimally.

### 1.7 Insight Status Attribution Gap (A4 Revised)

All `insight_status_changed` events carry `actorUserId=user1` due to a confirmed instrumentation bug: the `InsightActions` component defaults `userId` to `'user1'` when the parent `InsightCard` does not pass the actual session user's ID. Actor attribution on these events is unreliable. In solo sessions, participants are the presumptive operators.

| Session | `insight_status_changed` events | Attribution | Impact |
|---|---|---|---|
| S1 | 4 (3 dismissals, 1 acceptance) | **Ambiguous** — group phase, multiple users present | 10 of 14 group traceability clicks reached dismissed content. Whether the participant or facilitator dismissed is irrecoverable. Group traceability data remains low-confidence. |
| S2 | 0 | N/A | All 22 insights remained `new`. Cleanest session. |
| S3 | 10 (5 Shanyl solo, 4 Aung solo, 1 Group) | **Likely participants** — solo phases | Participants used accept/dismiss as part of their insight workflow. Primarily acceptances; content remained visible and navigable. |
| S4 | 6 (2 seed acceptances, 4 genuine acceptances) | **Likely participants** — solo phases | Participants accepted insights during solo work. All `new→accepted`. |

**Study-wide:** The accept/dismiss workflow was used in 3 of 4 sessions. In solo phases (S3, S4), the events are attributable to participants — they were the active interface users. This represents genuine participant adoption of the insight lifecycle mechanism, contrasting with the earlier (incorrect) analysis that attributed all events to the facilitator. The `insight_status_changes.csv` is empty because the processing script filters on `is_study_user(actorUserId)`, which fails for the misattributed `user1` value.

---

## 2. AQ1 — AI Routing Behaviour

### 2.1 Cross-Session Override Pattern

The 81% mean solo override rate represents a study-wide signal: participants took manual control of routing mode in the large majority of their solo interactions. The pattern was not uniform — Willson at 39% and Samuel at 67% represent a genuine minority who deferred to the auto-classifier — but the dominant behaviour was manual override.

**Group AI_ON overrides dropped substantially in every session:**

| Session | Solo Mean Override | Group AI_ON Mean Override |
|---|---|---|
| S1 | 69% (JC 71%, Samuel 67%) | 92% (P1 90%, P2 94%) |
| S2 | 80% (W 39%, A 100%, R 100%) | 43% (W 56%, A 35%, R 38%) |
| S3 | 96% (Aung 91%, Shanyl 100%) | 42% (P1 53%, P2 31%) |
| S4 | 82% (Val 73%, Jen 90%) | 37% (Val 40%, Jen 35%) |

S1's group override rate is anomalous (rising to 92% rather than falling). This reflects the "sticky mode" artefact described in the S1 analysis: JC and Samuel set Ask mode early and left it locked for the remainder, producing a high override rate from mode-locking rather than per-message routing decisions. Sessions 2–4, where participants encountered more varied auto-classified messages in the group phase, consistently show the drop.

The group AI_ON override drop is best explained by message content, not routing comprehension. Group messages were shorter and more conversational, which the auto-classifier handled acceptably (routing to Ask mode, which is what participants wanted). The solo override rate reflects participants actively needing Research mode or correcting misclassification; the group rate reflects the classifier's Ask default being acceptable for conversational messages.

### 2.2 Research Mode — The Depth Gap

Research mode's perceived failure is the most consistent cross-session finding in AQ1.

| Session | Participants who tried Research | Participant assessment |
|---|---|---|
| S1 | JC (1 auto), Samuel (1 manual) | JC found research output "too verbose"; Samuel found tool comparable to generic chatbot |
| S2 | Willson (2), Aly (5), Royston (3) | Aly: output felt like "opinion not fact". Royston: output diverged from question asked. Research mode template rigidity flagged by both. |
| S3 | Aung (2), Shanyl (2) | Shanyl: "Research is not researching" — clearest articulation. Aung: reply workaround to inject context specificity. |
| S4 | Val (4), Jen (1) | Val: initially useful for structured tasks (risks, open questions), then limiting as complexity increased. Jen: research output not thorough or deep enough. |

**Mechanism:** Research mode in S2–S4 routes to `generateReport` with the `research-analyst` archetype modifier (synchronous, same conversation-history context as Ask, no external retrieval). The mode label creates a retrieval expectation the system does not meet. Val's conditional assessment — useful for structured sub-tasks, limiting for open-ended research — is the most nuanced evaluation and the only participant to express a non-binary judgement.

### 2.3 Mode Distinction Clarity (Post-Session Q4)

| Session | Q4 Scores |
|---|---|
| S1 | Not measured (different instrument) |
| S2 | Willson: Understood, changed use. Aly: Understood, changed use. Royston: Understood clearly. |
| S3 | Aung: Rough idea. Shanyl: Rough idea. |
| S4 | Val: Understood clearly. Jen: Rough idea. |

**The Q4 pattern does not show a linear learning progression across sessions.** S2 participants (moderate AI familiarity) reached highest clarity. S3 participants (highest AI familiarity in the study) scored lowest. S4 produced a divergent result (Val high, Jen low). The determining factor is not general AI literacy but depth of Research mode engagement: participants who used Research mode enough to build an experiential contrast with Ask reached *Understood*; those who gave up on Research early or never tried it remained at *Rough idea*. Val's front-loaded Research engagement (4 manual-research in first 6 messages) and subsequent Ask transition gave her the clearest contrastive basis. Shanyl's Research avoidance after finding it non-functional prevented the contrast from forming.

### 2.4 Ask Assistant as De Facto Primary Mode

Across all sessions and participants, Ask Assistant was the overwhelmingly dominant mode. Research was attempted but abandoned as the primary interaction mode by every participant except Val (who front-loaded it but also shifted to Ask). The workspace design assumed deliberate mode selection as a core interaction pattern; in practice, participants converged on Ask as a defaulting strategy, with Research relegated to occasional exploratory use.

---

## 3. AQ2 — Traceability and Trust

### 3.1 Solo vs Group Traceability Inversion

The most consistent AQ2 pattern is the collapse of traceability engagement from solo to group phases:

| Participant | Solo Clicks | Group AI_ON Clicks |
|---|---|---|
| JC | 2 | 13* |
| Samuel | 6 | 1 |
| Willson | 1 | 3 |
| Aly | 4 | 0 |
| Royston | 5 | 0 |
| Aung | 7 | 0 |
| Shanyl | 5 | 0 |
| Val | 2 | 1 |
| Jen | 21 | 1 |

*10 of 13 to dismissed content; see §1.7.

Excluding JC's S1 group data (dismissed-content quality concern), every participant who engaged with traceability in solo reduced or eliminated engagement in the group phase. This is not a feature access issue — traceability links were equally available in both phases. Two factors explain the drop:

1. **Reduced insight density in group phases.** Solo phases generated 1–6 insights per person (individual prompting). Group AI_ON phases generated 1–6 total for the entire group (shared prompting with fewer distinct queries). Fewer insights = fewer traceability triggers.
2. **Attentional shift from panel to chat.** The collaborative context redirected attention to the conversational stream. The right panel became a peripheral resource rather than a primary workspace surface.

### 3.2 Post-Session Q1 — Source Legibility and the Framing Ambiguity

| Session | Q1 Scores | Verbal contradictions |
|---|---|---|
| S1 | Not formally measured | Both participants expressed low confidence in AI output sourcing |
| S2 | Willson: Easy. Aly: Difficult. Royston: Very easy. | Aly: output felt like "opinion not fact" |
| S3 | Aung: Easy. Shanyl: Easy. | Aung rated source provenance *Very important* pre-session but scored *Rough idea* on mode clarity |
| S4 | Val: Easy. Jen: Difficult. | Val: verbally said "not sure where facts came from" despite rating Easy |

**The Q1 survey question measures interface legibility ("can I see what the AI produced"), not epistemic provenance ("do I know the basis for the AI's claims").** This framing ambiguity is confirmed most clearly in S4: Val rated Easy but verbally expressed source uncertainty. Both dimensions — interface legibility and epistemic provenance — should be treated as analytically distinct in the AQ2 analysis. Participants who rated Easy generally meant they could identify AI-generated content visually; participants who rated Difficult generally meant they could not determine the epistemic grounding of that content.

### 3.3 Traceability Navigation Strategies

Three distinct traceability strategies emerged without scaffolding:

1. **Chat-to-panel navigation** (dominant): Most participants clicked chat markers (`focus_insight_from_marker`) to navigate from a chat message to the corresponding right-panel insight. This was the designed pathway.
2. **Panel-to-chat navigation** (Jen only): Jen used `focus_chat_marker_from_insight` / `jump_to_chat_marker` pairs — navigating from the insights panel back to the originating chat message. The only participant to treat the right panel as the primary navigation surface.
3. **Chat scroll as provenance fallback** (Shanyl, Val): Both noted using chat history scroll as a traceability strategy, bypassing the traceability UI entirely. Shanyl did this while simultaneously using the traceability clicks (5 genuine), indicating dual-strategy use. Val explicitly noted not everything in the chat log linked to an insight.

### 3.4 Source Legibility Divergence from Uniform Pre-Session Provenance Concern

All S2 participants entered with identical provenance concern (Q3: "Moderately important") but exited with substantially different experienced legibility (Willson Easy, Royston Very easy, Aly Difficult). S3 participants entered with divergent concern (Aung Very important, Shanyl Moderately important) but exited with identical legibility (both Easy). S4 participants entered with identical concern (both Moderately important) and exited with divergent legibility (Val Easy, Jen Difficult).

The divergence is not predicted by pre-session provenance concern, prior AI experience, or general AI literacy. It correlates most closely with depth of mode engagement: participants who used Ask mode predominantly experienced clearer attribution (Ask mode has more conversational, apparently attributable responses), while those who engaged more deeply with Research mode encountered the epistemic provenance problem (Research outputs lack source citation and feel "opinion-based").

---

## 4. AQ3 — Shared Understanding (Context Panel & Constraint Propagation)

### 4.1 Context Panel Engagement Onset

| Session | Earliest context engagement (group phase) | Mechanism |
|---|---|---|
| S1 | P1 at 09:37:43 (early, deliberate) | Panel save — trip parameters |
| S2 | Aly at 08:14:08 → 08:15:18 (70s from start) | Panel save — flat finding criteria |
| S3 | Aung promoted from start of group | Draft promote (8 events in group AI_ON) |
| S4 | Jen at 08:28:25 (~5 min from start) | Panel save — latest onset in study |

S2 had the fastest and most purposeful context-setting, attributable to the task's concrete parameter structure (flat finding has obvious shared criteria: location, budget, commute). S4 had the latest onset — neither participant edited context at the start of the group task, and it was eventually set midway through.

### 4.2 Context Bypass Patterns

Three direct observations of context bypass — where a constraint was communicated conversationally rather than through the shared context panel:

1. **S1 — Samuel's hiking constraint.** Opened the context panel at 09:47:14, closed without saving at 09:47:24, then typed "i dont like nature hikes" in chat 9 seconds later. The clearest observable bypass: the participant considered the panel, rejected it, and defaulted to verbal communication. The constraint did not propagate through the system.
2. **S2 — Willson's west-commute constraint.** Stated "guys i need go the west" in chat at 08:19:30. The AI incorporated it within 31 seconds (08:20:01) without a context panel update. However, this was a natural verbal communication rather than an observed bypass — there is no evidence Willson considered the panel.
3. **S4 — East-commute constraint.** Introduced by the facilitator, treated as a conversational planning parameter by both participants. Neither opened the context panel in response. The cleaned notes attribute this partly to the study framing reducing felt urgency of recording it.

**Cross-session pattern:** In every group phase where a mid-session constraint was introduced, participants communicated it conversationally rather than recording it in the shared context panel. The panel was used most for initial task framing (when it was used at all) and was not naturally revisited for mid-session constraint updates.

### 4.3 Context Pathway Divergence — The Promote vs Save Split

The most striking within-session AQ3 finding is the Aung–Shanyl divergence in S3:

| Participant | Panel Saves (total) | Draft Promotes (total) | Context interaction style |
|---|---|---|---|
| Aung | 3 | 34 | Promote-dominant: sourced context from AI replies and generated insights |
| Shanyl | 2 | 0 | Panel-dominant: edited context panel directly |
| JC | 0 | 4 | Promote-only (no panel saves) |
| Willson | 3 | 2 | Mixed |
| Aly | 2 | 4 | Mixed |
| Royston | 0 | 0 | Non-engagement |
| Samuel | 1 | 0 | Panel-only |
| Val | 0 | 2 | Promote-only (late session) |
| Jen | 4 | 3 | Mixed |

Aung's 34 promotes represent a fundamentally different context interaction model. He treated AI outputs as raw material for context, promoting responses into drafts rather than manually editing the context panel. This is a design affordance being used as intended — the promote pathway was built to support exactly this workflow — but the disparity between Aung (34 events) and all other participants (0–4 promotes each) suggests it requires a specific cognitive model that most participants did not arrive at spontaneously.

### 4.4 Bilateral Context Management

Only one session (S2) produced bilateral context management — two participants independently updating shared context during a live group task:
- Willson promoted at 08:19:46 and 08:19:57
- Aly promoted at 08:22:44 and 08:23:06

In every other group session, context management was driven by a single participant (S3: Aung only; S4: Jen only) or not engaged with at all (S1 group: P1 set context early, no subsequent updates after P2's bypass). This suggests context management naturally defaults to single-owner behaviour in small groups, consistent with observed patterns in shared document editing.

### 4.5 AI_LIGHT Context Promotes — Not Silently Discarded

Code inspection and telemetry confirm that `draft_context_promoted` events in AI_LIGHT mode are processed: the frontend auto-prepends `@agent` to any post-promote message (`shouldForceAgentInvoke = draftContexts.length > 0`), routing it as an explicit agent request — the one AI invocation type permitted in AI_LIGHT. This mechanism fired for Aung's 5 AI_LIGHT promotes (S3), Aly's 2 AI_LIGHT promotes (S2), and no other participants. The AI's failure to incorporate promoted constraints in AI_LIGHT (e.g. S3's shortened trip constraint) is therefore a context retention limitation across turns, not a mechanical drop.

---

## 5. AQ4 — Coordination Support

### 5.1 AI_LIGHT Preference

Every session that collected post-condition feedback produced a preference for AI_LIGHT or an acknowledgment that AI_LIGHT was cleaner/simpler:

| Session | Feedback |
|---|---|
| S1 | Both: AI_LIGHT "more structured and cleaner" |
| S2 | **Unanimous** preference across all 3 participants (Willson: information overload; Royston: faster and focused; Aly: too many functions in full version) |
| S3 | Shanyl: not much difference but AI_LIGHT more straightforward. Aung: would use both in tandem (most nuanced response). |
| S4 | Jen: modes would have been more useful with scenarios swapped. Val: found AI_ON features valuable for specific structured tasks. |

**The preference progression is notable.** S1–S2 produced clear AI_LIGHT preference. S3–S4 produced more conditional responses — Aung proposed tandem use (the most analytically mature coordination strategy in the study), and Val found specific AI_ON features (Research mode structure, action items) genuinely useful for sub-tasks. The later sessions' conditional framing may reflect increasing participant sophistication, different task designs, or the cumulative effect of iterative tool improvements between sessions.

### 5.2 The Depth-First Individual AI Tangent Pattern

Observed most clearly in S2 (3 participants) and S3 (2 participants): participants in the group AI_ON phase pursued individual AI interactions rather than building shared reasoning. The AI kept the group loosely coordinated by generating uncontroversial, facilitative outputs — but this was an emergent property of the AI's prompt structure, not a product of the shared context mechanism.

Aly (S2) named this directly: the AI was "behaving like a teammate giving feedback and making decisions" — a social role she found inappropriate when three people were already present. The implication for AQ4: the AI's coordination contribution was social (maintaining group momentum through safe, consensus-oriented outputs) rather than structural (facilitating shared decision-making through context management and insight linkage).

### 5.3 AI as Compromise Generator, Not Divergence Handler

S4 produced the clearest demonstration. The trip planning hiking constraint required split itineraries; the AI generated a compromise incorporating both hiking and non-hiking activities into a single plan. Jen identified this as the AI treating the group as a single entity with a single plan rather than managing divergent stakeholder needs. This is a structural limitation of the prompt architecture: the AI's "teammate" persona defaults to consensus rather than accommodating genuine preference divergence.

The pattern recurs across sessions:
- **S2:** AI made "largely uncontroversial decisions" that kept the group on task but did not drive convergence on substantive disagreements.
- **S3:** AI's facilitative outputs were "insufficiently specific to resolve genuine creative disagreement" in the divergent project reconciliation task.
- **S4:** AI compromised on hiking constraint rather than proposing separate tracks.

### 5.4 Pre-Exposure Mental Models — Consistent Mismatch

| Session | Pre-exposure frame | Matched tool? |
|---|---|---|
| S1 | JC: chatbot-like. Samuel: research + team use. | No |
| S2 | Willson: Notion-style organiser. Aly: lightweight summary. Royston: centralised tabs. | No |
| S3 | Aung: multi-format output aggregation workspace. Shanyl: AI transparency indicator. | Partial — conceptually closest but execution gap |
| S4 | Val: delegation and sub-process task assignment. Jen: moderator for team dynamics. | No |

**No participant across any session arrived with a mental model that matched the workspace's actual interaction paradigm.** S3 participants (Aung and Shanyl) came closest — their mental models anticipated workspace-level features that the tool was designed to provide — but neither felt the tool delivered on those models. The mental model mismatch is not merely a first-impression phenomenon; it persists across the full session and shapes the exit evaluation.

### 5.5 Group Message Volume vs Condition

| Session | Group AI_ON | Group AI_LIGHT | AI_LIGHT / AI_ON Ratio |
|---|---|---|---|
| S1 | 37 | 29 | 0.78 |
| S2 | 43 | 58 | 1.35 |
| S3 | 30 | 51 | 1.70 |
| S4 | 30 | 20 | 0.67 |

S2 and S3 show the expected pattern: AI_LIGHT produces more conversational messages because the right panel is unavailable to absorb structured output. S4 inverts this, likely due to its smaller group (2 vs 3 participants in S2, same-size as S3 but shorter session spans). S1's marginal difference may reflect the thinner data and earlier stage of the tool.

---

## 6. AQ5 — Contextual Catch-Up

### 6.1 Formal Testing

Only S2 included a new-joiner scenario. Willson left the group session and rejoined with a west-side commute constraint. The AI incorporated the constraint within 31 seconds of his verbal statement (08:19:30 → 08:20:01 agent response) without re-prompting or a context panel update. The constraint persisted through the session: the final recommendation (10 minutes later, after 13 more messages) remained consistent with it. Both AI-generated summaries produced after the constraint was stated reference "Participant 01's need to be near the west."

**The context and summary artefacts functioned as catch-up resources.** The constraint was captured in the conversation history and propagated through the AI's Ask mode responses, which draw on full conversation context. No formal catch-up mechanism (e.g. reading a summary produced before the constraint) was tested, but the persistent constraint incorporation demonstrates that AI-generated artefacts produced during a group session retain mid-session context updates.

### 6.2 Participant-Generated Observations

Two participants independently identified the summary function as a catch-up mechanism without prompting:
- **Shanyl (S3):** "A new joiner could use the summary function to get up to speed without reading the full conversation history."
- **S1 debrief note:** At least one participant noted the tool was faster than conducting plain research independently — a weak catch-up signal.

### 6.3 Limitations

AQ5 was under-tested. Only one formal new-joiner scenario was conducted across 4 sessions. The evidence is thin: one log-verified constraint incorporation (S2) and one unprompted participant observation (S3). The summary function's viability as a catch-up mechanism is plausible based on the available evidence but not rigorously validated.

---

## 7. Cross-Cutting Patterns

### 7.1 Insight Status Attribution Gap — Study-Wide Assessment

All `insight_status_changed` events are attributed to `user1` due to a confirmed instrumentation bug (the `InsightActions` component hardcodes `userId='user1'` as a default; `InsightCard` never passes the actual userId). The actor attribution is unreliable for all sessions.

| Attribution confidence | Sessions | Rationale |
|---|---|---|
| **Likely participant** | S3 solo (Shanyl, Aung), S4 solo (Val, Jen) | Solo phases — participant was the active interface user. |
| **Ambiguous** | S1 Group AI_ON, S3 Group AI_ON | Group phase — multiple users present; cannot determine operator. |
| **N/A** | S2 | Zero `insight_status_changed` events from anyone. |

S1 is the only session where the dismissed-content concern materially affects the analysis — 10 of 14 group traceability clicks reached dismissed content. However, the operator of those dismissals is now unknown rather than confirmed-facilitator. The analytical caution on S1 Group AI_ON traceability data should be retained (dismissed content is dismissed regardless of who did it) but reframed as an attribution gap rather than a confirmed facilitator confound.

### 7.2 Insight Title Determinism — "Context and Objective"

The Research mode generation pipeline produces a deterministic title ("Context and Objective") for research-type insights across all sessions. This is a system-level finding: the `generateReport` prompt template does not dynamically title outputs based on content. The title appears in S2 (Aly, Royston, Willson Group AI_ON), S3 (Aung, Shanyl, Group AI_ON), and S4 (Val, Group AI_ON). It has no analytical significance for the study but should be noted in system design discussions — participants encounter identical titles for substantively different research outputs.

### 7.3 Q1/Q4 Survey Divergence Patterns

**Within-session Q4 divergence (S4):** Val and Jen entered with identical pre-session profiles (same Q1, Q2, Q3, Q4 responses) and exited with opposite Q4 scores (Val *Understood clearly*, Jen *Rough idea*). The divergence maps directly to Research mode engagement depth: Val used 4 manual-research messages front-loaded in her session; Jen used 1.

**Cross-session Q4 regression (S3):** S3 participants had the highest prior AI familiarity in the study (Shanyl: regular collaborative AI user; Aung: considered it). Both scored *Rough idea* — the lowest Q4 in the dataset. General AI literacy did not transfer to product-specific mode understanding.

**Q1 framing ambiguity (study-wide):** The Q1 source legibility question is interpreted as interface legibility by participants who rate Easy and as epistemic provenance by participants who rate Difficult. Val's S4 contradiction (Easy rating + verbal "not sure where facts came from") is the sharpest confirmation. This ambiguity should be acknowledged in the methodology chapter and the two dimensions treated separately in the AQ2 analysis.

### 7.4 The Accept/Dismiss Workflow — Participant Adoption via Instrumentation Bug Recovery

The `insight_status_changed` mechanism (accept, dismiss, archive workflow for right-panel insights) was used in 3 of 4 sessions (20 events total). All events carry `actorUserId=user1` due to a confirmed instrumentation bug (A4 revised), but in solo phases the participant is the presumptive operator. This represents genuine participant adoption of the insight lifecycle in S3 and S4 solo phases:

- **Shanyl (S3):** 5 events — explored Quick Start Help statuses, accepted 2 action items during solo work
- **Aung (S3):** 4 events — accepted Quick Start Help and Context+Obj, dismissed one suggestion, archived one
- **Val (S4):** 2 events — accepted Quick Start Help and one action item
- **Jen (S4):** 4 events — accepted Quick Start Help, one suggestion, one summary, one action item

The accept/dismiss workflow was adopted by at least 4 of 9 participants (those in solo phases where attribution is recoverable). S1 group-phase events (3 dismissals, 1 acceptance) remain ambiguously attributed. S2 had zero events from anyone.

The `draft_context_promoted` mechanism was adopted by 5 of 9 participants. Together, these two mechanisms show that participants engaged with AI output through multiple pathways — both the promote-as-context-draft flow and the accept/dismiss lifecycle.

### 7.5 Auto-Classification — Systemic Ask Bias

The auto-classifier achieved zero autonomous Research classifications across all sessions captured in the routing CSV. The classifier was active and running in every session (returning confidence scores ranging from 0.655 to 0.957) but defaulted to Ask for every message it handled. The S4 researcher noted auto-classification was "largely non-functional" — an accurate description, but the issue is classifier bias rather than system failure. The classifier requires explicit research-intent keywords ("research", "investigate", "study") and a high confidence threshold to trigger Research; typical participant messages did not contain these keywords.

Practically, participants experienced the tool as a gated system requiring explicit invocation rather than an ambient AI that classifies and routes autonomously. This shaped the AQ4 coordination finding: the tool could not function as an ambient coordinator because the AI only activated when explicitly invoked. Jen (S4) articulated the desired alternative: "AI should read context passively and generate suggestions on the side without explicit invocation."

### 7.6 Condition Order — Not a Confound

All sessions ran AI_ON before AI_LIGHT. Timestamps and cleaned notes are authoritative for within-session presentation order. The `condition_audit.csv` `run_order` field reflects a counterbalancing code, not the actual presentation sequence. Since all sessions used the same order (Solo AI_ON → Group AI_ON → Group AI_LIGHT), the AI_LIGHT preference findings (§5.1) should be interpreted with the caveat that participants always experienced AI_LIGHT after AI_ON — the preference may partially reflect a learning/fatigue effect rather than pure condition preference.

### 7.7 Reply-Context Bug (Fixed 2026-03-29)

The reply-context bug — where `parentMessageId` was extracted but never passed to the LLM, causing the agent to infer reply targets from recency only — was present in S1–S3 and fixed before S4. Shanyl (S3) explicitly flagged misleading suggestions surfacing from incorrect reply context. This is a study-period finding: the bug was real during data collection and the AQ2 observations from S3 are valid study-period data, not reflections of the tool's current state.

---

## 8. Summary of Signal Strength by AQ

| AQ | Strongest session(s) | Study-wide finding | Confidence |
|---|---|---|---|
| **AQ1** | S2 (3 participants, clearest learning arcs), S4 (Val's unique Research-first arc) | Ask Assistant is the de facto primary mode. Research mode depth gap is the primary routing design obstacle. Auto-researcher never triggered Research autonomously. Override rates are high but reflect sticky mode-locking rather than per-message decisions. | **Moderate–strong** |
| **AQ2** | S4 (Jen's 21 clicks + Q1 framing ambiguity), S3 (solo engagement + group inversion) | Traceability feature is discoverable and used in solo but collapses in group. Q1 measures interface legibility, not epistemic provenance. Source legibility divergence is driven by mode engagement depth, not pre-session provenance concern. | **Moderate** |
| **AQ3** | S2 (bilateral context, fastest onset), S3 (Aung promote pathway, Shanyl panel pathway) | Context bypass is the default for mid-session constraints. Two distinct context pathways exist (panel save vs promote). Context management defaults to single-owner in groups. AI_LIGHT promotes are processed, not discarded. | **Strong** |
| **AQ4** | S2 (unanimous AI_LIGHT preference), S4 (AI compromise limitation, Jen's scenario swap) | Unanimous AI_LIGHT preference (S1–S2) softening to conditional in S3–S4. AI acts as soft facilitator, not convergence driver. Depth-first individual AI tangent pattern in group phases. Universal pre-exposure mental model mismatch. | **Strong** |
| **AQ5** | S2 (formal test: Willson rejoin) | Under-tested. One log-verified constraint incorporation (31s uptake). Summary identified as catch-up mechanism by Shanyl (S3) unprompted. Plausible but not rigorously validated. | **Weak** |

---

## 9. Telemetry vs Qualitative Alignment

### 9.1 Confirmed Alignments

The following qualitative observations from cleaned notes are directly confirmed by telemetry data:

1. **JC's routing confusion (S1):** "did not know when the AI was being triggered" — confirmed by 71% override rate and sticky-mode behaviour.
2. **Aly's self-directed onboarding (S2):** "asked the bot directly to figure out what the action feature does" — confirmed by 100% override rate (zero auto-classifications accepted).
3. **Aung's reply-as-context workaround (S3):** "used the reply function extensively to provide contextual specificity" — confirmed by 21 `draft_context_promoted` events in solo (highest in study).
4. **P2's context panel bypass (S1):** "opened context panel then typed constraint in chat" — confirmed by 09:47:14 panel open → 09:47:24 close → 09:47:33 chat message.
5. **S2 bilateral context management:** "shared context set and edited quickly" — confirmed by Aly panel save at 08:15:18, Willson promotes at 08:19:46–08:19:57, Aly promotes at 08:22:44–08:23:06.
6. **Shanyl's traceability-by-scrolling (S3):** "used chat history as a provenance mechanism" — confirmed by 5 genuine clicks coexisting with verbal description of scroll-based navigation.
7. **Jen's insights panel navigation (S4):** "used insights panel scroll as traceability strategy" — confirmed by 21 clicks dominated by `focus_chat_marker_from_insight` / `jump_to_chat_marker` pairs (panel→chat direction).
8. **Val's Research-first arc (S4):** "used force Research mode from the start" — confirmed by messages 3–6 all being manual-research overrides.
9. **Willson's new-joiner constraint uptake (S2):** "agent incorporated constraint relatively quickly" — confirmed by 31s gap (08:19:30 → 08:20:01) and persistent constraint in all subsequent agent responses.
10. **Jen's AI toggle exploration (S4):** "turning on and off assistant" — confirmed by 4 `team_ai_toggle_changed` events in 18 seconds, the only toggle events in the study.

### 9.2 Minor Discrepancies

1. **Jen's solo context saves (S4):** The analysis table reports 3 saves. Telemetry shows 4 `task_context_saved` events, but 2 at 08:02:55.420Z have identical content — a duplicate event, not a distinct save. True unique saves: 2 solo + 1 group = 3 total. The analysis table count is correct by intent (unique saves), not by raw event count.

2. **S1 Group AI_ON override rate:** The S1 analysis reports 92% for the combined group. The per-participant routing data shows P1 at 90% (19/21) and P2 at 94% (15/16). The combined rate is (19+15)/(21+16) = 34/37 = 92%. Correct.

3. **Royston's cleaned notes vs telemetry (S2):** Cleaned notes describe him as "Ask-only throughout solo." Telemetry shows 3 manual-research and 3 manual-ask. Resolved by early/late phase split: 3 Ask early, 3 Research late. Notes reflect settled behaviour; telemetry captures full arc.

### 9.3 No Unresolved Disparities

All quantitative claims in the four analysis files have been verified against CSV telemetry data. No unresolved disparities between the analysis files and the cleaned observational notes were identified. Qualitative observations align with telemetry patterns in every case where both data sources cover the same behaviour.

---

## 10. Methodological Notes for Thesis

### 10.1 Data Source Heterogeneity

Insight generation data uses two different reconstruction mechanisms (`timeline_event` for S1/S4, `export_fallback` for S2/S3). Counts are comparable after seed filtering but the underlying data source differs. The `data_source` column in `insight_generations.csv` distinguishes these. The heterogeneity is a consequence of instrumentation changes between sessions and should be noted as a limitation.

### 10.2 Seed Data Filtering

Each participant's export contained one pre-seeded "Quick Start Help" suggestion, timestamped the day before the session (S2–S3) or ~21 minutes before session start (S4). These must be excluded from genuine insight counts. The seed detection strategy (timestamp comparison against session dates) works reliably for S2–S3 seeds (13–17h gap) but is less effective for S4 seeds (~21min gap). S4 seeds were identified by content match and facilitator acceptance patterns.

### 10.3 Condition Order

All sessions presented conditions in the same order (Solo AI_ON → Group AI_ON → Group AI_LIGHT). There was no counterbalancing. The AI_LIGHT preference findings should be interpreted with this caveat — a fatigue or learning effect cannot be ruled out as a contributing factor.

### 10.4 Sample Size

9 participants across 4 sessions. S2 (3 participants) is the only session with more than a dyad. Individual-level findings (override rates, traceability patterns) have reasonable within-participant validity. Cross-participant generalisations are limited by the small sample.

### 10.5 Insight Status Attribution

All `insight_status_changed` events are attributed to `user1` due to a confirmed instrumentation bug (InsightActions component default). In solo phases, participants are the presumptive operators. S1 Group AI_ON had 3 dismissals where attribution is ambiguous — the dismissed-content concern for S1 traceability data should be retained but acknowledged as an unresolved attribution gap rather than a confirmed facilitator confound. S2 had zero workflow events from anyone.
