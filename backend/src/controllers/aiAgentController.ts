/**
 * AI Agent Controller
 * 
 * Following copilot-instructions.md architecture:
 * - Posts messages via same message:new flow for unified history
 * - Uses short chat replies + insight markers for structured outputs
 * - Links outputs via metadata.parentMessageId
 * - Evaluates chime rules for autonomous AI responses
 */

import { GitHubModelsClient } from '../ai/core/llm.js';
import {
  SYSTEM_PROMPTS,
  applyPreferences,
  applyPromptArchetype,
  buildConversationContext,
  buildRAGContext,
  getModelForPreferences,
  isPromptArchetypeEnabled,
  resolvePromptArchetype,
} from '../ai/core/prompts.js';
import { UnifiedRuleEngine } from '../ai/autonomous/unifiedRuleEngine.js';
import { MessageController } from './messageController.js';
import { TeamController } from './teamController.js';
import { AIInsightController } from './aiInsightController.js';
import { ChimeRuleController } from './chimeRuleController.js';
import { RuleProvider } from '../ai/rules/ruleProvider.js';
import { ragService } from '../services/ragService.js';
import { AgentPreferencesService } from '../services/agentPreferencesService.js';
import { embeddingService } from '../services/embeddingService.js';
import { IntentClassifier, MessageClassification } from '../ai/core/intentClassifier.js';
import { IntentController, InsightGenerationType } from './intentController.js';
import { prisma } from '../db.js';
import { AgentPromptArchetype, MessageDTO, CreateAIInsightRequest, AIInsightDTO } from '@fypai/types';
import { Server as SocketIOServer } from 'socket.io';

type ContinuationTrigger =
  | 'confidence-gate'
  | 'explicit-mention'
  | 'explicit-reply'
  | 'explicit-command'
  | 'passive-observation';

type ProcessingTargetType = InsightGenerationType | 'chat';

type RouteDecision = Awaited<ReturnType<typeof IntentController.decideAgentRoute>>;

export class AIAgentController {
  private static llm = new GitHubModelsClient();
  private static io: SocketIOServer | null = null;
  private static teamAIEnabled: Map<string, boolean> = new Map(); // In-memory cache for AI enabled state
  private static readonly ENABLE_MODEL_PROACTIVE_RESPONSE = process.env.ENABLE_MODEL_PROACTIVE_RESPONSE !== 'false';
  private static readonly ENABLE_CHAT_PLUS_INSIGHT = process.env.ENABLE_CHAT_PLUS_INSIGHT === 'true';
  private static readonly ENABLE_MERGED_MARKER_COMPANION = process.env.ENABLE_MERGED_MARKER_COMPANION !== 'false';
  private static readonly DISABLE_AUTONOMOUS_CHIME = process.env.DISABLE_AUTONOMOUS_CHIME === 'true';
  private static readonly PROACTIVE_RESPONSE_MIN_CONFIDENCE = Math.min(
    1,
    Math.max(0, parseFloat(process.env.PROACTIVE_RESPONSE_MIN_CONFIDENCE || '0.65')),
  );
  private static readonly CONTINUATION_MIN_CONFIDENCE = Math.min(
    1,
    Math.max(0, parseFloat(process.env.CONTINUATION_MIN_CONFIDENCE || '0.6')),
  );
  private static readonly CONTINUATION_WINDOW_MS = Math.max(
    0,
    Number.parseInt(process.env.CONTINUATION_WINDOW_MINUTES || '5', 10),
  ) * 60 * 1000;
  private static readonly INSIGHT_EXECUTION_LOCK_TTL_MS = Math.max(
    30 * 1000,
    Number.parseInt(process.env.INSIGHT_EXECUTION_LOCK_TTL_MS || '180000', 10),
  );
  private static readonly ENABLE_ASK_RESEARCH_COMPANION = process.env.ENABLE_ASK_RESEARCH_COMPANION !== 'false';
  private static readonly insightExecutionLocks: Map<string, number> = new Map();

  private static readonly ASK_RESEARCH_COMPANION_PATTERNS: RegExp[] = [
    /\bresearch\b/i,
    /\bdeep\s+dive\b/i,
    /\banaly[sz]e\b/i,
    /\bcompare\b/i,
    /\bbrief\b/i,
  ];

