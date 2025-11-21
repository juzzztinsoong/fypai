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
  longFormType?: 'summary' | 'code' | 'document'  // Type of long-form AI content
  relatedInsightIds?: string[]  // Linked AI insights
  // Chime rules metadata (for autonomous AI messages)
  chimeRuleName?: string  // Name of the rule that triggered this message
  chimeRuleId?: string  // ID of the rule that triggered this message
  confidence?: number  // Confidence score (0-1) for the chime trigger
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
  // Chime rules metadata (for autonomous AI insights)
  chimeRuleName?: string  // Name of the rule that triggered this insight
  chimeRuleId?: string  // ID of the rule that triggered this insight
  confidence?: number  // Confidence score (0-1) for the chime trigger
}

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
}

export interface UpdateAIInsightRequest {
  title?: string
  content?: string
  priority?: PriorityString
  tags?: string[]
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
