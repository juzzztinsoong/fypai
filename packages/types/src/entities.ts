/**
 * Core Entity Types (Prisma-aligned)
 * 
 * These types match the Prisma schema exactly and represent the database structure.
 * Use these types in backend controllers and database operations.
 * 
 * Key Design Decisions:
 * - All dates are Date objects (Prisma DateTime)
 * - All nullable fields use `| null` (not `?` optional)
 * - JSON fields are stored as `string | null` (will be parsed in DTOs)
 * - IDs are strings (UUID format)
 * - Only createdAt timestamps (no updatedAt in current schema)
 */

import { UserRole, TeamRole, ContentType, InsightType, Priority } from './enums.js'

/**
 * User Entity
 * Represents an application user (team member or AI agent)
 * 
 * Note: Prisma stores enums as strings, so we use string literals instead of enum types
 */
export interface User {
  id: string
  name: string
  email: string | null
  avatar: string | null
  role: string  // UserRole as string (Prisma generates this as string)
  createdAt: Date
}

/**
 * Team Entity
 * Represents a collaborative workspace
 */
export interface Team {
  id: string
  name: string
  isChimeEnabled: boolean  // AI assistant enabled state
  createdAt: Date
  updatedAt: Date
}

/**
 * TeamMember Entity
 * Join table linking users to teams with role information
 * 
 * Note: teamRole is nullable in Prisma schema and stored as string
 */
export interface TeamMember {
  id: string
  teamId: string
  userId: string
  teamRole: string | null  // TeamRole as string (Prisma generates this as string)
  joinedAt: Date
}

/**
 * Message Entity
 * Represents a chat message in a team
 * 
 * DECISION: metadata is stored as JSON string in DB
 * Contains: { suggestions?: string[], parentMessageId?: string, fileName?: string }
 * 
 * Note: contentType is stored as string in Prisma
 */
export interface Message {
  id: string
  teamId: string
  authorId: string
  content: string
  contentType: string  // ContentType as string (Prisma generates this as string)
  metadata: string | null  // JSON string
  createdAt: Date
}

/**
 * AIInsight Entity
 * Represents AI-generated insights, summaries, and recommendations
 * 
 * DECISIONS:
 * - priority and tags are separate fields (not in metadata)
 * - tags is stored as JSON array string: '["tag1", "tag2"]'
 * - relatedMessageIds is stored as JSON array string: '["id1", "id2"]'
 * 
 * Note: type and priority are stored as strings in Prisma
 */
export interface AIInsight {
  id: string
  teamId: string
  type: string  // InsightType as string (Prisma generates this as string)
  title: string
  content: string
  priority: string | null  // Priority as string (Prisma generates this as string)
  tags: string | null  // JSON array string
  createdAt: Date
  relatedMessageIds: string | null  // JSON array string
}

/**
 * Type guards to check if an entity matches the expected structure
 */
export function isUser(obj: any): obj is User {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    (obj.email === null || typeof obj.email === 'string') &&
    (obj.avatar === null || typeof obj.avatar === 'string') &&
    typeof obj.role === 'string' &&
    obj.createdAt instanceof Date
  )
}

export function isTeam(obj: any): obj is Team {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    obj.createdAt instanceof Date
  )
}

export function isMessage(obj: any): obj is Message {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.teamId === 'string' &&
    typeof obj.authorId === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.contentType === 'string' &&
    (obj.metadata === null || typeof obj.metadata === 'string') &&
    obj.createdAt instanceof Date
  )
}

export function isAIInsight(obj: any): obj is AIInsight {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.teamId === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.content === 'string' &&
    (obj.priority === null || typeof obj.priority === 'string') &&
    (obj.tags === null || typeof obj.tags === 'string') &&
    obj.createdAt instanceof Date &&
    (obj.relatedMessageIds === null || typeof obj.relatedMessageIds === 'string')
  )
}