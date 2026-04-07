# Underrepresented Findings Audit

Six areas flagged as potentially understated or missing from the current Chapter 6/7 drafts. Each investigated against the behavioral logs, exported CSVs, cleaned observer notes, and session analysis files.

---

## 1. Feedback Quality on AI Outputs (Thumbs Up/Down)

### What the data shows

Every session CSV carries `feedbackType`, `feedbackReason`, `feedbackComment` columns. Across all sessions and phases:

| Session/File | Positive | Negative | Comments |
|---|---|---|---|
| S1 JC solo (team-01) | 1 | 1 | Negative: "Did not enter into context" |
| S1 AI-Light group (team-05) | 0 | 1 | "bro does not know ball" |
| S3 Aung solo (team-01) | 1 | 0 | — |
| S3 Shanyl solo (team-02) | 2 | 0 | — |
| S3 Group AI-On (team-04) | 8 | 0 | — |
| S4 Jen solo (team-02) | 1 | 0 | — |
| S4 Group AI-On (team-04) | 4 | 0 | — |
| S4 AI-Light group (team-05) | 5 | 0 | — |
| **Total** | **22** | **2** | |

**S2 recorded zero feedback events across all three participants and all phases.**

### Assessment

The data exists but is **too sparse and too skewed to support a quantitative finding.** 22 positive vs 2 negative across 4 sessions is an adoption metric (most participants didn't use the feature systematically), not a quality metric. The 91% positive rate tells you more about which responses people bothered to rate (memorable/useful ones) than about overall AI quality.

The two negative comments are individually interesting:
- JC's "Did not enter into context" = the response failed to incorporate project context he expected → supports the RAG/context gap finding.
- The AI-Light "bro does not know ball" = colloquial dismissal of AI accuracy → supports the Research mode depth gap.

### Verdict

**Not a standalone finding.** The feedback mechanism was underused (S2 zero events; most sessions < 5 events). Not enough data density to claim patterns like "Research mode rated lower" or "ratings drop over session length." The two negative comments are useful as supporting quotes for existing findings (context gap, depth gap) but shouldn't be framed as a systematic rating analysis.

**Recommendation:** Mention in the methodology limitations that the inline feedback mechanism was available but underutilized, which itself is a minor finding about feature discoverability. Cite the two negative comments as corroborating evidence where relevant.

---

## 2. Reply-as-Context Workaround (P3a / Aung)

### What the data shows

The S3 analysis file already documents this explicitly:

> "Aung used the reply function as a creative workaround to inject contextual specificity — a mechanism designed for peer-to-peer threading repurposed as an AI prompt-refinement tool."

From the S3 cleaned notes:
- "Began by replying to the starting prompt, then shifted to direct @agent messages"
- "Used the reply function extensively and intentionally — specifically to provide contextual specificity to the AI"
- "Noted the reply indicator" (was aware the UI showed it differently)

The cleaned notes also record a **reply+help interaction bug** specific to S3: "reply and help features cancelled each other out" — when Aung used reply, the routing metrics were affected.

From the analysis:
- "Aung's use of reply as a context-specificity mechanism is a notable creative workaround — using a feature outside its primary design purpose"
- The reply-context bug meant "parentMessageId was extracted but never passed to the LLM; agent inferred context from the conversation window, not from the replied-to message specifically"

### Assessment

The finding is already stated in the S3 analysis and cleaned notes, but it's **framed as a participant-level observation rather than elevated to a design-level finding.** The current treatment describes *what Aung did* but doesn't fully draw the design implication: the prompt interface was perceived as insufficiently specific by at least one technically engaged participant, who then invented a workaround using an adjacent feature.

This is more than confirming observed behavior — it reveals that the single-input-box chat paradigm creates a specificity gap when users want to refer to or build on prior AI outputs. The reply function was the only available mechanism to anchor a new prompt to a specific prior exchange, and Aung found it independently.

**Counterweight:** The reply-context bug means the workaround didn't actually work as Aung intended (the parent message wasn't injected into the LLM context). So Aung was doing something creative that *felt* right to him but was technically inert. That's a perception/mental model finding, not a functional one.

### Verdict

**Understated. Deserves elevation from S3 participant note to a design finding.**

Suggested framing for Chapter 7: The reply-as-context workaround reveals a prompt-specificity gap in the single-input chat paradigm. Users who want to build iteratively on prior AI outputs lack a native mechanism to do so — the reply function filled that gap perceptually (if not technically). This implies a design requirement for explicit conversation threading or prompt-chaining in future iterations.

