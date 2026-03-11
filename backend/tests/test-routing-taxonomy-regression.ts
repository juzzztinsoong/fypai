/**
 * Routing & Taxonomy Regression Test Suite
 *
 * Validates:
 * 1. Explicit insight commands always route deterministically
 * 2. Inferred routing confidence bands (insight vs clarify vs chat)
 * 3. Category boundaries (summary/document, suggestion/action)
 * 4. Disabled insight types (analysis/code) are rejected
 *
 * Run with:
 *   npx tsx tests/test-routing-taxonomy-regression.ts
 */

import { IntentController } from '../src/controllers/intentController.js';
import { AIInsightController } from '../src/controllers/aiInsightController.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string): void {
  if (condition) {
    console.log(`✅ ${testName}`);
    passed += 1;
    return;
  }

  console.log(`❌ ${testName}${details ? ` - ${details}` : ''}`);
  failed += 1;
}

function assertEqual<T>(actual: T, expected: T, testName: string): void {
  assert(actual === expected, testName, `expected=${String(expected)} actual=${String(actual)}`);
}

async function testExplicitCommands(): Promise<void> {
  console.log('\n📋 TEST 1: Explicit Command Reliability');
  console.log('─'.repeat(60));

  const summary = await IntentController.decideAgentRoute('/summary weekly sync recap');
  assertEqual(summary.channel, 'insight', 'Slash /summary routes to insight');
  assertEqual(summary.insightType, 'summary', 'Slash /summary maps to summary');
  assert(summary.explicit, 'Slash /summary marked explicit');
  assertEqual(summary.promptOverride, 'weekly sync recap', 'Slash command preserves prompt override');

  const research = await IntentController.decideAgentRoute('/research compare sqlite and postgres');
  assertEqual(research.channel, 'insight', 'Slash /research routes to insight');
  assertEqual(research.insightType, 'document', 'Slash /research maps to document');
  assert(research.explicit, 'Slash /research marked explicit');

  const actions = await IntentController.decideAgentRoute('/actions owners and due dates');
  assertEqual(actions.channel, 'insight', 'Slash /actions routes to insight');
  assertEqual(actions.insightType, 'action', 'Slash /actions maps to action');

  const suggest = await IntentController.decideAgentRoute('/suggest possible alternatives');
  assertEqual(suggest.channel, 'insight', 'Slash /suggest routes to insight');
  assertEqual(suggest.insightType, 'suggestion', 'Slash /suggest maps to suggestion');

  const helpAlias = await IntentController.decideAgentRoute('/help practical recommendations for rollout');
  assertEqual(helpAlias.channel, 'insight', 'Slash /help routes to insight');
  assertEqual(helpAlias.insightType, 'suggestion', 'Slash /help maps to suggestion type');

  const explicitMention = await IntentController.decideAgentRoute(
    '@agent can you summarize this sprint in detail, including the key goals, delivered work, blockers, decisions, rationale, unresolved risks, and what should be carried forward next week?',
  );
  assertEqual(explicitMention.channel, 'insight', '@agent summary request with enough context routes to insight');
  assertEqual(explicitMention.insightType, 'summary', '@agent summary request maps to summary');
  assert(explicitMention.explicit, '@agent summary request is explicit');

  const shortExplicitMention = await IntentController.decideAgentRoute('@agent summarize sprint recap');
  assertEqual(shortExplicitMention.channel, 'chat_message', 'Short explicit @agent request stays in chat');
  assert(shortExplicitMention.clarify, 'Short explicit @agent request asks for clarification');
  assertEqual(
    shortExplicitMention.suggestedInsightType,
    'summary',
    'Short explicit @agent request still suggests summary type',
  );

  assert(IntentController.hasExplicitInsightCommand('/summary now'), 'hasExplicitInsightCommand identifies slash command');
  assert(
    IntentController.hasExplicitInsightCommand('@agent suggest a better approach'),
    'hasExplicitInsightCommand identifies explicit @agent category request',
  );
  assert(
    !IntentController.hasExplicitInsightCommand('@agent hello there'),
    'hasExplicitInsightCommand ignores generic @agent chat',
  );
}

