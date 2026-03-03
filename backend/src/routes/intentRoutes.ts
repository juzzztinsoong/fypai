import { Router } from 'express'
import { IntentController } from '../controllers/intentController.js'

const router = Router()

router.get('/override-rate', async (req, res, next) => {
  try {
    const teamId = req.query.teamId
    const hours = req.query.hours

    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId is required' })
    }

    const parsedHours = typeof hours === 'string' ? parseInt(hours, 10) : undefined
    const result = await IntentController.getOverrideRate(teamId, parsedHours)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

router.post('/classify', async (req, res, next) => {
  try {
    const { content, teamId } = req.body || {}

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' })
    }

    const result = await IntentController.classify(content, typeof teamId === 'string' ? teamId : undefined)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

export default router
