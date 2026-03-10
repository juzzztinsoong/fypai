import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import type {
  CreateSessionEventRequest,
  SessionEventDTO,
  SessionEventType,
  SessionMetricsDTO,
} from '../types.js'

const VALID_EVENT_TYPES: SessionEventType[] = [
  'chat',
  'navigation',
  'insight',
  'context',
  'session',
  'sync',
]

function parseMetadata(metadata: string | null): Record<string, any> | undefined {
  if (!metadata) return undefined

  try {
    const parsed = JSON.parse(metadata)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, any>
    }
  } catch (error) {
    console.warn('[SessionEventController] Failed to parse metadata JSON:', error)
  }

  return undefined
}

function toSessionEventDTO(event: {
  id: string
  teamId: string
  sessionId: string
  eventType: string
  eventName: string
  actorUserId: string | null
  messageId: string | null
  insightId: string | null
  content: string | null
  metadata: string | null
  createdAt: Date
}): SessionEventDTO {
  return {
    id: event.id,
    teamId: event.teamId,
    sessionId: event.sessionId,
    eventType: event.eventType as SessionEventType,
    eventName: event.eventName,
    actorUserId: event.actorUserId || undefined,
    messageId: event.messageId || undefined,
    insightId: event.insightId || undefined,
    content: event.content || undefined,
    metadata: parseMetadata(event.metadata),
    createdAt: event.createdAt.toISOString(),
  }
}

function normalizeCreatedAt(createdAt?: string): Date {
  if (!createdAt) return new Date()

  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid createdAt. Expected ISO datetime string')
  }

  return parsed
}

interface NormalizedSessionEvent {
  teamId: string
  sessionId: string
  eventType: SessionEventType
  eventName: string
  actorUserId: string | null
  messageId: string | null
  insightId: string | null
  content: string | null
  metadata: string | null
  createdAt: Date
}

function normalizeEvent(payload: CreateSessionEventRequest): NormalizedSessionEvent {
  if (!payload.teamId) {
    throw new Error('teamId is required')
  }

  if (!payload.sessionId) {
    throw new Error('sessionId is required')
  }

  if (!payload.eventType) {
    throw new Error('eventType is required')
  }

  if (!VALID_EVENT_TYPES.includes(payload.eventType)) {
    throw new Error(`Invalid eventType. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`)
  }

  if (!payload.eventName || !payload.eventName.trim()) {
    throw new Error('eventName is required')
  }

  return {
    teamId: payload.teamId,
    sessionId: payload.sessionId,
    eventType: payload.eventType,
    eventName: payload.eventName.trim(),
    actorUserId: payload.actorUserId?.trim() || null,
    messageId: payload.messageId?.trim() || null,
    insightId: payload.insightId?.trim() || null,
    content: payload.content || null,
    metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    createdAt: normalizeCreatedAt(payload.createdAt),
  }
}

function getSessionEventModel(): any {
  const model = (prisma as any).sessionEvent
  if (!model) {
    throw new Error('Database schema is outdated. Run: npx prisma migrate dev')
  }
  return model
}

