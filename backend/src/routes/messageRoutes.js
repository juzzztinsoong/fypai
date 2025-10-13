/**
 * Message Routes
 * 
 * Tech Stack: Express Router
 * Pattern: RESTful API endpoints
 * 
 * Endpoints:
 *   GET    /api/messages?teamId=:id  - List messages for team
 *   POST   /api/messages              - Create new message
 *   PATCH  /api/messages/:id          - Update message
 *   DELETE /api/messages/:id          - Delete message
 * 
 * Request/Response Shapes:
 *   POST body: { teamId, authorId, content, contentType, metadata? }
 *   PATCH body: { content }
 */

import { Router } from 'express'
import { MessageController } from '../controllers/messageController.js'

const router = Router()

/**
 * GET /api/messages?teamId=:id
 * Get all messages for a team
 */
router.get('/', async (req, res, next) => {
  try {
    const { teamId } = req.query
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' })
    }
    const messages = await MessageController.getMessages(teamId)
    res.json(messages)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/messages
 * Create a new message
 */
router.post('/', async (req, res, next) => {
  try {
    const message = await MessageController.createMessage(req.body)
    res.status(201).json(message)
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/messages/:id
 * Update message content
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { content } = req.body
    const message = await MessageController.updateMessage(id, content)
    res.json(message)
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/messages/:id
 * Delete a message
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await MessageController.deleteMessage(id)
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router