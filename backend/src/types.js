/**
 * Shared Type Definitions for Backend
 * 
 * Tech Stack: JavaScript with JSDoc for type hints
 * Pattern: Centralized type definitions for IDE autocomplete
 * 
 * Usage:
 *   import { UserRole, ContentType } from './types.js'
 * 
 * Exports:
 *   - UserRole: Enum for user roles
 *   - ContentType: Enum for message content types
 *   - TeamRole: Enum for team member roles
 */

/**
 * @typedef {'member' | 'admin' | 'agent'} UserRole
 */

/**
 * @typedef {'text' | 'ai_longform' | 'notebook' | 'file'} ContentType
 */

/**
 * @typedef {'owner' | 'admin' | 'member'} TeamRole
 */

/**
 * @typedef {Object} MessageMetadata
 * @property {string[]} [suggestions] - AI-suggested follow-up prompts
 * @property {string} [parentMessageId] - ID of message this replies to
 * @property {string} [fileName] - Original filename for file uploads
 */

export const UserRole = {
  MEMBER: 'member',
  ADMIN: 'admin',
  AGENT: 'agent',
}

export const ContentType = {
  TEXT: 'text',
  AI_LONGFORM: 'ai_longform',
  NOTEBOOK: 'notebook',
  FILE: 'file',
}

export const TeamRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
}