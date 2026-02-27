/**
 * AI Insight Controller
 * 
 * Tech Stack: Express, Prisma, @fypai/types
 * Pattern: Controller handles business logic, routes delegate to controller
 * 
 * Methods:
 *   - getInsights(teamId: string): Get all AI insights for a team (returns AIInsightDTO[])
 *   - createInsight(data: CreateAIInsightRequest): Create new insight (returns AIInsightDTO)
 *   - deleteInsight(id: string): Delete insight
 * 
 * Architecture:
 *   - Uses Prisma entity types for database operations
 *   - Transforms to DTO types using aiInsightToDTO() before returning
 *   - Returns API-friendly types with ISO strings and parsed JSON arrays
 *   - Handles tags and relatedMessageIds as JSON arrays
 */

import { prisma } from '../db.js'
import { AIInsightDTO, CreateAIInsightRequest, UpdateAIInsightRequest, UpdateInsightStatusRequest, aiInsightToDTO, aiInsightsToDTO } from '../types.js'
import { GitHubModelsClient } from '../ai/core/llm.js'
import { SYSTEM_PROMPTS, buildConversationContext } from '../ai/core/prompts.js'
import { MessageController } from './messageController.js'
import { TeamController } from './teamController.js'
import { Server as SocketIOServer } from 'socket.io'
import { CacheService } from '../services/cacheService.js'

export class AIInsightController {
  private static llm = new GitHubModelsClient();
  private static io: SocketIOServer | null = null;

  /**
   * Set Socket.IO instance for broadcasting
   */
  static setSocketIO(io: SocketIOServer): void {
    this.io = io;
    console.log('[AIInsightController] ✅ Socket.IO instance configured for insight broadcasts');
  }

