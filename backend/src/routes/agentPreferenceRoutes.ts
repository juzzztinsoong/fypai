/**
 * Agent Preferences Routes
 * 
 * Phase 6.5.2: Per-team AI agent customization
 * 
 * Endpoints:
 *   GET  /api/teams/:teamId/agent-preferences  - Get (or create default) preferences
 *   PUT  /api/teams/:teamId/agent-preferences  - Update preferences
 *   DELETE /api/teams/:teamId/agent-preferences - Reset to defaults
 */

import { Router } from 'express'
import { AgentPreferencesService } from '../services/agentPreferencesService.js'

const router = Router()

/**
 * GET /api/teams/:teamId/agent-preferences
 * Returns current preferences (creates defaults if none exist)
 */
router.get('/teams/:teamId/agent-preferences', async (req, res) => {
  try {
    const { teamId } = req.params
    const prefs = await AgentPreferencesService.getOrCreate(teamId)
    res.json({ data: prefs })
  } catch (error) {
    console.error('[AgentPreferencesRoutes] GET error:', error)
    res.status(500).json({ error: 'Failed to get agent preferences' })
  }
})

/**
 * PUT /api/teams/:teamId/agent-preferences
 * Update one or more preference fields
 */
router.put('/teams/:teamId/agent-preferences', async (req, res) => {
  try {
    const { teamId } = req.params
    const updates = req.body
    const prefs = await AgentPreferencesService.update(teamId, updates)
    res.json({ data: prefs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update agent preferences'
    // Validation errors return 400
    if (message.startsWith('Invalid')) {
      res.status(400).json({ error: message })
    } else {
      console.error('[AgentPreferencesRoutes] PUT error:', error)
      res.status(500).json({ error: message })
    }
  }
})

/**
 * DELETE /api/teams/:teamId/agent-preferences
 * Reset preferences to defaults
 */
router.delete('/teams/:teamId/agent-preferences', async (req, res) => {
  try {
    const { teamId } = req.params
    await AgentPreferencesService.reset(teamId)
    res.json({ message: 'Preferences reset to defaults' })
  } catch (error) {
    console.error('[AgentPreferencesRoutes] DELETE error:', error)
    res.status(500).json({ error: 'Failed to reset agent preferences' })
  }
})

export default router
