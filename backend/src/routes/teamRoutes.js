/**
 * Team Routes
 * 
 * Tech Stack: Express Router
 * Pattern: RESTful API endpoints
 * 
 * Endpoints:
 *   GET    /api/teams              - List all teams (filtered by user)
 *   GET    /api/teams/:id          - Get single team details
 *   POST   /api/teams              - Create new team
 *   PATCH  /api/teams/:id          - Update team
 *   DELETE /api/teams/:id          - Delete team
 *   POST   /api/teams/:id/members  - Add member to team
 *   DELETE /api/teams/:id/members/:userId - Remove member from team
 * 
 * Request/Response Shapes:
 *   POST body: { name, ownerId }
 *   PATCH body: { name? }
 *   POST /members body: { userId, teamRole? }
 */

import { Router } from 'express'
import { TeamController } from '../controllers/teamController.js'

const router = Router()

/**
 * GET /api/teams?userId=:id
 * Get all teams for a user
 */
router.get('/', async (req, res, next) => {
  try {
    const { userId } = req.query
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    const teams = await TeamController.getTeamsForUser(userId)
    res.json(teams)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/teams/:id
 * Get single team with members
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const team = await TeamController.getTeamById(id)
    if (!team) {
      return res.status(404).json({ error: 'Team not found' })
    }
    res.json(team)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/teams
 * Create a new team
 */
router.post('/', async (req, res, next) => {
  try {
    const team = await TeamController.createTeam(req.body)
    res.status(201).json(team)
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/teams/:id
 * Update team name
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { name } = req.body
    const team = await TeamController.updateTeam(id, name)
    res.json(team)
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/teams/:id
 * Delete a team
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await TeamController.deleteTeam(id)
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/teams/:id/members
 * Add member to team
 */
router.post('/:id/members', async (req, res, next) => {
  try {
    const { id } = req.params
    const { userId, teamRole } = req.body
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    const member = await TeamController.addMember(id, userId, teamRole)
    res.status(201).json(member)
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/teams/:id/members/:userId
 * Remove member from team
 */
router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const { id, userId } = req.params
    await TeamController.removeMember(id, userId)
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router