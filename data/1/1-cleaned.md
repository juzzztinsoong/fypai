# Session 1 — Cleaned Record

**Participants:** JC (P1), Samuel (P2)
**Structure:** Solo AI-on → Team AI-on → Team AI-light
**Scenarios:** General project scoping (solo), Trip planning /
Kuala Lumpur with hiking conflict (team AI-on),
Podcast project concept (team AI-light)
**Note on data quality:** Original survey iteration. Some buggy
behaviours present; participant fatigue evident toward end of
session. Post-session material treated as qualitative notes rather
than survey responses due to instrument divergence. Actionable
bugs identified in this session were resolved before Session 2.

---

## Pre-Session Survey

| | JC (P1) | Samuel (P2) |
|---|---|---|
| **Q1** AI tools for group decisions | Sometimes | Rarely |
| **Q2** Quick questions vs. deep research (1–5) | 5 | 4 |
| **Q3** Importance of knowing AI source (1–7) | 3 | 4 |
| **Q4** Confidence in digital coordination (1–7) | 5 | 5 |
| **Q5** Expectations of tool | Expected something chatbot-like; hedged and uncertain about what differentiated it | Expected it to be good at research and for team use |

**Analytical note on Q5:** Both responses reflect a pre-exposure
mental model anchored to generic AI assistants with no clear sense
of what a collaborative workspace adds. JC's hedging suggests low
prior conceptual framing for this category of tool. The question
was subsequently revised to a spoken prompt more directly
eliciting comparison with group chat AI. Responses here are thinner
than later rounds but usable as a baseline mental model anchor
for AQ4.

---

## Phase 1 — First Impressions & Solo AI Use

### JC (P1)

**Onboarding / orientation:**
- Onboarding cards found confusing — insufficient contextual
  grounding for the workspace paradigm. Subsequently streamlined
  before Session 2.
- Difficulty distinguishing between chat-directed and AI-directed
  interaction — unclear when a message would trigger the AI versus
  appear as a group message. Interface cues for mode distinction
  absent or insufficient.

**Routing and AI interaction:**
- Did not spontaneously distinguish between Ask and Research modes.
- Research responses perceived as too verbose — length unexpected
  and disruptive to workflow.
- Context tuning felt off; having to re-ask questions due to
  context not being retained noted as frustrating.
- Dismissed items reappearing — flagged as a bug, subsequently
  fixed.
- Deciding which category to assign to a query described as
  adding cognitive load.

**Interface:**
- [Inferred] Request for a simpler, less spatially spread-out UI —
  likely referring to the toolbar or bottom panel layout.

### Samuel (P2)

**Onboarding / orientation:**
- Arrived with a mental model of the tool as either a centralised
  chat onboarding app or a meeting tool — neither matched the
  actual workspace paradigm.

**Routing and AI interaction:**
- Encountered a bug in the Ask Assistant function, subsequently
  fixed.
- Found the assistant comparable to a generic chatbot — not
  experienced as meaningfully more useful for lighter research
  tasks.

---

## Phase 2 — Team AI-On (Trip Planning — Kuala Lumpur)

**Scenario:** Group trip planning. Conflict introduced mid-session:
Samuel does not like hiking.

**Coordination and context propagation:**
- Both participants defaulted to and remained in Ask mode
  throughout. Did not spontaneously switch to Research.
- [Inferred] Expectation that the AI would proactively know more
  and adapt without explicit mode switching.
- [Unclear from notes] Whether the hiking constraint introduced
  via context update was noticed and incorporated by JC without
  explicit re-statement from Samuel.

**Technical friction:**
- `/research` slash command caused message deletion — bug,
  subsequently fixed.
- Markdown formatting rendering issues noted.
- Chat markers described as useful — one of the few features
  receiving a positive mention in this session.

**Interface:**
- Request to hide or resize bottom panel.
- General sense that the UI needed simplification — too many
  visible elements simultaneously.

---

## Phase 2 (cont.) — Team AI-On Debrief (Trip Planning)

*Individual participant feedback on the trip planning AI-on
experience, collected after the team task.*

### Samuel
- Wanted the tool to provide more direct, adequate answers and
  pull from internet searches more visibly. [Note: lack of live
  internet search access by the AI agents was the likely driver
  of this — participants expected web-grounded responses and did
  not receive them.]

### JC
- Preferred a cleaner interface.
- Did not want to query via the group chat — collaborative AI
  interaction mode felt like the wrong default.
- Long AI responses felt disruptive to collaborative flow;
  shorter responses felt better.
- Collaborative features perceived as friction rather than support
  at this exposure level.

---

## Phase 3 — Team AI-Light (Podcast Project Concept)

*Collated feedback across both participants.*

- AI-light condition perceived as more structured and cleaner
  compared to AI-on.
- Neither participant found the full AI-on feature set immediately
  comprehensible or valuable — consensus that the tool would need
  significantly more tuning before users would appreciate the
  additional features.
