import { MessageDTO } from '@fypai/types';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { ChimeEvaluator, ChimeEvaluationContext, ChimeDecision } from './chimeEngine.js';
import type { RuleDefinition } from '../rules/ruleDefinitions.js';
import { MessageController } from '../../controllers/messageController.js';
import { AIInsightController } from '../../controllers/aiInsightController.js';
import { GitHubModelsClient } from '../core/llm.js';
import { SYSTEM_PROMPTS } from '../core/prompts.js';
import { embeddingService } from '../../services/embeddingService.js';
import { MessageClassification, IntentType, UrgencyLevel } from '../core/intentClassifier.js';
import { Server as SocketIOServer } from 'socket.io';

export class UnifiedRuleEngine {
  private static instance: UnifiedRuleEngine;
  private static io: SocketIOServer | null = null;
  private llm: GitHubModelsClient;
  private ruleEmbeddings: Map<string, number[]> = new Map();
  private processedMessageTriggers: Map<string, number> = new Map(); // messageId -> timestamp
  private ruleCooldownExpirations: Map<string, number> = new Map(); // teamId:ruleId -> expiry timestamp
  private inFlightExecutions: Map<string, number> = new Map(); // messageId -> lock timestamp
  private readonly processedMessageTtlMs = 10 * 60 * 1000; // 10 minutes
  private readonly asyncMaxMessageAgeMs = parseInt(process.env.ASYNC_CHIME_MAX_AGE_MS || '120000', 10);
  private readonly inFlightExecutionTtlMs = Math.max(
    1000,
    parseInt(process.env.CHIME_IN_FLIGHT_TTL_MS || '45000', 10),
  );
  private static readonly ACK_OR_SOCIAL_PATTERN =
    /^(ok(?:ay)?|k|kk|thanks|thank you|thx|got it|noted|sounds good|great|cool|nice|awesome|roger|yep|yeah|nope|nah|all good|looks good|works for me)[.!\s]*$/i;

  private constructor() {
    this.llm = new GitHubModelsClient();
  }

  public static getInstance(): UnifiedRuleEngine {
    if (!UnifiedRuleEngine.instance) {
      UnifiedRuleEngine.instance = new UnifiedRuleEngine();
    }
    return UnifiedRuleEngine.instance;
  }

  public static setSocketIO(io: SocketIOServer): void {
    UnifiedRuleEngine.io = io;
    console.log('[UnifiedRuleEngine] ✅ Socket.IO instance configured');
  }

  private pruneProcessedTriggers(): void {
    const now = Date.now();
    for (const [messageId, timestamp] of this.processedMessageTriggers.entries()) {
      if (now - timestamp > this.processedMessageTtlMs) {
        this.processedMessageTriggers.delete(messageId);
      }
    }
  }

  private hasProcessedTrigger(messageId: string): boolean {
    this.pruneProcessedTriggers();
    return this.processedMessageTriggers.has(messageId);
  }

  private markProcessedTrigger(messageId: string): void {
    this.pruneProcessedTriggers();
    this.processedMessageTriggers.set(messageId, Date.now());
  }

  private getRuleCooldownKey(teamId: string, ruleId: string): string {
    return `${teamId}:${ruleId}`;
  }

