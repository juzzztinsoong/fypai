import type { CreateSessionEventRequest, SessionEventType } from '@fypai/types'
import { useSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { api } from './api'

const MAX_QUEUE_SIZE = 400
const MAX_BATCH_SIZE = 50
const FLUSH_INTERVAL_MS = 4000
const SESSION_STORAGE_KEY = 'fypai:session-id'

const rawApiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const trimmedApiBaseUrl = rawApiBaseUrl.replace(/\/+$/, '')
const normalizedApiBaseUrl = trimmedApiBaseUrl.endsWith('/api')
  ? trimmedApiBaseUrl
  : `${trimmedApiBaseUrl}/api`

interface TrackSessionEventInput {
  eventType: SessionEventType
  eventName: string
  teamId?: string
  actorUserId?: string
  messageId?: string
  insightId?: string
  content?: string
  metadata?: Record<string, any>
  createdAt?: string
  flushImmediately?: boolean
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

class AnalyticsService {
  private readonly sessionId: string
  private readonly eventsBatchUrl: string
  private queue: CreateSessionEventRequest[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private isFlushing = false

  constructor() {
    this.sessionId = this.getOrCreateSessionId()
    this.eventsBatchUrl = `${normalizedApiBaseUrl}/export/events/batch`

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', this.handleVisibilityChange)
      window.addEventListener('beforeunload', this.handleBeforeUnload)
    }
  }

  getSessionId(): string {
    return this.sessionId
  }

  track(input: TrackSessionEventInput): void {
    const teamId = input.teamId || useUIStore.getState().currentTeamId
    if (!teamId) return

    const actorUserId = input.actorUserId || useSessionStore.getState().currentUser?.id || undefined

    const event: CreateSessionEventRequest = {
      teamId,
      sessionId: this.sessionId,
      eventType: input.eventType,
      eventName: input.eventName,
      actorUserId,
      messageId: input.messageId,
      insightId: input.insightId,
      content: input.content,
      metadata: input.metadata,
      createdAt: input.createdAt,
    }

    this.queue.push(event)

    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(this.queue.length - MAX_QUEUE_SIZE)
    }

    if (input.flushImmediately) {
      void this.flush()
      return
    }

    this.ensureFlushTimer()
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) {
      return
    }

    this.isFlushing = true
    this.clearFlushTimer()

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, MAX_BATCH_SIZE)
        try {
          await api.post('/export/events/batch', { events: batch })
        } catch (error) {
          this.queue = [...batch, ...this.queue].slice(-MAX_QUEUE_SIZE)
          console.warn('[AnalyticsService] Failed to flush telemetry events:', error)
          break
        }
      }
    } finally {
      this.isFlushing = false
      if (this.queue.length > 0) {
        this.ensureFlushTimer()
      }
    }
  }

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') {
      return generateSessionId()
    }

    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) {
      return existing
    }

    const created = generateSessionId()
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created)
    return created
  }

  private ensureFlushTimer(): void {
    if (this.flushTimer) return

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, FLUSH_INTERVAL_MS)
  }

  private clearFlushTimer(): void {
    if (!this.flushTimer) return

    clearTimeout(this.flushTimer)
    this.flushTimer = null
  }

  private flushWithBeacon(): void {
    if (this.queue.length === 0) return

    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      void this.flush()
      return
    }

    const batch = this.queue.splice(0, this.queue.length)
    const payload = JSON.stringify({ events: batch })
    const blob = new Blob([payload], { type: 'application/json' })

    const ok = navigator.sendBeacon(this.eventsBatchUrl, blob)
    if (!ok) {
      this.queue = [...batch, ...this.queue].slice(-MAX_QUEUE_SIZE)
      void this.flush()
    }
  }

  private handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.flushWithBeacon()
    }
  }

  private handleBeforeUnload = (): void => {
    this.flushWithBeacon()
  }
}

type WindowWithAnalytics = Window & {
  __fypaiAnalyticsService?: AnalyticsService
}

function getSingletonAnalyticsService(): AnalyticsService {
  if (typeof window === 'undefined') {
    return new AnalyticsService()
  }

  const analyticsWindow = window as WindowWithAnalytics
  if (!analyticsWindow.__fypaiAnalyticsService) {
    analyticsWindow.__fypaiAnalyticsService = new AnalyticsService()
  }

  return analyticsWindow.__fypaiAnalyticsService
}

export const analyticsService = getSingletonAnalyticsService()

export function trackSessionEvent(event: TrackSessionEventInput): void {
  analyticsService.track(event)
}

export default analyticsService
