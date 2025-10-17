/**
 * AI Insight Controller
 *
 * Tech Stack: Express, Prisma, @fypai/types
 * Pattern: Controller handles business logic, routes delegate to controller
 *
 * Methods:
 *   - getInsights(teamId: string): Get all AI insights for a team (returns AIInsightDTO[])
 *   - createInsight(data: CreateAIInsightRequest): Create new insight (returns AIInsightDTO)
 *   - deleteInsight(id: string): Delete insight
 *
 * Architecture:
 *   - Uses Prisma entity types for database operations
 *   - Transforms to DTO types using aiInsightToDTO() before returning
 *   - Returns API-friendly types with ISO strings and parsed JSON arrays
 *   - Handles tags and relatedMessageIds as JSON arrays
 */
import { prisma } from '../db.js';
import { aiInsightToDTO, aiInsightsToDTO } from '../types.js';
export class AIInsightController {
    /**
     * Get all AI insights for a team
     * @param {string} teamId - Team ID
     * @returns {Promise<AIInsightDTO[]>} Array of AI insight DTOs
     */
    static async getInsights(teamId) {
        const insights = await prisma.aIInsight.findMany({
            where: { teamId },
            orderBy: { createdAt: 'desc' }
        });
        return aiInsightsToDTO(insights);
    }
    /**
     * Create a new AI insight
     * @param {CreateAIInsightRequest} data - Insight data
     * @returns {Promise<AIInsightDTO>} Created insight DTO
     */
    static async createInsight(data) {
        const insight = await prisma.aIInsight.create({
            data: {
                teamId: data.teamId,
                type: data.type,
                title: data.title,
                content: data.content,
                priority: data.priority || null,
                tags: data.tags ? JSON.stringify(data.tags) : null,
                relatedMessageIds: data.relatedMessageIds ? JSON.stringify(data.relatedMessageIds) : null
            }
        });
        return aiInsightToDTO(insight);
    }
    /**
     * Delete an AI insight
     * @param {string} id - Insight ID
     * @returns {Promise<void>}
     */
    static async deleteInsight(id) {
        await prisma.aIInsight.delete({
            where: { id }
        });
    }
}
