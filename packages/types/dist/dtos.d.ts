/**
 * Data Transfer Object (DTO) Types
 *
 * These types are optimized for API communication between frontend and backend.
 * They differ from entity types in several ways:
 *
 * Key Differences from Entities:
 * - Dates are ISO strings (JSON-serializable)
 * - JSON fields are parsed into typed objects/arrays
 * - Optional fields use `?` notation (more frontend-friendly)
 * - Nested relations are included (e.g., TeamWithMembers)
 * - Some fields may be omitted (e.g., updatedAt if not needed by frontend)
 *
 * Use these types for:
 * - API request/response bodies
 * - Frontend state management (Zustand stores)
 * - React component props
 */
import { UserRoleString, TeamRoleString, ContentTypeString, InsightTypeString, PriorityString } from './enums.js';
/**
 * User DTO
 * Frontend-friendly user representation
 */
export interface UserDTO {
    id: string;
    name: string;
    email: string | null;
    avatar: string | null;
    role: UserRoleString;
    createdAt: string;
}
/**
 * Team DTO (basic)
 * Team without nested members
 */
export interface TeamDTO {
    id: string;
    name: string;
    createdAt: string;
}
/**
 * TeamMember DTO
 * User information within a team context
 */
export interface TeamMemberDTO {
    id: string;
    userId: string;
    name: string;
    email: string | null;
    avatar: string | null;
    role: UserRoleString;
    teamRole: TeamRoleString;
    joinedAt: string;
}
/**
 * Team with Members DTO
 * Complete team information including member list
 * This is what the frontend typically receives
 */
export interface TeamWithMembersDTO {
    id: string;
    name: string;
    isChimeEnabled: boolean;
    createdAt: string;
    members: TeamMemberDTO[];
}
/**
 * Message Metadata
 * Parsed metadata object for messages
 */
export type AgentPromptArchetype = 'decision-brief' | 'research-analyst' | 'execution-coach' | 'pragmatic-advisor' | 'implementation-partner';
export type MarkerProvenanceSource = 'seed-onboarding' | 'ai-generation' | 'reactive-chat' | 'autonomous-rule' | 'promoted-content' | 'user-request' | 'direct-insight-create' | 'system' | string;
export type MarkerProvenanceTrigger = 'seed-bootstrap' | 'manual-generation' | 'auto-escalation' | 'chime-rule' | 'promote-iterate' | 'explicit-request' | 'api-request' | 'unknown' | string;
export interface MessageMetadata {
    suggestions?: string[];
    parentMessageId?: string;
    fileName?: string;
    model?: string;
    tokensUsed?: number;
    prompt?: string;
    longFormType?: 'summary' | 'code' | 'document';
    relatedInsightIds?: string[];
    chimeRuleName?: string;
    chimeRuleId?: string;
    confidence?: number;
    routeMode?: 'ask' | 'research';
    routeConfidence?: number;
    routeRationale?: string;
    routeSource?: 'manual-override' | 'server-classifier' | 'frontend-fallback';
    routeOverrideUsed?: boolean;
    routeArchetype?: AgentPromptArchetype;
    markerType?: 'insight-link' | 'action-insight-link' | 'system-link';
    linkedInsightId?: string;
    linkedActionId?: string;
    linkedInsightType?: 'summary' | 'document' | 'action' | 'suggestion' | 'analysis' | 'code';
    sourceActionTitle?: string;
    markerLabel?: string;
    markerPreview?: string;
    markerSource?: MarkerProvenanceSource;
    markerTrigger?: MarkerProvenanceTrigger;
    markerCreatedBy?: string;
    markerTriggerDetail?: string;
    draftSourceInsightIds?: string[];
    draftSourceMessageIds?: string[];
    draftContextLabels?: string[];
}
/**
 * RAG Context Item
 * Represents a message retrieved for context during AI generation
 */
export interface RAGContextItem {
    messageId: string;
    content: string;
    authorId: string;
    authorName?: string;
    relevanceScore: number;
    createdAt: string;
}
/**
 * Agent Metadata
 * Details about the AI agent execution
 */
export interface AgentMetadata {
    model: string;
    cost: number;
    tier: 'tier1' | 'tier2';
    tokensUsed: {
        input: number;
        output: number;
    };
    confidence?: number;
    ragContext?: RAGContextItem[];
    promptArchetype?: AgentPromptArchetype;
    promptArchetypeApplied?: boolean;
    promptArchetypeSource?: 'request' | 'route' | 'default' | 'none';
    promptArchetypeFlagEnabled?: boolean;
}
/**
 * Message DTO
 * Frontend-friendly message representation with parsed metadata
 */
