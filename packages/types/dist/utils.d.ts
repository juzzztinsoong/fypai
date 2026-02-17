/**
 * Type Transformation Utilities
 *
 * These utilities help convert between Entity types (database format) and DTO types (API format).
 *
 * Main transformations:
 * - Date ↔ ISO string
 * - JSON string ↔ Parsed object/array
 * - Entity ↔ DTO
 */
import type { User, Team, TeamMember, Message, AIInsight } from './entities.js';
import type { UserDTO, TeamDTO, TeamWithMembersDTO, MessageDTO, MessageMetadata, AIInsightDTO } from './dtos.js';
/**
 * Date Utilities
 */
export declare function dateToISOString(date: Date): string;
export declare function isoStringToDate(iso: string): Date;
/**
 * JSON Utilities
 */
export declare function parseJSON<T>(json: string | null): T | undefined;
export declare function stringifyJSON(obj: any): string | null;
/**
 * Enum Utilities
 */
export declare function enumToString<T extends string>(enumValue: T): T;
export declare function stringToEnum<E extends Record<string, string>>(value: string, enumObj: E): E[keyof E] | undefined;
/**
 * Entity to DTO Transformers
 */
export declare function userToDTO(user: User): UserDTO;
export declare function teamToDTO(team: Team): TeamDTO;
export declare function messageToDTO(message: Message, author?: {
    id: string;
    name: string;
    avatar: string | null;
    role: string;
}): MessageDTO;
export declare function aiInsightToDTO(insight: AIInsight): AIInsightDTO;
/**
 * Create TeamWithMembersDTO from Team + TeamMembers + Users
 * This is commonly used when fetching a team with its members
 */
export declare function teamWithMembersToDTO(team: Team, teamMembers: Array<{
    teamMember: TeamMember;
    user: User;
}>): TeamWithMembersDTO;
/**
 * DTO to Entity Transformers (for request processing)
 */
export declare function messageDTOToMetadataString(metadata?: MessageMetadata): string | null;
export declare function aiInsightDTOToTagsString(tags?: string[]): string | null;
export declare function aiInsightDTOToRelatedMessageIdsString(ids?: string[]): string | null;
/**
 * Batch Transformers
 */
export declare function usersToDTO(users: User[]): UserDTO[];
export declare function teamsToDTO(teams: Team[]): TeamDTO[];
export declare function messagesToDTO(messages: Array<{
    message: Message;
    author?: {
        id: string;
        name: string;
        avatar: string | null;
        role: string;
    };
}>): MessageDTO[];
export declare function aiInsightsToDTO(insights: AIInsight[]): AIInsightDTO[];
/**
 * Validation Helpers
 */
export declare function isValidDate(date: any): date is Date;
export declare function isValidISOString(iso: any): iso is string;
export declare function isValidJSON(json: string): boolean;
/**
 * Safe Parsing Helpers (with defaults)
 */
export declare function parseJSONSafe<T>(json: string | null, defaultValue: T): T;
export declare function parseISOStringSafe(iso: string | null, defaultValue?: Date): Date;
//# sourceMappingURL=utils.d.ts.map