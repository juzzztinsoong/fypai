type MarkerMetadata = {
  markerType?: string;
  linkedInsightId?: string;
  parentMessageId?: string;
};

type MarkerMessageLike = {
  id: string;
  authorId: string;
  metadata?: MarkerMetadata;
};

export function buildMarkerMessageByInsightId(messages: MarkerMessageLike[]): Record<string, string> {
  const markerMessageByInsightId: Record<string, string> = {};

  messages.forEach((message) => {
    const linkedInsightId = message.metadata?.linkedInsightId;
    const isMarker =
      message.metadata?.markerType === 'action-insight-link' || message.metadata?.markerType === 'insight-link';

    if (!isMarker || !linkedInsightId) return;
    markerMessageByInsightId[linkedInsightId] = message.id;
  });

  return markerMessageByInsightId;
}

export function computeHiddenMarkerMessageIds(
  messages: MarkerMessageLike[],
  markerContextByParentMessageId: Record<string, { markerMessageId: string }>,
): Set<string> {
  const hidden = new Set<string>();
  const markerMessageByInsightId = buildMarkerMessageByInsightId(messages);

  messages.forEach((message) => {
    if (message.authorId !== 'agent') return;

    const isMarker =
      message.metadata?.markerType === 'action-insight-link' || message.metadata?.markerType === 'insight-link';
    if (isMarker) return;

    const parentMessageId = message.metadata?.parentMessageId;
    if (!parentMessageId) return;

    const markerContext = markerContextByParentMessageId[parentMessageId];
    if (markerContext) {
      hidden.add(markerContext.markerMessageId);
    }

    const directLinkedInsightId = message.metadata?.linkedInsightId;
    if (typeof directLinkedInsightId === 'string') {
      const markerMessageId = markerMessageByInsightId[directLinkedInsightId];
      if (markerMessageId) {
        hidden.add(markerMessageId);
      }
    }
  });

  return hidden;
}

export function shouldRenderInlineMarker(linkedInsightId?: string): boolean {
  return Boolean(linkedInsightId);
}
