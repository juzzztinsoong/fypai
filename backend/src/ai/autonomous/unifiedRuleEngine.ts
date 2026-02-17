import { MessageDTO } from '@fypai/types';
import { prisma } from '../../db.js';
import { ChimeRule, ChimeLog } from '@prisma/client';
import { ChimeEvaluator, ChimeEvaluationContext, ChimeDecision, ChimeRule as IChimeRule } from './chimeEngine.js';
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
  private readonly processedMessageTtlMs = 10 * 60 * 1000; // 10 minutes
  private readonly asyncMaxMessageAgeMs = parseInt(process.env.ASYNC_CHIME_MAX_AGE_MS || '120000', 10);

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

  /**
   * Sync Evaluation: Checks Regex/Keyword rules immediately
   * Called by MessageController/aiAgentController on new message
   */
  async evaluateSync(message: MessageDTO): Promise<void> {
    if (this.hasProcessedTrigger(message.id)) {
      console.log(`[UnifiedRuleEngine] ⏭️ Sync skipped (already processed message ${message.id})`);
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
    // Map Prisma ChimeRule to the interface expected by ChimeEvaluator
    const mappedRules: IChimeRule[] = rules.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type as any,
      enabled: r.enabled,
      priority: r.priority as any,
      cooldownMinutes: r.cooldownMinutes,
      conditions: JSON.parse(r.conditions),
      action: JSON.parse(r.action),
      teamId: r.teamId || undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    const evaluator = new ChimeEvaluator(mappedRules);
    const decisions = await evaluator.evaluate(context);

    // 4. Execute highest priority decision
    if (decisions.length > 0) {
      const topDecision = decisions[0];
      const triggeringMessageId = topDecision.triggeringMessageIds?.[0] || message.id;

      if (this.hasProcessedTrigger(triggeringMessageId)) {
        console.log(`[UnifiedRuleEngine] ⏭️ Sync top decision skipped (already processed ${triggeringMessageId})`);
        return;
      }

      await this.executeDecision(topDecision);
      this.markProcessedTrigger(triggeringMessageId);
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
        const conditions = JSON.parse(rule.conditions);
        let shouldTrigger = false;
        let confidence = 0;

        // Phase 6.2: Intent-based matching (fast path)
        if (conditions.requiredIntents && classification) {
          const requiredIntents = conditions.requiredIntents as IntentType[];
          if (requiredIntents.includes(classification.intent)) {
            shouldTrigger = true;
            confidence = classification.confidence;
            console.log(`[UnifiedRuleEngine] 🎯 Intent match for ${rule.name}: ${classification.intent}`);
          }
        }

        // Phase 6.2: Urgency-based matching
        if (conditions.minUrgency && classification) {
          const urgencyOrder: UrgencyLevel[] = ['low', 'medium', 'high', 'critical'];
          const minIndex = urgencyOrder.indexOf(conditions.minUrgency);
          const messageIndex = urgencyOrder.indexOf(classification.urgency);
          if (messageIndex >= minIndex) {
            shouldTrigger = true;
            confidence = Math.max(confidence, 0.7 + (messageIndex * 0.1));
            console.log(`[UnifiedRuleEngine] 🚨 Urgency threshold met for ${rule.name}: ${classification.urgency}`);
          }
        }

        // Phase 6.2: Sentiment-based matching
        if (conditions.triggerSentiments && classification) {
          const triggerSentiments = conditions.triggerSentiments as string[];
          if (triggerSentiments.includes(classification.sentiment)) {
            shouldTrigger = true;
            confidence = Math.max(confidence, classification.confidence);
            console.log(`[UnifiedRuleEngine] 😤 Sentiment match for ${rule.name}: ${classification.sentiment}`);
          }
        }

        // Semantic vector matching (original behavior)
        const semanticQuery = conditions.semanticQuery;
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
            shouldTrigger = true;
            confidence = Math.max(confidence, similarity);
            console.log(`[UnifiedRuleEngine] 📊 Semantic match for ${rule.name}: ${similarity.toFixed(2)}`);
          }
        }

        // If rule should trigger, add to decisions
        if (shouldTrigger) {
          console.log(`[UnifiedRuleEngine] ✅ Async rule triggered: ${rule.name} (confidence: ${confidence.toFixed(2)})`);
          
          const decision: ChimeDecision = {
            rule: { 
              ...rule, 
              conditions, 
              action: JSON.parse(rule.action),
              type: rule.type as any,
              priority: rule.priority as any
            } as any,
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
      // Sort by priority then confidence
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      triggeredDecisions.sort((a, b) => {
        const priorityDiff = (priorityOrder[b.rule.priority] || 0) - (priorityOrder[a.rule.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return b.confidence - a.confidence;
      });

      const topDecision = triggeredDecisions[0];
      const triggeringMessageId = topDecision.triggeringMessageIds?.[0] || message.id;

      if (this.hasProcessedTrigger(triggeringMessageId)) {
        console.log(`[UnifiedRuleEngine] ⏭️ Async top decision skipped (already processed ${triggeringMessageId})`);
        return;
      }

      console.log(`[UnifiedRuleEngine] 🏆 Executing top decision: ${topDecision.rule.name}`);
      await this.executeDecision(topDecision);
      this.markProcessedTrigger(triggeringMessageId);
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

  /**
   * Execute a Chime Decision
   */
  private async executeDecision(decision: ChimeDecision): Promise<void> {
    const { rule, teamId } = decision;
    console.log(`[UnifiedRuleEngine] Executing rule: ${rule.name}`);

    try {
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

      const response = await this.llm.generate({
        messages: [
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
          priority: rule.priority === 'critical' ? 'high' : 'medium',
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
      await prisma.chimeLog.create({
        data: {
          ruleId: rule.id,
          teamId,
          outcome: 'success',
          confidence: decision.confidence
        }
      });

    } catch (error) {
      console.error(`[UnifiedRuleEngine] Error executing rule ${rule.name}:`, error);
      // Log error
      await prisma.chimeLog.create({
        data: {
          ruleId: rule.id,
          teamId,
          outcome: 'error',
          errorMsg: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
}
