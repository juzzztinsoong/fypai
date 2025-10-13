/**
 * TYPES MODULE
 *
 * Tech Stack: TypeScript
 * Purpose: Centralized type definitions for frontend state, API, and data models
 *
 * Interfaces:
 *   - User: Basic user info (id, name, email, avatar?)
 *   - TeamMember: Team member info (id, name, avatar?, role)
 *   - Team: Team structure (id, name, description?, members[])
 *   - Message: Chat message (id, teamId, authorId, content, contentType, createdAt, metadata?)
 *   - AIContent: AI-generated content (id, messageId, content, type, metadata?)
 *   - ChatState: Chat UI state (messages[], isTyping, activeUsers[])
 *   - AIResponse: AI API response (type, content, metadata?)
 *   - AITask: AI job tracking (id, status, type, progress?, result?)
 *
 * Exported:
 *   - All interfaces above for use in stores, components, and API clients
 *
 * Usage:
 *   - Import types from this file in stores, hooks, components, and backend API clients
 *   - Use for prop types, Zustand store state, API request/response validation
 */

// User and Team types
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

export interface TeamMember {
  id: string
  name: string
  avatar?: string
  role: 'admin' | 'member'
}

export interface Team {
  id: string
  name: string
  description?: string
  members: TeamMember[]
}

// Message and Content types
export interface Message {
  id: string
  teamId: string
  authorId: string | 'agent'
  content: string
  contentType: 'text' | 'ai_longform' | 'notebook' | 'file'
  createdAt: string
  metadata?: {
    suggestions?: string[]
    parentMessageId?: string
  }
}

export interface AIContent {
  id: string
  messageId: string
  content: string
  type: 'text' | 'notebook' | 'file' | 'code'
  metadata?: {
    language?: string
    filename?: string
    suggestions?: string[]
    references?: {
      type: string
      id: string
      title: string
    }[]
  }
}

// Chat types
export interface ChatState {
  messages: Message[]
  isTyping: boolean
  activeUsers: string[]
}

// AI Agent types
export interface AIResponse {
  type: 'message' | 'content' | 'suggestion'
  content: string
  metadata?: Record<string, unknown>
}

export interface AITask {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  type: 'generate' | 'analyze' | 'search'
  progress?: number
  result?: AIResponse
}