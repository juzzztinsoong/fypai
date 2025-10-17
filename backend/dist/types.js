/**
 * Shared Type Definitions for Backend
 *
 * Tech Stack: TypeScript, @fypai/types shared package
 * Pattern: Re-export types from shared package + transformation utilities
 *
 * Usage:
 *   import { UserRole, ContentType, Message, userToDTO } from './types'
 *
 * Architecture:
 *   - Entity types (User, Team, Message, etc.) are used internally in controllers
 *   - DTO types (UserDTO, TeamDTO, MessageDTO, etc.) are returned from API routes
 *   - Transformation utilities (userToDTO, messageToDTO, etc.) convert entities to DTOs
 */
// Re-export enums (these are values, not just types)
export { UserRole, TeamRole, ContentType, InsightType, Priority, isValidUserRole, isValidTeamRole, isValidContentType, isValidInsightType, isValidPriority, } from '@fypai/types';
// Re-export type guard functions
export { isUser, isTeam, isMessage, isAIInsight, } from '@fypai/types';
// Re-export utility functions
export { 
// Date utilities
dateToISOString, isoStringToDate, 
// JSON utilities
parseJSON, stringifyJSON, parseJSONSafe, 
// Entity to DTO transformers
userToDTO, teamToDTO, messageToDTO, aiInsightToDTO, teamWithMembersToDTO, 
// DTO to Entity helpers
messageDTOToMetadataString, aiInsightDTOToTagsString, aiInsightDTOToRelatedMessageIdsString, 
// Batch transformers
usersToDTO, teamsToDTO, messagesToDTO, aiInsightsToDTO, 
// Validation helpers
isValidDate, isValidISOString, isValidJSON, } from '@fypai/types';
