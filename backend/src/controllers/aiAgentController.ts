/**
 * AI Agent Controller
 * 
 * Following copilot-instructions.md architecture:
 * - Posts messages via same message:new flow for unified history
 * - Uses contentType: 'ai_longform' for structured outputs
 * - Links outputs via metadata.parentMessageId
 */

import { GitHubModelsClient } from '../ai/llm/githubModelsClient.js';
import { SYSTEM_PROMPTS, buildConversationContext } from '../ai/llm/prompts.js';
import { shouldAgentRespond } from '../ai/agent/rules.js';
import { MessageController } from './messageController.js';
import { TeamController } from './teamController.js';
import { AIInsightController } from './aiInsightController.js';
import { MessageDTO, CreateAIInsightRequest } from '@fypai/types';
import { Server as SocketIOServer } from 'socket.io';

export class AIAgentController {
  private static llm = new GitHubModelsClient();
  private static io: SocketIOServer | null = null;

  /**
   * Set Socket.IO instance for broadcasting
   */
  static setSocketIO(io: SocketIOServer): void {
    this.io = io;
    console.log('[AIAgentController] ✅ Socket.IO instance configured for AI broadcasts');
  }

  /**
   * Main entry point: Called when a new message arrives
   * Following copilot-instructions.md: Agent subscribes to message streams
   */
  static async handleNewMessage(message: MessageDTO): Promise<void> {
    try {
      console.log(`[AI Agent] Evaluating message ${message.id} from ${message.authorId}`);

      // 1. Load context
      const [messages, team] = await Promise.all([
        MessageController.getMessages(message.teamId),
        TeamController.getTeamById(message.teamId),
      ]);

      if (!team) {
        console.log('[AI Agent] Team not found');
        return;
      }

      // 2. Decide if agent should respond (chime policy)
      const decision = shouldAgentRespond(message, {
        recentMessages: messages,
        agentLastResponseTime: this.getLastAgentResponseTime(messages),
        teamSettings: { autoRespond: true, cooldownMinutes: 2 },
      });

      if (!decision.should) {
        console.log(`[AI Agent] Not responding: ${decision.reason}`);
        return;
      }

      console.log(`[AI Agent] Responding due to: ${decision.reason} (rules: ${decision.triggeredRules.join(', ')})`);

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

    } catch (error) {
      console.error('[AI Agent] Error handling message:', error);
      // Don't throw - we don't want to break the message flow
    }
  }

  /**
   * Generate AI response based on conversation context
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

    const response = await this.llm.generate({
      messages: [
        { role: 'system', content: systemPrompt },
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
}
