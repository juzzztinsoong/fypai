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
import {
  AIInsightDTO,
  AgentPromptArchetype,
  CreateAIInsightRequest,
  MessageMetadata,
  UpdateAIInsightRequest,
  UpdateInsightStatusRequest,
  aiInsightToDTO,
  aiInsightsToDTO,
  messageToDTO,
} from '../types.js'
import { GitHubModelsClient } from '../ai/core/llm.js'
import {
  SYSTEM_PROMPTS,
  applyPromptArchetype,
  buildConversationContext,
  isPromptArchetypeEnabled,
  resolvePromptArchetype,
} from '../ai/core/prompts.js'
import { MessageController } from './messageController.js'
import { TeamController } from './teamController.js'
import { Server as SocketIOServer } from 'socket.io'
import { CacheService } from '../services/cacheService.js'

type HttpError = Error & { statusCode?: number }
type InsightMetadataRecord = Record<string, unknown>

type ProcessingTargetType = 'chat' | 'summary' | 'document' | 'action' | 'suggestion'

type InsightProvenance = {
  source: string
  trigger: string
  createdBy: string
  detail?: string
}

export class AIInsightController {
  private static llm = new GitHubModelsClient();
  private static io: SocketIOServer | null = null;
  private static readonly ACTIVE_INSIGHT_TYPES = new Set(['summary', 'document', 'action', 'suggestion']);
  private static readonly GENERIC_TITLE_SET = new Set([
    'conversation summary',
    'summary',
    'research',
    'brief',
    'report',
    'action item',
    'action items',
    'help',
    'help recommendations',
    'recommendations',
    'analysis',
    'insight',
    'ai insight',
    'decision made',
  ]);

  private static sanitizeTitleCandidate(raw: string): string {
    return raw
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/^[-*]\s*(?:\[[ xX]\]\s*)?/, '')
      .replace(/^#{1,6}\s+/, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/`/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[\s:;.,-]+$/, '');
  }

