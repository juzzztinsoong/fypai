/**
 * @fypai/types - Shared TypeScript Types
 * 
 * Main entry point for the shared types package.
 * Exports all types, enums, and utilities.
 */

// Enums and Constants
export {
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
  isValidUserRole,
  isValidTeamRole,
  isValidContentType,
  isValidInsightType,
  isValidPriority,
} from './enums.js'

// Entity Types (Database/Prisma-aligned)
export type {
  User,
  Team,
  TeamMember,
  Message,
  AIInsight,
} from './entities.js'

export {
  isUser,
  isTeam,
  isMessage,
  isAIInsight,
} from './entities.js'

// DTO Types (API/Frontend-friendly)
export type {
  UserDTO,
  TeamDTO,
  TeamMemberDTO,
  TeamWithMembersDTO,
  MessageDTO,
  MessageMetadata,
  AIInsightDTO,
  AIInsightMetadata,
  CreateUserRequest,
  UpdateUserRequest,
  CreateTeamRequest,
  UpdateTeamRequest,
  AddTeamMemberRequest,
  CreateMessageRequest,
  UpdateMessageRequest,
  CreateAIInsightRequest,
  UpdateAIInsightRequest,
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginatedResponse,
  MessageNewEvent,
  PresenceUpdateEvent,
  TypingEvent,
  AITaskStatusEvent,
  ChatState,
  PresenceState,
} from './dtos.js'

// Utility Functions
export {
  // Date utilities
  dateToISOString,
  isoStringToDate,
  
  // JSON utilities
  parseJSON,
  stringifyJSON,
  
  // Enum utilities
  enumToString,
  stringToEnum,
  
  // Entity to DTO transformers
  userToDTO,
  teamToDTO,
  messageToDTO,
  aiInsightToDTO,
  teamWithMembersToDTO,
  
  // DTO to Entity helpers
  messageDTOToMetadataString,
  aiInsightDTOToTagsString,
  aiInsightDTOToRelatedMessageIdsString,
  
  // Batch transformers
  usersToDTO,
  teamsToDTO,
  messagesToDTO,
  aiInsightsToDTO,
  
  // Validation helpers
  isValidDate,
  isValidISOString,
  isValidJSON,
  
  // Safe parsing helpers
  parseJSONSafe,
  parseISOStringSafe,
} from './utils.js'
