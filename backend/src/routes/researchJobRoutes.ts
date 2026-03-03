import { Router } from 'express'
import { ResearchJobController } from '../controllers/researchJobController.js'

const router = Router()

router.get('/jobs', async (req, res, next) => {
  try {
    const { teamId } = req.query
    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId is required' })
    }

    const jobs = await ResearchJobController.getJobs(teamId)
    res.json(jobs)
  } catch (error) {
    next(error)
  }
})

router.post('/jobs', async (req, res, next) => {
  try {
    const { teamId, query } = req.body

    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ error: 'teamId is required' })
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' })
    }

    const job = await ResearchJobController.createJob(teamId, query.trim())
    res.status(201).json(job)
  } catch (error) {
    next(error)
  }
})

export default router
