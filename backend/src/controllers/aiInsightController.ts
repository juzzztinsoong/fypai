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

type HttpError = Error & { statusCode?: number }

export class AIInsightController {
  private static llm = new GitHubModelsClient();
  private static io: SocketIOServer | null = null;

  private static emitProcessingStage(
    teamId: string,
    stage: 'thinking' | 'searching-memory' | 'analyzing' | 'idle',
  ): void {
    if (!this.io) return;
    this.io.to(`team:${teamId}`).emit('ai:processing', {
      teamId,
      userId: 'agent',
      stage,
    });
    console.log(`[AIInsightController] 🧭 Emitted ai:processing stage=${stage} for team=${teamId}`);
  }

  private static emitTyping(teamId: string, isTyping: boolean): void {
    if (!this.io) return;
    this.io.to(`team:${teamId}`).emit(isTyping ? 'typing:start' : 'typing:stop', {
      teamId,
      userId: 'agent',
    });
    console.log(`[AIInsightController] ⌨️ Emitted ${isTyping ? 'typing:start' : 'typing:stop'} for team=${teamId}`);
  }

  private static normalizeExcerpt(excerpt: string): string {
    return excerpt.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private static sanitizeInsightMetadata(rawMetadata: CreateAIInsightRequest['metadata']) {
    if (!rawMetadata || typeof rawMetadata !== 'object') {
      return null;
    }

    const metadata: Record<string, unknown> = { ...rawMetadata };

    if (typeof metadata.sourceInsightId === 'string') {
      metadata.sourceInsightId = metadata.sourceInsightId.trim();
    }

    if (typeof metadata.sourceExcerpt === 'string') {
      const trimmed = metadata.sourceExcerpt.replace(/\s+/g, ' ').trim();
      metadata.sourceExcerpt = trimmed.slice(0, 500);
    }

    if (typeof metadata.sourceMessageId === 'string') {
      metadata.sourceMessageId = metadata.sourceMessageId.trim();
    }

    if (typeof metadata.sourceMessageExcerpt === 'string') {
      const trimmed = metadata.sourceMessageExcerpt.replace(/\s+/g, ' ').trim();
      metadata.sourceMessageExcerpt = trimmed.slice(0, 500);
    }

    return metadata;
  }

  private static async createActionMarkerMessage(
    teamId: string,
    insight: AIInsightDTO,
  ): Promise<void> {
    const markerLabelByType: Record<string, string> = {
      action: 'Action item',
      summary: 'Summary',
      document: 'Research brief',
      suggestion: 'Suggestion',
      analysis: 'Analysis',
      code: 'Code output',
    }

    const markerLabel = markerLabelByType[insight.type] || 'Insight'
    const markerMessage = await MessageController.createMessage({
      teamId,
      authorId: 'agent',
      content: `📌 ${markerLabel} available: ${insight.title}`,
      contentType: 'text',
      metadata: {
        markerType: insight.type === 'action' ? 'action-insight-link' : 'insight-link',
        linkedInsightId: insight.id,
        linkedActionId: insight.type === 'action' ? insight.id : undefined,
        linkedInsightType: insight.type,
        sourceActionTitle: insight.title,
        markerLabel,
      },
    });

    if (this.io) {
      this.io.to(`team:${teamId}`).emit('message:new', markerMessage);
      console.log(`[AIInsightController] 🔗 Broadcasted marker message for insight: ${insight.id}`);
    }
  }

  private static async assertNoDuplicatePromotedAction(
    teamId: string,
    type: string,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    if (type !== 'action') return;

    const sourceInsightId = typeof metadata?.sourceInsightId === 'string' ? metadata.sourceInsightId : null;
    const sourceExcerpt = typeof metadata?.sourceExcerpt === 'string' ? metadata.sourceExcerpt : null;

    if (!sourceInsightId || !sourceExcerpt) return;

    const candidates = await prisma.aIInsight.findMany({
      where: {
        teamId,
        type: 'action',
        metadata: {
          contains: `"sourceInsightId":"${sourceInsightId}"`,
        },
      },
      select: {
        id: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const normalizedTargetExcerpt = this.normalizeExcerpt(sourceExcerpt);

    for (const candidate of candidates) {
      if (!candidate.metadata) continue;
      try {
        const parsed = JSON.parse(candidate.metadata) as { sourceInsightId?: string; sourceExcerpt?: string };
        if (parsed.sourceInsightId !== sourceInsightId) continue;

        const normalizedCandidateExcerpt = this.normalizeExcerpt(parsed.sourceExcerpt || '');
        if (normalizedCandidateExcerpt && normalizedCandidateExcerpt === normalizedTargetExcerpt) {
          const duplicateError = new Error('Action already exists for this promoted research item.') as HttpError;
          duplicateError.statusCode = 409;
          throw duplicateError;
        }
      } catch (error) {
        if ((error as HttpError).statusCode === 409) throw error;
      }
    }
  }

  private static async archiveSupersededLongForm(teamId: string, type: 'summary' | 'document'): Promise<void> {
    const superseded = await prisma.aIInsight.findMany({
      where: {
        teamId,
        type,
        status: {
          notIn: ['dismissed', 'archived'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (superseded.length === 0) return;

    const supersededIds = superseded.map((item) => item.id);

    await prisma.aIInsight.updateMany({
      where: { id: { in: supersededIds } },
      data: {
        status: 'archived',
        reviewedAt: new Date(),
      },
    });

    const archivedInsights = await prisma.aIInsight.findMany({
      where: { id: { in: supersededIds } },
    });

    if (this.io) {
      for (const archivedInsight of archivedInsights) {
        this.io.to(`team:${teamId}`).emit('insight:updated', aiInsightToDTO(archivedInsight));
      }
      console.log(`[AIInsightController] 📦 Archived ${archivedInsights.length} superseded ${type} insight(s) for team: ${teamId}`);
    }

    await CacheService.invalidateTeamCache(teamId);
  }

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
    const sanitizedMetadata = this.sanitizeInsightMetadata(data.metadata);

    await this.assertNoDuplicatePromotedAction(data.teamId, data.type, sanitizedMetadata);

    const insight = await prisma.aIInsight.create({
      data: {
        teamId: data.teamId,
        type: data.type,
        title: data.title,
        content: data.content,
        priority: data.priority || null,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        relatedMessageIds: data.relatedMessageIds ? JSON.stringify(data.relatedMessageIds) : null,
        metadata: sanitizedMetadata ? JSON.stringify(sanitizedMetadata) : null,
        agentMetadata: data.agentMetadata ? JSON.stringify(data.agentMetadata) : null,
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

    await this.createActionMarkerMessage(data.teamId, insightDTO);

    return insightDTO
  }

  /**
   * Update insight status (Sprint D - Part 2: Insight Lifecycle)
   * @param {string} id - Insight ID
   * @param {UpdateInsightStatusRequest} data - Status update data
   * @returns {Promise<AIInsightDTO>} Updated insight DTO
   */
  static async updateInsightStatus(id: string, data: UpdateInsightStatusRequest): Promise<AIInsightDTO> {
    const existingInsight = await prisma.aIInsight.findUnique({
      where: { id },
      select: {
        id: true,
        teamId: true,
        type: true,
        completedAt: true,
      },
    });

    if (!existingInsight) {
      const notFoundError = new Error('Insight not found') as HttpError;
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    const updateData: any = {
      status: data.status,
    };

    // Set reviewedAt/reviewedBy on first status change from 'new'
    if (data.status !== 'new') {
      updateData.reviewedAt = new Date();
      updateData.reviewedBy = data.userId;
    }

    // Action items are only considered complete when archived via explicit user action.
    if (
      existingInsight.type === 'action' &&
      data.status === 'archived' &&
      !existingInsight.completedAt
    ) {
      updateData.completedAt = new Date();
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
    this.emitTyping(teamId, true);
    this.emitProcessingStage(teamId, 'thinking');

    try {
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
      this.emitProcessingStage(teamId, 'analyzing');

      const response = await this.llm.generate({
        messages: [
          ...(taskContextMessage ? [taskContextMessage] : []),
          { role: 'system', content: SYSTEM_PROMPTS.summarizer },
          ...conversationHistory,
          { role: 'user', content: 'Please provide a concise conversation summary focused on discussion highlights, decisions made, rationale, and open questions. Do not include action-item checklists.' },
        ],
        model: process.env.LLM_MODEL_TIER_2, // Use Smart Tier for summaries
        maxTokens: 4096,
        temperature: 0.7,
      });

      console.log(`[AIInsightController] 📝 LLM generated summary content (${response.content.length} chars)`);

      await this.archiveSupersededLongForm(teamId, 'summary');

      const insightDTO = await this.createInsight({
        teamId,
        type: 'summary',
        title: 'Conversation Summary',
        content: response.content,
        priority: 'medium',
        tags: ['auto-generated', 'summary', response.model],
        relatedMessageIds: messages.length > 0 ? [messages[messages.length - 1].id] : [],
        metadata: {
          model: response.model,
          tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
        },
      });

      console.log(`[AIInsightController] 💾 Summary insight saved to database: ${insightDTO.id}`);
      return insightDTO;
    } finally {
      this.emitTyping(teamId, false);
      this.emitProcessingStage(teamId, 'idle');
    }
  }

  /**
   * Generate AI-powered research insight
   * Creates a comprehensive research brief based on team discussions
   * @param {string} teamId - Team ID
   * @param {string} prompt - Optional custom prompt for research generation
   * @returns {Promise<AIInsightDTO>} Created research insight
   */
  static async generateReport(teamId: string, prompt?: string): Promise<AIInsightDTO> {
    this.emitTyping(teamId, true);
    this.emitProcessingStage(teamId, 'thinking');

    try {
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
          console.log(`[AIInsightController] 📋 Injecting task context into research (${teamData.taskContext.length} chars)`);
        }
      } catch (error) {
        console.warn('[AIInsightController] Failed to load task context for research:', error);
      }

      const defaultPrompt = 'Generate a comprehensive research brief from the team discussion with context, key topics, decisions, rationale, risks, and open questions. Do not include task lists, assignees, or deadlines.';
      const reportPrompt = prompt || defaultPrompt;

      console.log(`[AIInsightController] Generating research brief for team ${teamId}`);
      this.emitProcessingStage(teamId, 'analyzing');

      const response = await this.llm.generate({
        messages: [
          ...(taskContextMessage ? [taskContextMessage] : []),
          { role: 'system', content: SYSTEM_PROMPTS.reporter },
          ...conversationHistory,
          { role: 'user', content: reportPrompt },
        ],
        maxTokens: 4096,
        temperature: 0.7,
      });

      console.log(`[AIInsightController] 🔎 LLM generated research content (${response.content.length} chars)`);

      const insightDTO = await this.createInsight({
        teamId,
        type: 'document',
        title: 'Research Brief',
        content: response.content,
        priority: 'high',
        tags: ['auto-generated', 'research', response.model],
        relatedMessageIds: messages.length > 0 ? [messages[messages.length - 1].id] : [],
        metadata: {
          model: response.model,
          tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
        },
      });

      console.log(`[AIInsightController] 💾 Research insight saved to database: ${insightDTO.id}`);
      return insightDTO;
    } finally {
      this.emitTyping(teamId, false);
      this.emitProcessingStage(teamId, 'idle');
    }
  }
}
