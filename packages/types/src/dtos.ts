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

import { 
  UserRole, 
  TeamRole, 
  ContentType, 
  InsightType, 
  Priority,
  UserRoleString,
  TeamRoleString,
  ContentTypeString,
  InsightTypeString,
  PriorityString
} from './enums.js'

/**
 * User DTO
 * Frontend-friendly user representation
 */
export interface UserDTO {
  id: string
  name: string
  email: string | null
  avatar: string | null
  role: UserRoleString
  createdAt: string  // ISO string
}

/**
 * Team DTO (basic)
 * Team without nested members
 */
export interface TeamDTO {
  id: string
  name: string
  createdAt: string  // ISO string
}

/**
 * TeamMember DTO
 * User information within a team context
 */
export interface TeamMemberDTO {
  id: string
  userId: string
  name: string
  email: string | null
  avatar: string | null
  role: UserRoleString  // Application-level role
  teamRole: TeamRoleString  // Team-specific role
  joinedAt: string  // ISO string
}

/**
 * Team with Members DTO
 * Complete team information including member list
 * This is what the frontend typically receives
 */
export interface TeamWithMembersDTO {
  id: string
  name: string
  isChimeEnabled: boolean  // AI assistant enabled state
  createdAt: string  // ISO string
  members: TeamMemberDTO[]
}

/**
 * Message Metadata
 * Parsed metadata object for messages
 */
export interface MessageMetadata {
  suggestions?: string[]
  parentMessageId?: string  // Link to original message for long-form content
  fileName?: string
  // AI-specific metadata
  model?: string
  tokensUsed?: number
  prompt?: string
  longFormType?: 'summary' | 'code' | 'document'  // Legacy compatibility: old long-form chat payload marker
  relatedInsightIds?: string[]  // Linked AI insights
  // Chime rules metadata (for autonomous AI messages)
  chimeRuleName?: string  // Name of the rule that triggered this message
  chimeRuleId?: string  // ID of the rule that triggered this message
  confidence?: number  // Confidence score (0-1) for the chime trigger
  // Sprint 3: Intent routing decision metadata
  routeMode?: 'ask' | 'research'
  routeConfidence?: number
  routeRationale?: string
  routeSource?: 'manual-override' | 'server-classifier' | 'frontend-fallback'
  routeOverrideUsed?: boolean
  // Action ↔ chat marker linkage
  markerType?: 'insight-link' | 'action-insight-link' | 'system-link'
  linkedInsightId?: string
  linkedActionId?: string
  linkedInsightType?: 'summary' | 'document' | 'action' | 'suggestion' | 'analysis' | 'code'
  sourceActionTitle?: string
  markerLabel?: string
}

/**
 * RAG Context Item
 * Represents a message retrieved for context during AI generation
 */
export interface RAGContextItem {
  messageId: string
  content: string
  authorId: string
  authorName?: string
  relevanceScore: number
  createdAt: string
}

/**
 * Agent Metadata
 * Details about the AI agent execution
 */
export interface AgentMetadata {
  model: string
  cost: number
  tier: 'tier1' | 'tier2'
  tokensUsed: {
    input: number
    output: number
  }
  confidence?: number  // Overall response confidence (0-1)
  ragContext?: RAGContextItem[]  // Retrieved context used for generation
}

/**
 * Message DTO
 * Frontend-friendly message representation with parsed metadata
 */
export interface MessageDTO {
  id: string
  teamId: string
  authorId: string
  content: string
  contentType: ContentTypeString
  createdAt: string  // ISO string
  metadata?: MessageMetadata  // Parsed from JSON string
  agentMetadata?: AgentMetadata // Agent execution details
  author?: {  // Optionally include author info
    id: string
    name: string
    avatar: string | null
    role: UserRoleString
  }
  relevanceScore?: number // RAG similarity score (0-1)
}

/**
 * AIInsight Metadata
 * Additional metadata for AI insights
 */
export interface AIInsightMetadata {
  language?: string  // For code snippets
  filename?: string  // For code/document insights
  sourceInsightId?: string  // For promoted action lineage
  sourceExcerpt?: string  // Source bullet/text promoted into action
  sourceMessageId?: string  // Source chat message promoted into action
  sourceMessageExcerpt?: string  // Source message excerpt promoted into action
  // Legacy fields (kept for compatibility)
  model?: string
  tokensUsed?: number
  prompt?: string
  // Chime rules metadata (for autonomous AI insights)
  chimeRuleName?: string  // Name of the rule that triggered this insight
  chimeRuleId?: string  // ID of the rule that triggered this insight
  confidence?: number  // Confidence score (0-1) for the chime trigger
}

/**
 * Insight Lifecycle Status (Sprint D)
 */
export type InsightStatus = 'new' | 'reviewed' | 'accepted' | 'dismissed' | 'archived'

/**
 * Action Item Priority (Sprint D)
 * Extends standard priority with 'urgent'
 */
export type ActionPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * AIInsight DTO
 * Frontend-friendly AI insight with parsed JSON fields
 */
export interface AIInsightDTO {
  id: string
  teamId: string
  type: InsightTypeString
  title: string
  content: string
  priority?: PriorityString  // Optional instead of null
  tags?: string[]  // Parsed from JSON array string
  createdAt: string  // ISO string
  relatedMessageIds?: string[]  // Parsed from JSON array string
  metadata?: AIInsightMetadata  // Additional context
  agentMetadata?: AgentMetadata // Agent execution details
  // Insight lifecycle (Sprint D - Part 2)
  status?: InsightStatus
  reviewedAt?: string  // ISO string
  reviewedBy?: string
  // Mutable action items (Sprint D - Part 3)
  assigneeId?: string
  dueDate?: string  // ISO string
  completedAt?: string  // ISO string
  actionPriority?: ActionPriority
}

