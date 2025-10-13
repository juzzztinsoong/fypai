/**
 * Global Error Handler Middleware
 * 
 * Tech Stack: Express 4.18.2
 * Pattern: Centralized error handling
 * 
 * Usage:
 *   app.use(errorHandler)  // Must be last middleware
 * 
 * Handles:
 *   - Prisma errors (P2002 = unique constraint, etc.)
 *   - Validation errors
 *   - Generic server errors
 */

/**
 * Global error handler
 * @param {Error} err - Error object
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
export function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err)

  // Prisma errors
  if (err.code?.startsWith('P')) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({ error: 'Resource already exists' })
      case 'P2025':
        return res.status(404).json({ error: 'Resource not found' })
      default:
        return res.status(500).json({ error: 'Database error' })
    }
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message })
  }

  // Default error
  res.status(500).json({ error: 'Internal server error' })
}