- Suggestion of a middle ground for output tuning — neither fully
  verbose AI-on nor stripped-back AI-light felt optimal.
- Dense text content within messages noted as distracting from
  the conversational flow.

---

## Overall Debrief Comments

### Samuel
- Primary desire: an integrated AI agent that provides direct
  answers within the chat flow without requiring explicit mode
  selection.

### JC
- Tool felt cluttered overall.
- Responses across the board should be shorter and more concise.
- Expressed preference for interacting only with the main chat —
  did not feel the need to engage with the right panel at all.
- Context panel and sidebar features not perceived as adding value
  in this session.

---

## Post-Session Qualitative Notes

*Treated as observer and debrief notes rather than survey
responses, given instrument divergence and session fatigue.
Overall sentiment reflects lower satisfaction and openness than
later sessions, partly attributable to bug encounters and response
verbosity.*

- Replying to individual messages within the tool not felt as
  useful — the level of collaborative discussion was not deep
  enough to warrant threaded replies.
- Ability to regenerate or re-surface previously produced content
  noted as a desirable feature.
- Trip planning to Kuala Lumpur (team AI-on): at least one
  participant noted the tool was faster than conducting plain
  research independently — a rare positive signal in this session.
- Confidence in the final output was low. Concern about
  information sourcing raised explicitly — participants wanted
  clearer provenance for AI-generated suggestions. Likely linked
  directly to the absence of live internet search access: without
  web-grounded responses, the origin and reliability of AI output
  was opaque. [Raw note truncated; full statement not
  recoverable.]
- Overall tone: lower trust and engagement than later sessions.
  Bug encounters, response verbosity, and missing search
  grounding are the primary confounding factors for this round.

---

## Analytical Flags — Mapped to AQ Framework

**AQ1 — AI Routing Behaviour**
Neither participant spontaneously used Research mode across any
phase. Both defaulted to Ask and remained there throughout. More
significantly, the mode distinction itself was not legible from
the interface at this stage — JC explicitly noted not knowing
when the AI was being triggered at all, which precedes any
routing decision. This suggests the routing legibility problem
is upstream of mode choice: participants cannot select
appropriately between modes if the boundary between chat and
AI interaction is itself unclear. Cognitive load of category
assignment (JC) is a secondary signal pointing to the same
issue. Early-round baseline: routing accuracy effectively zero,
but confounded by interface ambiguity rather than pure mode
misunderstanding.

**AQ2 — Traceability and Trust**
Provenance concern raised explicitly in debrief by at least one
participant. Trust in AI output was low, but the primary driver
appears to be the absence of internet search grounding rather
than the traceability UI specifically — participants did not know
whether suggestions were based on real, current information.
This is a distinct concern from navigating insight-to-source
linkage within the tool. The formal traceability task was not
run or not captured in this session. Treat as a weak early
signal: provenance matters to these participants, but the
confound with missing search capability limits what can be
attributed to traceability feature design specifically.

**AQ3 — Shared Understanding**
The hiking constraint was verbally communicated by Samuel directly in the chat rather than added to the shared project context. This represents a bypass of the context mechanism entirely — the natural instinct was to state the constraint conversationally rather than record it as shared context. Whether the AI agent incorporated the constraint in subsequent responses is unclear; no downstream prompt or response visibly reflected it. The net result is that the constraint existed as a verbal message in the chat history but not as structured shared context, and its effect on AI outputs was unverifiable. This is a meaningful early signal for AQ3: the context panel was not seen as the natural or intuitive place to record a mid-session constraint, and the fallback to verbal communication meant the information did not propagate through the system in a way that would have been visible to a new joiner or traceable in the context panel. Weak signal given session quality, but directionally consistent with what later sessions would reveal about context panel discoverability.

**AQ4 — Coordination Support**
The strongest signal from this session maps to AQ4. Both
participants converged on a preference for a simpler, more
integrated AI interaction — closer to a group chat with an
embedded AI than a structured workspace. The collaborative
features were experienced as overhead. JC's explicit preference
for not querying via group chat and Samuel's desire for a
directly answering agent both suggest the workspace paradigm
did not match the mental model either participant brought.
This is the most analytically useful signal from Session 1
given the data quality limitations, and maps directly to the
AQ4 framing of how workspace coordination differs from group
chat AI expectations.

**AQ5 — Contextual Catch-Up**
Not applicable to Session 1. No new joiner scenario was run.
No catch-up artifact usage was observed or elicited.

---

## Data Quality Caveat

Session 1 is the thinnest data source of the four rounds.
Think-aloud coverage is partial; post-survey instrument diverges
from the final version; participant fatigue and bug encounters
are active confounds. The AQ4 mental model finding and the AQ1
routing legibility signal are the most reliable takeaways.
All other observations should be treated as early directional
signals, weighted less heavily than Sessions 2–4 in cross-session
synthesis.