One participant (1 of 8) is thin evidence for a standalone finding, but it's strengthened by:
- Jen (S4) noting "limited conversational length of AI in main chat meant the response wasn't detailed enough" → same underlying tension about controlling AI depth/focus through the chat interface.
- JC (S1) noting "Replying to individual messages within the tool not felt as enough to warrant threaded replies" → JC considered and rejected the same mechanism Aung adopted, which means two participants independently evaluated it.

---

## 3. Engagement Trajectory Over Sessions

### What the data shows

Message distribution across session thirds (active window only, gap > 30 min filtered):

| Session | Condition | Duration | User 1st Third | User 2nd Third | User 3rd Third | Pattern |
|---|---|---|---|---|---|---|
| S1 | AI-On | 17 min | 8% | 38% | 54% | **Accelerating** |
| S1 | AI-Light | 14 min | 72% | 24% | 3% | **Decelerating** |
| S2 | AI-On | 10 min | 30% | 60% | 9% | **Middle-heavy, drop at end** |
| S2 | AI-Light | 11 min | 27% | 29% | 44% | **Accelerating** |
| S3 | AI-On | 13 min | 57% | 30% | 13% | **Decelerating** |
| S3 | AI-Light | 9 min | 32% | 32% | 36% | **Flat/slight acceleration** |
| S4 | AI-On | 12 min | 50% | 13% | 37% | **U-shaped (middle dip)** |
| S4 | AI-Light | 11 min | 50% | 15% | 35% | **U-shaped** |

### Assessment

**No consistent pattern across sessions.** The hypothesis was that AI-On engagement drops over time (information overload) while AI-Light remains flat or accelerates. The data doesn't cleanly support this:

- S1 shows the expected pattern (AI-On accelerates late, suggesting participants adapted; AI-Light front-loaded then ran out of questions).
- S2 shows the *opposite* pattern (AI-On collapses in the final third; AI-Light accelerates).
- S3 shows AI-On decelerating and AI-Light staying flat — partially consistent.
- S4 shows both conditions with a middle dip, no differentiation.

The 10–17 minute active windows are also very short. Splitting into thirds gives bins of ~4 minutes each, which is too crude for trajectory analysis with N=2 or N=3 participants per group phase.

### Verdict

**Not a viable finding.** Session windows are too short and participant counts too small for engagement trajectory to be meaningful. The message volume data is better used as raw counts (already in the analysis) than as temporal distributions. If you wanted to make this work, you'd need inter-message intervals rather than aggregate bins — but even then, 10-minute windows with 2 people don't produce reliable trajectory data.

**Not recommended for inclusion.**

---

## 4. Help Mode Usage and Outcomes

### What the data shows

**Quick Start Help cards** were seeded into every solo session as `suggestion` type insights:

| Session | Participant | Quick Start Help Status | Notes |
|---|---|---|---|
| S1 | JC | `new` (untouched) | S1 used "Demo: Help Card" variant instead |
| S1 | Sam | `new` (untouched) | Same Demo format |
| S2 | Willson | `new` (untouched) | Clicked once (~17 hours after creation — seed artifact) |
| S2 | Aly | `new` (untouched) | — |
| S2 | Royston | `new` (untouched) | — |
| S3 | Aung | **`accepted`** | Accepted the Quick Start Help |
| S3 | Shanyl | `new` → `accepted` → `archived` → `new` | Cycled through statuses (facilitator test artifact, not genuine use) |
| S4 | Val | **`accepted`** | Accepted the Quick Start Help |
| S4 | Jen | **`accepted`** | Accepted the Quick Start Help |

**Content of the Quick Start Help card:**
> "If you are not sure where to begin: Use center chat to explore ideas and ask questions. Use Summary for a clear recap. Use Research to compare options..."

**S1's earlier "Demo: Help Card" variant:**
> "## Unblock — Use when discussion stalls or choices feel unclear. Ask for 2-3 practical options. Pick one next step and continue in chat."

### Assessment

Three participants (Aung, Val, Jen) accepted the Quick Start Help. The S3 analysis notes that Shanyl's cycling was a facilitator artifact. S2 participants ignored it entirely. S1 used a different format (Demo: Help Card) that was also ignored.

There's no behavioral data showing **return visits** to the Help card after acceptance. Panel navigation logs show tab switches but not navigation within a tab back to a specific card.

The cleaned notes contain almost no participant commentary about the Help card specifically. Jen (S4) is the closest — noting that the "fixed insight prompt structure found too concise" — but this was about research insights, not the help card.

### Verdict

