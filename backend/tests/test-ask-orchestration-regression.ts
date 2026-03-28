/**
 * Ask-Orchestration Regression Suite
 *
 * Purpose:
 * Catch regressions where Ask-mode research handoff behavior diverges from
 * strict auto-mode behavior and produces unexpected artifacts.
 *
 * Run with:
 *   npx tsx tests/test-ask-orchestration-regression.ts
 */

import { IntentController } from '../src/controllers/intentController.js';
import { AIAgentController } from '../src/controllers/aiAgentController.js';
import type { MessageDTO } from '@fypai/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string): void {
  if (condition) {
    console.log(`PASS ${testName}`);
    passed += 1;
    return;
  }

  console.log(`FAIL ${testName}${details ? ` - ${details}` : ''}`);
  failed += 1;
}

function assertEqual<T>(actual: T, expected: T, testName: string): void {
  assert(actual === expected, testName, `expected=${String(expected)} actual=${String(actual)}`);
}

function createMessage(content: string): MessageDTO {
  return {
    id: 'msg-test-1',
    teamId: 'team-test',
    authorId: 'user1',
    content,
    contentType: 'text',
    createdAt: new Date().toISOString(),
  };
}

function getPromotionPredicate(): (
  message: MessageDTO,
  routeDecision: any,
  hasForcedAgentReplySignal: boolean,
  isExplicitMentionOnlyMode: boolean,
  hasExplicitInsightTrigger: boolean,
) => boolean {
  const predicate = (AIAgentController as any).shouldPromoteAskResearchCompanion;
  if (typeof predicate !== 'function') {
    throw new Error('AIAgentController.shouldPromoteAskResearchCompanion is not available');
  }
  return predicate.bind(AIAgentController);
}

async function testAskVsAutoRoutingSignals(): Promise<void> {
  console.log('\n=== Ask vs Auto Routing Signals ===');

  const askLike = await IntentController.decideAgentRoute('detailed research please');
  assertEqual(askLike.channel, 'chat_message', 'Short research phrase remains conversational route');
  assertEqual(askLike.clarify, false, 'Short research phrase does not force clarification by itself');
  assertEqual(askLike.suggestedInsightType, 'document', 'Short research phrase still suggests document category');

  const strongerResearch = await IntentController.decideAgentRoute('can you do detailed research on technology projects');
  assertEqual(strongerResearch.channel, 'insight', 'Longer research phrase routes to insight');
  assertEqual(strongerResearch.insightType, 'document', 'Longer research phrase maps to document insight');
}

async function testAskResearchPromotionPredicate(): Promise<void> {
  console.log('\n=== Ask Research Promotion Predicate ===');

  const shouldPromote = getPromotionPredicate();
  const message = createMessage('detailed research please');
  const conversationalDocumentHint = {
    channel: 'chat_message',
    confidence: 0.5,
    explicit: false,
    clarify: false,
    suggestedInsightType: 'document',
  };

  assert(
    shouldPromote(message, conversationalDocumentHint, true, false, false),
    'Ask forced reply with research-like phrase promotes companion insight',
  );

  assert(
    !shouldPromote(message, conversationalDocumentHint, false, false, false),
    'Auto mode (no forced Ask signal) does not promote companion insight',
  );

  assert(
    !shouldPromote(message, conversationalDocumentHint, true, true, false),
    'AI-light mode blocks Ask companion promotion',
  );

  assert(
    !shouldPromote(message, conversationalDocumentHint, true, false, true),
    'Explicit insight triggers bypass Ask promotion fallback',
  );

  const tooShortMessage = createMessage('research please');
  assert(
    !shouldPromote(tooShortMessage, conversationalDocumentHint, true, false, false),
    'Very short Ask phrasing does not promote companion insight',
  );

  const alreadyInsightRoute = {
    channel: 'insight',
    confidence: 0.82,
    explicit: false,
    clarify: false,
    insightType: 'document',
    suggestedInsightType: 'document',
  };
  assert(
    !shouldPromote(message, alreadyInsightRoute, true, false, false),
    'Existing inferred insight route skips promotion fallback',
  );
}

async function run(): Promise<void> {
  await testAskVsAutoRoutingSignals();
  await testAskResearchPromotionPredicate();

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }

  process.exit(0);
}

run().catch((error) => {
  console.error('Fatal Ask-Orchestration regression failure:', error);
  process.exit(1);
});
