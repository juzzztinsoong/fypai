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
    createdAt: string;
    members: TeamMemberDTO[];
}
/**
 * Message Metadata
 * Parsed metadata object for messages
 */
export interface MessageMetadata {
    suggestions?: string[];
    parentMessageId?: string;
    fileName?: string;
    model?: string;
    tokensUsed?: number;
    prompt?: string;
    longFormType?: 'summary' | 'code' | 'document';
    relatedInsightIds?: string[];
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
    author?: {
        id: string;
        name: string;
        avatar: string | null;
        role: UserRoleString;
    };
}
/**
 * AIInsight Metadata
 * Additional metadata for AI insights
 */
export interface AIInsightMetadata {
    language?: string;
    filename?: string;
}
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
}
export interface UpdateAIInsightRequest {
    title?: string;
    content?: string;
    priority?: PriorityString;
    tags?: string[];
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
//# sourceMappingURL=dtos.d.ts.map