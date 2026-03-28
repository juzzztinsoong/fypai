import {
  buildMarkerMessageByInsightId,
  computeHiddenMarkerMessageIds,
  shouldRenderInlineMarker,
} from '../src/utils/markerLinkContracts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, details?: string): void {
  if (condition) {
    console.log(`PASS ${name}`);
    passed += 1;
    return;
  }

  console.log(`FAIL ${name}${details ? ` - ${details}` : ''}`);
  failed += 1;
}

function assertEqual<T>(actual: T, expected: T, name: string): void {
  assert(actual === expected, name, `expected=${String(expected)} actual=${String(actual)}`);
}

function run(): void {
  console.log('\n=== Marker Render Contract Regression ===');

  const messages = [
    {
      id: 'marker-1',
      authorId: 'agent',
      metadata: {
        markerType: 'insight-link',
        linkedInsightId: 'insight-1',
      },
    },
    {
      id: 'companion-1',
      authorId: 'agent',
      metadata: {
        parentMessageId: 'user-1',
        linkedInsightId: 'insight-1',
      },
    },
  ];

  const markerIndex = buildMarkerMessageByInsightId(messages);
  assertEqual(markerIndex['insight-1'], 'marker-1', 'Indexes marker by linked insight id');

  const hidden = computeHiddenMarkerMessageIds(messages, {
    'user-1': {
      markerMessageId: 'marker-1',
    },
  });
  assert(hidden.has('marker-1'), 'Hides standalone marker when companion message references same insight');

  assert(shouldRenderInlineMarker('insight-1'), 'Renders inline marker when linked insight id exists');
  assert(!shouldRenderInlineMarker(undefined), 'Does not render inline marker without linked insight id');

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }

  process.exit(0);
}

run();