**Minor finding, currently correctly weighted.** The Quick Start Help card had a ~38% acceptance rate (3 of 8 participants) but no evidence it changed behavior. Participants who accepted it may have simply been clearing the "new" badge rather than learning from it. There's no return-visit data to confirm ongoing utility.

The more interesting observation is the **format evolution** between S1 (Demo: Help Card with "Unblock" framing) and S2-S4 (Quick Start Help with feature-oriented instructions). But this was a researcher design decision, not a participant finding.

**Recommendation:** Worth one sentence in the methodology or 7.2.3 (progressive disclosure/onboarding) noting that seeded help cards were available, accepted by ~38% of participants, but without evidence of behavioral impact. The S2 "self-directed onboarding via the bot directly" observation (from the cleaned notes) is the stronger onboarding finding — participants preferred to learn the tool by using it, not by reading a card.

---

## 5. Cross-Participant Variation in S2 (3-Person Group)

### What the data shows

**S2 AI-On group (3 participants):**

| Participant | Messages | % of User Msgs | Avg Words/Msg | Role |
|---|---|---|---|---|
| study-user-02 (Aly) | 26 | 60% | 4 words | **Driver** — dominated message volume |
| study-user-01 (Willson) | 9 | 21% | 6 words | Lower contributor |
| study-user-03 (Royston) | 8 | 19% | 9 words | Lowest volume, longest messages |
| agent | 20 | — | 51 words | — |

**S2 AI-Light group (only 2 participants active):**

| Participant | Messages | % of User Msgs | Avg Words/Msg |
|---|---|---|---|
| study-user-02 (Aly) | 25 | 42% | 4 words |
| study-user-01 (Willson) | 23 | 39% | 6 words |
| agent | 22 | — | 76 words |

Royston did not appear in the AI-Light group data (0 messages).

### Assessment

**Aly dominated the AI-On group phase with 60% of user messages** — a 3:1 ratio over Willson and Royston. This is a clear driver/observer split in the 3-person group. In AI-Light, the split normalized to near-equal (42% vs 39%) but Royston dropped out entirely.

The S2 analysis already captures the "depth-first individual AI tangent pattern" and notes that the workspace "subtly encourages individual AI interaction at the expense of group coordination." But the **quantitative driver/observer split** isn't explicitly discussed.

From the S2 analysis:
> "Aly's human reply prominence note is the most actionable design-level AQ4 finding: the tool's visual hierarchy currently prioritizes AI responses over human replies."

This connects directly: when one person is driving AI interaction (60% of messages), the other two are observing AI responses scroll past — exactly the condition under which "human reply prominence" becomes critical. If Willson or Royston tried to contribute a human message, it would be buried under Aly's AI interaction thread.

### Verdict

**Understated. The 60/21/19 split is worth stating explicitly.**

It's the only session with 3 participants, so it's the only place to observe how AI-mediated group dynamics scale beyond dyads. The finding: a single participant naturally became the "AI driver" in the group, concentrating 60% of message volume, while others observed. In AI-Light (where AI was less dominant), participation rebalanced to near-equal.

This supports the information overload / depth-first tangent finding with a concrete mechanism: in high-AI conditions, one person tends to monopolize the AI interaction channel, creating a de facto driver/observer asymmetry. The normalization in AI-Light suggests the AI's presence (not just the task) shaped the participation distribution.

**Recommended for:** Chapter 6.6 cross-cutting findings (as a concrete quantification of the depth-first tangent pattern) and Chapter 7 (as a design implication about multi-user AI interaction equity).

**Caveat:** N=1 triad. This is a pattern observation, not a generalizable finding. Frame it as "observed in the only 3-person session" and note it warrants further study.

---

## 6. Re-Reading / Re-Using Accepted Insights

### What the data shows

**Traceability click events by insight final status:**

| Insight Status | Clicks |
|---|---|
| new | 33 |
| accepted | 22 |
| dismissed | 11 |
| archived | 4 |
| unknown | 7 |

**Accepted insights with click counts:**

| Session | Insight | Clicks | Title |
|---|---|---|---|
| S1 | 08fd5ea5 | 3 | "Here's a detailed comparison of bus operators and..." |
| S3 | 5d1e60b2 | 1 | "Develop a detailed storyline for the Day in the Life..." |
| S3 | bd5d192e | 2 | "Decide on the theme and genre of the short film" |
| S4 | a4d77fc5 | 1 | "Research the impact of new infrastructure on culture..." |
| S4 | 0749ba94 | **11** | "Define specific focus areas for your research paper..." |
| S4 | a6e0ca65 | 4 | "Outline the Research Paper Structure..." |

