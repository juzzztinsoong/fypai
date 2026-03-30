/**
 * AI Insight Routes
 * 
 * Tech Stack: Express Router
 * Pattern: RESTful API endpoints
 * 
 * Endpoints:
 *   GET    /api/insights?teamId=:id  - List AI insights for team
 *   POST   /api/insights              - Create new AI insight
 *   DELETE /api/insights/:id          - Delete AI insight
 * 
 * Request/Response Shapes:
 *   POST body: { teamId, type, title, content, priority?, tags?, relatedMessageIds? }
 *   Response: AIInsightDTO with parsed tags and relatedMessageIds arrays
 */

import { Router } from 'express'
import { AIInsightController } from '../controllers/aiInsightController.js'
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../db.js'

const router = Router()

const GENERATE_WINDOW_MS = parseInt(process.env.INSIGHT_GENERATE_WINDOW_MS || '60000', 10)
const GENERATE_MAX_REQUESTS = parseInt(process.env.INSIGHT_GENERATE_MAX_PER_WINDOW || '6', 10)
const generateRequestTimestamps: number[] = []

function applyGenerateRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now()
  const cutoff = now - GENERATE_WINDOW_MS

  while (generateRequestTimestamps.length > 0 && generateRequestTimestamps[0] < cutoff) {
    generateRequestTimestamps.shift()
  }

  if (generateRequestTimestamps.length >= GENERATE_MAX_REQUESTS) {
    const earliest = generateRequestTimestamps[0]
    const retryAfterMs = Math.max(0, GENERATE_WINDOW_MS - (now - earliest))
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))
    return res.status(429).json({
      error: 'Too many AI generation requests. Please retry shortly.',
      retryAfterSeconds,
    })
  }

  generateRequestTimestamps.push(now)
  next()
}

async function denyIfAiLight(teamId: string, res: Response): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, isChimeEnabled: true },
  })

  if (!team) {
    res.status(404).json({ error: 'Team not found' })
    return true
  }

  if (!team.isChimeEnabled) {
    res.status(403).json({
      error: 'This study condition supports explicit @agent chat only. AI insight generation is disabled.',
      code: 'AI_LIGHT_RESTRICTED',
    })
    return true
  }

  return false
}

/**
 * GET /api/insights?teamId=:id
 * Get all AI insights for a team
 */
router.get('/', async (req, res, next) => {
  try {
    const { teamId } = req.query
    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId is required' })
    }
    const insights = await AIInsightController.getInsights(teamId)
    res.json(insights)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/insights
 * Create a new AI insight
 */
router.post('/', async (req, res, next) => {
  try {
    const { teamId } = req.body || {}
    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId is required' })
    }
    if (await denyIfAiLight(teamId, res)) {
      return
    }

    const insight = await AIInsightController.createInsight(req.body)
    res.status(201).json(insight)
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/insights/:id/status
 * Update insight lifecycle status (Sprint D - Part 2)
 */
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { status, userId } = req.body
    if (!status || !userId) {
      return res.status(400).json({ error: 'status and userId are required' })
    }
    const validStatuses = ['new', 'reviewed', 'accepted', 'dismissed', 'archived']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }
    const insight = await AIInsightController.updateInsightStatus(id, { status, userId })
    res.json(insight)
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/insights/:id
 * Update insight fields (Sprint D - Part 3: Mutable Action Items)
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const insight = await AIInsightController.updateInsight(id, req.body)
    res.json(insight)
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/insights/team/:teamId
 * Reset team insights by deleting all AI insights for team
 */
router.delete('/team/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params
    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId is required' })
    }

    const deletedInsightIds = await AIInsightController.deleteInsightsByTeam(teamId)
    res.json({ teamId, deletedCount: deletedInsightIds.length, deletedInsightIds })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/insights/:id
 * Delete an AI insight
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await AIInsightController.deleteInsight(id)
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/insights/generate/summary
 * Generate AI-powered conversation summary as insight
 */
router.post('/generate/summary', applyGenerateRateLimit, async (req, res, next) => {
  try {
    const { teamId, archetype } = req.body
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' })
    }
    if (await denyIfAiLight(teamId, res)) {
      return
    }
    const insight = await AIInsightController.generateSummary(teamId, archetype)
    res.status(201).json(insight)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/insights/generate/report
 * Generate AI-powered discussion report as insight
 */
router.post('/generate/report', applyGenerateRateLimit, async (req, res, next) => {
  try {
    const { teamId, prompt, archetype } = req.body
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' })
    }
    if (await denyIfAiLight(teamId, res)) {
      return
    }
    const insight = await AIInsightController.generateReport(teamId, prompt, archetype)
    res.status(201).json(insight)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/insights/generate/action
 * Generate deterministic action-item insight
 */
router.post('/generate/action', async (req, res, next) => {
  try {
    const { teamId, prompt, archetype } = req.body
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' })
    }
    if (await denyIfAiLight(teamId, res)) {
      return
    }
    const insight = await AIInsightController.generateAction(teamId, prompt, archetype)
    res.status(201).json(insight)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/insights/generate/suggestion
 * Generate deterministic suggestion insight
 */
router.post('/generate/suggestion', async (req, res, next) => {
  try {
    const { teamId, prompt, archetype } = req.body
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' })
    }
    if (await denyIfAiLight(teamId, res)) {
      return
    }
    const insight = await AIInsightController.generateSuggestion(teamId, prompt, archetype)
    res.status(201).json(insight)
  } catch (error) {
    next(error)
  }
})

export default router
