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
export function errorHandler(err, req, res, next) {
    console.error('[ERROR] Full error details:', err);
    console.error('[ERROR] Stack:', err.stack);
    // Prisma errors - type guard for PrismaClientKnownRequestError
    if ('code' in err && typeof err.code === 'string' && err.code.startsWith('P')) {
        console.error('[ERROR] Prisma error code:', err.code);
        switch (err.code) {
            case 'P2002':
                return res.status(409).json({ error: 'Resource already exists' });
            case 'P2025':
                return res.status(404).json({ error: 'Resource not found' });
            default:
                return res.status(500).json({ error: 'Database error', details: err.message });
        }
    }
    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }
    // Default error
    res.status(500).json({ error: 'Internal server error', message: err.message });
}