export interface MessageDTO {
    id: string;
    teamId: string;
    authorId: string;
    content: string;
    contentType: ContentTypeString;
    createdAt: string;
    metadata?: MessageMetadata;
    agentMetadata?: AgentMetadata;
    author?: {
        id: string;
        name: string;
        avatar: string | null;
        role: UserRoleString;
    };
    relevanceScore?: number;
}
/**
 * AIInsight Metadata
 * Additional metadata for AI insights
 */
export interface AIInsightMetadata {
    language?: string;
    filename?: string;
    sourceInsightId?: string;
    sourceExcerpt?: string;
    sourceMessageId?: string;
    sourceMessageExcerpt?: string;
    model?: string;
    tokensUsed?: number;
    prompt?: string;
    promptArchetype?: AgentPromptArchetype;
    promptArchetypeApplied?: boolean;
    promptArchetypeSource?: 'request' | 'route' | 'default' | 'none';
    promptArchetypeFlagEnabled?: boolean;
    chimeRuleName?: string;
    chimeRuleId?: string;
    confidence?: number;
    provenanceSource?: MarkerProvenanceSource;
    provenanceTrigger?: MarkerProvenanceTrigger;
    provenanceCreatedBy?: string;
    provenanceDetail?: string;
}
/**
 * Insight Lifecycle Status (Sprint D)
 */
export type InsightStatus = 'new' | 'reviewed' | 'accepted' | 'dismissed' | 'archived';
/**
 * Action Item Priority (Sprint D)
 * Extends standard priority with 'urgent'
 */
export type ActionPriority = 'low' | 'medium' | 'high' | 'urgent';
/**
 * AIInsight DTO
 * Frontend-friendly AI insight with parsed JSON fields
 */
export interface AIInsightDTO {
    id: string;
    teamId: string;
    type: InsightTypeString;
    title: string;
    content: string;
    priority?: PriorityString;
    tags?: string[];
    createdAt: string;
    relatedMessageIds?: string[];
    metadata?: AIInsightMetadata;
    agentMetadata?: AgentMetadata;
    status?: InsightStatus;
    reviewedAt?: string;
    reviewedBy?: string;
    assigneeId?: string;
    dueDate?: string;
    completedAt?: string;
    actionPriority?: ActionPriority;
}
/**
 * API Request DTOs
 * Types for creating/updating entities
 */
export interface CreateUserRequest {
    name: string;
    email?: string;
    avatar?: string;
    role?: UserRoleString;
}
export interface UpdateUserRequest {
    name?: string;
    avatar?: string;
    role?: UserRoleString;
}
export interface CreateTeamRequest {
    name: string;
    ownerId: string;
}
export interface UpdateTeamRequest {
    name?: string;
}
export interface AddTeamMemberRequest {
    userId: string;
    teamRole?: TeamRoleString;
}
export interface CreateMessageRequest {
    teamId: string;
    authorId: string;
    content: string;
    contentType: ContentTypeString;
    metadata?: MessageMetadata;
    agentMetadata?: AgentMetadata;
}
export interface UpdateMessageRequest {
    content: string;
}
export interface CreateAIInsightRequest {
    teamId: string;
    type: InsightTypeString;
    title: string;
    content: string;
    priority?: PriorityString;
    tags?: string[];
    relatedMessageIds?: string[];
    metadata?: AIInsightMetadata;
    agentMetadata?: AgentMetadata;
}
export interface UpdateAIInsightRequest {
    title?: string;
    content?: string;
    priority?: PriorityString;
    tags?: string[];
    assigneeId?: string | null;
    dueDate?: string | null;
    completedAt?: string | null;
    actionPriority?: ActionPriority | null;
}
/**
 * Update Insight Status Request (Sprint D - Part 2)
 */
export interface UpdateInsightStatusRequest {
    status: InsightStatus;
    userId: string;
}
/**
 * Task Context DTO
 * Shared team task context for grounding AI responses
 */
export interface TaskContextDTO {
    content: string | null;
    updatedAt: string | null;
    updatedBy: string | null;
}
/**
 * Update Task Context Request
 */
