/**
 * Event Bus Type Definitions
 * 
 * Central type system for all events flowing through the application.
 * Events can originate from REST API responses or real-time socket events.
 */

import type { MessageDTO, AIInsightDTO, TeamDTO } from '@fypai/types'

/**
 * Event source - where did this event originate?
 */
export type EventSource = 'rest' | 'socket' | 'local'

/**
 * Base event structure - all events extend this
 */
export interface BaseEvent {
  /** Unique event identifier for deduplication */
  eventId: string
  /** Event source (REST API, socket, local action) */
  source: EventSource
  /** Timestamp when event was created */
  timestamp: number
}

/**
 * Message Events
 */
export interface MessageCreatedEvent extends BaseEvent {
  type: 'message:created'
  message: MessageDTO
  requestId?: string // For optimistic updates
}

export interface MessageUpdatedEvent extends BaseEvent {
  type: 'message:updated'
  message: MessageDTO
}

export interface MessageDeletedEvent extends BaseEvent {
  type: 'message:deleted'
  messageId: string
  teamId: string
}

export interface MessagesFetchedEvent extends BaseEvent {
  type: 'messages:fetched'
  teamId: string
  messages: MessageDTO[]
}

/**
 * Insight Events
 */
export interface InsightCreatedEvent extends BaseEvent {
  type: 'insight:created'
  insight: AIInsightDTO
}

export interface InsightUpdatedEvent extends BaseEvent {
  type: 'insight:updated'
  insight: AIInsightDTO
}

export interface InsightDeletedEvent extends BaseEvent {
  type: 'insight:deleted'
  insightId: string
  teamId: string
}

export interface InsightsFetchedEvent extends BaseEvent {
  type: 'insights:fetched'
  teamId: string
  insights: AIInsightDTO[]
}

/**
 * Team Events
 */
export interface TeamJoinedEvent extends BaseEvent {
  type: 'team:joined'
  teamId: string
  userId: string
}

export interface TeamLeftEvent extends BaseEvent {
  type: 'team:left'
  teamId: string
  userId: string
}

export interface TeamsFetchedEvent extends BaseEvent {
  type: 'teams:fetched'
  userId: string
  teams: TeamDTO[]
}

/**
 * Presence Events
 */
export interface PresenceOnlineEvent extends BaseEvent {
  type: 'presence:online'
  userId: string
}

export interface PresenceOfflineEvent extends BaseEvent {
  type: 'presence:offline'
  userId: string
}

export interface PresenceTypingEvent extends BaseEvent {
  type: 'presence:typing'
  teamId: string
  userId: string
  isTyping: boolean
}

export interface PresenceListEvent extends BaseEvent {
  type: 'presence:list'
  users: string[]
}

/**
 * Union type of all possible events
 */
export type DomainEvent =
  | MessageCreatedEvent
  | MessageUpdatedEvent
  | MessageDeletedEvent
  | MessagesFetchedEvent
  | InsightCreatedEvent
  | InsightUpdatedEvent
  | InsightDeletedEvent
  | InsightsFetchedEvent
  | TeamJoinedEvent
  | TeamLeftEvent
  | TeamsFetchedEvent
  | PresenceOnlineEvent
  | PresenceOfflineEvent
  | PresenceTypingEvent
  | PresenceListEvent

/**
 * Event callback function type
 */
export type EventCallback<T extends DomainEvent = DomainEvent> = (event: T) => void

/**
 * Event subscriber type
 */
export interface EventSubscriber {
  id: string
  eventType: DomainEvent['type']
  callback: EventCallback
}

/**
 * Event statistics for monitoring
 */
export interface EventStats {
  totalPublished: number
  totalDeduplicated: number
  totalSubscribers: number
  eventCounts: Record<DomainEvent['type'], number>
}