  private static emitContinuationStatus(
    teamId: string,
    payload: {
      status: 'active' | 'ended';
      confidence: number;
      trigger: ContinuationTrigger;
      reason?: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`team:${teamId}`).emit('ai:continuation', {
      teamId,
      status: payload.status,
      confidence: Math.min(1, Math.max(0, payload.confidence)),
      threshold: this.CONTINUATION_MIN_CONFIDENCE,
      trigger: payload.trigger,
      reason: payload.reason,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `[AI Agent] 🧷 Emitted ai:continuation status=${payload.status} ` +
        `confidence=${payload.confidence.toFixed(2)} trigger=${payload.trigger} team=${teamId}`
    );
  }

  private static buildPassiveObservationReason(routeDecision: RouteDecision): string {
    if (routeDecision.channel === 'insight' && routeDecision.suggestedInsightType) {
      return (
        `Weak gate detected ${routeDecision.suggestedInsightType} intent ` +
        `(${Math.round(routeDecision.confidence * 100)}% confidence) and stayed passive until explicit user trigger.`
      )
    }

    if (routeDecision.clarify && routeDecision.suggestedInsightType) {
      return (
        `Weak gate saw a possible ${routeDecision.suggestedInsightType} request but held response pending clearer context.`
      )
    }

    return 'Weak gate evaluated this message and kept AI in observe mode for this turn.'
  }

  private static shouldPromoteAskResearchCompanion(
    message: MessageDTO,
    routeDecision: RouteDecision,
    hasForcedAgentReplySignal: boolean,
    isExplicitMentionOnlyMode: boolean,
    hasExplicitInsightTrigger: boolean,
  ): boolean {
    if (!this.ENABLE_ASK_RESEARCH_COMPANION) return false;
    if (isExplicitMentionOnlyMode) return false;
    if (!hasForcedAgentReplySignal) return false;
    if (hasExplicitInsightTrigger) return false;

    // Existing high-confidence inferred-insight path handles companion generation separately.
    if (routeDecision.channel === 'insight' && routeDecision.insightType) return false;

    if (routeDecision.suggestedInsightType !== 'document') return false;

    const trimmed = message.content.trim();
    if (trimmed.length < 16) return false;

    return this.ASK_RESEARCH_COMPANION_PATTERNS.some((pattern) => pattern.test(trimmed));
  }

  /**
   * Set Socket.IO instance for broadcasting
   */
  static setSocketIO(io: SocketIOServer): void {
    this.io = io;
    console.log('[AIAgentController] ✅ Socket.IO instance configured for AI broadcasts');
  }

  private static emitProcessingStage(
    teamId: string,
    stage: 'thinking' | 'searching-memory' | 'analyzing' | 'idle',
    detail?: string,
    targetType?: ProcessingTargetType,
  ): void {
    if (!this.io) return;
    const payload: {
      teamId: string;
      userId: string;
      stage: 'thinking' | 'searching-memory' | 'analyzing' | 'idle';
      detail?: string;
      targetType?: ProcessingTargetType;
    } = {
      teamId,
      userId: 'agent',
      stage,
    };

    if (detail) payload.detail = detail;
    if (targetType) payload.targetType = targetType;

    this.io.to(`team:${teamId}`).emit('ai:processing', payload);
    console.log(
      `[AI Agent] 🧭 Emitted ai:processing stage=${stage}` +
        `${detail ? ` detail=${detail}` : ''}` +
        `${targetType ? ` target=${targetType}` : ''} for team=${teamId}`,
    );
  }

  /**
   * Set AI enabled state for a team
   */
  static setAIEnabled(teamId: string, enabled: boolean): void {
    this.teamAIEnabled.set(teamId, enabled);
    console.log(`[AIAgentController] 🤖 AI ${enabled ? 'enabled' : 'disabled'} for team: ${teamId}`);
  }

  /**
   * Get AI enabled state for a team (default: true)
   */
  static isAIEnabled(teamId: string): boolean {
    return this.teamAIEnabled.get(teamId) ?? true;
  }

  /**
   * Resolve AI enabled state using DB team settings as source of truth.
   * Falls back to in-memory cache, then defaults to enabled.
   */
  private static resolveTeamAIEnabled(
    teamId: string,
    team?: { isChimeEnabled?: boolean | null },
  ): boolean {
    if (typeof team?.isChimeEnabled === 'boolean') {
      this.teamAIEnabled.set(teamId, team.isChimeEnabled);
      return team.isChimeEnabled;
    }

    return this.isAIEnabled(teamId);
  }

  private static getMessageMetadata(message: MessageDTO): Record<string, unknown> | null {
    const metadata = (message as any).metadata;
    if (!metadata) return null;

    if (typeof metadata === 'object') {
      return metadata as Record<string, unknown>;
    }

    if (typeof metadata === 'string') {
      try {
        const parsed = JSON.parse(metadata);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  private static hasDraftContextSignal(message: MessageDTO): boolean {
    const metadata = this.getMessageMetadata(message);
    if (!metadata) return false;

    const hasInsightDraftSources =
      Array.isArray(metadata.draftSourceInsightIds) && metadata.draftSourceInsightIds.length > 0;
    const hasMessageDraftSources =
      Array.isArray(metadata.draftSourceMessageIds) && metadata.draftSourceMessageIds.length > 0;

    return hasInsightDraftSources || hasMessageDraftSources;
  }

  private static hasForcedAgentReplySignal(message: MessageDTO): boolean {
    const metadata = this.getMessageMetadata(message);
    if (!metadata) return false;

    return metadata.forceAgentReply === true;
  }

  private static getRequestedInsightType(message: MessageDTO): InsightGenerationType | null {
    const metadata = this.getMessageMetadata(message);
    if (!metadata) return null;

    const requested = metadata.requestedInsightType;
    if (requested === 'summary' || requested === 'document' || requested === 'action' || requested === 'suggestion') {
      return requested;
    }

    if (metadata.routeOverrideUsed === true && metadata.routeMode === 'research') {
      return 'document';
    }

    return null;
  }

  private static getRouteExecutionId(message: MessageDTO): string | undefined {
    const metadata = this.getMessageMetadata(message);
    if (!metadata) return undefined;
    return typeof metadata.routeExecutionId === 'string' ? metadata.routeExecutionId : undefined;
  }

  private static buildInsightExecutionKey(
    message: MessageDTO,
    insightType: InsightGenerationType,
  ): string {
    const routeExecutionId = this.getRouteExecutionId(message);
    const stableId = routeExecutionId || message.id;
    return `${message.teamId}:${stableId}:${insightType}`;
  }

  private static acquireInsightExecutionLock(executionKey: string): boolean {
    const now = Date.now();

    for (const [key, ts] of this.insightExecutionLocks.entries()) {
      if (now - ts > this.INSIGHT_EXECUTION_LOCK_TTL_MS) {
        this.insightExecutionLocks.delete(key);
      }
    }

    if (this.insightExecutionLocks.has(executionKey)) {
      return false;
    }

    this.insightExecutionLocks.set(executionKey, now);
    return true;
  }

  private static async hasExistingInsightForMessage(
    teamId: string,
    messageId: string,
    insightType: InsightGenerationType,
  ): Promise<boolean> {
    const existing = await prisma.aIInsight.findFirst({
      where: {
        teamId,
        type: insightType,
        relatedMessageIds: {
          contains: messageId,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    return Boolean(existing);
  }

  private static async generateInsightForRoute(
    message: MessageDTO,
    routeDecision: RouteDecision,
    options?: {
      emitCompanionChat?: boolean;
      forceCompanionChat?: boolean;
    },
  ): Promise<AIInsightDTO | null> {
    if (routeDecision.channel !== 'insight' || !routeDecision.insightType) {
      return null;
    }

    const executionKey = this.buildInsightExecutionKey(message, routeDecision.insightType);
    const acquired = this.acquireInsightExecutionLock(executionKey);
    if (!acquired) {
      console.log(`[AI Agent] ⏭️ Skipping duplicate insight execution lock hit: ${executionKey}`);
      return null;
    }

    const existingInsightForMessage = await this.hasExistingInsightForMessage(
      message.teamId,
      message.id,
      routeDecision.insightType,
    );
    if (existingInsightForMessage) {
      console.log(
        `[AI Agent] ⏭️ Skipping duplicate insight generation for message ${message.id} ` +
          `(type=${routeDecision.insightType}) because related insight already exists`,
      );
      return null;
    }

    const insightArchetype = this.resolveArchetypeForInsight(
      routeDecision.insightType,
      message.metadata?.routeArchetype,
    );

    const generatedInsight = await this.executeInsightDecision(
      message.teamId,
      routeDecision.insightType,
      routeDecision.promptOverride,
      insightArchetype.archetype,
    );

    if (this.shouldMergeCompanionIntoMarker(routeDecision)) {
      await AIInsightController.mergeCompanionIntoMarker(
        message.teamId,
        generatedInsight.id,
        this.buildInsightCompanionText(generatedInsight, routeDecision),
      );
    }

    const emitCompanionChat = options?.emitCompanionChat ?? true;
    const forceCompanionChat = options?.forceCompanionChat === true;
    if (
      emitCompanionChat &&
      (forceCompanionChat || this.shouldEmitCompanionChat(routeDecision))
    ) {
      await this.emitInsightCompanionMessage(message, generatedInsight, routeDecision);
    }

    return generatedInsight;
  }

  private static coerceDraftContextRouteDecision(routeDecision: RouteDecision): RouteDecision {
    return {
      ...routeDecision,
      channel: 'chat_message',
      clarify: false,
      insightType: undefined,
      rationale:
        `${routeDecision.rationale} Draft-context promotion prefers inline chat response over insight panel output.`,
    };
  }

  private static coerceChatOnlyRouteDecision(routeDecision: RouteDecision, reason: string): RouteDecision {
    return {
      ...routeDecision,
      channel: 'chat_message',
      clarify: false,
      insightType: undefined,
      suggestedInsightType: undefined,
      rationale: `${routeDecision.rationale} ${reason}`,
    };
  }

  private static getInsightTitle(insightType: InsightGenerationType): string {
    if (insightType === 'summary') return 'Conversation Summary';
    if (insightType === 'action') return 'Action Items';
    if (insightType === 'suggestion') return 'Help';
    return 'Research';
  }

  private static getDefaultArchetypeForInsightType(insightType: InsightGenerationType): AgentPromptArchetype {
    if (insightType === 'summary') return 'decision-brief';
    if (insightType === 'action') return 'execution-coach';
    if (insightType === 'suggestion') return 'pragmatic-advisor';
    return 'research-analyst';
  }

  private static resolveArchetypeForInsight(
    insightType: InsightGenerationType,
    requestedArchetype?: string,
  ): { archetype: AgentPromptArchetype; source: 'request' | 'default' } {
    const requested = resolvePromptArchetype(requestedArchetype);
    if (requested) {
      return {
        archetype: requested,
        source: 'request',
      };
    }

    return {
      archetype: this.getDefaultArchetypeForInsightType(insightType),
      source: 'default',
    };
  }

  private static resolveArchetypeForChat(
    triggerMessage: MessageDTO,
    routeDecision?: Pick<RouteDecision, 'insightType' | 'suggestedInsightType'>,
  ): { archetype: AgentPromptArchetype; source: 'request' | 'route' | 'default' } {
    const requestedArchetype = resolvePromptArchetype(triggerMessage.metadata?.routeArchetype);
    if (requestedArchetype) {
      return {
        archetype: requestedArchetype,
        source: 'request',
      };
    }

    const routedInsightType = routeDecision?.insightType || routeDecision?.suggestedInsightType;
    if (routedInsightType) {
      return {
        archetype: this.getDefaultArchetypeForInsightType(routedInsightType),
        source: 'route',
      };
    }

    const normalizedContent = triggerMessage.content.toLowerCase();
    if (normalizedContent.includes('code')) {
      return {
        archetype: 'implementation-partner',
        source: 'default',
      };
    }

    if (normalizedContent.includes('summary') || normalizedContent.includes('summarize')) {
      return {
        archetype: 'decision-brief',
        source: 'default',
      };
    }

    return {
      archetype: 'pragmatic-advisor',
      source: 'default',
    };
  }

  private static buildInsightClarificationMessage(insightType: InsightGenerationType): string {
    if (insightType === 'summary') {
      return 'I can generate a Summary in Insights. Reply with `/summary` if that is what you want.';
    }
    if (insightType === 'action') {
      return 'I can generate Action Items in Insights. Reply with `/actions` to create them.';
    }
    if (insightType === 'suggestion') {
      return 'I can generate Help in Insights. Reply with `/help` (or `/suggest`) if you want recommendations.';
    }
    return 'I can generate Research in Insights. Reply with `/research` if you want the long-form version.';
  }

  private static async executeInsightDecision(
    teamId: string,
    insightType: InsightGenerationType,
    promptOverride?: string,
    archetypeHint?: string,
  ): Promise<AIInsightDTO> {
    if (insightType === 'summary') {
      return AIInsightController.generateSummary(teamId, archetypeHint);
    }

    if (insightType === 'action') {
      return AIInsightController.generateAction(teamId, promptOverride, archetypeHint);
    }

    if (insightType === 'suggestion') {
      return AIInsightController.generateSuggestion(teamId, promptOverride, archetypeHint);
    }

    return AIInsightController.generateReport(teamId, promptOverride, archetypeHint);
  }

  private static stripMarkdownForSnippet(markdown: string): string {
    return markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static extractInsightSnippet(content: string, maxLength = 220): string {
    const plain = this.stripMarkdownForSnippet(content);
    if (!plain) return '';

    const sentence = plain.split(/[.!?]/)[0]?.trim() || plain;
    if (sentence.length <= maxLength) return sentence;
    return `${sentence.slice(0, maxLength - 3).trimEnd()}...`;
  }

  private static getInsightLabel(insightType: InsightGenerationType): string {
    if (insightType === 'summary') return 'summary';
    if (insightType === 'action') return 'action plan';
    if (insightType === 'suggestion') return 'help brief';
    return 'research';
  }

  private static shouldEmitCompanionChat(routeDecision: RouteDecision): boolean {
    return (
      this.ENABLE_CHAT_PLUS_INSIGHT &&
      !this.ENABLE_MERGED_MARKER_COMPANION &&
      routeDecision.channel === 'insight' &&
      Boolean(routeDecision.insightType)
    );
  }

  private static shouldMergeCompanionIntoMarker(routeDecision: RouteDecision): boolean {
    return (
      this.ENABLE_CHAT_PLUS_INSIGHT &&
      this.ENABLE_MERGED_MARKER_COMPANION &&
      routeDecision.channel === 'insight' &&
      Boolean(routeDecision.insightType)
    );
  }

  private static buildInsightCompanionText(
    insight: AIInsightDTO,
    routeDecision: RouteDecision,
  ): string {
    const type = routeDecision.insightType || insight.type || 'document';

    if (type === 'summary') {
      return 'Summary insight created. Open the card for details.';
    }

    if (type === 'action') {
      return 'Action plan created. Open the card for tasks.';
    }

    if (type === 'suggestion') {
      return 'Help brief created. Open the card for recommendations.';
    }

    return 'Research insight created. Open the card for details.';
  }

  private static async emitInsightCompanionMessage(
    triggerMessage: MessageDTO,
    insight: AIInsightDTO,
    routeDecision: RouteDecision,
  ): Promise<void> {
    const snippet = this.extractInsightSnippet(insight.content);
    const content = this.buildInsightCompanionText(insight, routeDecision);

    const companionMessage = await MessageController.createMessage({
      teamId: triggerMessage.teamId,
      authorId: 'agent',
      content,
      contentType: 'text',
      metadata: {
        parentMessageId: triggerMessage.id,
        linkedInsightId: insight.id,
        linkedInsightType: insight.type,
        sourceActionTitle: insight.title,
        markerLabel: this.getInsightLabel(routeDecision.insightType || 'document'),
        markerPreview: snippet,
      },
    });

    if (this.io) {
      this.io.to(`team:${triggerMessage.teamId}`).emit('message:new', companionMessage);
    }
  }

  private static buildFocusDirective(
    triggerMessage: MessageDTO,
    routeDecision?: Pick<RouteDecision, 'insightType' | 'suggestedInsightType'>,
  ): string | null {
    const metadata = this.getMessageMetadata(triggerMessage);
    if (!metadata) return null;

    const focusParts: string[] = [];
    const labels = Array.isArray(metadata.draftContextLabels)
      ? metadata.draftContextLabels.filter((value): value is string => typeof value === 'string').slice(0, 3)
      : [];

    if (labels.length > 0) {
      focusParts.push(`Promoted draft context to prioritize: ${labels.join(' | ')}`);
    }

    const routedType = routeDecision?.insightType || routeDecision?.suggestedInsightType;
    if (routedType) {
      focusParts.push(`Preferred response framing: ${routedType}`);
    }

    if (focusParts.length === 0) return null;

    return `FOCUS DIRECTIVE:\n- ${focusParts.join('\n- ')}\n- Prioritize these over older generic context.`;
  }

  private static buildRecentInsightsContext(
    insights: Array<{ title: string; type: string; createdAt: Date; content: string }>,
  ): string | null {
    if (insights.length === 0) return null;

    const lines = insights.map((insight) => {
      const createdAt = insight.createdAt.toISOString();
      const snippet = this.extractInsightSnippet(insight.content, 180);
      return `- [${createdAt}] (${insight.type}) ${insight.title}${snippet ? ` :: ${snippet}` : ''}`;
    });

    return `RECENT TEAM INSIGHTS (use as secondary context when relevant):\n${lines.join('\n')}`;
  }

  private static async createEscalatedInsightFromChat(
    teamId: string,
    parentMessageId: string,
    insightType: InsightGenerationType,
    response: {
      content: string;
      model: string;
      usage: { inputTokens: number; outputTokens: number };
      promptArchetype?: AgentPromptArchetype;
      promptArchetypeApplied?: boolean;
      promptArchetypeSource?: 'request' | 'route' | 'default' | 'none';
      promptArchetypeFlagEnabled?: boolean;
    },
  ): Promise<void> {
    await AIInsightController.createInsight({
      teamId,
      type: insightType,
      title: this.getInsightTitle(insightType),
      content: response.content,
      priority: insightType === 'action' || insightType === 'document' ? 'high' : 'medium',
      tags: ['auto-generated', 'auto-escalated-from-chat', insightType, response.model],
      relatedMessageIds: [parentMessageId],
      metadata: {
        prompt: 'auto-escalated-from-chat',
        model: response.model,
        tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
        promptArchetype: response.promptArchetype,
        promptArchetypeApplied: response.promptArchetypeApplied,
        promptArchetypeSource: response.promptArchetypeSource,
        promptArchetypeFlagEnabled: response.promptArchetypeFlagEnabled,
      },
    });
  }

  /**
   * Main entry point: Called when a new message arrives
   * Following copilot-instructions.md: Agent subscribes to message streams
   */
  static async handleNewMessage(message: MessageDTO): Promise<void> {
    try {
      console.log(`[AI Agent] Evaluating message ${message.id} from ${message.authorId}`);

      // 🚨 CRITICAL: Skip AI agent messages to prevent infinite loops
      if (message.authorId === 'agent') {
        console.log(`[AI Agent] Skipping agent's own message to prevent loops`);
        return;
      }

      // 1. Load context
      const [messages, team] = await Promise.all([
        MessageController.getMessages(message.teamId),
        TeamController.getTeamById(message.teamId),
      ]);

      if (!team) {
        console.log('[AI Agent] Team not found');
        return;
      }

      // 2. Check if this is an @agent mention (reactive mode)
      const hasAgentMention = message.content.toLowerCase().includes('@agent');
      const hasExplicitInsightCommand = IntentController.hasExplicitInsightCommand(message.content);
      const requestedInsightType = this.getRequestedInsightType(message);
      const hasRequestedInsightType = Boolean(requestedInsightType);
      const hasDraftContextSignal = this.hasDraftContextSignal(message);
      const hasForcedAgentReplySignal = this.hasForcedAgentReplySignal(message);
      const hasExplicitInsightTrigger = hasExplicitInsightCommand || hasRequestedInsightType;

      // 1.5 Global AI gate
      // - AI_ON: full reactive + autonomous processing
      // - AI_LIGHT: explicit @agent conversational responses only
      const isTeamAIEnabled = this.resolveTeamAIEnabled(message.teamId, team);
      const isExplicitMentionOnlyMode = !isTeamAIEnabled;
      if (!isTeamAIEnabled) {
        if (!hasAgentMention && !hasForcedAgentReplySignal) {
          this.emitContinuationStatus(message.teamId, {
            status: 'ended',
            confidence: 0,
            trigger: 'confidence-gate',
            reason: 'AI-light mode allows only explicit Ask Assistant triggers or @agent mentions.',
          });
          console.log(
            `[AI Agent] 🚫 AI-light mode for team ${message.teamId}, skipping non-explicit message`
          );
          return;
        }

        console.log(
          `[AI Agent] ⚠️ AI-light mode for team ${message.teamId}: explicit Ask/@agent trigger allowed, autonomous disabled`
        );
      }

      // 2.5 Conversational continuation gate
      // Continuation is accepted by explicit mention/reply, or inferred when a
      // recent agent turn is followed by a message that remains above
      // CONTINUATION_MIN_CONFIDENCE.
      const parentMessageId = this.getParentMessageId(message);
      const parentMessage = parentMessageId
        ? messages.find((m) => m.id === parentMessageId)
        : undefined;

      let routeDecisionCache: Awaited<ReturnType<typeof IntentController.decideAgentRoute>> | null = null;
      let hasEmittedContinuationStatus = false;
      const getRouteDecision = async () => {
        if (!routeDecisionCache) {
          routeDecisionCache = await IntentController.decideAgentRoute(message.content, message.teamId);
        }
        return routeDecisionCache;
      };
      const baselineRouteDecision = await getRouteDecision();
      const metadataRequestedRouteDecision = hasRequestedInsightType && requestedInsightType
        ? {
            ...baselineRouteDecision,
            channel: 'insight' as const,
            explicit: true,
            clarify: false,
            insightType: requestedInsightType,
            suggestedInsightType: requestedInsightType,
            rationale: `${baselineRouteDecision.rationale} Metadata requested ${requestedInsightType} insight route.`,
          }
        : baselineRouteDecision;
      const effectiveRouteDecision = isExplicitMentionOnlyMode
        ? this.coerceChatOnlyRouteDecision(
            metadataRequestedRouteDecision,
            'AI-light mode forced conversational chat output (insight routing disabled).',
          )
        : metadataRequestedRouteDecision;

      let isReplyToAgent = Boolean(parentMessage && parentMessage.authorId === 'agent');
      let isConfidenceContinuedConversation = false;
      if (isReplyToAgent) {
        console.log('[AI Agent] 🗣️ Explicit reply-to-agent detected via parentMessageId');
      }

      if (!hasAgentMention && !hasForcedAgentReplySignal && !isReplyToAgent && !hasExplicitInsightTrigger && messages.length >= 2 && !isExplicitMentionOnlyMode) {
        const previousMessage = messages[messages.length - 2];
        const elapsedMs = new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime();
        const isRecentAgentTurn =
          previousMessage.authorId === 'agent' &&
          elapsedMs >= 0 &&
          elapsedMs <= this.CONTINUATION_WINDOW_MS;

        if (isRecentAgentTurn) {
          const routeDecision = effectiveRouteDecision;
          if (routeDecision.confidence >= this.CONTINUATION_MIN_CONFIDENCE) {
            isReplyToAgent = true;
            isConfidenceContinuedConversation = true;
            this.emitContinuationStatus(message.teamId, {
              status: 'active',
              confidence: routeDecision.confidence,
              trigger: 'confidence-gate',
              reason: 'Continuation confidence is above threshold.',
            });
            hasEmittedContinuationStatus = true;
            console.log(
              `[AI Agent] 🔁 Confidence-gated continuation accepted ` +
                `(confidence=${routeDecision.confidence.toFixed(2)} >= ${this.CONTINUATION_MIN_CONFIDENCE.toFixed(2)})`
            );
          } else {
            this.emitContinuationStatus(message.teamId, {
              status: 'ended',
              confidence: routeDecision.confidence,
              trigger: 'confidence-gate',
              reason: 'Continuation confidence fell below threshold.',
            });
            hasEmittedContinuationStatus = true;
            console.log(
              `[AI Agent] ⏹️ Continuation ended by confidence gate ` +
                `(confidence=${routeDecision.confidence.toFixed(2)} < ${this.CONTINUATION_MIN_CONFIDENCE.toFixed(2)})`
            );
          }
        }
      }

      // Optional implicit mode (off by default): use Tier 1 only when enabled.
      const enableImplicitConversationalMode = process.env.ENABLE_IMPLICIT_CONVERSATIONAL_MODE === 'true';
      if (!hasAgentMention && !hasForcedAgentReplySignal && !isReplyToAgent && !hasExplicitInsightTrigger && enableImplicitConversationalMode && messages.length >= 2 && !isExplicitMentionOnlyMode) {
        const previousMessage = messages[messages.length - 2];
        const timeDiff = new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime();
        const isRecent = timeDiff < 5 * 60 * 1000; // 5 minutes

        if (previousMessage.authorId === 'agent' && isRecent) {
          const fallback = await this.detectConversationalReplyWithLLM(message, previousMessage);
          if (fallback.isConversational && fallback.confidence >= 0.8) {
            isReplyToAgent = true;
            console.log(
              `[AI Agent] 🧠 Tier1 conversational fallback matched (confidence=${fallback.confidence.toFixed(2)}): ${fallback.reason}`
            );
          }
        }
      }

      let isModelProactiveResponse = false;

      if (!hasAgentMention && !hasForcedAgentReplySignal && !isReplyToAgent && !hasExplicitInsightTrigger && !isExplicitMentionOnlyMode) {
        if (hasDraftContextSignal) {
          isReplyToAgent = true;
          this.emitContinuationStatus(message.teamId, {
            status: 'active',
            confidence: Math.max(0.85, effectiveRouteDecision.confidence),
            trigger: 'explicit-command',
            reason: 'Draft context promotion explicitly requested an agent reply.',
          });
          hasEmittedContinuationStatus = true;
          console.log('[AI Agent] 🧵 Draft context trigger detected - forcing reactive reply');
        } else {
          const proactiveDecision = await this.shouldRespondProactively(
            message,
            effectiveRouteDecision,
            messages,
          );
          if (proactiveDecision.shouldRespond) {
            isReplyToAgent = true;
            isModelProactiveResponse = true;
            this.emitContinuationStatus(message.teamId, {
              status: 'active',
              confidence: proactiveDecision.confidence,
              trigger: 'confidence-gate',
              reason: proactiveDecision.reason,
            });
            hasEmittedContinuationStatus = true;
            console.log(
              `[AI Agent] 🧠 Model proactive reply enabled ` +
                `(confidence=${proactiveDecision.confidence.toFixed(2)}, threshold=${this.PROACTIVE_RESPONSE_MIN_CONFIDENCE.toFixed(2)})`
            );
          }
        }
      }

      if (hasAgentMention || hasForcedAgentReplySignal || isReplyToAgent || hasExplicitInsightTrigger || hasDraftContextSignal) {
        console.log(
          `[AI Agent] 🎯 ${
            hasExplicitInsightTrigger
              ? 'explicit insight command'
              : hasForcedAgentReplySignal
              ? 'Ask Assistant force reply'
              : hasAgentMention
              ? '@agent mention'
              : hasDraftContextSignal
              ? 'draft-context invocation'
              : isModelProactiveResponse
              ? 'model proactive response'
              : isConfidenceContinuedConversation
              ? 'confidence-gated continuation'
              : 'Reply to agent'
          } detected - responding in reactive mode`
        );
        
        // Inline cooldown check (replaces shouldAgentRespond from reactiveRules.ts)
        // Direct mentions and conversational replies bypass cooldown
        let shouldRespond = true;
        let skipReason = '';
        
        if (!hasAgentMention && !hasForcedAgentReplySignal && !hasExplicitInsightTrigger && (!isReplyToAgent || isModelProactiveResponse)) {
          // Apply cooldown for conversational replies. Explicit @agent bypasses cooldown.
          const lastAgentTime = this.getLastAgentResponseTime(messages);
          if (lastAgentTime) {
            const cooldownMs = 2 * 60 * 1000; // 2 minutes cooldown
            const timeSince = Date.now() - lastAgentTime.getTime();
            if (timeSince < cooldownMs) {
              shouldRespond = false;
              skipReason = 'cooldown_active';
            }
          }
        }

        if (!shouldRespond) {
          const routeDecision = effectiveRouteDecision;
          this.emitContinuationStatus(message.teamId, {
            status: 'ended',
            confidence: routeDecision.confidence,
            trigger: 'confidence-gate',
            reason: skipReason === 'cooldown_active'
              ? 'Continuation gated by cooldown; no reply was sent for this turn.'
              : `Continuation ended without reply (reason: ${skipReason || 'not-eligible'}).`,
          });
          hasEmittedContinuationStatus = true;
          console.log(`[AI Agent] Not responding: ${skipReason}`);
        } else {
          console.log(`[AI Agent] Responding to reactive trigger`);

          // Emit typing indicator - agent is generating
          if (this.io) {
            this.io.to(`team:${message.teamId}`).emit('typing:start', { 
              teamId: message.teamId, 
              userId: 'agent' 
            });
            console.log(`[AI Agent] ⌨️  Emitted typing:start for agent`);
          }

          const routeDecision = hasDraftContextSignal
            ? this.coerceDraftContextRouteDecision(effectiveRouteDecision)
            : effectiveRouteDecision;

          const processingTarget: ProcessingTargetType =
            routeDecision.channel === 'insight' && routeDecision.insightType
              ? routeDecision.insightType
              : 'chat';
          const thinkingDetail =
            routeDecision.channel === 'insight' && routeDecision.insightType
              ? `Preparing ${this.getInsightLabel(routeDecision.insightType)}`
              : 'Thinking through request';
          this.emitProcessingStage(message.teamId, 'thinking', thinkingDetail, processingTarget);

          if (!hasEmittedContinuationStatus) {
            const trigger: ContinuationTrigger = isConfidenceContinuedConversation
              ? 'confidence-gate'
              : hasExplicitInsightTrigger
              ? 'explicit-command'
              : hasForcedAgentReplySignal
              ? 'explicit-command'
              : hasAgentMention
              ? 'explicit-mention'
              : 'explicit-reply';

            this.emitContinuationStatus(message.teamId, {
              status: 'active',
              confidence: routeDecision.confidence,
              trigger,
              reason: 'Reactive continuation remains active for this turn.',
            });
            hasEmittedContinuationStatus = true;
          }

          if (routeDecision.channel === 'insight' && routeDecision.insightType && routeDecision.explicit) {
            console.log(
              `[AI Agent] Routing to insight generation (${routeDecision.insightType}) ` +
                `(confidence=${routeDecision.confidence.toFixed(2)}, explicit=${routeDecision.explicit})`
            );
            await this.generateInsightForRoute(message, routeDecision);
          } else if (
            routeDecision.channel === 'chat_message' &&
            routeDecision.clarify &&
            routeDecision.explicit &&
            routeDecision.suggestedInsightType
          ) {
            const clarificationContent = this.buildInsightClarificationMessage(routeDecision.suggestedInsightType);

            const clarificationMessage = await MessageController.createMessage({
              teamId: message.teamId,
              authorId: 'agent',
              content: clarificationContent,
              contentType: 'text',
              metadata: {
                parentMessageId: message.id,
                routeRationale: routeDecision.rationale,
              },
            });

            if (this.io) {
              this.io.to(`team:${message.teamId}`).emit('message:new', clarificationMessage);
            }
          } else if (
            !isExplicitMentionOnlyMode &&
            hasForcedAgentReplySignal &&
            !hasExplicitInsightTrigger &&
            !routeDecision.explicit &&
            (
              (routeDecision.channel === 'insight' && routeDecision.insightType && !routeDecision.clarify) ||
              this.shouldPromoteAskResearchCompanion(
                message,
                routeDecision,
                hasForcedAgentReplySignal,
                isExplicitMentionOnlyMode,
                hasExplicitInsightTrigger,
              )
            )
          ) {
            const promotedAskInsightDecision =
              routeDecision.channel === 'insight' && routeDecision.insightType
                ? routeDecision
                : {
                    ...routeDecision,
                    channel: 'insight' as const,
                    explicit: false,
                    clarify: false,
                    insightType: 'document' as const,
                    suggestedInsightType: 'document' as const,
                    rationale: `${routeDecision.rationale} Ask-mode research companion promotion applied.`,
                  };

            await this.generateInsightForRoute(message, promotedAskInsightDecision, {
              emitCompanionChat: true,
              forceCompanionChat: true,
            });
          } else {
            // 3b. Normal conversational response
            const response = await this.generateResponse(
              messages,
              team,
              message,
              routeDecision,
              isExplicitMentionOnlyMode,
              parentMessageId,
            );
            const responseContent = typeof response.content === 'string' ? response.content.trim() : '';

            if (!responseContent) {
              console.warn('[AI Agent] Skipping chat post because generated response content was empty');
              this.emitContinuationStatus(message.teamId, {
                status: 'ended',
                confidence: routeDecision.confidence,
                trigger: 'confidence-gate',
                reason: 'Generated response was empty, so no reply was sent for this turn.',
              });
              hasEmittedContinuationStatus = true;
              if (this.io) {
                this.io.to(`team:${message.teamId}`).emit('typing:stop', {
                  teamId: message.teamId,
                  userId: 'agent'
                });
              }
              this.emitProcessingStage(message.teamId, 'idle');
              return;
            }

            // Reactive responses should remain in the main chat channel.
            const cost = this.calculateCost(response.model, response.usage.inputTokens, response.usage.outputTokens);
            const tier = response.model.includes('mini') ? 'tier1' : 'tier2';

            const shouldInlineLinkedInsight =
              !isExplicitMentionOnlyMode &&
              !hasForcedAgentReplySignal &&
              routeDecision.channel === 'insight' &&
              routeDecision.insightType &&
              !routeDecision.explicit &&
              !routeDecision.clarify;

            // For inferred chat+insight turns, generate and link the insight to this
            // conversational reply so the user sees a single composed chat item.
            let inlineLinkedInsight: AIInsightDTO | null = null;
            if (shouldInlineLinkedInsight) {
              inlineLinkedInsight = await this.generateInsightForRoute(message, routeDecision, {
                emitCompanionChat: false,
              });
            }

            // 4. Post as message (unified with regular messages per copilot-instructions.md)
            const agentMessage = await MessageController.createMessage({
              teamId: message.teamId,
              authorId: 'agent',
              content: responseContent,
              contentType: 'text',
              metadata: {
                parentMessageId: message.id,
                linkedInsightId: inlineLinkedInsight?.id,
                linkedInsightType: inlineLinkedInsight?.type,
                sourceActionTitle: inlineLinkedInsight?.title,
              },
              agentMetadata: {
                model: response.model,
                cost,
                tier,
                tokensUsed: {
                  input: response.usage.inputTokens,
                  output: response.usage.outputTokens
                },
                confidence: response.confidence,
                ragContext: response.ragContextItems,
                promptArchetype: response.promptArchetype,
                promptArchetypeApplied: response.promptArchetypeApplied,
                promptArchetypeSource: response.promptArchetypeSource,
                promptArchetypeFlagEnabled: response.promptArchetypeFlagEnabled,
              }
            });

            console.log(`[AI Agent] Posted response message ${agentMessage.id}`);

            // 5. Broadcast agent message via WebSocket
            if (this.io) {
              const roomSize = this.io.sockets.adapter.rooms.get(`team:${message.teamId}`)?.size || 0;
              this.io.to(`team:${message.teamId}`).emit('message:new', agentMessage);
              console.log(`[AI Agent] 🤖 Broadcasted AI message to team: ${message.teamId} | message: ${agentMessage.id} | clients in room: ${roomSize}`);
            } else {
              console.warn('[AI Agent] ⚠️  Socket.IO not available, AI message not broadcasted!');
            }

          }

          // Stop typing indicator - agent finished generating
          if (this.io) {
            this.io.to(`team:${message.teamId}`).emit('typing:stop', { 
              teamId: message.teamId, 
              userId: 'agent' 
            });
            console.log(`[AI Agent] ⌨️  Emitted typing:stop for agent`);
          }
          this.emitProcessingStage(message.teamId, 'idle');
        }
        
        // ⚠️ IMPORTANT: Skip chime evaluation if responded reactively
        // Mark message as handled so async eval (via embedding worker) also skips it
        UnifiedRuleEngine.getInstance().markHandledExternally(message.id);
        console.log(`[AI Agent] Skipping chime evaluation — reactive path handled this message`);
        return;
      }

      if (!hasEmittedContinuationStatus) {
        this.emitContinuationStatus(message.teamId, {
          status: 'ended',
          confidence: effectiveRouteDecision.confidence,
          trigger: 'passive-observation',
          reason: this.buildPassiveObservationReason(effectiveRouteDecision),
        });
      }

      // 7. Evaluate chime rules (autonomous mode) - only if NOT an @agent mention
      await this.evaluateChimeRules(message, messages);

    } catch (error) {
      console.error('[AI Agent] Error handling message:', error);
      // Don't throw - we don't want to break the message flow
    }
  }

  /**
   * Generate AI response based on conversation context
   * Now with RAG support for semantic context retrieval
   */
  private static async generateResponse(
    messages: MessageDTO[],
    team: any,
    triggerMessage: MessageDTO,
    routeDecision?: Pick<RouteDecision, 'insightType' | 'suggestedInsightType'>,
    isExplicitMentionOnlyMode = false,
    parentMessageId?: string,
  ): Promise<{
    content: string;
    model: string;
    usage: any;
    ragContextItems?: any[];
    confidence: number;
    promptArchetype?: AgentPromptArchetype;
    promptArchetypeApplied: boolean;
    promptArchetypeSource: 'request' | 'route' | 'default' | 'none';
    promptArchetypeFlagEnabled: boolean;
  }> {
    const repliedToMessage = parentMessageId
      ? messages.find((m) => m.id === parentMessageId)
      : undefined;
    const conversationHistory = buildConversationContext(messages, team, 20, repliedToMessage?.id);

    // Phase 6.5.2: Load team agent preferences
    let preferences = null;
    try {
      preferences = await AgentPreferencesService.getOrCreate(triggerMessage.teamId);
      console.log(`[AI Agent] 🎛️  Preferences: personality=${preferences.personality}, length=${preferences.responseLength}, proactivity=${preferences.proactivity}, tier=${preferences.modelTierOverride}`);
    } catch (error) {
      console.warn('[AI Agent] Failed to load preferences, using defaults:', error);
    }

    // AI-light mode keeps responses in classic assistant-chat style.
    let systemPrompt = isExplicitMentionOnlyMode ? SYSTEM_PROMPTS.assistantLight : SYSTEM_PROMPTS.assistant;
    if (!isExplicitMentionOnlyMode) {
      if (triggerMessage.content.toLowerCase().includes('summarize') || 
          triggerMessage.content.toLowerCase().includes('summary')) {
        systemPrompt = SYSTEM_PROMPTS.summarizer;
      } else if (triggerMessage.content.toLowerCase().includes('code')) {
        systemPrompt = SYSTEM_PROMPTS.codeGenerator;
      }
    }

    // ✨ NEW: Try to get RAG context for better responses
    let ragContext = '';
    let ragContextItems: any[] = [];
    let confidence = 0.85; // Default confidence for responses without RAG
    try {
      this.emitProcessingStage(
        triggerMessage.teamId,
        'searching-memory',
        'Searching team memory',
        'chat',
      );
      const isRAGReady = await ragService.healthCheck();
      console.log(`[AI Agent] 🔍 RAG health check: ${isRAGReady ? 'ready' : 'not ready'}`);
      if (isRAGReady) {
        const { relevantMessages, totalResults } = await ragService.getRelevantContext(
          triggerMessage.content,
          triggerMessage.teamId,
          5, // Top 5 similar messages
          parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.7') // Configurable similarity threshold
        );

        console.log(`[AI Agent] 🔍 RAG search returned ${totalResults} results`);

        if (totalResults > 0) {
          const scores = relevantMessages.map(m => m.relevanceScore || 0);
          ragContext = buildRAGContext(relevantMessages, scores);
          systemPrompt = SYSTEM_PROMPTS.assistantWithRAG; // Use RAG-aware prompt
          console.log(`[AI Agent] 🔍 Retrieved ${totalResults} relevant messages for context`);
          
          // Calculate confidence based on average relevance score
          const avgRelevance = scores.reduce((a, b) => a + b, 0) / scores.length;
          confidence = Math.min(0.95, 0.7 + (avgRelevance * 0.25)); // Scale 0.7-0.95 based on relevance
          
          // Store RAG context items for transparency display
          ragContextItems = relevantMessages.map(m => ({
            messageId: m.id,
            content: m.content.substring(0, 200) + (m.content.length > 200 ? '...' : ''),
            authorId: m.authorId,
            authorName: m.author?.name,
            relevanceScore: m.relevanceScore || 0,
            createdAt: m.createdAt
          }));
        }
      }
    } catch (error) {
      console.warn('[AI Agent] RAG context retrieval failed, continuing without:', error);
      confidence = 0.6; // Lower confidence when RAG fails
    }

    // Phase 6.5.2: Apply team preferences to system prompt
    systemPrompt = applyPreferences(systemPrompt, preferences);

    const chatArchetype = this.resolveArchetypeForChat(triggerMessage, routeDecision);
    const archetypedPrompt = applyPromptArchetype(systemPrompt, chatArchetype.archetype);

    // Phase 6.5.2: Select model based on team preferences
    const model = getModelForPreferences(preferences, 'tier2');
    this.emitProcessingStage(triggerMessage.teamId, 'analyzing', 'Drafting response', 'chat');

    // Sprint D - Part 5: Inject shared task context if available
    let taskContextMessage: { role: 'system'; content: string } | null = null;
    try {
      const teamData = await prisma.team.findUnique({
        where: { id: triggerMessage.teamId },
        select: { taskContext: true },
      });
      if (teamData?.taskContext) {
        taskContextMessage = {
          role: 'system' as const,
          content: `TEAM TASK CONTEXT (ground truth for this team — align your response to this context first):\n\n${teamData.taskContext}`,
        };
        console.log(`[AI Agent] 📋 Injecting task context (${teamData.taskContext.length} chars)`);
      }
    } catch (error) {
      console.warn('[AI Agent] Failed to load task context:', error);
    }

    let recentInsightsMessage: { role: 'system'; content: string } | null = null;
    try {
      const insightsLimit = Math.max(1, parseInt(process.env.AI_RECENT_INSIGHTS_CONTEXT_LIMIT || '6', 10));
      const recentInsights = await prisma.aIInsight.findMany({
        where: { teamId: triggerMessage.teamId },
        select: { title: true, type: true, content: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: insightsLimit,
      });

      const recentInsightsContext = this.buildRecentInsightsContext(recentInsights);
      if (recentInsightsContext) {
        recentInsightsMessage = {
          role: 'system' as const,
          content: recentInsightsContext,
        };
      }
    } catch (error) {
      console.warn('[AI Agent] Failed to load recent insights context:', error);
    }

    const focusDirective = this.buildFocusDirective(triggerMessage, routeDecision);
    const conversationalConciseDirective =
      'CONVERSATIONAL REPLY MODE: Keep the response concise and practical. Use 2-5 sentences total unless the user explicitly asks for detail.';

    const defaultChatCap = Math.max(160, parseInt(process.env.AI_CHAT_MAX_TOKENS || '480', 10));
    const aiOnChatCap = Math.max(
      160,
      parseInt(process.env.AI_ON_CHAT_MAX_TOKENS || String(defaultChatCap), 10),
    );
    const aiLightChatCap = Math.max(
      160,
      parseInt(process.env.AI_LIGHT_CHAT_MAX_TOKENS || String(defaultChatCap), 10),
    );
    const chatMaxTokens = isExplicitMentionOnlyMode ? aiLightChatCap : aiOnChatCap;

    const response = await this.llm.generate({
      messages: [
        ...(taskContextMessage ? [taskContextMessage] : []),
        ...(recentInsightsMessage ? [recentInsightsMessage] : []),
        { role: 'system' as const, content: archetypedPrompt.prompt },
        ...(ragContext ? [{ role: 'system' as const, content: ragContext }] : []),
        ...(focusDirective ? [{ role: 'system' as const, content: focusDirective }] : []),
        { role: 'system' as const, content: conversationalConciseDirective },
        ...(repliedToMessage ? [{
          role: 'system' as const,
          content: `REPLY CONTEXT: The user is replying to the following earlier message. Address it directly in your response.\n\n"${repliedToMessage.content}"`,
        }] : []),
        ...conversationHistory,
      ],
      model, // Use preference-based model selection
      maxTokens: chatMaxTokens,
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    });

    return {
      ...response,
      ragContextItems,
      confidence,
      promptArchetype: archetypedPrompt.archetype,
      promptArchetypeApplied: archetypedPrompt.applied,
      promptArchetypeSource: archetypedPrompt.archetype ? chatArchetype.source : 'none',
      promptArchetypeFlagEnabled: isPromptArchetypeEnabled(),
    };
  }

  /**
   * Generate long-form content (summaries, documents, etc.)
   * Contract: long-form output is stored as insight; chat gets short conversational response
   */
  static async generateLongFormContent(
    teamId: string,
    prompt: string,
    longFormType: 'summary' | 'document',
    parentMessageId?: string
  ): Promise<AIInsightDTO> {
    const messages = await MessageController.getMessages(teamId);
    const team = await TeamController.getTeamById(teamId);

    if (!team) throw new Error('Team not found');

    const conversationHistory = buildConversationContext(messages, team, 50);

    const systemPrompt = longFormType === 'summary'
      ? SYSTEM_PROMPTS.summarizer
      : SYSTEM_PROMPTS.assistant;

    // Phase 6.5.2: Load and apply team preferences
    let preferences = null;
    try {
      preferences = await AgentPreferencesService.getOrCreate(teamId);
    } catch (error) {
      console.warn('[AI Agent] Failed to load preferences for long-form:', error);
    }
    const finalPrompt = applyPreferences(systemPrompt, preferences);
    const longFormArchetype =
      longFormType === 'summary'
        ? ('decision-brief' as AgentPromptArchetype)
        : ('research-analyst' as AgentPromptArchetype);
    const archetypedLongFormPrompt = applyPromptArchetype(finalPrompt, longFormArchetype);
    const model = getModelForPreferences(preferences, 'tier2');

    // Sprint D - Part 5: Inject shared task context if available
    let taskCtxMsg: { role: 'system'; content: string } | null = null;
    try {
      const teamData = await prisma.team.findUnique({
        where: { id: teamId },
        select: { taskContext: true },
      });
      if (teamData?.taskContext) {
        taskCtxMsg = {
          role: 'system' as const,
          content: `TEAM TASK CONTEXT (ground truth for this team — align your response to this context first):\n\n${teamData.taskContext}`,
        };
      }
    } catch (error) {
      console.warn('[AI Agent] Failed to load task context for long-form:', error);
    }

    console.log(`[AI Agent] Generating ${longFormType} for team ${teamId}`);

    const response = await this.llm.generate({
      messages: [
        ...(taskCtxMsg ? [taskCtxMsg] : []),
        { role: 'system', content: archetypedLongFormPrompt.prompt },
        ...conversationHistory,
        { role: 'user', content: prompt },
      ],
      model,
      maxTokens: 4096,
      temperature: 0.7,
    });

    const mappedInsightType: CreateAIInsightRequest['type'] =
      longFormType === 'summary' ? 'summary' : 'document'

    const insight = await AIInsightController.createInsight({
      teamId,
      type: mappedInsightType,
      title:
        longFormType === 'summary'
          ? 'Conversation Summary'
          : 'Research',
      content: response.content,
      priority: longFormType === 'document' ? 'high' : 'medium',
      tags: ['auto-generated', longFormType, response.model],
      metadata: {
        prompt,
        model: response.model,
        tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
        promptArchetype: archetypedLongFormPrompt.archetype,
        promptArchetypeApplied: archetypedLongFormPrompt.applied,
        promptArchetypeSource: archetypedLongFormPrompt.archetype ? 'default' : 'none',
        promptArchetypeFlagEnabled: isPromptArchetypeEnabled(),
      },
    })

    // createInsight already emits/broadcasts a canonical marker message. Avoid legacy
    // duplicate completion messages in chat for long-form generations.
    void parentMessageId;
    return insight;
  }

  /**
   * Extract insights from conversation
   * Simple pattern matching for now (can be enhanced with LLM)
   */
  private static async extractInsights(
    teamId: string,
    messages: MessageDTO[],
    agentResponse: string
  ): Promise<void> {
    try {
      // Pattern 1: Action items
      const actionItemPattern = /(?:action item|todo|task):\s*(.+)/gi;
      const actionMatches = [...agentResponse.matchAll(actionItemPattern)];

      for (const match of actionMatches) {
        await AIInsightController.createInsight({
          teamId,
          type: 'action',
          title: 'Action Item',
          content: match[1].trim(),
          priority: 'medium',
          relatedMessageIds: messages.length > 0 ? [messages[messages.length - 1].id] : [],
          tags: ['action-item'],
        });
      }

      // Pattern 2: Decisions
      const decisionPattern = /(?:decided|decision):\s*(.+)/gi;
      const decisionMatches = [...agentResponse.matchAll(decisionPattern)];

      for (const match of decisionMatches) {
        await AIInsightController.createInsight({
          teamId,
          type: 'summary',
          title: 'Decision Made',
          content: match[1].trim(),
          priority: 'high',
          relatedMessageIds: messages.length > 0 ? [messages[messages.length - 1].id] : [],
          tags: ['decision'],
        });
      }

    } catch (error) {
      console.error('[AI Agent] Error extracting insights:', error);
    }
  }

  /**
   * Check if user message is requesting to create an action item
   */
  private static isActionCreationRequest(content: string): boolean {
    const lower = content.toLowerCase();
    const patterns = [
      /\b(add|create|make|set|log|track|put)\b.{0,20}\b(action|task|todo|to-do|item)\b/,
      /\baction (item|list)\b/,
      /\b(add|put).{0,15}\b(to the|to our|as a|as an)\b.{0,10}\b(list|action|task|todo)\b/,
      /\bset this.{0,10}(task|for)\b/,
      /\badd.{0,5}(this|that|it|fixing).{0,15}\b(action|task|list)\b/,
    ];
    return patterns.some(p => p.test(lower));
  }

  /**
   * Handle action item creation request
   * Uses LLM to extract the action from conversation context, then creates a real AIInsight
   */
  private static async handleActionCreation(
    triggerMessage: MessageDTO,
    messages: MessageDTO[],
    team: any,
  ): Promise<void> {
    console.log(`[AI Agent] 📋 Action creation request detected`);

    // Use LLM to extract the action item from recent conversation
    const recentMessages = messages.slice(-10);
    const contextStr = recentMessages
      .map(m => {
        const name = m.author?.name || m.authorId;
        return `${name}: ${m.content}`;
      })
      .join('\n');

    let taskContextMessage: { role: 'system'; content: string } | null = null;
    try {
      const teamData = await prisma.team.findUnique({
        where: { id: triggerMessage.teamId },
        select: { taskContext: true },
      });
      if (teamData?.taskContext) {
        taskContextMessage = {
          role: 'system' as const,
          content: `TEAM TASK CONTEXT (ground truth for this team — align your response to this context first):\n\n${teamData.taskContext}`,
        };
        console.log(`[AI Agent] 📋 Injecting task context into action extraction (${teamData.taskContext.length} chars)`);
      }
    } catch (error) {
      console.warn('[AI Agent] Failed to load task context for action extraction:', error);
    }

    const response = await this.llm.generate({
      messages: [
        ...(taskContextMessage ? [taskContextMessage] : []),
        {
          role: 'system' as const,
          content: `You are an action item extractor. The user wants to add something as an action item / task.
Look at the conversation and the user's request to determine:
1. A SHORT title for the action (5-10 words max)
2. A brief description of what needs to be done (1-2 sentences)
3. Priority: low, medium, or high

Respond in this exact JSON format (no markdown):
{"title": "...", "description": "...", "priority": "medium"}`
        },
        {
          role: 'user' as const,
          content: `Recent conversation:\n${contextStr}\n\nThe user's request: "${triggerMessage.content}"\n\nExtract the action item from this conversation.`
        }
      ],
      model: process.env.LLM_MODEL_TIER_1, // Fast model for extraction
      maxTokens: 200,
      temperature: 0.3,
    });

    try {
      const cleaned = response.content.trim().replace(/```json\n?|\n?```/g, '');
      const extracted = JSON.parse(cleaned) as { title: string; description: string; priority: string };
      
      const validPriority = ['low', 'medium', 'high'].includes(extracted.priority) 
        ? extracted.priority as 'low' | 'medium' | 'high'
        : 'medium';

      // Create real AIInsight of type 'action'
      const insight = await AIInsightController.createInsight({
        teamId: triggerMessage.teamId,
        type: 'action',
        title: extracted.title,
        content: extracted.description,
        priority: validPriority,
        relatedMessageIds: [triggerMessage.id],
        tags: ['action-item', 'user-requested'],
      });

      console.log(`[AI Agent] ✅ Created action item insight: ${insight.id} - "${extracted.title}"`);

      // Confirm in chat
      const confirmMessage = await MessageController.createMessage({
        teamId: triggerMessage.teamId,
        authorId: 'agent',
        content: `✅ Added action item: **${extracted.title}**\n\n${extracted.description}\n\n_Priority: ${validPriority} · Check the Actions tab in the right panel._`,
        contentType: 'text',
        metadata: {
          parentMessageId: triggerMessage.id,
        },
      });

      // Broadcast confirmation
      if (this.io) {
        this.io.to(`team:${triggerMessage.teamId}`).emit('message:new', confirmMessage);
      }

    } catch (parseError) {
      console.error('[AI Agent] Failed to parse action extraction:', parseError);
      // Fallback: create action with the raw message
      const insight = await AIInsightController.createInsight({
        teamId: triggerMessage.teamId,
        type: 'action',
        title: 'Action Item',
        content: triggerMessage.content.replace(/@agent\s*/gi, '').trim(),
        priority: 'medium',
        relatedMessageIds: [triggerMessage.id],
        tags: ['action-item', 'user-requested'],
      });

      const confirmMessage = await MessageController.createMessage({
        teamId: triggerMessage.teamId,
        authorId: 'agent',
        content: `✅ Added as action item. Check the Actions tab in the right panel.`,
        contentType: 'text',
        metadata: { parentMessageId: triggerMessage.id },
      });

      if (this.io) {
        this.io.to(`team:${triggerMessage.teamId}`).emit('message:new', confirmMessage);
      }
    }
  }

  /**
   * Get timestamp of last agent response
   */
  private static getLastAgentResponseTime(messages: MessageDTO[]): Date | undefined {
    const agentMessages = messages.filter((m) => m.authorId === 'agent');
    if (agentMessages.length === 0) return undefined;
    return new Date(agentMessages[agentMessages.length - 1].createdAt);
  }

  private static getParentMessageId(message: MessageDTO): string | undefined {
    const metadata = this.getMessageMetadata(message);
    if (!metadata) return undefined;
    return typeof metadata.parentMessageId === 'string' ? metadata.parentMessageId : undefined;
  }

  private static async shouldRespondProactively(
    message: MessageDTO,
    routeDecision: RouteDecision,
    messages: MessageDTO[],
  ): Promise<{ shouldRespond: boolean; confidence: number; reason: string }> {
    if (!this.ENABLE_MODEL_PROACTIVE_RESPONSE) {
      return {
        shouldRespond: false,
        confidence: routeDecision.confidence,
        reason: 'Model proactive gate disabled by environment.',
      };
    }

    try {
      const previousMessage = messages.length >= 2 ? messages[messages.length - 2] : undefined;
      const previousAgentMessage = [...messages.slice(0, -1)]
        .reverse()
        .find((candidate) => candidate.authorId === 'agent');

      const classification = await IntentClassifier.getInstance().assessReplyNeed(message, {
        previousMessage,
        previousAgentMessage,
        routeConfidence: routeDecision.confidence,
      });

      const proactiveIntents = new Set([
        'question',
        'code_request',
        'summary_request',
        'decision_detected',
        'confusion',
        'action_commitment',
        'blocker',
      ]);

      const urgencyBoost =
        classification.urgency === 'critical'
          ? 0.15
          : classification.urgency === 'high'
          ? 0.1
          : classification.urgency === 'medium'
          ? 0.05
          : 0;

      const combinedConfidence = Math.min(
        1,
        Math.max(routeDecision.confidence, classification.confidence) + urgencyBoost,
      );

      const routeConfidencePass = routeDecision.confidence >= this.PROACTIVE_RESPONSE_MIN_CONFIDENCE;
      const classifierConfidencePass = classification.confidence >= this.PROACTIVE_RESPONSE_MIN_CONFIDENCE;

      const shouldRespond =
        classification.requiresResponse &&
        (classification.isContinuation || proactiveIntents.has(classification.intent)) &&
        routeConfidencePass &&
        classifierConfidencePass;

      return {
        shouldRespond,
        confidence: combinedConfidence,
        reason:
          `Model proactive gate: requires=${classification.requiresResponse}, continuation=${classification.isContinuation}, ` +
          `intent=${classification.intent}, urgency=${classification.urgency}, route=${routeDecision.confidence.toFixed(2)}, ` +
          `classifier=${classification.confidence.toFixed(2)}, routePass=${routeConfidencePass}, classifierPass=${classifierConfidencePass}, ` +
          `reason=${classification.reason}.`,
      };
    } catch (error) {
      console.warn('[AI Agent] Proactive-response classification failed:', error);
      return {
        shouldRespond: false,
        confidence: routeDecision.confidence,
        reason: 'Model proactive gate failed; remained in observe mode.',
      };
    }
  }

  private static async detectConversationalReplyWithLLM(
    currentMessage: MessageDTO,
    previousAgentMessage: MessageDTO
  ): Promise<{ isConversational: boolean; confidence: number; reason: string }> {
    const prompt = `Determine if the user's latest message is a direct conversational reply to the AI assistant's previous message.

Assistant message:
"${previousAgentMessage.content}"

User message:
"${currentMessage.content}"

Return JSON only:
{"isConversational": true/false, "confidence": 0.0-1.0, "reason": "short reason"}`;

    try {
      const response = await this.llm.generate({
        messages: [
          {
            role: 'system' as const,
            content: 'You are a strict classifier. Return ONLY valid JSON. Be conservative and avoid false positives.',
          },
          { role: 'user' as const, content: prompt },
        ],
        model: process.env.LLM_MODEL_TIER_1,
        temperature: 0.1,
        maxTokens: 120,
      });

      const cleaned = response.content.trim().replace(/```json\n?|\n?```/g, '');
      const parsed = JSON.parse(cleaned) as {
        isConversational?: boolean;
        confidence?: number;
        reason?: string;
      };

      return {
        isConversational: Boolean(parsed.isConversational),
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0)),
        reason: parsed.reason ?? 'no-reason',
      };
    } catch (error) {
      console.warn('[AI Agent] Conversational fallback classification failed:', error);
      return { isConversational: false, confidence: 0, reason: 'fallback-error' };
    }
  }

  private static buildFastClassification(message: MessageDTO): MessageClassification {
    const sync = IntentClassifier.getInstance().classifySync(message);

    const urgencyFromIntent: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      blocker: 'medium',
      decision_detected: 'medium',
      action_commitment: 'medium',
      confusion: 'medium',
      question: 'low',
      code_request: 'low',
      summary_request: 'low',
      direct_mention: 'low',
      casual_chat: 'low',
      none: 'low',
    };

    return {
      intent: sync.intent,
      sentiment: sync.intent === 'confusion' ? 'confused' : 'neutral',
      urgency: urgencyFromIntent[sync.intent] ?? 'low',
      topics: [],
      confidence: sync.confidence,
    };
  }

  /**
   * Evaluate chime rules for autonomous AI responses
   * Phase 6: Unified Rule Engine Integration
   */
  private static async evaluateChimeRules(
    message: MessageDTO, 
    messages: MessageDTO[]
  ): Promise<void> {
    try {
      if (this.DISABLE_AUTONOMOUS_CHIME) {
        console.log('[AI Agent] 🚫 Autonomous chime evaluation is globally disabled by DISABLE_AUTONOMOUS_CHIME=true');
        return;
      }

      console.log(`[AI Agent] 🔔 Evaluating chime rules for message ${message.id}`);

      // 0. Check if AI is enabled for this team (fresh DB-backed state)
      const team = await TeamController.getTeamById(message.teamId);
      const isTeamAIEnabled = this.resolveTeamAIEnabled(message.teamId, team || undefined);
      if (!isTeamAIEnabled) {
        console.log(`[AI Agent] 🚫 AI disabled for team ${message.teamId}, skipping chime evaluation`);
        return;
      }

      // Use Unified Rule Engine for Sync evaluation
      await UnifiedRuleEngine.getInstance().evaluateSync(message);

      // Also kick off async evaluation immediately (non-blocking) so chimes
      // don't wait for embedding worker flush latency.
      // Worker path remains as fallback and dedup is handled by UnifiedRuleEngine.
      const enableImmediateAsync = process.env.ENABLE_IMMEDIATE_ASYNC_CHIME !== 'false';
      if (enableImmediateAsync) {
        const isAgentMention = message.content.toLowerCase().includes('@agent');
        if (!isAgentMention && message.authorId !== 'agent') {
          const fastClassification = this.buildFastClassification(message);

          embeddingService
            .generateEmbedding(message.content)
            .then(({ embedding }) => {
              return UnifiedRuleEngine.getInstance().evaluateAsync(
                message,
                embedding,
                fastClassification
              );
            })
            .catch((error) => {
              console.warn('[AI Agent] Immediate async chime evaluation failed, worker fallback will handle:', error);
            });
        }
      }

    } catch (error) {
      console.error('[AI Agent] Error evaluating chime rules:', error);
    }
  }

  /**
   * Execute a triggered chime rule
   */
  private static async executeChime(
    decision: any, // ChimeDecision type
    messages: MessageDTO[]
  ): Promise<void> {
    try {
      const { rule, teamId, confidence, triggeringMessageIds } = decision;

      console.log(`[AI Agent] 🎯 Executing chime: ${rule.name} (confidence: ${confidence.toFixed(2)})`);

      // 1. Get team context
      const team = await TeamController.getTeamById(teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      // 2. Build conversation context from triggering messages
      const triggeringMessages = messages.filter(m => 
        triggeringMessageIds.includes(m.id)
      );
      const conversationHistory = buildConversationContext(messages, team, 20);

      // Emit typing indicator - agent is generating chime response
      if (this.io) {
        this.io.to(`team:${teamId}`).emit('typing:start', { 
          teamId, 
          userId: 'agent' 
        });
        console.log(`[AI Agent] ⌨️  Emitted typing:start for chime rule: ${rule.name}`);
      }
      const chimeTarget: ProcessingTargetType =
        rule.action.type === 'insight' || rule.action.type === 'both'
          ? (rule.action.insightType || 'suggestion')
          : 'chat';
      this.emitProcessingStage(teamId, 'analyzing', `Generating ${rule.name}`, chimeTarget);

      // 3. Call LLM with rule's prompt template
      // Sprint D - Part 5: Inject shared task context if available
      let chimeTaskCtx: { role: 'system'; content: string } | null = null;
      try {
        const teamData = await prisma.team.findUnique({
          where: { id: teamId },
          select: { taskContext: true },
        });
        if (teamData?.taskContext) {
          chimeTaskCtx = {
            role: 'system' as const,
            content: `TEAM TASK CONTEXT (ground truth for this team — align your response to this context first):\n\n${teamData.taskContext}`,
          };
        }
      } catch (error) {
        console.warn('[AI Agent] Failed to load task context for chime:', error);
      }

      const response = await this.llm.generate({
        messages: [
          ...(chimeTaskCtx ? [chimeTaskCtx] : []),
          { role: 'system', content: SYSTEM_PROMPTS.assistant },
          ...conversationHistory,
          { role: 'user', content: rule.action.template },
        ],
        maxTokens: 2048,
        temperature: 0.7,
      });

      // Stop typing indicator - agent finished generating
      if (this.io) {
        this.io.to(`team:${teamId}`).emit('typing:stop', { 
          teamId, 
          userId: 'agent' 
        });
        console.log(`[AI Agent] ⌨️  Emitted typing:stop for chime rule: ${rule.name}`);
      }
      this.emitProcessingStage(teamId, 'idle');

      // 4. Create insight or message based on rule action type
      if (rule.action.type === 'insight' || rule.action.type === 'both') {
        const insight = await AIInsightController.createInsight({
          teamId,
          type: rule.action.insightType || 'suggestion',
          title: `AI ${rule.name}`,
          content: response.content,
          priority: rule.priority === 'critical' ? 'high' : rule.priority,
          tags: ['auto-generated', 'chime', rule.name],
          relatedMessageIds: triggeringMessageIds,
          metadata: {
            chimeRuleName: rule.name,
            chimeRuleId: rule.id,
            confidence,
          },
        });

        console.log(`[AI Agent] 📊 Created insight ${insight.id} from chime rule`);

        // Log successful execution
        await ChimeRuleController.logChimeExecution({
          ruleId: rule.id,
          teamId,
          outcome: 'success',
          confidence,
          insightId: insight.id,
        });
      }

      if (rule.action.type === 'chat_message' || rule.action.type === 'both') {
        const agentMessage = await MessageController.createMessage({
          teamId,
          authorId: 'agent',
          content: response.content,
          contentType: 'text',
          metadata: {
            chimeRuleName: rule.name,
            chimeRuleId: rule.id,
            confidence,
            parentMessageId: triggeringMessageIds[0],
          },
        });

        console.log(`[AI Agent] 💬 Posted chime message ${agentMessage.id}`);
        
        // Note: MessageController.createMessage() doesn't broadcast directly
        // The broadcast happens in messageRoutes.ts, but since we're calling
        // createMessage() directly here (not via HTTP), we need to broadcast manually
        if (this.io) {
          this.io.to(`team:${teamId}`).emit('message:new', agentMessage);
          console.log(`[AI Agent] 📤 Broadcasted message:new for chime message`);
        }

        // Log successful execution
        await ChimeRuleController.logChimeExecution({
          ruleId: rule.id,
          teamId,
          outcome: 'success',
          confidence,
          messageId: agentMessage.id,
        });
      }

    } catch (error) {
      console.error('[AI Agent] Error executing chime:', error);
      this.emitProcessingStage(decision.teamId, 'idle');
      
      // Log failed execution
      await ChimeRuleController.logChimeExecution({
        ruleId: decision.rule.id,
        teamId: decision.teamId,
        outcome: 'error',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Calculate estimated cost of LLM usage
   */
  private static calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Prices per 1M tokens (approximate)
    let inputPrice = 0;
    let outputPrice = 0;

    if (model.includes('mini')) {
      inputPrice = 0.15;
      outputPrice = 0.60;
    } else if (model.includes('gpt-4o')) {
      inputPrice = 2.50;
      outputPrice = 10.00;
    }

    return (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;
  }
}
