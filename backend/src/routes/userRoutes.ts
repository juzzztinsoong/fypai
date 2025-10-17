/**
 * User Routes
 * 
 * Tech Stack: Express Router
 * Pattern: RESTful API endpoints
 * 
 * Endpoints:
 *   GET    /api/users              - List all users
 *   GET    /api/users/:id          - Get single user
 *   POST   /api/users              - Create new user
 *   PATCH  /api/users/:id          - Update user
 *   DELETE /api/users/:id          - Delete user
 * 
 * Request/Response Shapes:
 *   POST body: { name, email?, avatar?, role }
 *   PATCH body: { name?, avatar?, role? }
 */

import { Router } from 'express'
import { UserController } from '../controllers/userController.js'
import { Request, Response, NextFunction } from 'express'

const router = Router()

/**
 * GET /api/users
 * Get all users (consider adding pagination in production)
 */
router.get('/', async (req, res, next) => {
  try {
    const users = await UserController.getAllUsers()
    res.json(users)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/users/:id
 * Get single user by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const user = await UserController.getUserById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(user)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', async (req, res, next) => {
  try {
    console.log('[POST /api/users] Request body:', req.body)
    const user = await UserController.createUser(req.body)
    console.log('[POST /api/users] Created user:', user)
    res.status(201).json(user)
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/users/:id
 * Update user details
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const user = await UserController.updateUser(id, req.body)
    res.json(user)
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/users/:id
 * Delete a user
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await UserController.deleteUser(id)
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router