**Most re-read insights (2+ clicks, any status):**

| Session | Clicks | Status | Title |
|---|---|---|---|
| S4 | **11** | accepted | "Define specific focus areas for your research paper..." |
| S1 | 7 | dismissed | "Visit Johor Bahru, Malaysia" |
| S3 | 4 | archived | "Context and Objective" |
| S4 | 4 | new | "Develop a Weekly News Aggregation Plan" |
| S4 | 4 | accepted | "Outline the Research Paper Structure..." |
| S1 | 3 | dismissed | "Context and Objective" |
| S1 | 3 | accepted | "Here's a detailed comparison of bus operators and..." |

### Assessment

**This is a genuine finding that's currently absent from the analysis.**

The standout data point: Jen's "Define specific focus areas" insight received **11 traceability clicks** — by far the highest for any insight in the study. This was an accepted insight, meaning Jen committed to it and then returned to it repeatedly. That's behavioral evidence of an insight functioning as a working reference document, not just a one-time read.

The split between "accepted insights get revisited" and "dismissed insights also get clicks" is also interesting:
- 22 clicks on accepted insights = insights that were adopted continued to be referenced.
- 11 clicks on dismissed insights = participants clicked through to dismissed content too. The S1 analysis already notes that "10 of 14 clicks were to already-dismissed insights" — participants navigated to content they'd rejected, possibly reconsidering or using the traceability link to cross-reference chat.

**Panel navigation data** (23 tab switches across all sessions): too sparse to determine within-tab navigation patterns. The tab switches show exploration behavior (cycling through All → Summaries → Research → Suggestions → Actions) but don't reveal re-reading of specific cards.

### Verdict

**Genuine missing finding.** Two specific claims are supportable:

1. **Accepted insights functioned as working reference documents.** Jen's 11 clicks on a single accepted insight is the strongest behavioral evidence that the accept/dismiss workflow has genuine utility beyond triage — accepted content became a touchstone for ongoing work. The S1 and S3 accepted insights with 2-4 clicks support this at smaller scale.

2. **Dismissed insights still attracted navigation.** 11 clicks on dismissed insights across S1 (7 on a single dismissed JB suggestion, 3 on a dismissed Context and Objective) suggest that "dismissed" didn't mean "irrelevant" — it meant "not accepted into the workflow" while still being consulted. This complicates the accept/dismiss binary and supports a design recommendation for a "reference" or "maybe later" status between accept and dismiss.

**Recommended for:**
- Chapter 6.6 — as a cross-session finding about insight utility persisting beyond the accept/dismiss action.
- Chapter 7.2 — as a design implication about the accept/dismiss workflow: the binary may be insufficient, and a "reference" intermediate state could match observed behavior.

---

## Summary Table

| Area | Data Available? | Is It a Finding? | Currently in Chapters? | Recommendation |
|---|---|---|---|---|
| 1. Feedback quality (thumbs up/down) | Yes but sparse (24 total events) | No — adoption metric, not quality metric | No | Mention as methodology limitation; cite 2 negative comments as supporting quotes |
| 2. Reply-as-context workaround | Yes — cleaned notes + analysis | Yes — design-level prompt-specificity gap | S3 analysis only (participant-level) | **Elevate to Chapter 7 design finding** |
| 3. Engagement trajectory | Yes — timestamps available | No — sessions too short, N too small | No | Not recommended for inclusion |
| 4. Help mode | Yes — status data, content | Minor — 38% acceptance, no behavioral impact evidence | Barely mentioned | One sentence in 7.2.3 onboarding section |
| 5. S2 cross-participant variation | Yes — message counts per user | Yes — 60/21/19 driver/observer split | Partially (depth-first tangent) | **State the quantitative split explicitly in 6.6** |
| 6. Insight re-reading | Yes — traceability click counts | Yes — 11 clicks on single accepted insight | Not analyzed | **Add to 6.6 and 7.2 as new finding** |

### Top 3 additions to draft:

1. **Insight re-reading** (#6) — strongest new finding. Jen's 11-click pattern on a single accepted insight is the clearest behavioral evidence for the accept/dismiss workflow as genuinely useful. Dismissed-insight navigation complicates the accept/dismiss binary.

2. **S2 driver/observer split** (#5) — the 60/21/19 ratio quantifies the depth-first tangent finding in the only triad session. Worth stating explicitly as a concrete mechanism by which AI presence shapes group participation equity.

3. **Reply-as-context elevation** (#2) — currently buried as a participant note. Deserves framing as a design finding about the prompt-specificity gap in single-input chat paradigms.
