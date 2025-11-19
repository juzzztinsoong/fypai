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

import type { User, Team, TeamMember, Message, AIInsight } from './entities.js'
import type {
  UserDTO,
  TeamDTO,
  TeamMemberDTO,
  TeamWithMembersDTO,
  MessageDTO,
  MessageMetadata,
  AIInsightDTO,
} from './dtos.js'
import {
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
} from './enums.js'

/**
 * Date Utilities
 */

export function dateToISOString(date: Date): string {
  return date.toISOString()
}

export function isoStringToDate(iso: string): Date {
  return new Date(iso)
}

/**
 * JSON Utilities
 */

export function parseJSON<T>(json: string | null): T | undefined {
  if (json === null) return undefined
  try {
    return JSON.parse(json) as T
  } catch {
    return undefined
  }
}

export function stringifyJSON(obj: any): string | null {
  if (obj === undefined || obj === null) return null
  try {
    return JSON.stringify(obj)
  } catch {
    return null
  }
}

/**
 * Enum Utilities
 */

export function enumToString<T extends string>(enumValue: T): T {
  return enumValue
}

export function stringToEnum<E extends Record<string, string>>(
  value: string,
  enumObj: E
): E[keyof E] | undefined {
  const enumValue = Object.values(enumObj).find((v) => v === value)
  return enumValue as E[keyof E] | undefined
}

/**
 * Entity to DTO Transformers
 */

export function userToDTO(user: User): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role as UserRoleString,
    createdAt: dateToISOString(user.createdAt),
  }
}

export function teamToDTO(team: Team): TeamDTO {
  return {
    id: team.id,
    name: team.name,
    createdAt: dateToISOString(team.createdAt),
  }
}

export function messageToDTO(
  message: Message,
  author?: { id: string; name: string; avatar: string | null; role: string }
): MessageDTO {
  return {
    id: message.id,
    teamId: message.teamId,
    authorId: message.authorId,
    content: message.content,
    contentType: message.contentType as ContentTypeString,
    createdAt: dateToISOString(message.createdAt),
    metadata: parseJSON<MessageMetadata>(message.metadata),
    author: author
      ? {
          id: author.id,
          name: author.name,
          avatar: author.avatar,
          role: author.role as UserRoleString,
        }
      : undefined,
  }
}

export function aiInsightToDTO(insight: AIInsight): AIInsightDTO {
  return {
    id: insight.id,
    teamId: insight.teamId,
    type: insight.type as InsightTypeString,
    title: insight.title,
    content: insight.content,
    priority: insight.priority ? (insight.priority as PriorityString) : undefined,
    tags: parseJSON<string[]>(insight.tags),
    createdAt: dateToISOString(insight.createdAt),
    relatedMessageIds: parseJSON<string[]>(insight.relatedMessageIds),
  }
}

/**
 * Create TeamWithMembersDTO from Team + TeamMembers + Users
 * This is commonly used when fetching a team with its members
 */
export function teamWithMembersToDTO(
  team: Team,
  teamMembers: Array<{
    teamMember: TeamMember
    user: User
  }>
): TeamWithMembersDTO {
  return {
    id: team.id,
    name: team.name,
    isChimeEnabled: team.isChimeEnabled,
    createdAt: dateToISOString(team.createdAt),
    members: teamMembers.map(({ teamMember, user }) => ({
      id: teamMember.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role as UserRoleString,
      teamRole: (teamMember.teamRole || 'member') as TeamRoleString,
      joinedAt: dateToISOString(teamMember.joinedAt),
    })),
  }
}

/**
 * DTO to Entity Transformers (for request processing)
 */

export function messageDTOToMetadataString(metadata?: MessageMetadata): string | null {
  return stringifyJSON(metadata)
}

export function aiInsightDTOToTagsString(tags?: string[]): string | null {
  return stringifyJSON(tags)
}

export function aiInsightDTOToRelatedMessageIdsString(ids?: string[]): string | null {
  return stringifyJSON(ids)
}

/**
 * Batch Transformers
 */

export function usersToDTO(users: User[]): UserDTO[] {
  return users.map(userToDTO)
}

export function teamsToDTO(teams: Team[]): TeamDTO[] {
  return teams.map(teamToDTO)
}

export function messagesToDTO(
  messages: Array<{
    message: Message
    author?: { id: string; name: string; avatar: string | null; role: string }
  }>
): MessageDTO[] {
  return messages.map(({ message, author }) => messageToDTO(message, author))
}

export function aiInsightsToDTO(insights: AIInsight[]): AIInsightDTO[] {
  return insights.map(aiInsightToDTO)
}

/**
 * Validation Helpers
 */

export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime())
}

export function isValidISOString(iso: any): iso is string {
  if (typeof iso !== 'string') return false
  const date = new Date(iso)
  return isValidDate(date)
}

export function isValidJSON(json: string): boolean {
  try {
    JSON.parse(json)
    return true
  } catch {
    return false
  }
}

/**
 * Safe Parsing Helpers (with defaults)
 */

export function parseJSONSafe<T>(json: string | null, defaultValue: T): T {
  const parsed = parseJSON<T>(json)
  return parsed !== undefined ? parsed : defaultValue
}

export function parseISOStringSafe(iso: string | null, defaultValue: Date = new Date()): Date {
  if (!iso) return defaultValue
  try {
    const date = isoStringToDate(iso)
    return isValidDate(date) ? date : defaultValue
  } catch {
    return defaultValue
  }
}
