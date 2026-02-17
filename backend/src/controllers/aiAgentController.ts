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
import { SYSTEM_PROMPTS, buildConversationContext, buildRAGContext, applyPreferences, getModelForPreferences } from '../ai/core/prompts.js';
import { shouldAgentRespond } from '../ai/reactive/reactiveRules.js';
import { ChimeEvaluator } from '../ai/autonomous/chimeEngine.js';
import { UnifiedRuleEngine } from '../ai/autonomous/unifiedRuleEngine.js';
import { MessageController } from './messageController.js';
import { TeamController } from './teamController.js';
import { AIInsightController } from './aiInsightController.js';
import { ChimeRuleController } from './chimeRuleController.js';
import { RuleProvider } from '../ai/rules/ruleProvider.js';
import { ragService } from '../services/ragService.js';
import { AgentPreferencesService } from '../services/agentPreferencesService.js';
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

      // 2.5 Check if this is a reply to an agent question (Conversational Mode)
      let isReplyToAgent = false;
      if (!hasAgentMention && messages.length >= 2) {
        const previousMessage = messages[messages.length - 2];
        const timeDiff = new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime();
        const isRecent = timeDiff < 5 * 60 * 1000; // 5 minutes

        if (previousMessage.authorId === 'agent' && isRecent) {
           // Check if agent asked a question or requested info
           // Updated to handle multi-line responses, bullet points, and polite closing statements
           const content = previousMessage.content;
           const lowerContent = content.toLowerCase();
           
           if (content.includes('?') || 
               lowerContent.includes('let me know') ||
               lowerContent.includes('elaborate') ||
               lowerContent.includes('please clarify') ||
               lowerContent.includes('what do you mean') ||
               lowerContent.includes('can you') ||
               lowerContent.includes('could you')) {
             isReplyToAgent = true;
             console.log(`[AI Agent] 🗣️ Detected reply to agent question - entering conversational mode`);
           }
        }
      }

      if (hasAgentMention || isReplyToAgent) {
        console.log(`[AI Agent] 🎯 ${hasAgentMention ? '@agent mention' : 'Reply to agent'} detected - responding in reactive mode`);
        
        // Decide if agent should respond (cooldown check)
        // For direct replies/mentions, we generally want to respond unless spammed
        const decision = shouldAgentRespond(message, {
          recentMessages: messages,
          agentLastResponseTime: this.getLastAgentResponseTime(messages),
          isConversationalReply: isReplyToAgent, // Pass the flag
          teamSettings: { autoRespond: true, cooldownMinutes: isReplyToAgent ? 0 : 2 }, // No cooldown for replies
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

          // Calculate cost
          const cost = this.calculateCost(response.model, response.usage.inputTokens, response.usage.outputTokens);
          const tier = response.model.includes('mini') ? 'tier1' : 'tier2';

          // 4. Post as message (unified with regular messages per copilot-instructions.md)
          const agentMessage = await MessageController.createMessage({
            teamId: message.teamId,
            authorId: 'agent',
            content: response.content,
            contentType: 'text',
            metadata: {
              parentMessageId: message.id,
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
              ragContext: response.ragContextItems
            }
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
  ): Promise<{ content: string; model: string; usage: any; ragContextItems?: any[]; confidence: number }> {
    const conversationHistory = buildConversationContext(messages, team, 20);

    // Phase 6.5.2: Load team agent preferences
    let preferences = null;
    try {
      preferences = await AgentPreferencesService.getOrCreate(triggerMessage.teamId);
      console.log(`[AI Agent] 🎛️  Preferences: personality=${preferences.personality}, length=${preferences.responseLength}, proactivity=${preferences.proactivity}, tier=${preferences.modelTierOverride}`);
    } catch (error) {
      console.warn('[AI Agent] Failed to load preferences, using defaults:', error);
    }

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
    let ragContextItems: any[] = [];
    let confidence = 0.85; // Default confidence for responses without RAG
    try {
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

    // Phase 6.5.2: Select model based on team preferences
    const model = getModelForPreferences(preferences, 'tier2');

    const response = await this.llm.generate({
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...(ragContext ? [{ role: 'system' as const, content: ragContext }] : []),
        ...conversationHistory,
      ],
      model, // Use preference-based model selection
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048'),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    });

    return { ...response, ragContextItems, confidence };
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

    // Phase 6.5.2: Load and apply team preferences
    let preferences = null;
    try {
      preferences = await AgentPreferencesService.getOrCreate(teamId);
    } catch (error) {
      console.warn('[AI Agent] Failed to load preferences for long-form:', error);
    }
    const finalPrompt = applyPreferences(systemPrompt, preferences);
    const model = getModelForPreferences(preferences, 'tier2');

    console.log(`[AI Agent] Generating ${longFormType} for team ${teamId}`);

    const response = await this.llm.generate({
      messages: [
        { role: 'system', content: finalPrompt },
        ...conversationHistory,
        { role: 'user', content: prompt },
      ],
      model,
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
   * Phase 6: Unified Rule Engine Integration
   */
  private static async evaluateChimeRules(
    message: MessageDTO, 
    messages: MessageDTO[]
  ): Promise<void> {
    try {
      console.log(`[AI Agent] 🔔 Evaluating chime rules for message ${message.id}`);

      // 0. Check if AI is enabled for this team
      if (!this.isAIEnabled(message.teamId)) {
        console.log(`[AI Agent] 🚫 AI disabled for team ${message.teamId}, skipping chime evaluation`);
        return;
      }

      // Use Unified Rule Engine for Sync evaluation
      await UnifiedRuleEngine.getInstance().evaluateSync(message);

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
