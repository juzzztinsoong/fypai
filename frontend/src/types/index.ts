/**
 * TYPES MODULE
 *
 * Tech Stack: TypeScript, @fypai/types shared package
 * Purpose: Re-export shared types and define frontend-specific types
 *
 * Architecture:
 *   - Core types (User, Team, Message, etc.) come from @fypai/types shared package
 *   - All API responses use DTO types with ISO strings and parsed JSON
 *   - Frontend-specific UI state types are defined here
 *
 * Exported from @fypai/types:
 *   - Enums: UserRole, TeamRole, ContentType, InsightType, Priority
 *   - DTOs: UserDTO, TeamDTO, TeamMemberDTO, MessageDTO, AIInsightDTO, etc.
 *   - Request types: CreateUserRequest, UpdateUserRequest, etc.
 *   - Event types: MessageNewEvent, PresenceUpdateEvent, etc.
 *
 * Frontend-specific types:
 *   - ChatState: Chat UI state (messages[], isTyping, activeUsers[])
 *   - AITask: AI job tracking (id, status, type, progress?, result?)
 *
 * Usage:
 *   - Import types from this file in stores, hooks, components, and API clients
 *   - Use DTO types for all API responses
 *   - Use Request types for API requests
 */

// Re-export all shared types from the @fypai/types package
export {
  // Enums
  UserRole,
  TeamRole,
  ContentType,
  InsightType,
  Priority,
  type UserRoleString,
  type TeamRoleString,
  type ContentTypeString,
  type InsightTypeString,
  type PriorityString,
  
  // DTO Types (for API responses and frontend state)
  type UserDTO,
  type TeamDTO,
  type TeamMemberDTO,
  type TeamWithMembersDTO,
  type MessageDTO,
  type MessageMetadata,
  type AIInsightDTO,
  type AIInsightMetadata,
  
  // Request Types (for API calls)
  type CreateUserRequest,
  type UpdateUserRequest,
  type CreateTeamRequest,
  type UpdateTeamRequest,
  type AddTeamMemberRequest,
  type CreateMessageRequest,
  type UpdateMessageRequest,
  type CreateAIInsightRequest,
  type UpdateAIInsightRequest,
  
  // Event Types (for WebSocket/realtime)
  type MessageNewEvent,
  type PresenceUpdateEvent,
  type TypingEvent,
  type AITaskStatusEvent,
  
  // State Types (for stores)
  type ChatState,
  type PresenceState,
  
  // Validation helpers
  isValidUserRole,
  isValidTeamRole,
  isValidContentType,
  isValidInsightType,
  isValidPriority,
} from '@fypai/types'

// Frontend-specific types (not in shared package)

/**
 * AI Task Tracking
 * For monitoring long-running AI operations
 */
export interface AITask {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  type: 'generate' | 'analyze' | 'search'
  progress?: number
  result?: {
    type: 'message' | 'content' | 'suggestion'
    content: string
    metadata?: Record<string, unknown>
  }
}

// Legacy type aliases for backward compatibility during migration
// TODO: Remove these once all components are updated
export type { UserDTO as User } from '@fypai/types'
export type { TeamMemberDTO as TeamMember } from '@fypai/types'
export type { TeamWithMembersDTO as Team } from '@fypai/types'
export type { MessageDTO as Message } from '@fypai/types'
export type { AIInsightDTO as AIContent } from '@fypai/types'