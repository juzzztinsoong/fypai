import { Router } from 'express'
import { FeedbackController } from '../controllers/feedbackController.js'

const router = Router()

/**
 * POST /api/feedback
 * Submit feedback for an AI message
 */
router.post('/feedback', async (req, res) => {
  try {
    const feedback = await FeedbackController.createFeedback(req.body)
    res.status(201).json(feedback)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create feedback'

    if (message.includes('schema is outdated')) {
      return res.status(503).json({ error: message })
    }

    if (
      message.includes('required') ||
      message.includes('Invalid') ||
      message.includes('not found')
    ) {
      return res.status(400).json({ error: message })
    }

    console.error('[FeedbackRoutes] POST /feedback error:', error)
    res.status(500).json({ error: message })
  }
})

export default router
