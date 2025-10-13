// Shared API types for frontend-backend communication
// Specification-first: All types used in REST and WebSocket APIs

export interface Team {
  id: string
  name: string
  members: User[]
}

export interface User {
  id: string
  name: string
  avatarUrl?: string
  role: 'member' | 'admin' | 'agent'
}

export interface Message {
  id: string
  teamId: string
  authorId: string | 'agent'
  content: string
  contentType: 'text' | 'ai_longform' | 'notebook' | 'file'
  createdAt: string // ISOString
  metadata?: {
    suggestions?: string[]
    parentMessageId?: string
  }
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}
