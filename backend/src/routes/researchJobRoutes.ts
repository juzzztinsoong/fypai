import { Router } from 'express'
import { ResearchJobController } from '../controllers/researchJobController.js'
import { prisma } from '../db.js'
import { Response } from 'express'

const router = Router()

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
      error: 'This study condition supports explicit @agent chat only. Research generation is disabled.',
      code: 'AI_LIGHT_RESTRICTED',
    })
    return true
  }

  return false
}

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

    if (await denyIfAiLight(teamId, res)) {
      return
    }

    const job = await ResearchJobController.createJob(teamId, query.trim())
    res.status(201).json(job)
  } catch (error) {
    next(error)
  }
})

export default router
