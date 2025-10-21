/**
 * Event Transformer
 * 
 * Normalizes events from different sources (REST, socket) into a unified format.
 * Ensures all events have required fields (eventId, source, timestamp).
 * 
 * This allows domain services to publish events without worrying about the format.
 */

import type { DomainEvent, EventSource } from './types'
import type { MessageDTO, AIInsightDTO } from '@fypai/types'

export class EventTransformer {
  /**
   * Generate unique event ID
   * Format: {type}:{resourceId}:{timestamp}:{random}
   */
  static generateEventId(type: string, resourceId?: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    return resourceId
      ? `${type}:${resourceId}:${timestamp}:${random}`
      : `${type}:${timestamp}:${random}`
  }

  /**
   * Transform message:created event
   */
  static messageCreated(
    message: MessageDTO,
    source: EventSource,
    requestId?: string
  ): DomainEvent {
    return {
      type: 'message:created',
      eventId: requestId || this.generateEventId('msg-created', message.id),
      source,
      timestamp: Date.now(),
      message,
      requestId,
    }
  }

  /**
   * Transform message:updated event
   */
  static messageUpdated(message: MessageDTO, source: EventSource): DomainEvent {
    return {
      type: 'message:updated',
      eventId: this.generateEventId('msg-updated', message.id),
      source,
      timestamp: Date.now(),
      message,
    }
  }

  /**
   * Transform message:deleted event
   */
  static messageDeleted(
    messageId: string,
    teamId: string,
    source: EventSource
  ): DomainEvent {
    return {
      type: 'message:deleted',
      eventId: this.generateEventId('msg-deleted', messageId),
      source,
      timestamp: Date.now(),
      messageId,
      teamId,
    }
  }

  /**
   * Transform messages:fetched event
   */
  static messagesFetched(
    teamId: string,
    messages: MessageDTO[],
    source: EventSource
  ): DomainEvent {
    return {
      type: 'messages:fetched',
      eventId: this.generateEventId('msgs-fetched', teamId),
      source,
      timestamp: Date.now(),
      teamId,
      messages,
    }
  }

  /**
   * Transform insight:created event
   */
  static insightCreated(
    insight: AIInsightDTO,
    source: EventSource
  ): DomainEvent {
    return {
      type: 'insight:created',
      eventId: this.generateEventId('insight-created', insight.id),
      source,
      timestamp: Date.now(),
      insight,
    }
  }

  /**
   * Transform insight:updated event
   */
  static insightUpdated(
    insight: AIInsightDTO,
    source: EventSource
  ): DomainEvent {
    return {
      type: 'insight:updated',
      eventId: this.generateEventId('insight-updated', insight.id),
      source,
      timestamp: Date.now(),
      insight,
    }
  }

  /**
   * Transform insight:deleted event
   */
  static insightDeleted(
    insightId: string,
    teamId: string,
    source: EventSource
  ): DomainEvent {
    return {
      type: 'insight:deleted',
      eventId: this.generateEventId('insight-deleted', insightId),
      source,
      timestamp: Date.now(),
      insightId,
      teamId,
    }
  }

  /**
   * Transform insights:fetched event
   */
  static insightsFetched(
    teamId: string,
    insights: AIInsightDTO[],
    source: EventSource
  ): DomainEvent {
    return {
      type: 'insights:fetched',
      eventId: this.generateEventId('insights-fetched', teamId),
      source,
      timestamp: Date.now(),
      teamId,
      insights,
    }
  }

  /**
   * Transform presence:online event
   */
  static presenceOnline(userId: string, source: EventSource): DomainEvent {
    return {
      type: 'presence:online',
      eventId: this.generateEventId('presence-online', userId),
      source,
      timestamp: Date.now(),
      userId,
    }
  }

  /**
   * Transform presence:offline event
   */
  static presenceOffline(userId: string, source: EventSource): DomainEvent {
    return {
      type: 'presence:offline',
      eventId: this.generateEventId('presence-offline', userId),
      source,
      timestamp: Date.now(),
      userId,
    }
  }

  /**
   * Transform presence:typing event
   */
  static presenceTyping(
    teamId: string,
    userId: string,
    isTyping: boolean,
    source: EventSource
  ): DomainEvent {
    return {
      type: 'presence:typing',
      eventId: this.generateEventId('presence-typing', `${teamId}:${userId}`),
      source,
      timestamp: Date.now(),
      teamId,
      userId,
      isTyping,
    }
  }

  /**
   * Transform presence:list event
   */
  static presenceList(users: string[], source: EventSource): DomainEvent {
    return {
      type: 'presence:list',
      eventId: this.generateEventId('presence-list'),
      source,
      timestamp: Date.now(),
      users,
    }
  }

  /**
   * Transform team:joined event
   */
  static teamJoined(teamId: string, userId: string, source: EventSource): DomainEvent {
    return {
      type: 'team:joined',
      eventId: this.generateEventId('team-joined', `${teamId}:${userId}`),
      source,
      timestamp: Date.now(),
      teamId,
      userId,
    }
  }

  /**
   * Transform team:left event
   */
  static teamLeft(teamId: string, userId: string, source: EventSource): DomainEvent {
    return {
      type: 'team:left',
      eventId: this.generateEventId('team-left', `${teamId}:${userId}`),
      source,
      timestamp: Date.now(),
      teamId,
      userId,
    }
  }
}
