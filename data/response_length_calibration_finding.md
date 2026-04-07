# Displaced Finding: Dual-Channel Response Length Calibration Gap

## The Finding (Two-Sided)

Participants consistently wanted **shorter** responses in the conversational chat and **deeper/longer** output in the insight panel — validating the dual-channel cognitive separation while surfacing a calibration gap in both directions simultaneously.

This finding was displaced because the two sides were treated as separate usability complaints across different sections rather than as two faces of the same cross-channel design observation.

---

## Side 1: Chat Responses Too Long (4 of 4 sessions)

| Session | Participant | Source | Quote / Observation |
|---------|-------------|--------|---------------------|
| **S1** | JC (P1a) | `1/1-cleaned.md` L52 | "Research responses perceived as too verbose — length unexpected and disruptive to workflow" |
| **S1** | JC (P1a) | `1/1-cleaned.md` L125–126 | "Long AI responses felt disruptive to collaborative flow; shorter responses felt better" |
| **S1** | JC (P1a) | `1/1-cleaned.md` L158 | "Responses across the board should be shorter and more concise" |
| **S1** | JC (P1a) | `1/test 1.txt` L13–14 | Raw observer notes: "verbose research answer / length not expected?" |
| **S2** | Willson (P2a) | `2/2-cleaned.md` L92 | "Stated preference for a sparser, more limited version" |
| **S2** | Willson (P2a) | `2/2-cleaned.md` L189–194 | "Research outputs providing too much information... Blocks of AI text disrupted conversational flow" |
| **S3** | Shanyl (P3b) | `3/3-cleaned.md` L177 | "AI-on mode needs to be better designed or tuned — currently overwhelming" |
| **S4** | Jen (P4b) | `4/4-cleaned.md` L201 | "Q3: Responses too long for group chat" |
| **S4** | Jen (P4b) | `4/4.txt` L50 | "responses would be too long, doesn't seem useful to use researching functions in a group chat" |

---

## Side 2: Insight Panel Not Deep Enough (3 of 4 sessions)

| Session | Participant | Source | Quote / Observation |
|---------|-------------|--------|---------------------|
| **S4** | Jen (P4b) | `4/4-cleaned.md` L159 | "Fixed insight prompt structure found too concise" |
| **S4** | Jen (P4b) | `4/4.txt` L37–43 | "fixed insight prompt structure too concise... really thinks the research insight isn't thorough and deep enough" |
| **S4** | Jen (P4b) | `4/4-cleaned.md` L172–175 | "limited conversational length of AI in main chat meant the response wasn't detailed enough — genuine tension: balancing response length, depth, and placement" |
| **S4** | Jen (P4b) | `cross-session-analysis.md` L144 | "Jen: research output not thorough or deep enough" |
| **S3** | Shanyl (P3b) | `3/3-analysis.md` L54 | "does not sufficiently understand the prompt to return genuinely researched output" — perception of qualitative parity between Research insights and Ask chat |
| **S2** | Aly (P2b) | `2/2-cleaned.md` | Output felt like "opinion not fact" — depth/substance complaint about insight-type content |
| **S1** | S1 Phase 3 | `1/1-cleaned.md` L139–143 | "Suggestion of a middle ground for output tuning — neither fully verbose AI-on nor stripped-back AI-light felt optimal" |

---

## Quantitative Corroboration

### Solo Chat Agent Responses (Output Tokens)

| Participant | Avg Output Tokens | Message Count | Token Values |
|-------------|-------------------|---------------|--------------|
| JC (P1a) | 292 | 5 | 487, 264, 285, 96, 330 |
| Willson (P2a) | 200 | 5 | 178, 281, 192, 102, 249 |
| Aly (P2b) | 281 | 4 | 231, 319, 224, 353 |
| Roys (P2c) | 96 | 1 | 96 |
| Aung (P3a) | 168 | 7 | 66, 188, 277, 81, 188, 200, 179 |
| Shanyl (P3b) | 243 | 3 | 323, 299, 108 |
| Val (P4a) | 175 | 2 | 203, 147 |
| Jen (P4b) | 194 | 5 | 205, 108, 267, 127, 265 |

Several participants (JC: avg 292, Aly: avg 281, Shanyl: avg 243) received chat responses in the 200–400 token range — long enough to disrupt conversational flow in a real-time chat window.

### Solo Insight Content (Word Counts, Excluding Seeds <50 Words)

| Participant | Avg Words | Insight Count | Word Counts |
|-------------|-----------|---------------|-------------|
| JC (P1a) | 215 | 8 | 313, 192, 76, 120, 163, 252, 300, 306 |
| Willson (P2a) | 268 | 5 | 231, 252, 376, 150, 332 |
| Aly (P2b) | 169 | 4 | 59, 185, 262, 172 |
| Shanyl (P3b) | 231 | 4 | 308, 127, 147, 343 |
| Val (P4a) | 205 | 5 | 231, 110, 147, 208, 332 |
| Jen (P4b) | 178 | 6 | 70, 59, 253, 94, 308, 286 |

Excluding seed content, genuine insights averaged ~200–270 words (~250–340 tokens). For a dedicated analytical panel, this is a surprisingly thin margin over chat responses.

### The Convergence Problem

The data shows that chat responses and panel insights converged toward similar lengths (~200–300 tokens/words). Participants expected the two surfaces to differ significantly — chat should be briefer, panel should be deeper — but the system delivered near-identical depth to both.

---

## Session Attribution Summary

- **4 of 4 sessions** have explicit "chat too long" evidence (S1 JC, S2 Willson, S3 Shanyl, S4 Jen)
- **3 of 4 sessions** have explicit "insight not deep enough" evidence (S2 Aly, S3 Shanyl, S4 Jen)
- **Jen (P4b)** is the only participant who articulated both sides explicitly in the same session, identifying the "genuine tension" between the two surfaces

---

## Why This Finding Was Displaced

The "chat too long" side was partially absorbed into the Research mode depth-gap discussion (6.2.2) and individual participant usability observations. The "insight not deep enough" side was absorbed into Jen's individual S4 analysis. Neither was framed as a **cross-channel calibration finding** — the two complaints were treated as separate usability issues rather than as evidence of the same design gap.

---

## Recommended Chapter Placement

### Chapter 6.6 — Cross-Cutting Finding

Participants independently calibrated different depth expectations to the two output surfaces, confirming the dual-channel design as intuitively meaningful while identifying a concrete calibration gap. Chat responses averaging ~200–290 output tokens were perceived as too long for conversational flow; insight outputs averaging ~200–270 words were perceived as insufficiently deep for a dedicated analytical panel. The two surfaces converged toward similar output depths despite participants expecting them to diverge.

### Chapter 7.2.x — Design Implication (Response Depth Calibration)

Token budgets and prompt structures need surface-specific tuning. The current architecture delivers near-identical depth to both surfaces despite participants expecting them to serve fundamentally different communicative functions. This implies that the routing architecture validated in the study needs to be complemented by **output calibration** — not just routing the right content to the right surface, but tuning the depth and format of that content to match the affordances each surface creates.