  private pruneRuleCooldowns(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.ruleCooldownExpirations.entries()) {
      if (expiresAt <= now) {
        this.ruleCooldownExpirations.delete(key);
      }
    }
  }

  private isRuleInCooldown(ruleId: string, teamId: string, cooldownMinutes: number): boolean {
    if (!Number.isFinite(cooldownMinutes) || cooldownMinutes <= 0) {
      return false;
    }

    this.pruneRuleCooldowns();
    const key = this.getRuleCooldownKey(teamId, ruleId);
    const expiresAt = this.ruleCooldownExpirations.get(key);
    if (!expiresAt) {
      return false;
    }

    return expiresAt > Date.now();
  }

  private markRuleCooldown(ruleId: string, teamId: string, cooldownMinutes: number): void {
    if (!Number.isFinite(cooldownMinutes) || cooldownMinutes <= 0) {
      return;
    }

    const expiresAt = Date.now() + (cooldownMinutes * 60 * 1000);
    const key = this.getRuleCooldownKey(teamId, ruleId);
    this.ruleCooldownExpirations.set(key, expiresAt);
  }

  private pruneInFlightExecutions(): void {
    const now = Date.now();
    for (const [messageId, lockedAt] of this.inFlightExecutions.entries()) {
      if (now - lockedAt > this.inFlightExecutionTtlMs) {
        this.inFlightExecutions.delete(messageId);
      }
    }
  }

  private isInFlightExecution(messageId: string): boolean {
    this.pruneInFlightExecutions();
    return this.inFlightExecutions.has(messageId);
  }

  private acquireExecutionLock(messageId: string): boolean {
    this.pruneInFlightExecutions();
    if (this.inFlightExecutions.has(messageId)) {
      return false;
    }

    this.inFlightExecutions.set(messageId, Date.now());
    return true;
  }

  private releaseExecutionLock(messageId: string): void {
    this.inFlightExecutions.delete(messageId);
  }

  private isCommitmentRule(ruleName: string, requiredIntents: IntentType[]): boolean {
    return (
      requiredIntents.includes('action_commitment') ||
      /commitment|action\s*item|tracker/i.test(ruleName)
    );
  }

  private passesCommitmentQualityGate(message: MessageDTO): boolean {
    const content = (message.content || '').trim();
    if (!content) return false;

    const normalized = content.toLowerCase();
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;

    if (UnifiedRuleEngine.ACK_OR_SOCIAL_PATTERN.test(normalized)) {
      return false;
    }

    if (/\bwhat do you think\b/.test(normalized) || /\bthanks\b/.test(normalized)) {
      return false;
    }

    const hasOwnerSignal =
      /\b(i\s*'ll|i\s*will|we\s*'ll|we\s*will|let\s+me|i\s+am\s+going\s+to|i'm\s+going\s+to)\b/.test(normalized);
    const hasConcreteActionVerb =
      /\b(finish|complete|deliver|prepare|send|draft|book|organize|coordinate|review|submit|create|update|schedule|finalize|share)\b/.test(normalized);
    const hasDeadlineSignal =
      /\b(by|before|tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week|end\s+of|eod|eow|\d{4}-\d{2}-\d{2}|\d{1,2}\s*(am|pm))\b/.test(normalized);

    const strongCommitment = hasOwnerSignal && hasConcreteActionVerb;
    if (!strongCommitment) return false;

    // Require either a time signal or enough detail to avoid short vague commitments.
    if (!hasDeadlineSignal && wordCount < 7) {
      return false;
    }

    return true;
  }

  /**
   * Mark a message as already handled (e.g., by the reactive @agent path).
   * Prevents the async evaluation from producing a duplicate response.
   */
  public markHandledExternally(messageId: string): void {
    this.markProcessedTrigger(messageId);
    console.log(`[UnifiedRuleEngine] ⏭️ Marked ${messageId} as externally handled (skipping future async eval)`);
  }

  /**
   * Sync Evaluation: Checks Regex/Keyword rules immediately
   * Called by MessageController/aiAgentController on new message
   */
  async evaluateSync(message: MessageDTO): Promise<void> {
    if (this.hasProcessedTrigger(message.id)) {
      console.log(`[UnifiedRuleEngine] ⏭️ Sync skipped (already processed message ${message.id})`);
      return;
    }

    if (this.isInFlightExecution(message.id)) {
      console.log(`[UnifiedRuleEngine] ⏳ Sync skipped (message ${message.id} already in-flight)`);
      return;
    }

    // 1. Fetch Sync rules (System + Team)
    const rules = await prisma.chimeRule.findMany({
      where: {
        enabled: true,
        execution: 'sync', // Only sync rules
        OR: [
          { teamId: null }, // System rules
          { teamId: message.teamId } // Team rules
        ]
      }
    });

    if (rules.length === 0) return;

    // 2. Build Context
    // We need recent messages for pattern matching context
    const recentMessages = await MessageController.getMessages(message.teamId, 10);
    
    const context: ChimeEvaluationContext = {
      teamId: message.teamId,
      recentMessages: recentMessages,
      newMessageId: message.id,
      recentInsights: [], // Not needed for sync pattern rules usually
      currentTime: new Date()
    };

    // 3. Evaluate
    // Map Prisma ChimeRule to the RuleDefinition interface
    const mappedRules: RuleDefinition[] = rules.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      execution: (r.execution || 'sync') as RuleDefinition['execution'],
      type: r.type as RuleDefinition['type'],
      enabled: r.enabled,
      priority: r.priority,
      cooldownMinutes: r.cooldownMinutes,
      conditions: JSON.parse(r.conditions),
      action: JSON.parse(r.action),
      teamId: r.teamId || undefined,
      sourceRuleId: r.sourceRuleId || undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    const cooldownEligibleRules = mappedRules.filter((rule) => {
      const inCooldown = this.isRuleInCooldown(rule.id, message.teamId, rule.cooldownMinutes);
      if (inCooldown) {
        console.log(`[UnifiedRuleEngine] ⏸️ Sync rule in cooldown, skipping: ${rule.name}`);
      }
      return !inCooldown;
    });

    if (cooldownEligibleRules.length === 0) {
      return;
    }

    const evaluator = new ChimeEvaluator(cooldownEligibleRules);
    const decisions = await evaluator.evaluate(context);

    // 4. Execute highest priority decision
    if (decisions.length > 0) {
      const topDecision = decisions[0];
      const triggeringMessageId = topDecision.triggeringMessageIds?.[0] || message.id;

      if (this.hasProcessedTrigger(triggeringMessageId)) {
        console.log(`[UnifiedRuleEngine] ⏭️ Sync top decision skipped (already processed ${triggeringMessageId})`);
        return;
      }

      if (!this.acquireExecutionLock(triggeringMessageId)) {
        console.log(`[UnifiedRuleEngine] ⏳ Sync top decision skipped (lock held for ${triggeringMessageId})`);
        return;
      }

      try {
        this.markRuleCooldown(topDecision.rule.id, message.teamId, topDecision.rule.cooldownMinutes);
        await this.executeDecision(topDecision);
        this.markProcessedTrigger(triggeringMessageId);
      } finally {
        this.releaseExecutionLock(triggeringMessageId);
      }
    }
  }

  /**
   * Async Evaluation: Checks Semantic rules using Vector Similarity + Intent Classification
   * Called by EmbeddingWorker after generating message embedding and classification
   * 
   * Phase 6.2: Now uses intent classification for smarter rule matching
   */
  async evaluateAsync(
    message: MessageDTO, 
    messageEmbedding: number[], 
    classification?: MessageClassification
  ): Promise<void> {
    const messageAgeMs = Date.now() - new Date(message.createdAt).getTime();
    if (messageAgeMs > this.asyncMaxMessageAgeMs) {
      console.log(
        `[UnifiedRuleEngine] ⏭️ Async skipped stale message ${message.id} ` +
        `(age=${Math.round(messageAgeMs / 1000)}s, max=${Math.round(this.asyncMaxMessageAgeMs / 1000)}s)`
      );
      return;
    }

    if (this.hasProcessedTrigger(message.id)) {
      console.log(`[UnifiedRuleEngine] ⏭️ Async skipped (already processed message ${message.id})`);
      return;
    }

    if (this.isInFlightExecution(message.id)) {
      console.log(`[UnifiedRuleEngine] ⏳ Async skipped (message ${message.id} already in-flight)`);
      return;
    }

    // Skip agent messages to prevent loops
    if (message.authorId === 'agent') {
      console.log(`[UnifiedRuleEngine] ⏭️ Skipping agent message`);
      return;
    }

    // 1. Fetch Async rules
    const rules = await prisma.chimeRule.findMany({
      where: {
        enabled: true,
        execution: 'async',
        OR: [
          { teamId: null },
          { teamId: message.teamId }
        ]
      }
    });

    if (rules.length === 0) return;

    // Track triggered rules to avoid spam (execute only top priority)
    const triggeredDecisions: ChimeDecision[] = [];

    for (const rule of rules) {
      try {
        if (this.isRuleInCooldown(rule.id, message.teamId, rule.cooldownMinutes)) {
          console.log(`[UnifiedRuleEngine] ⏸️ Async rule in cooldown, skipping: ${rule.name}`);
          continue;
        }

        const conditions = JSON.parse(rule.conditions);
        let confidence = 0;

        // Phase 6.2: Intent + Urgency + Sentiment matching
        // Logic: ALL specified conditions must pass (AND), not just any one (OR)
        // Each condition that exists is a filter; if any filter fails, the rule doesn't trigger
        const hasIntentFilters = Boolean(
          conditions.requiredIntents || conditions.minUrgency || conditions.triggerSentiments,
        );
        let intentPassed = true;  // default true = no filter
        let urgencyPassed = true;
        let sentimentPassed = true;

        // Intent filter
        const requiredIntents = (conditions.requiredIntents || []) as IntentType[];
        if (conditions.requiredIntents) {
          if (classification) {
            if (requiredIntents.includes(classification.intent)) {
              confidence = Math.max(confidence, classification.confidence);
              console.log(`[UnifiedRuleEngine] 🎯 Intent match for ${rule.name}: ${classification.intent}`);
            } else {
              intentPassed = false;
            }
          } else {
            intentPassed = false;
          }
        }

        // Urgency filter (only checked if intent passed or no intent required)
        if (conditions.minUrgency) {
          if (classification) {
            const urgencyOrder: UrgencyLevel[] = ['low', 'medium', 'high', 'critical'];
            const minIndex = urgencyOrder.indexOf(conditions.minUrgency);
            const messageIndex = urgencyOrder.indexOf(classification.urgency);
            if (messageIndex >= minIndex) {
              confidence = Math.max(confidence, 0.7 + (messageIndex * 0.1));
              console.log(`[UnifiedRuleEngine] 🚨 Urgency threshold met for ${rule.name}: ${classification.urgency}`);
            } else {
              urgencyPassed = false;
            }
          } else {
            urgencyPassed = false;
          }
        }

        // Sentiment filter
        if (conditions.triggerSentiments) {
          if (classification) {
            const triggerSentiments = conditions.triggerSentiments as string[];
            if (triggerSentiments.includes(classification.sentiment)) {
              confidence = Math.max(confidence, classification.confidence);
              console.log(`[UnifiedRuleEngine] 😤 Sentiment match for ${rule.name}: ${classification.sentiment}`);
            } else {
              sentimentPassed = false;
            }
          } else {
            sentimentPassed = false;
          }
        }

        const semanticQuery = conditions.semanticQuery;
        const hasSemanticFilter = Boolean(semanticQuery);
        let semanticPassed = !hasSemanticFilter;

        if (semanticQuery) {
          // Get or generate rule embedding
          let ruleEmbedding = this.ruleEmbeddings.get(rule.id);
          if (!ruleEmbedding) {
            const response = await embeddingService.generateEmbedding(semanticQuery);
            ruleEmbedding = response.embedding;
            this.ruleEmbeddings.set(rule.id, ruleEmbedding);
          }

          // Calculate Similarity
          const similarity = this.cosineSimilarity(messageEmbedding, ruleEmbedding);
          const threshold = conditions.threshold || 0.5;
          
          if (similarity >= threshold) {
            semanticPassed = true;
            confidence = Math.max(confidence, similarity);
            console.log(`[UnifiedRuleEngine] 📊 Semantic match for ${rule.name}: ${similarity.toFixed(2)}`);
          } else {
            semanticPassed = false;
          }
        }

        let shouldTrigger =
          intentPassed &&
          urgencyPassed &&
          sentimentPassed &&
          semanticPassed &&
          (hasIntentFilters || hasSemanticFilter);

        // Additional guard: avoid noisy autonomous action-item creation on low-signal/social turns.
        if (shouldTrigger && this.isCommitmentRule(rule.name, requiredIntents)) {
          const qualityPass = this.passesCommitmentQualityGate(message);
          if (!qualityPass) {
            shouldTrigger = false;
            console.log(
              `[UnifiedRuleEngine] 🛑 Commitment quality gate blocked ${rule.name} for message ${message.id}`
            );
          }
        }

        // If rule should trigger, add to decisions
        if (shouldTrigger) {
          console.log(`[UnifiedRuleEngine] ✅ Async rule triggered: ${rule.name} (confidence: ${confidence.toFixed(2)})`);
          
          const decision: ChimeDecision = {
            rule: { 
              id: rule.id,
              name: rule.name,
              description: rule.description || '',
              execution: (rule.execution || 'async') as RuleDefinition['execution'],
              type: rule.type as RuleDefinition['type'],
              enabled: rule.enabled,
              priority: rule.priority,
              cooldownMinutes: rule.cooldownMinutes,
              conditions,
              action: JSON.parse(rule.action),
              teamId: rule.teamId || undefined,
              sourceRuleId: rule.sourceRuleId || undefined,
            },
            teamId: message.teamId,
            triggeringMessageIds: [message.id],
            confidence,
            timestamp: new Date()
          };
          
          triggeredDecisions.push(decision);
        }
      } catch (err) {
        console.error(`[UnifiedRuleEngine] Error evaluating async rule ${rule.id}:`, err);
      }
    }

    // Execute only the highest priority/confidence decision to prevent spam
    if (triggeredDecisions.length > 0) {
      // Sort by priority (numeric, higher = more important) then confidence
      triggeredDecisions.sort((a, b) => {
        const priorityA = typeof a.rule.priority === 'number' ? a.rule.priority : 0;
        const priorityB = typeof b.rule.priority === 'number' ? b.rule.priority : 0;
        const priorityDiff = priorityB - priorityA;
        if (priorityDiff !== 0) return priorityDiff;
        return b.confidence - a.confidence;
      });

      const topDecision = triggeredDecisions[0];
      const triggeringMessageId = topDecision.triggeringMessageIds?.[0] || message.id;

      if (this.hasProcessedTrigger(triggeringMessageId)) {
        console.log(`[UnifiedRuleEngine] ⏭️ Async top decision skipped (already processed ${triggeringMessageId})`);
        return;
      }

      if (!this.acquireExecutionLock(triggeringMessageId)) {
        console.log(`[UnifiedRuleEngine] ⏳ Async top decision skipped (lock held for ${triggeringMessageId})`);
        return;
      }

      try {
        this.markRuleCooldown(topDecision.rule.id, message.teamId, topDecision.rule.cooldownMinutes);
        console.log(`[UnifiedRuleEngine] 🏆 Executing top decision: ${topDecision.rule.name}`);
        await this.executeDecision(topDecision);
        this.markProcessedTrigger(triggeringMessageId);
      } finally {
        this.releaseExecutionLock(triggeringMessageId);
      }
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async safeCreateChimeLog(data: {
    ruleId: string;
    teamId: string;
    outcome: 'success' | 'cooldown' | 'error';
    confidence?: number;
    messageId?: string;
    insightId?: string;
    errorMsg?: string;
  }): Promise<void> {
    try {
      await prisma.chimeLog.create({
        data: {
          ruleId: data.ruleId,
          teamId: data.teamId,
          outcome: data.outcome,
          confidence: data.confidence,
          messageId: data.messageId,
          insightId: data.insightId,
          errorMsg: data.errorMsg,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        let hasRule = false;
        let hasTeam = false;

        try {
          const [rule, team] = await Promise.all([
            prisma.chimeRule.findUnique({ where: { id: data.ruleId }, select: { id: true } }),
            prisma.team.findUnique({ where: { id: data.teamId }, select: { id: true } }),
          ]);
          hasRule = Boolean(rule);
          hasTeam = Boolean(team);
        } catch {
          // best effort diagnostics only
        }

        console.warn(
          `[UnifiedRuleEngine] ⚠️ Skipping chime log insert due FK constraint ` +
            `(ruleExists=${hasRule}, teamExists=${hasTeam}, outcome=${data.outcome})`
        );
        return;
      }

      console.error('[UnifiedRuleEngine] Failed to persist chime log:', error);
    }
  }

  private async ensureDecisionRefsExist(ruleId: string, teamId: string): Promise<boolean> {
    const [rule, team] = await Promise.all([
      prisma.chimeRule.findUnique({ where: { id: ruleId }, select: { id: true } }),
      prisma.team.findUnique({ where: { id: teamId }, select: { id: true } }),
    ]);

    if (!rule || !team) {
      console.warn(
        `[UnifiedRuleEngine] ⏭️ Skipping decision execution due missing references ` +
          `(ruleId=${ruleId}, ruleExists=${Boolean(rule)}, teamId=${teamId}, teamExists=${Boolean(team)})`
      );
      return false;
    }

    return true;
  }

  /**
   * Execute a Chime Decision
   */
  private async executeDecision(decision: ChimeDecision): Promise<void> {
    const { rule, teamId } = decision;
    console.log(`[UnifiedRuleEngine] Executing rule: ${rule.name}`);

    try {
      const refsExist = await this.ensureDecisionRefsExist(rule.id, teamId);
      if (!refsExist) {
        return;
      }

      // Generate content using LLM
      const messages = await MessageController.getMessages(teamId, 20);
      // Simple context builder
      const contextStr = messages.map(m => `${m.authorId}: ${m.content}`).join('\n');
      
      const prompt = `
        Context:
        ${contextStr}

        Task:
        ${rule.action.template}
      `;

      let taskContextMessage: { role: 'system'; content: string } | null = null;
      try {
        const teamData = await prisma.team.findUnique({
          where: { id: teamId },
          select: { taskContext: true },
        });
        if (teamData?.taskContext) {
          taskContextMessage = {
            role: 'system' as const,
            content: `TEAM TASK CONTEXT (ground truth for this team — align your response to this context first):\n\n${teamData.taskContext}`,
          };
          console.log(`[UnifiedRuleEngine] 📋 Injecting task context (${teamData.taskContext.length} chars)`);
        }
      } catch (error) {
        console.warn('[UnifiedRuleEngine] Failed to load task context:', error);
      }

      const response = await this.llm.generate({
        messages: [
          ...(taskContextMessage ? [taskContextMessage] : []),
          { role: 'system', content: SYSTEM_PROMPTS.chimeAgent || 'You are a helpful AI assistant.' },
          { role: 'user', content: prompt }
        ],
        model: process.env.LLM_MODEL_TIER_1 // Use Tier 1 for Chime actions by default
      });

      // Create Insight or Message
      if (rule.action.type === 'insight' && rule.action.insightType) {
        await AIInsightController.createInsight({
          teamId,
          type: rule.action.insightType,
          title: `AI: ${rule.name}`,
          content: response.content,
          priority: rule.priority >= 80 ? 'high' : 'medium',
          tags: ['auto-generated', 'chime', rule.name],
          metadata: { chimeRuleName: rule.name }
        });
      } else if (rule.action.type === 'chat_message') {
        const parentMessageId = decision.triggeringMessageIds?.[0];

        const chimeMessage = await MessageController.createMessage({
          teamId,
          authorId: 'agent',
          content: response.content,
          contentType: 'text',
          metadata: { 
            chimeRuleName: rule.name,
            chimeRuleId: rule.id,
            confidence: decision.confidence,
            parentMessageId,
          },
          agentMetadata: {
            model: response.model,
            cost: 0,
            tier: response.model.includes('mini') ? 'tier1' : 'tier2',
            tokensUsed: {
              input: response.usage.inputTokens,
              output: response.usage.outputTokens
            },
            confidence: decision.confidence
          }
        });

        if (UnifiedRuleEngine.io) {
          const roomSize = UnifiedRuleEngine.io.sockets.adapter.rooms.get(`team:${teamId}`)?.size || 0;
          UnifiedRuleEngine.io.to(`team:${teamId}`).emit('message:new', chimeMessage);
          console.log(`[UnifiedRuleEngine] 📤 Broadcasted chime message ${chimeMessage.id} to team:${teamId} (${roomSize} clients)`);
        }
      }

      // Log success
      await this.safeCreateChimeLog({
        ruleId: rule.id,
        teamId,
        outcome: 'success',
        confidence: decision.confidence,
      });

    } catch (error) {
      console.error(`[UnifiedRuleEngine] Error executing rule ${rule.name}:`, error);
      // Log error
      await this.safeCreateChimeLog({
        ruleId: rule.id,
        teamId,
        outcome: 'error',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
