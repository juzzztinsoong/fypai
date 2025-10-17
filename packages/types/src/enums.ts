/**
 * Shared Enums and Constants
 * 
 * These enums define the allowed values for various fields across the application.
 * They ensure type safety and consistency between frontend and backend.
 */

/**
 * User Role Enum
 * Defines the application-level role of a user
 */
export enum UserRole {
  MEMBER = 'member',
  ADMIN = 'admin',
  AGENT = 'agent',
}

/**
 * Team Role Enum
 * Defines a user's role within a specific team
 */
export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

/**
 * Content Type Enum
 * Defines the type of message content
 */
export enum ContentType {
  TEXT = 'text',
  AI_LONGFORM = 'ai_longform',
  NOTEBOOK = 'notebook',
  FILE = 'file',
}

/**
 * AI Insight Type Enum
 * Defines the type of AI-generated insight
 * 
 * DECISION: Use 'action' instead of 'action-item' for consistency
 * Backend will use snake_case in DB, but expose as enum value
 */
export enum InsightType {
  SUMMARY = 'summary',
  ACTION = 'action',
  SUGGESTION = 'suggestion',
  ANALYSIS = 'analysis',
  CODE = 'code',
  DOCUMENT = 'document',
}

/**
 * Priority Level Enum
 * Defines priority levels for insights and tasks
 */
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * Union type alternatives for when you need string literals
 * Useful for API contracts and validation
 */
export type UserRoleString = 'member' | 'admin' | 'agent'
export type TeamRoleString = 'owner' | 'admin' | 'member'
export type ContentTypeString = 'text' | 'ai_longform' | 'notebook' | 'file'
export type InsightTypeString = 'summary' | 'action' | 'suggestion' | 'analysis' | 'code' | 'document'
export type PriorityString = 'low' | 'medium' | 'high'

/**
 * Helper function to validate enum values
 */
export function isValidUserRole(value: string): value is UserRoleString {
  return Object.values(UserRole).includes(value as UserRole)
}

export function isValidTeamRole(value: string): value is TeamRoleString {
  return Object.values(TeamRole).includes(value as TeamRole)
}

export function isValidContentType(value: string): value is ContentTypeString {
  return Object.values(ContentType).includes(value as ContentType)
}

export function isValidInsightType(value: string): value is InsightTypeString {
  return Object.values(InsightType).includes(value as InsightType)
}

export function isValidPriority(value: string): value is PriorityString {
  return Object.values(Priority).includes(value as Priority)
}
