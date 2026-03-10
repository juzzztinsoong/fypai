import { Router } from 'express'
import { ExportController } from '../controllers/exportController.js'
import { SessionEventController } from '../controllers/sessionEventController.js'

const router = Router()

/**
 * POST /api/export/events
 * Store a single telemetry event
 */
router.post('/events', async (req, res) => {
  try {
    const event = await SessionEventController.createEvent(req.body)
    res.status(201).json(event)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create session event'

    if (
      message.includes('required') ||
      message.includes('Invalid') ||
      message.includes('batch too large') ||
      message.includes('Expected ISO')
    ) {
      return res.status(400).json({ error: message })
    }

    if (message.includes('schema is outdated')) {
      return res.status(503).json({ error: message })
    }

    console.error('[ExportRoutes] POST /events error:', error)
    res.status(500).json({ error: message })
  }
})

/**
 * POST /api/export/events/batch
 * Store multiple telemetry events in one call
 */
router.post('/events/batch', async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : []
    const result = await SessionEventController.createEventsBatch(events)
    res.status(201).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create session events batch'

    if (
      message.includes('required') ||
      message.includes('Invalid') ||
      message.includes('batch too large') ||
      message.includes('Expected ISO')
    ) {
      return res.status(400).json({ error: message })
    }

    if (message.includes('schema is outdated')) {
      return res.status(503).json({ error: message })
    }

    console.error('[ExportRoutes] POST /events/batch error:', error)
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/export/events/:teamId?sessionId=:sessionId&limit=1000
 * Read telemetry events for diagnostics/research
 */
router.get('/events/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined

    const events = await SessionEventController.getEvents(teamId, {
      sessionId,
      limit,
    })

    res.status(200).json({
      teamId,
      sessionId,
      count: events.length,
      events,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch session events'

    if (message.includes('required')) {
      return res.status(400).json({ error: message })
    }

    console.error('[ExportRoutes] GET /events/:teamId error:', error)
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/export/session/:teamId?format=json|csv|timeline-json|metrics-csv&sessionId=:sessionId
 * Export session data for research analysis
 */
router.get('/session/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params
    const format = (req.query.format as string | undefined)?.toLowerCase() || 'json'
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined

    const result = await ExportController.exportSession(teamId, format, { sessionId })

    if (format === 'csv' || format === 'metrics-csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      if (format === 'metrics-csv') {
        const sessionSuffix = sessionId ? `-${sessionId}` : ''
        res.setHeader('Content-Disposition', `attachment; filename="session-${teamId}${sessionSuffix}-metrics.csv"`)
      } else {
        res.setHeader('Content-Disposition', `attachment; filename="session-${teamId}.csv"`)
      }
      return res.status(200).send(result)
    }

    res.status(200).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export session'

    if (message.includes('required') || message.includes('Unsupported format')) {
      return res.status(400).json({ error: message })
    }

    console.error('[ExportRoutes] GET /session/:teamId error:', error)
    res.status(500).json({ error: message })
  }
})

export default router