export interface UpdateTaskContextRequest {
    content: string;
    userId: string;
}
export type SessionEventType = 'chat' | 'navigation' | 'insight' | 'context' | 'session' | 'sync';
export interface SessionEventMetadata {
    [key: string]: any;
}
export interface SessionEventDTO {
    id: string;
    teamId: string;
    sessionId: string;
    eventType: SessionEventType;
    eventName: string;
    actorUserId?: string;
    messageId?: string;
    insightId?: string;
    content?: string;
    metadata?: SessionEventMetadata;
    createdAt: string;
}
export interface CreateSessionEventRequest {
    teamId: string;
    sessionId: string;
    eventType: SessionEventType;
    eventName: string;
    actorUserId?: string;
    messageId?: string;
    insightId?: string;
    content?: string;
    metadata?: SessionEventMetadata;
    createdAt?: string;
}
export interface CreateSessionEventBatchRequest {
    events: CreateSessionEventRequest[];
}
export interface SessionMetricsDTO {
    teamId: string;
    sessionId?: string;
    windowStart: string | null;
    windowEnd: string | null;
    totalEvents: number;
    uniqueUsers: number;
    messageSentCount: number;
    insightStatusChangeCount: number;
    tabSwitchCount: number;
    contextEditCount: number;
    exportCount: number;
    resetCount: number;
    markerJumpCount: number;
    timelineSyncCount: number;
    linkHoverCount: number;
    actionAcceptedCount: number;
    actionDismissedCount: number;
    actionCompletedCount: number;
    avgSecondsBetweenEvents: number;
}
export interface SessionTimelineExportDTO {
    teamId: string;
    sessionId?: string;
    exportedAt: string;
    timeline: SessionEventDTO[];
    metrics: SessionMetricsDTO;
}
/**
 * API Response Wrappers
 * Standard response formats
 */
export interface ApiSuccessResponse<T> {
    data: T;
    message?: string;
}
export interface ApiErrorResponse {
    error: string;
    message?: string;
    details?: Record<string, any>;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
/**
 * WebSocket Event Payloads
 */
export interface MessageNewEvent {
    message: MessageDTO;
}
export interface PresenceUpdateEvent {
    userId: string;
    online: boolean;
}
export interface TypingEvent {
    teamId: string;
    userId: string;
    isTyping: boolean;
}
export interface AITaskStatusEvent {
    taskId: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress?: number;
    result?: AIInsightDTO;
}
/**
 * Frontend-only types (UI state)
 * These don't correspond to backend entities
 */
export interface ChatState {
    messages: MessageDTO[];
    isTyping: boolean;
    typingUsers: string[];
    activeUsers: string[];
}
export interface PresenceState {
    onlineUsers: Set<string>;
    lastSeen: Record<string, string>;
}
/**
 * Personality types for the AI agent
 * Controls tone and formality of responses
 */
export type AgentPersonality = 'formal' | 'balanced' | 'casual';
/**
 * Proactivity levels for the AI agent
 * Controls how often the agent chimes in autonomously
 */
export type AgentProactivity = 'silent' | 'helpful' | 'proactive';
/**
 * Response length preferences
 * Controls verbosity of AI responses
 */
export type AgentResponseLength = 'concise' | 'balanced' | 'detailed';
/**
 * Model tier override
 * Allows forcing a specific model tier or using automatic selection
 */
export type AgentModelTier = 'auto' | 'tier1' | 'tier2';
/**
 * Agent Preferences DTO
 * Per-team AI agent behavior configuration
 */
export interface AgentPreferencesDTO {
    id: string;
    teamId: string;
    personality: AgentPersonality;
    proactivity: AgentProactivity;
    responseLength: AgentResponseLength;
    modelTierOverride: AgentModelTier;
    createdAt: string;
    updatedAt: string;
}
/**
 * Update Agent Preferences Request
 * All fields optional - only send what changed
 */
export interface UpdateAgentPreferencesRequest {
    personality?: AgentPersonality;
    proactivity?: AgentProactivity;
    responseLength?: AgentResponseLength;
    modelTierOverride?: AgentModelTier;
}
export type FeedbackType = 'positive' | 'negative';
export type FeedbackReason = 'irrelevant' | 'incorrect' | 'too-verbose' | 'too-brief' | 'misunderstood' | 'other';
export type FeedbackRuleAction = 'reduce-frequency' | 'disable' | 'none';
export interface FeedbackDTO {
    id: string;
    messageId: string;
    userId: string;
    type: FeedbackType;
    reason?: FeedbackReason;
    comment?: string;
    ruleId?: string;
    ruleAction?: FeedbackRuleAction;
    createdAt: string;
}
export interface CreateFeedbackRequest {
    messageId: string;
    userId: string;
    type: FeedbackType;
    reason?: FeedbackReason;
    comment?: string;
    ruleId?: string;
    ruleAction?: FeedbackRuleAction;
}
//# sourceMappingURL=dtos.d.ts.map