export class SessionEventController {
  static async createEvent(payload: CreateSessionEventRequest): Promise<SessionEventDTO> {
    const normalized = normalizeEvent(payload)

    try {
      const sessionEventModel = getSessionEventModel()
      const event = await sessionEventModel.create({
        data: normalized,
      })

      return toSessionEventDTO(event)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
        throw new Error('Database schema is outdated. Run: npx prisma migrate dev')
      }
      throw error
    }
  }

  static async createEventsBatch(events: CreateSessionEventRequest[]): Promise<{ created: number; received: number }> {
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('events array is required')
    }

    if (events.length > 200) {
      throw new Error('events batch too large (max 200)')
    }

    const normalized = events.map((event) => normalizeEvent(event))

    try {
      const sessionEventModel = getSessionEventModel()
      const result = await sessionEventModel.createMany({
        data: normalized,
      })

      return {
        created: result.count,
        received: events.length,
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
        throw new Error('Database schema is outdated. Run: npx prisma migrate dev')
      }
      throw error
    }
  }

  static async getEvents(teamId: string, options?: { sessionId?: string; limit?: number }): Promise<SessionEventDTO[]> {
    if (!teamId) {
      throw new Error('teamId is required')
    }

    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 5000) : 1000

    try {
      const sessionEventModel = getSessionEventModel()
      const events = await sessionEventModel.findMany({
        where: {
          teamId,
          ...(options?.sessionId ? { sessionId: options.sessionId } : {}),
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: limit,
      })

      return events.map(toSessionEventDTO)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
        return []
      }
      throw error
    }
  }

  static computeMetrics(events: SessionEventDTO[], teamId: string, sessionId?: string): SessionMetricsDTO {
    const sorted = [...events].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

    const firstEvent = sorted[0]
    const lastEvent = sorted[sorted.length - 1]

    const uniqueUsers = new Set(
      sorted
        .map((event) => event.actorUserId)
        .filter((value): value is string => Boolean(value))
    ).size

    const messageSentCount = sorted.filter((event) => event.eventName === 'message_sent').length
    const insightStatusChangeCount = sorted.filter((event) => event.eventName === 'insight_status_changed').length
    const tabSwitchCount = sorted.filter((event) => event.eventName === 'right_panel_tab_changed').length
    const contextEditCount = sorted.filter((event) => event.eventName === 'task_context_saved').length
    const exportCount = sorted.filter((event) => event.eventName === 'session_export_requested').length
    const resetCount = sorted.filter((event) => event.eventName === 'session_reset_completed').length
    const markerJumpCount = sorted.filter((event) => {
      return (
        event.eventName === 'jump_to_chat_marker' ||
        event.eventName === 'jump_to_insight_marker' ||
        event.eventName === 'focus_chat_marker_from_insight' ||
        event.eventName === 'focus_insight_from_marker'
      )
    }).length

    const timelineSyncCount = sorted.filter((event) => {
      return (
        event.eventType === 'sync' ||
        event.eventName === 'timeline_anchor_sync' ||
        event.eventName === 'timeline_sync_toggled'
      )
    }).length

    const linkHoverCount = sorted.filter((event) => event.eventName === 'link_hover').length

    const actionAcceptedCount = sorted.filter((event) => {
      return event.eventName === 'insight_status_changed' && event.metadata?.toStatus === 'accepted'
    }).length

    const actionDismissedCount = sorted.filter((event) => {
      return event.eventName === 'insight_status_changed' && event.metadata?.toStatus === 'dismissed'
    }).length

    const actionCompletedCount = sorted.filter((event) => {
      return event.eventName === 'insight_status_changed' && event.metadata?.toStatus === 'archived'
    }).length

    let avgSecondsBetweenEvents = 0
    if (sorted.length > 1) {
      let totalMsBetween = 0
      for (let index = 1; index < sorted.length; index += 1) {
        const prev = new Date(sorted[index - 1].createdAt).getTime()
        const current = new Date(sorted[index].createdAt).getTime()
        totalMsBetween += Math.max(0, current - prev)
      }
      avgSecondsBetweenEvents = Number((totalMsBetween / (sorted.length - 1) / 1000).toFixed(2))
    }

    return {
      teamId,
      sessionId,
      windowStart: firstEvent?.createdAt || null,
      windowEnd: lastEvent?.createdAt || null,
      totalEvents: sorted.length,
      uniqueUsers,
      messageSentCount,
      insightStatusChangeCount,
      tabSwitchCount,
      contextEditCount,
      exportCount,
      resetCount,
      markerJumpCount,
      timelineSyncCount,
      linkHoverCount,
      actionAcceptedCount,
      actionDismissedCount,
      actionCompletedCount,
      avgSecondsBetweenEvents,
    }
  }
}
