/**
 * Artifact Contract Regression Suite
 *
 * Purpose:
 * Validate per-turn output shape so a single ask-turn does not emit an
 * unintended triple-output sequence (long chat + marker + companion).
 *
 * Run with:
 *   npx tsx tests/test-artifact-contract-regression.ts
 */

import { AIAgentController } from '../src/controllers/aiAgentController.js';
import { MessageController } from '../src/controllers/messageController.js';
import { TeamController } from '../src/controllers/teamController.js';
import { AIInsightController } from '../src/controllers/aiInsightController.js';
import { IntentController } from '../src/controllers/intentController.js';
import type { MessageDTO } from '@fypai/types';

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

function createUserMessage(
  content: string,
  metadata?: Record<string, unknown>,
): MessageDTO {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    teamId: 'team-contract',
    authorId: 'user1',
    content,
    contentType: 'text',
    createdAt: new Date().toISOString(),
    metadata,
  };
}

async function run(): Promise<void> {
  console.log('\n=== Artifact Contract Regression ===');

  const createdMessages: any[] = [];
  let activeMessage: MessageDTO | null = null;
  let generateResponseCalls = 0;
  let insightExecutionCalls = 0;

  const originalGetMessages = (MessageController as any).getMessages;
  const originalCreateMessage = (MessageController as any).createMessage;
  const originalGetTeamById = (TeamController as any).getTeamById;
  const originalGenerateResponse = (AIAgentController as any).generateResponse;
  const originalExecuteInsightDecision = (AIAgentController as any).executeInsightDecision;
  const originalShouldRespondProactively = (AIAgentController as any).shouldRespondProactively;
  const originalEvaluateChimeRules = (AIAgentController as any).evaluateChimeRules;
  const originalMergeCompanion = (AIInsightController as any).mergeCompanionIntoMarker;
  const originalDecideAgentRoute = (IntentController as any).decideAgentRoute;

  try {
    (MessageController as any).getMessages = async () => {
      if (!activeMessage) return [];
      const prior: MessageDTO = {
        id: 'msg-prior',
        teamId: activeMessage.teamId,
        authorId: 'user2',
        content: 'Earlier context from teammate',
        contentType: 'text',
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      };
      return [prior, activeMessage];
    };

    (TeamController as any).getTeamById = async (teamId: string) => ({
      id: teamId,
      name: 'Contract Team',
      isChimeEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    (MessageController as any).createMessage = async (data: any) => {
      const next = {
        id: `agent-${createdMessages.length + 1}`,
        teamId: data.teamId,
        authorId: data.authorId,
        content: data.content,
        contentType: data.contentType || 'text',
        createdAt: new Date().toISOString(),
        metadata: data.metadata || undefined,
        agentMetadata: data.agentMetadata || undefined,
      };
      createdMessages.push(next);
      return next;
    };

    (AIAgentController as any).generateResponse = async () => {
      generateResponseCalls += 1;
      return {
        content: 'LONG_CONVERSATIONAL_REPLY',
        model: 'gpt-4o',
        usage: { inputTokens: 10, outputTokens: 12 },
        confidence: 0.9,
        promptArchetypeApplied: false,
        promptArchetypeSource: 'none',
        promptArchetypeFlagEnabled: false,
      };
    };

    (AIAgentController as any).executeInsightDecision = async () => {
      insightExecutionCalls += 1;
      return {
      id: 'insight-contract-1',
      teamId: 'team-contract',
      type: 'document',
      title: 'Research Insight',
      content: 'Research content body',
      tags: ['test'],
      createdAt: new Date().toISOString(),
      };
    };

    (AIAgentController as any).shouldRespondProactively = async () => ({
      shouldRespond: false,
      confidence: 0,
      reason: 'test override',
    });

    (AIAgentController as any).evaluateChimeRules = async () => {
      return;
    };

    (AIInsightController as any).mergeCompanionIntoMarker = async () => {
      return;
    };

    // Case 1: Ask-mode research phrase should use companion-handoff path and
    // avoid generating the long conversational chat response.
    createdMessages.length = 0;
    generateResponseCalls = 0;
    activeMessage = createUserMessage('detailed research please', {
      routeMode: 'ask',
      routeSource: 'manual-override',
      routeOverrideUsed: true,
      forceAgentReply: true,
      routeExecutionId: 'contract-ask-1',
    });

    await AIAgentController.handleNewMessage(activeMessage);

    assert(
      generateResponseCalls === 0,
      'Ask research handoff skips long conversational generation',
      `generateResponseCalls=${generateResponseCalls}`,
    );

    assert(
      createdMessages.length === 1,
      'Ask research handoff emits exactly one companion chat message',
      `createdMessages=${createdMessages.length}`,
    );

    assert(
      createdMessages[0]?.metadata?.linkedInsightId === 'insight-contract-1',
      'Companion chat includes linked insight metadata',
    );

    assert(
      createdMessages[0]?.content === 'Research insight created. Open the card for details.',
      'Companion chat uses concise deterministic copy',
      `content=${createdMessages[0]?.content}`,
    );

    // Case 2: Auto-mode same phrase should remain silent under strict gates
    // (no forced ask, no mention/reply context, proactive gate disabled above).
    createdMessages.length = 0;
    generateResponseCalls = 0;
    activeMessage = createUserMessage('detailed research please', {
      routeMode: 'ask',
      routeSource: 'server-classifier',
      routeOverrideUsed: false,
      forceAgentReply: false,
      routeExecutionId: 'contract-auto-1',
    });

    await AIAgentController.handleNewMessage(activeMessage);

    assert(
      generateResponseCalls === 0,
      'Auto-mode conversational phrase does not force chat generation',
      `generateResponseCalls=${generateResponseCalls}`,
    );

    assert(
      createdMessages.length === 0,
      'Auto-mode conversational phrase emits no agent artifacts under strict gates',
      `createdMessages=${createdMessages.length}`,
    );

    // Case 3: Inferred chat+insight flow should keep conversational chat + insight,
    // but must not append a separate companion chat message.
    createdMessages.length = 0;
    generateResponseCalls = 0;
    insightExecutionCalls = 0;

    (IntentController as any).decideAgentRoute = async () => ({
      channel: 'insight',
      confidence: 0.84,
      explicit: false,
      clarify: false,
      insightType: 'document',
      suggestedInsightType: 'document',
      rationale: 'Test inferred insight route',
    });

    activeMessage = createUserMessage('@agent can you help me think this through?', {
      routeMode: 'ask',
      routeSource: 'server-classifier',
      routeOverrideUsed: false,
      forceAgentReply: false,
      routeExecutionId: 'contract-inferred-chat-plus-insight-1',
    });

    await AIAgentController.handleNewMessage(activeMessage);

    assert(
      generateResponseCalls === 1,
      'Inferred chat+insight emits one conversational AI chat reply',
      `generateResponseCalls=${generateResponseCalls}`,
    );

    assert(
      insightExecutionCalls === 1,
      'Inferred chat+insight still generates one AI insight',
      `insightExecutionCalls=${insightExecutionCalls}`,
    );

    assert(
      createdMessages.length === 1,
      'Inferred chat+insight does not append separate companion chat message',
      `createdMessages=${createdMessages.length}`,
    );

    assert(
      createdMessages[0]?.metadata?.linkedInsightId === 'insight-contract-1',
      'Conversational reply carries inline linked insight metadata',
      `linkedInsightId=${createdMessages[0]?.metadata?.linkedInsightId}`,
    );

    assert(
      createdMessages[0]?.metadata?.linkedInsightType === 'document',
      'Conversational reply includes linked insight type for inline marker rendering',
      `linkedInsightType=${createdMessages[0]?.metadata?.linkedInsightType}`,
    );
  } finally {
    (MessageController as any).getMessages = originalGetMessages;
    (MessageController as any).createMessage = originalCreateMessage;
    (TeamController as any).getTeamById = originalGetTeamById;
    (AIAgentController as any).generateResponse = originalGenerateResponse;
    (AIAgentController as any).executeInsightDecision = originalExecuteInsightDecision;
    (AIAgentController as any).shouldRespondProactively = originalShouldRespondProactively;
    (AIAgentController as any).evaluateChimeRules = originalEvaluateChimeRules;
    (AIInsightController as any).mergeCompanionIntoMarker = originalMergeCompanion;
    (IntentController as any).decideAgentRoute = originalDecideAgentRoute;
  }

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }

  process.exit(0);
}

run().catch((error) => {
  console.error('Fatal Artifact Contract regression failure:', error);
  process.exit(1);
});
