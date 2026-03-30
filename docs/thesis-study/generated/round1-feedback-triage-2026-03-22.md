# Round 1 Feedback Triage

Date: 2026-03-22
Source: Facilitator notes and post-test comments from first completed test round
Purpose: Separate immediate product fixes from likely next-iteration changes and evidential findings for research reporting

## Quick Triage Summary

### Actionable Items To Fix Before Next Round

- Fix `/research` message-loss behavior (reported as deleting the message).
- Fix dismissal visibility behavior so dismissed items do not continue to appear in active surfaces.
- Reduce response verbosity defaults, especially research responses in center chat flow.
- Improve mode/trigger clarity in composer and send behavior (users unsure when they are talking to chat vs triggering AI workflows).
- Verify and fix `Ask Assistant` mode behavior if state can become sticky/confusing.

### Likely Actionable (Validate in Pilot Then Decide)

- Simplify onboarding/demo cards to reduce confusion and setup cognitive load.
- Reduce category-selection burden (mode/category decisions feel heavy during collaboration).
- Improve contextual cues for why an output was generated and from what source.
- Tighten markdown rendering consistency in chat/insight snippets.
- Improve collaborative fit by biasing toward shorter responses and less disruption to group flow.

### Evidential Research Findings (Use As Study Results)

- Participants are sensitive to verbosity and workflow interruption from long AI outputs.
- Perceived value depends on confidence/sourcing signals, not only content completeness.
- Some users prefer interacting only in center chat and avoid right-panel context switching.
- Perception differs by condition: one condition was described as cleaner/more structured.
- Preference heterogeneity is strong (different users want different depth and guidance levels).

---

## Participant 1: JC

### Actionable Items To Fix

- Responses are too verbose and often longer than expected.
- Re-asking for context can feel repetitive/annoying.
- Dismissed content appears to still surface when it should be hidden.
- Category selection adds cognitive load during live collaboration.

### Likely Actionable

- Demo cards and onboarding are confusing and may not provide useful contextual clues.
- Interface cues are insufficient for understanding when AI is being triggered.
- Collaborative usability could improve if users do not need to query in the group chat for every operation.

### Evidential Findings

- Preferred shorter, cleaner interactions.
- Reported clutter and context overload reduce usefulness.
- Tended to use main chat rather than right panel.
- Wanted responses to be concise and practical across the board.

---

## Participant 2: Samuel

### Actionable Items To Fix

- `/research` reported as deleting the message (high-severity workflow bug).
- `Ask Assistant` behavior flagged as potentially buggy/confusing.
- Help behavior perceived as too similar to a generic chatbot and less useful for lighter research support.

### Likely Actionable

- Improve onboarding framing for meeting-tool usage and mode understanding.
- Improve fluidity so users do not feel stuck in one mode.
- Review markdown formatting quality and consistency.

### Evidential Findings

- Values deep research and confidence in outputs.
- Cares about source quality and information grounding.
- Condition-level impression: compared one setup as cleaner/more structured.

---

## Cross-Participant Observations (Group-Level)

### Actionable Items To Fix

- Clarify trigger model in UI (when message routes to chat reply vs insight workflow).
- Reduce visible complexity and unnecessary controls during active collaboration.

### Likely Actionable

- Offer stronger default tuning for concise mode in team contexts.
- Calibrate a middle-ground personalization strategy for response depth.

### Evidential Findings

- AI assistance must be tuned carefully before broad perceived value emerges.
- Longer content can distract teams from core discussion.
- Marker/navigation features can be useful, but only when low-friction and context-clear.

---

## Final Survey Signals (From Notes)

### Actionable Items To Fix

- Replying/threading perceived as less useful in shallow discussions; consider better affordances or context thresholds.

### Evidential Findings

- Confidence in final output is tied to sourcing and trust cues.
- One workflow variant was perceived as faster for certain tasks than plain research.
- Some participants did not report clear overall improvement despite feature usage.

---

## Recommended Pre-Round-2 Change List

Priority 0 (must fix):
- `/research` message-loss bug.
- Dismissal persistence/visibility bug.

Priority 1 (high impact):
- Verbosity tuning for chat and research responses.
- Trigger/mode clarity in composer and output cues.

Priority 2 (if time allows):
- Onboarding/demo simplification.
- Markdown polish and minor UX consistency issues.

---

## Notes For Analysis Write-Up

- Treat bug reports and UX confusion as implementation issues, not condition effects.
- Use repeated comments (verbosity, cue clarity, cognitive load, sourcing confidence) as core qualitative themes.
- Keep participant-specific nuance in the findings section to avoid over-generalization from small sample input.
