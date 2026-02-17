import { Router } from 'express'
import { ExportController } from '../controllers/exportController.js'

const router = Router()

/**
 * GET /api/export/session/:teamId?format=json|csv
 * Export session data for research analysis
 */
router.get('/session/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params
    const format = (req.query.format as string | undefined)?.toLowerCase() || 'json'

    const result = await ExportController.exportSession(teamId, format)

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="session-${teamId}.csv"`)
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