  private static normalizeTitleForComparison(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private static truncateTitle(title: string, maxLength = 96): string {
    if (title.length <= maxLength) return title;

    const slice = title.slice(0, maxLength + 1);
    const lastSpace = slice.lastIndexOf(' ');
    const cutoff = lastSpace > Math.floor(maxLength * 0.6) ? lastSpace : maxLength;
    return `${slice.slice(0, cutoff).trimEnd()}...`;
  }

  private static isTitleGeneric(rawTitle: string): boolean {
    const normalized = this.normalizeTitleForComparison(rawTitle);
    if (!normalized) return true;

    if (this.GENERIC_TITLE_SET.has(normalized)) return true;

    const wordCount = normalized.split(' ').filter(Boolean).length;
    if (
      wordCount <= 3 &&
      /summary|brief|help|action|item|analysis|insight|report|recommendation|decision/.test(normalized)
    ) {
      return true;
    }

    if (/^ai\s+/.test(normalized) && wordCount <= 4) {
      return true;
    }

    return false;
  }

  private static extractDescriptiveTitleFromContent(
    type: CreateAIInsightRequest['type'],
    content: string,
  ): string | null {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const chooseCandidate = (candidateRaw: string): string | null => {
      const candidate = this.sanitizeTitleCandidate(candidateRaw);
      if (!candidate) return null;
      if (candidate.length < 8) return null;
      if (this.isTitleGeneric(candidate)) return null;
      return candidate;
    };

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
      if (!headingMatch) continue;

      const candidate = chooseCandidate(headingMatch[1]);
      if (candidate) return candidate;
    }

    if (type === 'action' || type === 'suggestion') {
      for (const line of lines) {
        const bulletMatch = line.match(/^[-*]\s+(?:\[[ xX]\]\s*)?(.+)$/);
        const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
        const candidate = chooseCandidate((bulletMatch || numberedMatch)?.[1] || '');
        if (candidate) return candidate;
      }
    }

    for (const line of lines) {
      if (/^#{1,6}\s+/.test(line)) continue;
      if (/^[-*]\s+/.test(line)) continue;
      if (/^\d+\.\s+/.test(line)) continue;

      const firstSentence = line.split(/[.!?]/)[0] || line;
      const candidate = chooseCandidate(firstSentence);
      if (candidate) return candidate;
    }

    const plainText = this.sanitizeTitleCandidate(content.replace(/\s+/g, ' '));
    if (!plainText) return null;

    const words = plainText.split(' ').filter(Boolean);
    if (words.length === 0) return null;

    const condensed = words.slice(0, 12).join(' ');
    return chooseCandidate(condensed);
  }

  private static getDefaultTitleByType(type: CreateAIInsightRequest['type']): string {
    if (type === 'summary') return 'Summary Insight';
    if (type === 'document') return 'Research Insight';
    if (type === 'action') return 'Action Insight';
    if (type === 'suggestion') return 'Help Insight';
    return 'Insight';
  }

  private static resolveInsightTitle(data: Pick<CreateAIInsightRequest, 'type' | 'title' | 'content'>): string {
    const providedTitle = this.sanitizeTitleCandidate(data.title || '');
    if (providedTitle && !this.isTitleGeneric(providedTitle)) {
      return this.truncateTitle(providedTitle);
    }

    const fromContent = this.extractDescriptiveTitleFromContent(data.type, data.content || '');
    if (fromContent) {
      return this.truncateTitle(fromContent);
    }

    if (providedTitle) {
      return this.truncateTitle(providedTitle);
    }

    return this.getDefaultTitleByType(data.type);
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

  private static extractInsightSnippet(content: string, maxLength = 180): string {
    const plain = this.stripMarkdownForSnippet(content);
    if (!plain) return '';

    const sentence = plain.split(/[.!?]/)[0]?.trim() || plain;
    if (sentence.length <= maxLength) return sentence;
    return `${sentence.slice(0, maxLength - 3).trimEnd()}...`;
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
      `[AIInsightController] 🧭 Emitted ai:processing stage=${stage}` +
        `${detail ? ` detail=${detail}` : ''}` +
        `${targetType ? ` target=${targetType}` : ''} for team=${teamId}`,
    );
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

  private static readStringField(metadata: InsightMetadataRecord, key: string): string | undefined {
    const value = metadata[key]
    if (typeof value !== 'string') return undefined

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  private static normalizeTags(tags?: string[]): Set<string> {
    if (!Array.isArray(tags)) return new Set()

    return new Set(
      tags
        .map((tag) => tag.toLowerCase().trim())
        .filter((tag) => tag.length > 0),
    )
  }

  private static deriveInsightProvenance(tags: string[] | undefined, metadata: InsightMetadataRecord): InsightProvenance {
    const normalizedTags = this.normalizeTags(tags)
    const hasOnboardingSignal = normalizedTags.has('onboarding') || Boolean(metadata.onboardingDemo)

    if (hasOnboardingSignal) {
      return {
        source: 'seed-onboarding',
        trigger: 'seed-bootstrap',
        createdBy: 'system',
      }
    }

    const chimeRuleName = this.readStringField(metadata, 'chimeRuleName')
    if (chimeRuleName) {
      return {
        source: 'autonomous-rule',
        trigger: 'chime-rule',
        createdBy: 'agent',
        detail: chimeRuleName,
      }
    }

    const hasPromotionSignal =
      Boolean(this.readStringField(metadata, 'sourceInsightId')) ||
      Boolean(this.readStringField(metadata, 'sourceMessageId'))
    if (hasPromotionSignal) {
      return {
        source: 'promoted-content',
        trigger: 'promote-iterate',
        createdBy: 'user',
      }
    }

    const promptValue = this.readStringField(metadata, 'prompt')
    const isAutoEscalated =
      promptValue === 'auto-escalated-from-chat' || normalizedTags.has('auto-escalated-from-chat')
    if (isAutoEscalated) {
      return {
        source: 'reactive-chat',
        trigger: 'auto-escalation',
        createdBy: 'agent',
      }
    }

    if (normalizedTags.has('user-requested')) {
      return {
        source: 'user-request',
        trigger: 'explicit-request',
        createdBy: 'user',
      }
    }

    if (normalizedTags.has('auto-generated')) {
      return {
        source: 'ai-generation',
        trigger: 'manual-generation',
        createdBy: 'agent',
      }
    }

    return {
      source: 'direct-insight-create',
      trigger: 'api-request',
      createdBy: 'user',
    }
  }

  private static enrichInsightMetadataWithProvenance(
    tags: string[] | undefined,
    rawMetadata: InsightMetadataRecord | null,
  ): InsightMetadataRecord {
    const metadata: InsightMetadataRecord = rawMetadata ? { ...rawMetadata } : {}
    const derived = this.deriveInsightProvenance(tags, metadata)

    if (!this.readStringField(metadata, 'provenanceSource')) {
      metadata.provenanceSource = derived.source
    }

    if (!this.readStringField(metadata, 'provenanceTrigger')) {
      metadata.provenanceTrigger = derived.trigger
    }

    if (!this.readStringField(metadata, 'provenanceCreatedBy')) {
      metadata.provenanceCreatedBy = derived.createdBy
    }

    if (!this.readStringField(metadata, 'provenanceDetail') && derived.detail) {
      metadata.provenanceDetail = derived.detail
    }

    return metadata
  }

  private static resolveMarkerProvenance(insight: AIInsightDTO): InsightProvenance {
    const metadata = (insight.metadata && typeof insight.metadata === 'object'
      ? ({ ...insight.metadata } as InsightMetadataRecord)
      : {}) as InsightMetadataRecord
    const derived = this.deriveInsightProvenance(insight.tags, metadata)

    return {
      source: this.readStringField(metadata, 'provenanceSource') || derived.source,
      trigger: this.readStringField(metadata, 'provenanceTrigger') || derived.trigger,
      createdBy: this.readStringField(metadata, 'provenanceCreatedBy') || derived.createdBy,
      detail: this.readStringField(metadata, 'provenanceDetail') || derived.detail,
    }
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

    if (typeof metadata.provenanceSource === 'string') {
      metadata.provenanceSource = metadata.provenanceSource.trim().slice(0, 80);
    }

    if (typeof metadata.provenanceTrigger === 'string') {
      metadata.provenanceTrigger = metadata.provenanceTrigger.trim().slice(0, 80);
    }

    if (typeof metadata.provenanceCreatedBy === 'string') {
      metadata.provenanceCreatedBy = metadata.provenanceCreatedBy.trim().slice(0, 80);
    }

    if (typeof metadata.provenanceDetail === 'string') {
      metadata.provenanceDetail = metadata.provenanceDetail.replace(/\s+/g, ' ').trim().slice(0, 180);
    }

    return metadata;
  }

  private static resolveArchetype(
    requestedArchetype: string | undefined,
    defaultArchetype: AgentPromptArchetype,
  ): { archetype?: AgentPromptArchetype; source: 'request' | 'default' | 'none' } {
    const requested = resolvePromptArchetype(requestedArchetype);
    if (requested) {
      return {
        archetype: requested,
        source: 'request',
      };
    }

    return {
      archetype: defaultArchetype,
      source: 'default',
    };
  }

  private static async createActionMarkerMessage(
    teamId: string,
    insight: AIInsightDTO,
  ): Promise<void> {
    const existingMarker = await prisma.message.findFirst({
      where: {
        teamId,
        authorId: 'agent',
        metadata: {
          contains: `\"linkedInsightId\":\"${insight.id}\"`,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })

    if (existingMarker) {
      console.log(`[AIInsightController] ♻️ Skipping duplicate marker for insight: ${insight.id}`)
      return
    }

    const markerLabelByType: Record<string, string> = {
      action: 'Action Item',
      summary: 'Summary',
      document: 'Research',
      suggestion: 'Help',
      analysis: 'Analysis',
      code: 'Code Output',
    }

    const markerVerbByType: Record<string, string> = {
      action: 'Generated action items',
      summary: 'Generated summary',
      document: 'Generated research',
      suggestion: 'Generated help recommendations',
      analysis: 'Generated analysis',
      code: 'Generated code output',
    }

    const markerLabel = markerLabelByType[insight.type] || 'Insight'
    const markerVerb = markerVerbByType[insight.type] || 'Generated insight'
    const markerSnippet = this.extractInsightSnippet(insight.content)
    const markerProvenance = this.resolveMarkerProvenance(insight)
    const markerCompanionText = `I generated this ${markerLabel.toLowerCase()} insight and linked it here so you can open the full version.`
    const markerMessage = await MessageController.createMessage({
      teamId,
      authorId: 'agent',
      content:
        markerSnippet.length > 0
          ? `${markerVerb}: ${insight.title}\n\n${markerSnippet}`
          : `${markerVerb}: ${insight.title}`,
      contentType: 'text',
      metadata: {
        markerType: insight.type === 'action' ? 'action-insight-link' : 'insight-link',
        linkedInsightId: insight.id,
        linkedActionId: insight.type === 'action' ? insight.id : undefined,
        linkedInsightType: insight.type,
        sourceActionTitle: insight.title,
        markerLabel,
        markerPreview: markerSnippet || undefined,
        markerCompanionText,
        markerSource: markerProvenance.source,
        markerTrigger: markerProvenance.trigger,
        markerCreatedBy: markerProvenance.createdBy,
        markerTriggerDetail: markerProvenance.detail,
      },
    });

    if (this.io) {
      this.io.to(`team:${teamId}`).emit('message:new', markerMessage);
      console.log(`[AIInsightController] 🔗 Broadcasted marker message for insight: ${insight.id}`);
    }
  }

  static async mergeCompanionIntoMarker(
    teamId: string,
    insightId: string,
    companionText: string,
  ): Promise<void> {
    const normalizedText = companionText.replace(/\s+/g, ' ').trim();
    if (!normalizedText) return;

    const markerRecord = await prisma.message.findFirst({
      where: {
        teamId,
        authorId: 'agent',
        metadata: {
          contains: `\"linkedInsightId\":\"${insightId}\"`,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!markerRecord) {
      console.log(`[AIInsightController] ⚠️ No marker found to merge companion text for insight: ${insightId}`);
      return;
    }

    const metadata: MessageMetadata = markerRecord.metadata
      ? (JSON.parse(markerRecord.metadata) as MessageMetadata)
      : {};

    if (metadata.markerCompanionText === normalizedText) {
      return;
    }

    const updated = await prisma.message.update({
      where: { id: markerRecord.id },
      data: {
        metadata: JSON.stringify({
          ...metadata,
          markerCompanionText: normalizedText,
        }),
      },
    });

    if (this.io) {
      this.io.to(`team:${teamId}`).emit('message:edited', messageToDTO(updated));
      console.log(`[AIInsightController] 🧩 Merged companion text into marker ${updated.id} for insight: ${insightId}`);
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
    if (!this.ACTIVE_INSIGHT_TYPES.has(data.type)) {
      const invalidTypeError = new Error(
        `Insight type '${data.type}' is disabled in the current taxonomy pass. Allowed types: summary, document, action, suggestion.`
      ) as HttpError;
      invalidTypeError.statusCode = 400;
      throw invalidTypeError;
    }

    const sanitizedMetadata = this.sanitizeInsightMetadata(data.metadata);
    const enrichedMetadata = this.enrichInsightMetadataWithProvenance(data.tags, sanitizedMetadata);
    const resolvedTitle = this.resolveInsightTitle({
      type: data.type,
      title: data.title,
      content: data.content,
    });

    if (resolvedTitle !== data.title) {
      console.log(`[AIInsightController] 🏷️ Refined insight title "${data.title}" -> "${resolvedTitle}"`);
    }

    await this.assertNoDuplicatePromotedAction(data.teamId, data.type, sanitizedMetadata);

    const insight = await prisma.aIInsight.create({
      data: {
        teamId: data.teamId,
        type: data.type,
        title: resolvedTitle,
        content: data.content,
        priority: data.priority || null,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        relatedMessageIds: data.relatedMessageIds ? JSON.stringify(data.relatedMessageIds) : null,
        metadata: JSON.stringify(enrichedMetadata),
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
  static async generateSummary(teamId: string, archetypeHint?: string): Promise<AIInsightDTO> {
    this.emitTyping(teamId, true);
    this.emitProcessingStage(teamId, 'thinking', 'Reviewing recent discussion', 'summary');

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
      this.emitProcessingStage(teamId, 'analyzing', 'Generating summary', 'summary');

      const archetypeDecision = this.resolveArchetype(archetypeHint, 'decision-brief');
      const summaryPrompt = applyPromptArchetype(SYSTEM_PROMPTS.summarizer, archetypeDecision.archetype);

      const response = await this.llm.generate({
        messages: [
          ...(taskContextMessage ? [taskContextMessage] : []),
          { role: 'system', content: summaryPrompt.prompt },
          ...conversationHistory,
          { role: 'user', content: 'Please provide a concise conversation summary focused on discussion highlights, decisions made, rationale, and open questions. Do not include action-item checklists.' },
        ],
        model: process.env.LLM_MODEL_TIER_2, // Use Smart Tier for summaries
        maxTokens: 4096,
        temperature: 0.7,
      });

      console.log(`[AIInsightController] 📝 LLM generated summary content (${response.content.length} chars)`);

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
          promptArchetype: summaryPrompt.archetype,
          promptArchetypeApplied: summaryPrompt.applied,
          promptArchetypeSource: summaryPrompt.archetype ? archetypeDecision.source : 'none',
          promptArchetypeFlagEnabled: isPromptArchetypeEnabled(),
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
    * Creates comprehensive research based on team discussions
   * @param {string} teamId - Team ID
   * @param {string} prompt - Optional custom prompt for research generation
   * @returns {Promise<AIInsightDTO>} Created research insight
   */
  static async generateReport(
    teamId: string,
    prompt?: string,
    archetypeHint?: string,
  ): Promise<AIInsightDTO> {
    this.emitTyping(teamId, true);
    this.emitProcessingStage(teamId, 'thinking', 'Reviewing context for research', 'document');

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

      const defaultPrompt = `Generate a comprehensive research analysis from the team discussion.

    Requirements:
    - Cover context, key topics, decisions, rationale, risks, and open questions.
    - Keep analysis domain-neutral unless conversation or team task context explicitly defines a domain.
    - Do not assume software/engineering workflows or suggest tools/frameworks unless explicitly requested.
    - If context is limited, state neutral assumptions briefly instead of inventing technical details.

    Do not include task lists, assignees, or deadlines.`;
      const reportPrompt = prompt || defaultPrompt;

      console.log(`[AIInsightController] Generating research for team ${teamId}`);
      this.emitProcessingStage(teamId, 'analyzing', 'Generating research', 'document');

      const archetypeDecision = this.resolveArchetype(archetypeHint, 'research-analyst');
      const reportSystemPrompt = applyPromptArchetype(SYSTEM_PROMPTS.reporter, archetypeDecision.archetype);

      const response = await this.llm.generate({
        messages: [
          ...(taskContextMessage ? [taskContextMessage] : []),
          { role: 'system', content: reportSystemPrompt.prompt },
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
        title: 'Research',
        content: response.content,
        priority: 'high',
        tags: ['auto-generated', 'research', response.model],
        relatedMessageIds: messages.length > 0 ? [messages[messages.length - 1].id] : [],
        metadata: {
          model: response.model,
          tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
          promptArchetype: reportSystemPrompt.archetype,
          promptArchetypeApplied: reportSystemPrompt.applied,
          promptArchetypeSource: reportSystemPrompt.archetype ? archetypeDecision.source : 'none',
          promptArchetypeFlagEnabled: isPromptArchetypeEnabled(),
        },
      });

      console.log(`[AIInsightController] 💾 Research insight saved to database: ${insightDTO.id}`);
      return insightDTO;
    } finally {
      this.emitTyping(teamId, false);
      this.emitProcessingStage(teamId, 'idle');
    }
  }

  /**
   * Generate AI-powered action insight
   * Produces deterministic action-item output from recent conversation
   * @param {string} teamId - Team ID
   * @param {string} prompt - Optional custom prompt for action generation
   * @returns {Promise<AIInsightDTO>} Created action insight
   */
  static async generateAction(
    teamId: string,
    prompt?: string,
    archetypeHint?: string,
  ): Promise<AIInsightDTO> {
    this.emitTyping(teamId, true);
    this.emitProcessingStage(teamId, 'thinking', 'Reviewing commitments and decisions', 'action');

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
          console.log(`[AIInsightController] 📋 Injecting task context into action generation (${teamData.taskContext.length} chars)`);
        }
      } catch (error) {
        console.warn('[AIInsightController] Failed to load task context for action generation:', error);
      }

      const defaultPrompt = `Create a concise, trackable action list from the latest team discussion.

Output format:
## Action Items
- [ ] Action statement

Rules:
- Max 5 action items
- Include owner and due date only if explicitly stated
- Merge duplicates
- Keep each item short and execution-ready`;

      const actionPrompt = prompt || defaultPrompt;

      console.log(`[AIInsightController] Generating action insight for team ${teamId}`);
        this.emitProcessingStage(teamId, 'analyzing', 'Generating action items', 'action');

      const archetypeDecision = this.resolveArchetype(archetypeHint, 'execution-coach');
      const actionSystemPrompt = applyPromptArchetype(SYSTEM_PROMPTS.assistant, archetypeDecision.archetype);

      const response = await this.llm.generate({
        messages: [
          ...(taskContextMessage ? [taskContextMessage] : []),
          { role: 'system', content: actionSystemPrompt.prompt },
          ...conversationHistory,
          { role: 'user', content: actionPrompt },
        ],
        model: process.env.LLM_MODEL_TIER_2,
        maxTokens: 1400,
        temperature: 0.35,
      });

      const insightDTO = await this.createInsight({
        teamId,
        type: 'action',
        title: 'Action Items',
        content: response.content,
        priority: 'high',
        tags: ['auto-generated', 'action', response.model],
        relatedMessageIds: messages.length > 0 ? [messages[messages.length - 1].id] : [],
        metadata: {
          model: response.model,
          tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
          promptArchetype: actionSystemPrompt.archetype,
          promptArchetypeApplied: actionSystemPrompt.applied,
          promptArchetypeSource: actionSystemPrompt.archetype ? archetypeDecision.source : 'none',
          promptArchetypeFlagEnabled: isPromptArchetypeEnabled(),
        },
      });

      console.log(`[AIInsightController] 💾 Action insight saved to database: ${insightDTO.id}`);
      return insightDTO;
    } finally {
      this.emitTyping(teamId, false);
      this.emitProcessingStage(teamId, 'idle');
    }
  }

  /**
   * Generate AI-powered help insight
   * Produces practical help and recommendations based on recent discussion
   * @param {string} teamId - Team ID
   * @param {string} prompt - Optional custom prompt for help generation
   * @returns {Promise<AIInsightDTO>} Created help insight (stored as suggestion type)
   */
  static async generateSuggestion(
    teamId: string,
    prompt?: string,
    archetypeHint?: string,
  ): Promise<AIInsightDTO> {
    this.emitTyping(teamId, true);
    this.emitProcessingStage(teamId, 'thinking', 'Reviewing blockers and support needs', 'suggestion');

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
          console.log(`[AIInsightController] 📋 Injecting task context into help generation (${teamData.taskContext.length} chars)`);
        }
      } catch (error) {
        console.warn('[AIInsightController] Failed to load task context for help generation:', error);
      }

      const defaultPrompt = `Provide practical help for the team based on the latest discussion.

Output format:
## Help Recommendations
- Recommendation and why it helps

Rules:
- Max 5 recommendations
- Be specific and low-friction
- Highlight major tradeoffs when relevant
    - Keep guidance domain-neutral unless conversation or team task context explicitly defines a domain
    - Do not assume software/engineering workflows or suggest tools/frameworks unless explicitly requested
    - Do not produce task checklists, owners, or deadlines`;

      const suggestionPrompt = prompt || defaultPrompt;

      console.log(`[AIInsightController] Generating help insight for team ${teamId}`);
        this.emitProcessingStage(teamId, 'analyzing', 'Generating help recommendations', 'suggestion');

      const archetypeDecision = this.resolveArchetype(archetypeHint, 'pragmatic-advisor');
      const suggestionSystemPrompt = applyPromptArchetype(SYSTEM_PROMPTS.assistant, archetypeDecision.archetype);

      const response = await this.llm.generate({
        messages: [
          ...(taskContextMessage ? [taskContextMessage] : []),
          { role: 'system', content: suggestionSystemPrompt.prompt },
          ...conversationHistory,
          { role: 'user', content: suggestionPrompt },
        ],
        model: process.env.LLM_MODEL_TIER_2,
        maxTokens: 1400,
        temperature: 0.45,
      });

      const insightDTO = await this.createInsight({
        teamId,
        type: 'suggestion',
        title: 'Help',
        content: response.content,
        priority: 'medium',
        tags: ['auto-generated', 'help', 'suggestion', response.model],
        relatedMessageIds: messages.length > 0 ? [messages[messages.length - 1].id] : [],
        metadata: {
          model: response.model,
          tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
          promptArchetype: suggestionSystemPrompt.archetype,
          promptArchetypeApplied: suggestionSystemPrompt.applied,
          promptArchetypeSource: suggestionSystemPrompt.archetype ? archetypeDecision.source : 'none',
          promptArchetypeFlagEnabled: isPromptArchetypeEnabled(),
        },
      });

      console.log(`[AIInsightController] 💾 Help insight saved to database: ${insightDTO.id}`);
      return insightDTO;
    } finally {
      this.emitTyping(teamId, false);
      this.emitProcessingStage(teamId, 'idle');
    }
  }
}
