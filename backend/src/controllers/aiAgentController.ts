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
import { prisma } from '../db.js';
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

  private static emitProcessingStage(
    teamId: string,
    stage: 'thinking' | 'searching-memory' | 'analyzing' | 'idle'
  ): void {
    if (!this.io) return;
    this.io.to(`team:${teamId}`).emit('ai:processing', {
      teamId,
      userId: 'agent',
      stage,
    });
    console.log(`[AI Agent] 🧭 Emitted ai:processing stage=${stage} for team=${teamId}`);
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

      // 2.5 Conversational Mode gate (strict by default)
      // Default behavior: only explicit replies to an agent message continue the
      // conversation (or explicit @agent mention above).
      const parentMessageId = this.getParentMessageId(message);
      const parentMessage = parentMessageId
        ? messages.find((m) => m.id === parentMessageId)
        : undefined;

      let isReplyToAgent = Boolean(parentMessage && parentMessage.authorId === 'agent');
      if (isReplyToAgent) {
        console.log('[AI Agent] 🗣️ Explicit reply-to-agent detected via parentMessageId');
      }

      // Optional implicit mode (off by default): use Tier 1 only when enabled.
      const enableImplicitConversationalMode = process.env.ENABLE_IMPLICIT_CONVERSATIONAL_MODE === 'true';
      if (!hasAgentMention && !isReplyToAgent && enableImplicitConversationalMode && messages.length >= 2) {
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

      if (hasAgentMention || isReplyToAgent) {
        console.log(`[AI Agent] 🎯 ${hasAgentMention ? '@agent mention' : 'Reply to agent'} detected - responding in reactive mode`);
        
        // Inline cooldown check (replaces shouldAgentRespond from reactiveRules.ts)
        // Direct mentions and conversational replies bypass cooldown
        let shouldRespond = true;
        let skipReason = '';
        
        if (!hasAgentMention) {
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
          console.log(`[AI Agent] Not responding: ${skipReason}`);
        } else {
          console.log(`[AI Agent] Responding to ${hasAgentMention ? '@agent mention' : 'conversational reply'}`);
          this.emitProcessingStage(message.teamId, 'thinking');

          // Emit typing indicator - agent is generating
          if (this.io) {
            this.io.to(`team:${message.teamId}`).emit('typing:start', { 
              teamId: message.teamId, 
              userId: 'agent' 
            });
            console.log(`[AI Agent] ⌨️  Emitted typing:start for agent`);
          }

          // 3a. Check if user is requesting an action item be created
          const isActionRequest = this.isActionCreationRequest(message.content);
          
          if (isActionRequest) {
            // Extract what the action item should be and create a real insight
            await this.handleActionCreation(message, messages, team);
          } else {
            // 3b. Normal conversational response
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
      this.emitProcessingStage(triggerMessage.teamId, 'searching-memory');
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
    this.emitProcessingStage(triggerMessage.teamId, 'analyzing');

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

    const response = await this.llm.generate({
      messages: [
        ...(taskContextMessage ? [taskContextMessage] : []),
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
    const metadata = (message as any).metadata;
    if (!metadata) return undefined;

    if (typeof metadata === 'object' && typeof metadata.parentMessageId === 'string') {
      return metadata.parentMessageId;
    }

    if (typeof metadata === 'string') {
      try {
        const parsed = JSON.parse(metadata);
        if (parsed && typeof parsed.parentMessageId === 'string') {
          return parsed.parentMessageId;
        }
      } catch {
        return undefined;
      }
    }

    return undefined;
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
      console.log(`[AI Agent] 🔔 Evaluating chime rules for message ${message.id}`);

      // 0. Check if AI is enabled for this team
      if (!this.isAIEnabled(message.teamId)) {
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
      this.emitProcessingStage(teamId, 'analyzing');

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
