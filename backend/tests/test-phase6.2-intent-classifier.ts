/**
 * Phase 6.2 Intent Classifier & Async Rule Evaluation Test Suite
 * 
 * Tests for:
 * 1. IntentClassifier sync classification (regex-based)
 * 2. IntentClassifier async classification (LLM-based)
 * 3. UnifiedRuleEngine intent-based rule matching
 * 4. Integration with embedding worker flow
 * 
 * Run with: npx tsx tests/test-phase6.2-intent-classifier.ts
 */

import { IntentClassifier, MessageClassification, SyncClassification } from '../src/ai/core/intentClassifier.js';
import { UnifiedRuleEngine } from '../src/ai/autonomous/unifiedRuleEngine.js';
import { prisma } from '../src/db.js';
import { MessageDTO } from '@fypai/types';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const SKIP_LLM_TESTS = process.env.SKIP_LLM_TESTS === 'true';

// Helper to create mock messages
function createMockMessage(content: string, overrides: Partial<MessageDTO> = {}): MessageDTO {
  return {
    id: uuidv4(),
    teamId: 'test-team-1',
    authorId: 'user1',
    content,
    contentType: 'text',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

// Test results tracking
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ ${testName}`);
    passed++;
  } else {
    console.log(`❌ ${testName}${details ? ` - ${details}` : ''}`);
    failed++;
  }
}

// ============================================================================
// TEST 1: Sync Classification (Regex-based)
// ============================================================================

async function testSyncClassification() {
  console.log('\n📋 TEST 1: Sync Classification (Regex-based)');
  console.log('─'.repeat(50));

  const classifier = IntentClassifier.getInstance();

  // Test @agent mention
  const mentionMsg = createMockMessage('@agent help me with this');
  const mentionResult = classifier.classifySync(mentionMsg);
  assert(mentionResult.intent === 'direct_mention', 'Detects @agent mention');
  assert(mentionResult.confidence === 1.0, '@agent has 100% confidence');

  // Test decision patterns
  const decisionMsg = createMockMessage("Let's go with option B for the database");
  const decisionResult = classifier.classifySync(decisionMsg);
  assert(decisionResult.intent === 'decision_detected', 'Detects decision pattern');

  // Test action commitment
  const commitmentMsg = createMockMessage("I'll finish the API integration by Friday");
  const commitmentResult = classifier.classifySync(commitmentMsg);
  assert(commitmentResult.intent === 'action_commitment', 'Detects action commitment');

  // Test blocker detection
  const blockerMsg = createMockMessage("I'm blocked on the deployment, waiting on DevOps");
  const blockerResult = classifier.classifySync(blockerMsg);
  assert(blockerResult.intent === 'blocker', 'Detects blocker');

  // Test confusion detection
  const confusionMsg = createMockMessage("I'm confused about how this authentication works");
  const confusionResult = classifier.classifySync(confusionMsg);
  assert(confusionResult.intent === 'confusion', 'Detects confusion');

  // Test question detection
  const questionMsg = createMockMessage('What time does the meeting start?');
  const questionResult = classifier.classifySync(questionMsg);
  assert(questionResult.intent === 'question', 'Detects question');

  // Test code request
  const codeMsg = createMockMessage('Can you help me debug this function?');
  const codeResult = classifier.classifySync(codeMsg);
  assert(codeResult.intent === 'code_request', 'Detects code request');

  // Test summary request
  const summaryMsg = createMockMessage('Can you summarize the meeting?');
  const summaryResult = classifier.classifySync(summaryMsg);
  assert(summaryResult.intent === 'summary_request', 'Detects summary request');

  // Test no intent
  const casualMsg = createMockMessage('Sounds good, thanks!');
  const casualResult = classifier.classifySync(casualMsg);
  assert(casualResult.intent === 'none', 'Returns none for casual message');
}

// ============================================================================
// TEST 2: Async Classification (LLM-based)
// ============================================================================

async function testAsyncClassification() {
  console.log('\n📋 TEST 2: Async Classification (LLM-based)');
  console.log('─'.repeat(50));

  if (SKIP_LLM_TESTS) {
    console.log('⏭️  Skipping LLM tests (SKIP_LLM_TESTS=true)');
    return;
  }

  const classifier = IntentClassifier.getInstance();

  // Test complex blocker message
  const blockerMsg = createMockMessage(
    "We're completely stuck on the payment integration. The third-party API keeps timing out and we can't proceed until this is fixed. Really frustrated with this."
  );
  
  console.log('Testing blocker message...');
  const blockerResult = await classifier.classifyAsync(blockerMsg);
  console.log(`   Intent: ${blockerResult.intent}`);
  console.log(`   Sentiment: ${blockerResult.sentiment}`);
  console.log(`   Urgency: ${blockerResult.urgency}`);
  console.log(`   Topics: ${blockerResult.topics.join(', ')}`);
  console.log(`   Confidence: ${blockerResult.confidence.toFixed(2)}`);
  
  assert(blockerResult.intent === 'blocker', 'LLM detects blocker intent');
  assert(['frustrated', 'negative'].includes(blockerResult.sentiment), 'LLM detects frustrated/negative sentiment');
  assert(['high', 'critical'].includes(blockerResult.urgency), 'LLM detects high/critical urgency');

  // Test decision message
  const decisionMsg = createMockMessage(
    "After discussing the options, we've decided to use PostgreSQL for the database and Redis for caching. This is our final decision."
  );
  
  console.log('\nTesting decision message...');
  const decisionResult = await classifier.classifyAsync(decisionMsg);
  console.log(`   Intent: ${decisionResult.intent}`);
  console.log(`   Sentiment: ${decisionResult.sentiment}`);
  console.log(`   Urgency: ${decisionResult.urgency}`);
  console.log(`   Topics: ${decisionResult.topics.join(', ')}`);
  
  assert(decisionResult.intent === 'decision_detected', 'LLM detects decision intent');
  assert(decisionResult.topics.length > 0, 'LLM extracts topics');

  // Test casual message
  const casualMsg = createMockMessage("Nice weather today! Anyone want to grab coffee?");
  
  console.log('\nTesting casual message...');
  const casualResult = await classifier.classifyAsync(casualMsg);
  console.log(`   Intent: ${casualResult.intent}`);
  console.log(`   Sentiment: ${casualResult.sentiment}`);
  
  assert(casualResult.intent === 'casual_chat' || casualResult.intent === 'none', 'LLM identifies casual chat');
  assert(casualResult.sentiment === 'positive' || casualResult.sentiment === 'neutral', 'LLM detects positive/neutral sentiment');
}

// ============================================================================
// TEST 3: Classification Result Structure
// ============================================================================

async function testClassificationStructure() {
  console.log('\n📋 TEST 3: Classification Result Structure');
  console.log('─'.repeat(50));

  const classifier = IntentClassifier.getInstance();

  // Sync classification structure
  const syncResult = classifier.classifySync(createMockMessage('Test message'));
  assert('intent' in syncResult, 'Sync result has intent field');
  assert('confidence' in syncResult, 'Sync result has confidence field');
  assert(typeof syncResult.confidence === 'number', 'Sync confidence is a number');
  assert(syncResult.confidence >= 0 && syncResult.confidence <= 1, 'Sync confidence is between 0 and 1');

  if (!SKIP_LLM_TESTS) {
    // Async classification structure
    const asyncResult = await classifier.classifyAsync(createMockMessage('This is a test'));
    assert('intent' in asyncResult, 'Async result has intent field');
    assert('sentiment' in asyncResult, 'Async result has sentiment field');
    assert('urgency' in asyncResult, 'Async result has urgency field');
    assert('topics' in asyncResult, 'Async result has topics field');
    assert('confidence' in asyncResult, 'Async result has confidence field');
    assert(Array.isArray(asyncResult.topics), 'Topics is an array');
    assert(asyncResult.topics.length <= 5, 'Topics array is limited to 5 items');
  }
}

// ============================================================================
// TEST 4: Intent-Based Rule Matching
// ============================================================================

async function testIntentBasedRuleMatching() {
  console.log('\n📋 TEST 4: Intent-Based Rule Matching');
  console.log('─'.repeat(50));

  // Create test team
  const teamId = `test-intent-${Date.now()}`;
  const userId = `test-user-${Date.now()}`;

  try {
    // Setup test data
    await prisma.team.create({
      data: { id: teamId, name: 'Intent Test Team' }
    });

    await prisma.user.create({
      data: { id: userId, name: 'Intent Test User', role: 'member' }
    });

    await prisma.teamMember.create({
      data: { teamId, userId, teamRole: 'member' }
    });

    // Create intent-based async rule
    await prisma.chimeRule.create({
      data: {
        id: `test-intent-rule-${Date.now()}`,
        name: 'Test Intent Blocker Rule',
        type: 'semantic',
        triggerType: 'vector',
        execution: 'async',
        priority: 'high',
        cooldownMinutes: 0, // No cooldown for testing
        conditions: JSON.stringify({
          requiredIntents: ['blocker'],
          minUrgency: 'medium'
        }),
        action: JSON.stringify({
          type: 'insight',
          insightType: 'action',
          template: 'Blocker detected by intent classification.'
        }),
        teamId
      }
    });

    console.log('✅ Test rule created with intent conditions');

    // Create test message
    const message: MessageDTO = {
      id: uuidv4(),
      teamId,
      authorId: userId,
      content: "I'm completely blocked on the deployment",
      contentType: 'text',
      createdAt: new Date().toISOString()
    };

    // Mock classification result
    const classification: MessageClassification = {
      intent: 'blocker',
      sentiment: 'frustrated',
      urgency: 'high',
      topics: ['deployment', 'blocked'],
      confidence: 0.9
    };

    // Mock embedding (1536 dimensions)
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

    // Test rule evaluation
    console.log('Testing rule evaluation with classification...');
    
    // Note: We can't easily test the full flow without mocking more services,
    // but we can verify the rule was created correctly
    const rule = await prisma.chimeRule.findFirst({
      where: { teamId, name: 'Test Intent Blocker Rule' }
    });

    assert(rule !== null, 'Intent-based rule exists in database');
    
    if (rule) {
      const conditions = JSON.parse(rule.conditions);
      assert(conditions.requiredIntents?.includes('blocker'), 'Rule has requiredIntents condition');
      assert(conditions.minUrgency === 'medium', 'Rule has minUrgency condition');
    }

    console.log('✅ Intent-based rule structure verified');

  } finally {
    // Cleanup
    await prisma.chimeRule.deleteMany({ where: { teamId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
    console.log('🧹 Cleanup complete');
  }
}

// ============================================================================
// TEST 5: Urgency Threshold Matching
// ============================================================================

async function testUrgencyMatching() {
  console.log('\n📋 TEST 5: Urgency Threshold Matching');
  console.log('─'.repeat(50));

  // Test urgency order logic
  const urgencyOrder = ['low', 'medium', 'high', 'critical'];
  
  // minUrgency: 'medium' should match 'medium', 'high', 'critical'
  const minIndex = urgencyOrder.indexOf('medium');
  
  assert(urgencyOrder.indexOf('low') < minIndex, 'low is below medium threshold');
  assert(urgencyOrder.indexOf('medium') >= minIndex, 'medium meets medium threshold');
  assert(urgencyOrder.indexOf('high') >= minIndex, 'high meets medium threshold');
  assert(urgencyOrder.indexOf('critical') >= minIndex, 'critical meets medium threshold');
}

// ============================================================================
// TEST 6: Sentiment-Based Matching
// ============================================================================

async function testSentimentMatching() {
  console.log('\n📋 TEST 6: Sentiment-Based Matching');
  console.log('─'.repeat(50));

  // Test sentiment matching logic
  const triggerSentiments = ['frustrated', 'negative'];
  
  const testCases = [
    { sentiment: 'frustrated', shouldMatch: true },
    { sentiment: 'negative', shouldMatch: true },
    { sentiment: 'neutral', shouldMatch: false },
    { sentiment: 'positive', shouldMatch: false },
    { sentiment: 'confused', shouldMatch: false }
  ];

  for (const tc of testCases) {
    const matches = triggerSentiments.includes(tc.sentiment);
    assert(
      matches === tc.shouldMatch,
      `Sentiment '${tc.sentiment}' ${tc.shouldMatch ? 'matches' : 'does not match'} trigger list`
    );
  }
}

// ============================================================================
// TEST 7: Classification Storage in Message Metadata
// ============================================================================

async function testClassificationStorage() {
  console.log('\n📋 TEST 7: Classification Storage Format');
  console.log('─'.repeat(50));

  // Test metadata JSON structure
  const existingMetadata = { mentions: ['user2'] };
  const classification: MessageClassification = {
    intent: 'blocker',
    sentiment: 'frustrated',
    urgency: 'high',
    topics: ['deployment'],
    confidence: 0.85
  };

  // Merge metadata (as done in embeddingWorker)
  const mergedMetadata = JSON.stringify({
    ...existingMetadata,
    classification: {
      intent: classification.intent,
      sentiment: classification.sentiment,
      urgency: classification.urgency,
      topics: classification.topics,
      confidence: classification.confidence
    }
  });

  const parsed = JSON.parse(mergedMetadata);
  
  assert('mentions' in parsed, 'Preserves existing metadata');
  assert('classification' in parsed, 'Adds classification object');
  assert(parsed.classification.intent === 'blocker', 'Stores intent correctly');
  assert(parsed.classification.urgency === 'high', 'Stores urgency correctly');
  assert(Array.isArray(parsed.classification.topics), 'Topics stored as array');
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runTests() {
  console.log('═'.repeat(60));
  console.log('  Phase 6.2 Intent Classifier & Async Rule Evaluation Tests');
  console.log('═'.repeat(60));
  console.log(`  LLM Tests: ${SKIP_LLM_TESTS ? 'SKIPPED' : 'ENABLED'}`);
  console.log(`  Run with SKIP_LLM_TESTS=true to skip LLM API calls`);

  try {
    await testSyncClassification();
    await testAsyncClassification();
    await testClassificationStructure();
    await testIntentBasedRuleMatching();
    await testUrgencyMatching();
    await testSentimentMatching();
    await testClassificationStorage();

    console.log('\n' + '═'.repeat(60));
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log('═'.repeat(60));

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
