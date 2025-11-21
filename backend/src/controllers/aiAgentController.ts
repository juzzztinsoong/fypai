/**
 * AI Agent Controller
 * 
 * Following copilot-instructions.md architecture:
 * - Posts messages via same message:new flow for unified history
 * - Uses contentType: 'ai_longform' for structured outputs
 * - Links outputs via metadata.parentMessageId
 * - Evaluates chime rules for autonomous AI responses
 */

import { GitHubModelsClient } from '../ai/core/llm.js';
import { SYSTEM_PROMPTS, buildConversationContext, buildRAGContext } from '../ai/core/prompts.js';
import { shouldAgentRespond } from '../ai/reactive/reactiveRules.js';
import { ChimeEvaluator } from '../ai/autonomous/chimeEngine.js';
import { MessageController } from './messageController.js';
import { TeamController } from './teamController.js';
import { AIInsightController } from './aiInsightController.js';
import { ChimeRuleController } from './chimeRuleController.js';
import { RuleProvider } from '../ai/rules/ruleProvider.js';
import { ragService } from '../services/ragService.js';
import { MessageDTO, CreateAIInsightRequest } from '@fypai/types';
import { Server as SocketIOServer } from 'socket.io';

export class AIAgentController {
  private static llm = new GitHubModelsClient();
  private static io: SocketIOServer | null = null;
  private static teamAIEnabled: Map<string, boolean> = new Map(); // In-memory cache for AI enabled state