/**
 * API Request DTOs
 * Types for creating/updating entities
 */

export interface CreateUserRequest {
  name: string
  email?: string
  avatar?: string
  role?: UserRoleString
}

export interface UpdateUserRequest {
  name?: string
  avatar?: string
  role?: UserRoleString
}

export interface CreateTeamRequest {
  name: string
  ownerId: string
}

export interface UpdateTeamRequest {
  name?: string
}

export interface AddTeamMemberRequest {
  userId: string
  teamRole?: TeamRoleString
}

export interface CreateMessageRequest {
  teamId: string
  authorId: string
  content: string
  contentType: ContentTypeString
  metadata?: MessageMetadata
  agentMetadata?: AgentMetadata
}

export interface UpdateMessageRequest {
  content: string
}

export interface CreateAIInsightRequest {
  teamId: string
  type: InsightTypeString
  title: string
  content: string
  priority?: PriorityString
  tags?: string[]
  relatedMessageIds?: string[]
  metadata?: AIInsightMetadata
  agentMetadata?: AgentMetadata
}

export interface UpdateAIInsightRequest {
  title?: string
  content?: string
  priority?: PriorityString
  tags?: string[]
  // Action item fields (Sprint D - Part 3)
  assigneeId?: string | null
  dueDate?: string | null  // ISO string
  completedAt?: string | null  // ISO string
  actionPriority?: ActionPriority | null
}

/**
 * Update Insight Status Request (Sprint D - Part 2)
 */
export interface UpdateInsightStatusRequest {
  status: InsightStatus
  userId: string
}

// ============================================================================
// Task Context DTOs (Sprint D - Part 5)
// ============================================================================

/**
 * Task Context DTO
 * Shared team task context for grounding AI responses
 */
export interface TaskContextDTO {
  content: string | null
  updatedAt: string | null  // ISO timestamp
  updatedBy: string | null  // userId or 'agent'
}

/**
 * Update Task Context Request
 */
export interface UpdateTaskContextRequest {
  content: string
  userId: string
}

/**
 * API Response Wrappers
 * Standard response formats
 */

export interface ApiSuccessResponse<T> {
  data: T
  message?: string
}

export interface ApiErrorResponse {
  error: string
  message?: string
  details?: Record<string, any>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * WebSocket Event Payloads
 */

export interface MessageNewEvent {
  message: MessageDTO
}

export interface PresenceUpdateEvent {
  userId: string
  online: boolean
}

export interface TypingEvent {
  teamId: string
  userId: string
  isTyping: boolean
}

export interface AITaskStatusEvent {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress?: number
  result?: AIInsightDTO
}

/**
 * Frontend-only types (UI state)
 * These don't correspond to backend entities
 */

export interface ChatState {
  messages: MessageDTO[]
  isTyping: boolean
  typingUsers: string[]
  activeUsers: string[]
}

export interface PresenceState {
  onlineUsers: Set<string>
  lastSeen: Record<string, string>  // userId -> ISO timestamp
}

// ============================================================================
// Agent Preferences DTOs (Phase 6.5.2)
// ============================================================================

/**
 * Personality types for the AI agent
 * Controls tone and formality of responses
 */
export type AgentPersonality = 'formal' | 'balanced' | 'casual'

/**
 * Proactivity levels for the AI agent
 * Controls how often the agent chimes in autonomously
 */
export type AgentProactivity = 'silent' | 'helpful' | 'proactive'

/**
 * Response length preferences
 * Controls verbosity of AI responses
 */
export type AgentResponseLength = 'concise' | 'balanced' | 'detailed'

/**
 * Model tier override
 * Allows forcing a specific model tier or using automatic selection
 */
export type AgentModelTier = 'auto' | 'tier1' | 'tier2'

/**
 * Agent Preferences DTO
 * Per-team AI agent behavior configuration
 */
export interface AgentPreferencesDTO {
  id: string
  teamId: string
  personality: AgentPersonality
  proactivity: AgentProactivity
  responseLength: AgentResponseLength
  modelTierOverride: AgentModelTier
  createdAt: string  // ISO string
  updatedAt: string  // ISO string
}

/**
 * Update Agent Preferences Request
 * All fields optional - only send what changed
 */
export interface UpdateAgentPreferencesRequest {
  personality?: AgentPersonality
  proactivity?: AgentProactivity
  responseLength?: AgentResponseLength
  modelTierOverride?: AgentModelTier
}

// ============================================================================
// Feedback DTOs (Phase 6.5.3)
// ============================================================================

export type FeedbackType = 'positive' | 'negative'

export type FeedbackReason =
  | 'irrelevant'
  | 'incorrect'
  | 'too-verbose'
  | 'too-brief'
  | 'misunderstood'
  | 'other'

export type FeedbackRuleAction = 'reduce-frequency' | 'disable' | 'none'

export interface FeedbackDTO {
  id: string
  messageId: string
  userId: string
  type: FeedbackType
  reason?: FeedbackReason
  comment?: string
  ruleId?: string
  ruleAction?: FeedbackRuleAction
  createdAt: string
}

export interface CreateFeedbackRequest {
  messageId: string
  userId: string
  type: FeedbackType
  reason?: FeedbackReason
  comment?: string
  ruleId?: string
  ruleAction?: FeedbackRuleAction
}
