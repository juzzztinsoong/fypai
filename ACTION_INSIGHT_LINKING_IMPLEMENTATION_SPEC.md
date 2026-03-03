# Conversation-or-Marker Delivery Contract Spec

## Objective
Shift the AI UX to a strict delivery contract:
1. AI output in chat is always either:
   - a short conversational response, OR
   - a compact marker that links to an insight in the right panel.
2. Long-form outputs (summary/research/analysis/action/code) live in the insight panel only.
3. Chat acts as timeline + navigation, insights act as canonical artifact storage.

## Contract Rules

### Rule A: No long-form payloads in chat
- AI must not emit full long-form bodies as chat message content.
- Long-form content is persisted as `AIInsight` and surfaced in right panel.

### Rule B: Insight creation emits marker
- Every created insight emits one marker message in chat.
- Marker includes deep-link metadata to target insight.

### Rule C: Optional short conversational wrapper
- AI may send a short follow-up sentence (“Created a research brief…”).
- If sent, it must remain concise and not duplicate long-form insight body.

## Data Model

### Message metadata
- `markerType?: 'insight-link' | 'action-insight-link' | 'system-link'`
- `linkedInsightId?: string`
- `linkedActionId?: string`
- `linkedInsightType?: 'summary' | 'document' | 'action' | 'suggestion' | 'analysis' | 'code'`
- `sourceActionTitle?: string`
- `markerLabel?: string`

### Insight metadata
- `sourceInsightId?: string`
- `sourceExcerpt?: string`
- `sourceMessageId?: string`
- `sourceMessageExcerpt?: string`

## Implementation Phases

### Phase 1 (executed in this slice)
- Generate chat markers for all insight creations in `AIInsightController.createInsight`.
- Convert legacy `generateLongFormContent` behavior to insight-first + short response.
- Keep marker deep-link metadata consistent across insight types.
- Render marker cards in chat and focus linked insight on click.

### Phase 2
- Ensure all autonomous/chime insight creators use `createInsight` path only.
- Remove any remaining `ai_longform` assumptions from frontend rendering.

### Phase 3
- Add insight→chat marker jump (reverse navigation).
- Optional timeline synchronization enhancements beyond bottom anchoring.

## Frontend Behavior

### Chat
- Marker messages render as clickable marker cards.
- Marker click dispatches focus event with `linkedInsightId`.

### Right panel
- Subscribes to focus event and opens correct tab.
- Scrolls insight card into center and applies temporary highlight.
- Insight list uses chronological ascending order (newest at bottom).

## Promote-to-action UX
- Promote available on most agentic surfaces:
  - long-form insight content
  - compact insight cards
  - agent chat messages
- Promotion creates action insight and therefore also emits chat marker automatically.

## Acceptance Criteria
- No new long-form AI chat bodies are emitted in long-form generation path.
- Every new insight emits one chat marker.
- Marker click lands on exact insight card.
- Insight panel remains bottom-anchored with newest entries at bottom.
- Promote-to-action remains available and creates linked action artifacts.

## Risks
- Marker volume may increase with high autonomous activity.
- Duplicate “short response + marker” can feel noisy if overused.

## Mitigations
- Keep wrapper responses optional and concise.
- Add future toggle: marker-only vs marker+wrapper for teams.