  /**
   * Set Socket.IO instance for broadcasting
   */
  static setSocketIO(io: SocketIOServer): void {
    this.io = io;
    console.log('[AIAgentController] ✅ Socket.IO instance configured for AI broadcasts');
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

      if (hasAgentMention) {
        console.log(`[AI Agent] 🎯 @agent mention detected - responding in reactive mode`);
        
        // Decide if agent should respond (cooldown check)
        const decision = shouldAgentRespond(message, {
          recentMessages: messages,
          agentLastResponseTime: this.getLastAgentResponseTime(messages),
          teamSettings: { autoRespond: true, cooldownMinutes: 2 },
        });

        if (!decision.should) {
          console.log(`[AI Agent] Not responding: ${decision.reason}`);
        } else {
          console.log(`[AI Agent] Responding due to: ${decision.reason} (rules: ${decision.triggeredRules.join(', ')})`);

          // Emit typing indicator - agent is generating
          if (this.io) {
            this.io.to(`team:${message.teamId}`).emit('typing:start', { 
              teamId: message.teamId, 
              userId: 'agent' 
            });
            console.log(`[AI Agent] ⌨️  Emitted typing:start for agent`);
          }

          // 3. Generate response
          const response = await this.generateResponse(messages, team, message);

          // 4. Post as message (unified with regular messages per copilot-instructions.md)
          const agentMessage = await MessageController.createMessage({
            teamId: message.teamId,
            authorId: 'agent',
            content: response.content,
            contentType: 'text',
            metadata: {
              parentMessageId: message.id,
              model: response.model,
              tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
            },
          });

          console.log(`[AI Agent] Posted response message ${agentMessage.id}`);

          // Stop typing indicator - agent finished generating
          if (this.io) {
            this.io.to(`team:${message.teamId}`).emit('typing:stop', { 
              teamId: message.teamId, 
              userId: 'agent' 
            });
            console.log(`[AI Agent] ⌨️  Emitted typing:stop for agent`);
          }

          // 5. Broadcast agent message via WebSocket
          if (this.io) {
            const roomSize = this.io.sockets.adapter.rooms.get(`team:${message.teamId}`)?.size || 0;
            this.io.to(`team:${message.teamId}`).emit('message:new', agentMessage);
            console.log(`[AI Agent] 🤖 Broadcasted AI message to team: ${message.teamId} | message: ${agentMessage.id} | clients in room: ${roomSize}`);
          } else {
            console.warn('[AI Agent] ⚠️  Socket.IO not available, AI message not broadcasted!');
          }

          // 6. Extract insights if needed
          await this.extractInsights(message.teamId, messages, response.content);
        }
        
        // ⚠️ IMPORTANT: Skip chime evaluation if @agent was mentioned
        // User explicitly asked for agent help, don't spam with autonomous responses
        console.log(`[AI Agent] Skipping chime evaluation due to @agent mention`);
        return;
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
    triggerMessage: MessageDTO
  ): Promise<{ content: string; model: string; usage: any }> {
    const conversationHistory = buildConversationContext(messages, team, 20);

    // Determine system prompt based on trigger
    let systemPrompt = SYSTEM_PROMPTS.assistant;
    if (triggerMessage.content.toLowerCase().includes('summarize') || 
        triggerMessage.content.toLowerCase().includes('summary')) {
      systemPrompt = SYSTEM_PROMPTS.summarizer;
    } else if (triggerMessage.content.toLowerCase().includes('code') ||
               triggerMessage.content.toLowerCase().includes('implement')) {
      systemPrompt = SYSTEM_PROMPTS.codeGenerator;
    }

    // ✨ NEW: Try to get RAG context for better responses
    let ragContext = '';
    try {
      const isRAGReady = await ragService.healthCheck();
      if (isRAGReady) {
        const { relevantMessages, totalResults } = await ragService.getRelevantContext(
          triggerMessage.content,
          triggerMessage.teamId,
          5, // Top 5 similar messages
          parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.7') // Configurable similarity threshold
        );

        if (totalResults > 0) {
          const scores = relevantMessages.map(m => m.relevanceScore || 0);
          ragContext = buildRAGContext(relevantMessages, scores);
          systemPrompt = SYSTEM_PROMPTS.assistantWithRAG; // Use RAG-aware prompt
          console.log(`[AI Agent] 🔍 Retrieved ${totalResults} relevant messages for context`);
        }
      }
    } catch (error) {
      console.warn('[AI Agent] RAG context retrieval failed, continuing without:', error);
    }

    const response = await this.llm.generate({
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...(ragContext ? [{ role: 'system' as const, content: ragContext }] : []),
        ...conversationHistory,
      ],
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048'),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    });

    return response;
  }

  /**
   * Generate long-form content (summaries, documents, etc.)
   * Following copilot-instructions.md: contentType: 'ai_longform' for structured outputs
   */
  static async generateLongFormContent(
    teamId: string,
    prompt: string,
    longFormType: 'summary' | 'document' | 'code',
    parentMessageId?: string
  ): Promise<MessageDTO> {
    const messages = await MessageController.getMessages(teamId);
    const team = await TeamController.getTeamById(teamId);

    if (!team) throw new Error('Team not found');

    const conversationHistory = buildConversationContext(messages, team, 50);

    const systemPrompt = longFormType === 'summary' 
      ? SYSTEM_PROMPTS.summarizer 
      : longFormType === 'code'
      ? SYSTEM_PROMPTS.codeGenerator
      : SYSTEM_PROMPTS.assistant;

    console.log(`[AI Agent] Generating ${longFormType} for team ${teamId}`);

    const response = await this.llm.generate({
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: prompt },
      ],
      maxTokens: 4096,
      temperature: 0.7,
    });

    // Create message with long-form content
    const agentMessage = await MessageController.createMessage({
      teamId,
      authorId: 'agent',
      content: response.content,
      contentType: 'ai_longform',
      metadata: {
        prompt,
        model: response.model,
        longFormType,  // Use longFormType instead of contentType
        tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
        parentMessageId,  // Link to originating message
      },
    });

    // Broadcast AI-generated long-form content via WebSocket
    if (this.io) {
      const roomSize = this.io.sockets.adapter.rooms.get(`team:${teamId}`)?.size || 0;
      this.io.to(`team:${teamId}`).emit('message:new', agentMessage);
      console.log(`[AI Agent] 🤖 Broadcasted AI ${longFormType} to team: ${teamId} | message: ${agentMessage.id} | clients in room: ${roomSize}`);
    } else {
      console.warn('[AI Agent] ⚠️  Socket.IO not available, AI message not broadcasted!');
    }

    return agentMessage;
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
   * Get timestamp of last agent response
   */
  private static getLastAgentResponseTime(messages: MessageDTO[]): Date | undefined {
    const agentMessages = messages.filter((m) => m.authorId === 'agent');
    if (agentMessages.length === 0) return undefined;
    return new Date(agentMessages[agentMessages.length - 1].createdAt);
  }

  /**
   * Evaluate chime rules for autonomous AI responses
   * Phase 3: Chime Rules Engine Integration
   */
  private static async evaluateChimeRules(
    message: MessageDTO, 
    messages: MessageDTO[]
  ): Promise<void> {
    try {
      console.log(`[AI Agent] 🔔 Evaluating chime rules for message ${message.id}`);
      console.log(`[AI Agent] 📝 Message content: "${message.content}"`);
      console.log(`[AI Agent] 📚 Total messages in context: ${messages.length}`);

      // 0. Check if AI is enabled for this team
      if (!this.isAIEnabled(message.teamId)) {
        console.log(`[AI Agent] 🚫 AI disabled for team ${message.teamId}, skipping chime evaluation`);
        return;
      }

      // 1. Get active rules for this team
      const rules = await RuleProvider.getRulesForTeam(message.teamId);
      
      console.log(`[AI Agent] 📋 Found ${rules.length} active chime rules for team ${message.teamId}`);
      
      if (rules.length === 0) {
        console.log('[AI Agent] ⚠️  No active chime rules for this team');
        return;
      }

      // Log each rule being evaluated
      rules.forEach((rule, i) => {
        console.log(`[AI Agent] Rule ${i + 1}: ${rule.name} (${rule.type}, priority: ${rule.priority})`);
      });

      // 2. Create evaluator with team's active rules
      const evaluator = new ChimeEvaluator(rules);

      // 3. Build evaluation context
      // STRATEGY: Use recent message window, but only trigger if NEW message contributes to pattern
      // This prevents:
      // - False positives from old messages (old messages alone won't trigger)
      // - Threshold rules never triggering (messageCount > 1 can accumulate)
      //
      // The evaluator will check if patterns appear in recent messages,
      // but we ensure the NEW message is part of the triggering set
      const recentMessages = messages.slice(-5); // Last 5 messages for context
      
      const context = {
        teamId: message.teamId,
        recentMessages: recentMessages,
        newMessageId: message.id, // Track which message is new
        recentInsights: [],
        currentTime: new Date(),
      };

      console.log(`[AI Agent] 🔍 Evaluating with ${recentMessages.length} recent messages, new message: ${message.id}`);

      // 4. Evaluate all rules
      const decisions = await evaluator.evaluate(context);

      if (decisions.length === 0) {
        console.log('[AI Agent] No chime rules triggered');
        return;
      }

      console.log(`[AI Agent] ✅ ${decisions.length} chime rule(s) triggered`);

      // 🚨 ANTI-SPAM: Only execute the HIGHEST PRIORITY rule to avoid overwhelming the chat
      // Rules are already sorted by priority (critical > high > medium > low)
      const topDecision = decisions[0];
      
      if (decisions.length > 1) {
        console.log(`[AI Agent] ⚠️  Multiple rules triggered, executing only highest priority: ${topDecision.rule.name}`);
        console.log(`[AI Agent] 🔕 Skipped rules: ${decisions.slice(1).map(d => d.rule.name).join(', ')}`);
      }

      // 5. Execute only the top priority rule
      await this.executeChime(topDecision, messages);

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

      // 3. Call LLM with rule's prompt template
      const response = await this.llm.generate({
        messages: [
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
      
      // Log failed execution
      await ChimeRuleController.logChimeExecution({
        ruleId: decision.rule.id,
        teamId: decision.teamId,
        outcome: 'error',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
