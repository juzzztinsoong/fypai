/**
 * AI Insight Routes
 *
 * Tech Stack: Express Router
 * Pattern: RESTful API endpoints
 *
 * Endpoints:
 *   GET    /api/insights?teamId=:id  - List AI insights for team
 *   POST   /api/insights              - Create new AI insight
 *   DELETE /api/insights/:id          - Delete AI insight
 *
 * Request/Response Shapes:
 *   POST body: { teamId, type, title, content, priority?, tags?, relatedMessageIds? }
 *   Response: AIInsightDTO with parsed tags and relatedMessageIds arrays
 */
import { Router } from 'express';
import { AIInsightController } from '../controllers/aiInsightController.js';
const router = Router();
/**
 * GET /api/insights?teamId=:id
 * Get all AI insights for a team
 */
router.get('/', async (req, res, next) => {
    try {
        const { teamId } = req.query;
        if (!teamId || typeof teamId !== 'string') {
            return res.status(400).json({ error: 'teamId is required' });
        }
        const insights = await AIInsightController.getInsights(teamId);
        res.json(insights);
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/insights
 * Create a new AI insight
 */
router.post('/', async (req, res, next) => {
    try {
        const insight = await AIInsightController.createInsight(req.body);
        res.status(201).json(insight);
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /api/insights/:id
 * Delete an AI insight
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        await AIInsightController.deleteInsight(id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
export default router;