async function testConfidenceBands(): Promise<void> {
  console.log('\n📋 TEST 2: Confidence Band Routing');
  console.log('─'.repeat(60));

  const highSummary = await IntentController.decideAgentRoute(
    'summarize the meeting notes from today including key decisions, blockers, rationale, unresolved questions, scope changes, and concrete context for why each major decision was made',
  );
  assertEqual(highSummary.channel, 'insight', 'High-confidence summary routes to insight');
  assertEqual(highSummary.insightType, 'summary', 'High-confidence summary keeps summary category');
  assert(!highSummary.clarify, 'High-confidence summary does not request clarification');

  const highDocument = await IntentController.decideAgentRoute(
    'research and compare trade offs, evaluate options in detail, analyze implementation risks, and recommend a strategy with evidence for sqlite versus postgres in our upcoming sprint context',
  );
  assertEqual(highDocument.channel, 'insight', 'High-confidence research routes to insight');
  assertEqual(highDocument.insightType, 'document', 'High-confidence research maps to document');
  assert(!highDocument.clarify, 'High-confidence research does not request clarification');

  const mediumSuggestion = await IntentController.decideAgentRoute('suggest options for this');
  assertEqual(mediumSuggestion.channel, 'chat_message', 'Medium-confidence suggestion stays in chat channel');
  assert(mediumSuggestion.clarify, 'Medium-confidence suggestion requires clarification');
  assertEqual(
    mediumSuggestion.suggestedInsightType,
    'suggestion',
    'Medium-confidence suggestion proposes suggestion category',
  );

  const mediumAction = await IntentController.decideAgentRoute('next steps for this issue');
  assertEqual(mediumAction.channel, 'chat_message', 'Medium-confidence action stays in chat channel');
  assert(mediumAction.clarify, 'Medium-confidence action requires clarification');
  assertEqual(mediumAction.suggestedInsightType, 'action', 'Medium-confidence action proposes action category');

  const lowConfidence = await IntentController.decideAgentRoute('sounds good thanks');
  assertEqual(lowConfidence.channel, 'chat_message', 'Low-confidence content remains chat');
  assert(!lowConfidence.clarify, 'Low-confidence content does not force clarification');
}

async function testCategoryBoundaries(): Promise<void> {
  console.log('\n📋 TEST 3: Category Boundary Separation');
  console.log('─'.repeat(60));

  const summaryOnly = await IntentController.decideAgentRoute(
    'please summarize this conversation with highlights, rationale, open questions, dependency constraints, and decision context so we can review priorities in our next sprint planning discussion',
  );
  assertEqual(summaryOnly.insightType, 'summary', 'Summary request does not become document');

  const researchOnly = await IntentController.decideAgentRoute(
    'provide a research brief to compare pros and cons, evaluate options in context, analyze key risks and constraints, and recommend the best strategy for the next sprint rollout',
  );
  assertEqual(researchOnly.insightType, 'document', 'Research request does not become summary');

  const suggestionOnly = await IntentController.decideAgentRoute('/suggest best alternatives for deployment');
  assertEqual(suggestionOnly.insightType, 'suggestion', 'Suggestion command does not become action');

  const actionOnly = await IntentController.decideAgentRoute('/actions extract concrete tasks from this thread');
  assertEqual(actionOnly.insightType, 'action', 'Action command does not become suggestion');

  const explicitOverride = await IntentController.decideAgentRoute('/summary compare pros and cons for option A and B');
  assertEqual(explicitOverride.insightType, 'summary', 'Explicit command overrides mixed lexical signals');
}

async function testDisabledInsightTypes(): Promise<void> {
  console.log('\n📋 TEST 4: Disabled Insight Type Rejection');
  console.log('─'.repeat(60));

  let analysisRejected = false;
  try {
    await AIInsightController.createInsight({
      teamId: 'test-team-routing-regression',
      type: 'analysis' as never,
      title: 'Analysis should fail',
      content: 'This should be rejected in taxonomy pass.',
      tags: ['test'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;
    analysisRejected = statusCode === 400 && message.includes("Insight type 'analysis' is disabled");
  }
  assert(analysisRejected, 'createInsight rejects analysis type with 400');

  let codeRejected = false;
  try {
    await AIInsightController.createInsight({
      teamId: 'test-team-routing-regression',
      type: 'code' as never,
      title: 'Code should fail',
      content: 'This should also be rejected in taxonomy pass.',
      tags: ['test'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;
    codeRejected = statusCode === 400 && message.includes("Insight type 'code' is disabled");
  }
  assert(codeRejected, 'createInsight rejects code type with 400');
}

async function run(): Promise<void> {
  console.log('\n=== Routing & Taxonomy Regression Suite ===');

  await testExplicitCommands();
  await testConfidenceBands();
  await testCategoryBoundaries();
  await testDisabledInsightTypes();

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }

  process.exit(0);
}

run().catch((error) => {
  console.error('Fatal test failure:', error);
  process.exit(1);
});