  /**
   * Get all AI insights for a team
   * @param {string} teamId - Team ID
   * @returns {Promise<AIInsightDTO[]>} Array of AI insight DTOs
   */
  static async getInsights(teamId: string): Promise<AIInsightDTO[]> {
    const insights = await prisma.aIInsight.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' }
    })

    return aiInsightsToDTO(insights)
  }

  /**
   * Create a new AI insight
   * @param {CreateAIInsightRequest} data - Insight data
   * @returns {Promise<AIInsightDTO>} Created insight DTO
   */
  static async createInsight(data: CreateAIInsightRequest): Promise<AIInsightDTO> {
    const insight = await prisma.aIInsight.create({
      data: {
        teamId: data.teamId,
        type: data.type,
        title: data.title,
        content: data.content,
        priority: data.priority || null,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        relatedMessageIds: data.relatedMessageIds ? JSON.stringify(data.relatedMessageIds) : null
      }
    })

    const insightDTO = aiInsightToDTO(insight)

    // Invalidate team cache after insight creation
    await CacheService.invalidateTeamCache(data.teamId)

    // 🚨 CRITICAL: Broadcast new insight to team via WebSocket
    if (this.io) {
      this.io.to(`team:${data.teamId}`).emit('ai:insight:new', insightDTO);
      console.log(`[AIInsightController] 📊 Broadcasted ai:insight:new to team: ${data.teamId}`);
    }

    return insightDTO
  }

  /**
   * Update insight status (Sprint D - Part 2: Insight Lifecycle)
   * @param {string} id - Insight ID
   * @param {UpdateInsightStatusRequest} data - Status update data
   * @returns {Promise<AIInsightDTO>} Updated insight DTO
   */
  static async updateInsightStatus(id: string, data: UpdateInsightStatusRequest): Promise<AIInsightDTO> {
    const updateData: any = {
      status: data.status,
    };

    // Set reviewedAt/reviewedBy on first status change from 'new'
    if (data.status !== 'new') {
      updateData.reviewedAt = new Date();
      updateData.reviewedBy = data.userId;
    }

    // Set completedAt when accepted
    if (data.status === 'accepted') {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }

    const insight = await prisma.aIInsight.update({
      where: { id },
      data: updateData,
    });

    const insightDTO = aiInsightToDTO(insight);

    // Invalidate team cache
    await CacheService.invalidateTeamCache(insight.teamId);

    // Broadcast update via WebSocket
    if (this.io) {
      this.io.to(`team:${insight.teamId}`).emit('insight:updated', insightDTO);
      console.log(`[AIInsightController] 📝 Broadcasted insight:updated (status=${data.status}) to team: ${insight.teamId}`);
    }

    return insightDTO;
  }

  /**
   * Update insight fields (Sprint D - Part 3: Mutable Action Items)
   * @param {string} id - Insight ID
   * @param {UpdateAIInsightRequest} data - Fields to update
   * @returns {Promise<AIInsightDTO>} Updated insight DTO
   */
  static async updateInsight(id: string, data: UpdateAIInsightRequest): Promise<AIInsightDTO> {
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.tags !== undefined) updateData.tags = data.tags ? JSON.stringify(data.tags) : null;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    if (data.actionPriority !== undefined) updateData.actionPriority = data.actionPriority;

    const insight = await prisma.aIInsight.update({
      where: { id },
      data: updateData,
    });

    const insightDTO = aiInsightToDTO(insight);

    // Invalidate team cache
    await CacheService.invalidateTeamCache(insight.teamId);

    // Broadcast update via WebSocket
    if (this.io) {
      this.io.to(`team:${insight.teamId}`).emit('insight:updated', insightDTO);
      console.log(`[AIInsightController] 📝 Broadcasted insight:updated to team: ${insight.teamId}`);
    }

    return insightDTO;
  }

  /**
   * Delete an AI insight
   * @param {string} id - Insight ID
   * @returns {Promise<void>}
   */
  static async deleteInsight(id: string): Promise<void> {
    await prisma.aIInsight.delete({
      where: { id }
    })
  }

  /**
   * Delete all AI insights for a team (session reset)
   * @param {string} teamId - Team ID
   * @returns {Promise<string[]>} Deleted insight IDs
   */
  static async deleteInsightsByTeam(teamId: string): Promise<string[]> {
    const existing = await prisma.aIInsight.findMany({
      where: { teamId },
      select: { id: true },
    })

    await prisma.aIInsight.deleteMany({
      where: { teamId },
    })

    await CacheService.invalidateTeamCache(teamId)

    if (this.io) {
      for (const insight of existing) {
        this.io.to(`team:${teamId}`).emit('insight:deleted', { id: insight.id, teamId })
      }
    }

    return existing.map((insight) => insight.id)
  }

  /**
   * Generate AI-powered summary insight
   * Analyzes recent conversation and creates a summary insight
   * @param {string} teamId - Team ID
   * @returns {Promise<AIInsightDTO>} Created summary insight
   */
  static async generateSummary(teamId: string): Promise<AIInsightDTO> {
    const messages = await MessageController.getMessages(teamId);
    const team = await TeamController.getTeamById(teamId);

    if (!team) throw new Error('Team not found');

    const conversationHistory = buildConversationContext(messages, team, 50);

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
        console.log(`[AIInsightController] 📋 Injecting task context into summary (${teamData.taskContext.length} chars)`);
      }
    } catch (error) {
      console.warn('[AIInsightController] Failed to load task context for summary:', error);
    }

    console.log(`[AIInsightController] Generating summary for team ${teamId}`);

    const response = await this.llm.generate({
      messages: [
        ...(taskContextMessage ? [taskContextMessage] : []),
        { role: 'system', content: SYSTEM_PROMPTS.summarizer },
        ...conversationHistory,
        { role: 'user', content: 'Please provide a comprehensive summary of our conversation, including key points, decisions, and action items.' },
      ],
      model: process.env.LLM_MODEL_TIER_2, // Use Smart Tier for summaries
      maxTokens: 4096,
      temperature: 0.7,
    });

    console.log(`[AIInsightController] 📝 LLM generated summary content (${response.content.length} chars)`);

    // Create insight with generated content
    const insight = await prisma.aIInsight.create({
      data: {
        teamId,
        type: 'summary',
        title: 'Conversation Summary',
        content: response.content,
        priority: 'medium',
        tags: JSON.stringify(['auto-generated', 'summary', response.model]),
        relatedMessageIds: messages.length > 0 ? JSON.stringify([messages[messages.length - 1].id]) : null
      }
    });

    console.log(`[AIInsightController] 💾 Summary insight saved to database: ${insight.id}`);

    const insightDTO = aiInsightToDTO(insight);

    // Broadcast new insight via WebSocket
    if (this.io) {
      const roomSize = this.io.sockets.adapter.rooms.get(`team:${teamId}`)?.size || 0;
      this.io.to(`team:${teamId}`).emit('ai:insight:new', insightDTO);
      console.log(`[AIInsightController] 🤖 Broadcasted summary insight to team: ${teamId} | insight: ${insightDTO.id} | clients in room: ${roomSize}`);
    } else {
      console.warn('[AIInsightController] ⚠️  Socket.IO not available, insight not broadcasted!');
    }

    return insightDTO;
  }

  /**
   * Generate AI-powered report insight
   * Creates a comprehensive report based on team discussions
   * @param {string} teamId - Team ID
   * @param {string} prompt - Optional custom prompt for report generation
   * @returns {Promise<AIInsightDTO>} Created report insight
   */
  static async generateReport(teamId: string, prompt?: string): Promise<AIInsightDTO> {
    const messages = await MessageController.getMessages(teamId);
    const team = await TeamController.getTeamById(teamId);

    if (!team) throw new Error('Team not found');

    const conversationHistory = buildConversationContext(messages, team, 50);

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
        console.log(`[AIInsightController] 📋 Injecting task context into report (${teamData.taskContext.length} chars)`);
      }
    } catch (error) {
      console.warn('[AIInsightController] Failed to load task context for report:', error);
    }

    const defaultPrompt = 'Generate a comprehensive report of the team discussion, including context, key topics, decisions made, action items, and next steps.';
    const reportPrompt = prompt || defaultPrompt;

    console.log(`[AIInsightController] Generating report for team ${teamId}`);

    const response = await this.llm.generate({
      messages: [
        ...(taskContextMessage ? [taskContextMessage] : []),
        { role: 'system', content: SYSTEM_PROMPTS.assistant },
        ...conversationHistory,
        { role: 'user', content: reportPrompt },
      ],
      maxTokens: 4096,
      temperature: 0.7,
    });

    console.log(`[AIInsightController] 📊 LLM generated report content (${response.content.length} chars)`);

    // Create insight with generated content
    const insight = await prisma.aIInsight.create({
      data: {
        teamId,
        type: 'document',
        title: 'Team Discussion Report',
        content: response.content,
        priority: 'high',
        tags: JSON.stringify(['auto-generated', 'report', response.model]),
        relatedMessageIds: messages.length > 0 ? JSON.stringify([messages[messages.length - 1].id]) : null
      }
    });

    console.log(`[AIInsightController] 💾 Report insight saved to database: ${insight.id}`);

    const insightDTO = aiInsightToDTO(insight);

    // Broadcast new insight via WebSocket
    if (this.io) {
      const roomSize = this.io.sockets.adapter.rooms.get(`team:${teamId}`)?.size || 0;
      this.io.to(`team:${teamId}`).emit('ai:insight:new', insightDTO);
      console.log(`[AIInsightController] 🤖 Broadcasted report insight to team: ${teamId} | insight: ${insightDTO.id} | clients in room: ${roomSize}`);
    } else {
      console.warn('[AIInsightController] ⚠️  Socket.IO not available, insight not broadcasted!');
    }

    return insightDTO;
  }
}
