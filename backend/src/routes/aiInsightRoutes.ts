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

const router = Router()

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
router.post('/generate/summary', async (req, res, next) => {
  try {
    const { teamId } = req.body
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' })
    }
    const insight = await AIInsightController.generateSummary(teamId)
    res.status(201).json(insight)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/insights/generate/report
 * Generate AI-powered discussion report as insight
 */
router.post('/generate/report', async (req, res, next) => {
  try {
    const { teamId, prompt } = req.body
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' })
    }
    const insight = await AIInsightController.generateReport(teamId, prompt)
    res.status(201).json(insight)
  } catch (error) {
    next(error)
  }
})

export default router
