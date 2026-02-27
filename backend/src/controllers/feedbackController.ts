import { prisma } from '../db.js'
import { Prisma } from '@prisma/client'
import type { CreateFeedbackRequest, FeedbackDTO, FeedbackType, FeedbackReason, FeedbackRuleAction } from '../types.js'

const FEEDBACK_TYPES: FeedbackType[] = ['positive', 'negative']
const FEEDBACK_REASONS: FeedbackReason[] = [
  'irrelevant',
  'incorrect',
  'too-verbose',
  'too-brief',
  'misunderstood',
  'other',
]
const FEEDBACK_RULE_ACTIONS: FeedbackRuleAction[] = ['reduce-frequency', 'disable', 'none']

export class FeedbackController {
  static async createFeedback(data: CreateFeedbackRequest): Promise<FeedbackDTO> {
    if (!data.messageId || !data.userId || !data.type) {
      throw new Error('messageId, userId, and type are required')
    }

    if (!FEEDBACK_TYPES.includes(data.type)) {
      throw new Error('Invalid feedback type')
    }

    if (data.reason && !FEEDBACK_REASONS.includes(data.reason)) {
      throw new Error('Invalid feedback reason')
    }

    if (data.ruleAction && !FEEDBACK_RULE_ACTIONS.includes(data.ruleAction)) {
      throw new Error('Invalid feedback ruleAction')
    }

    if (data.type === 'negative' && data.reason === undefined && !data.comment?.trim()) {
      throw new Error('Negative feedback should include a reason or comment')
    }

    const message = await prisma.message.findUnique({ where: { id: data.messageId } })
    if (!message) {
      throw new Error('Message not found')
    }

    const user = await prisma.user.findUnique({ where: { id: data.userId } })
    if (!user) {
      throw new Error('User not found')
    }

    let feedback
    try {
      feedback = await prisma.feedback.create({
        data: {
          messageId: data.messageId,
          userId: data.userId,
          type: data.type,
          reason: data.reason ?? null,
          comment: data.comment?.trim() || null,
          ruleId: data.ruleId ?? null,
          ruleAction: data.ruleAction ?? null,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
        throw new Error('Database schema is outdated. Run: npx prisma migrate dev')
      }
      throw error
    }

    // Sprint D - Part 4: Act on ruleAction for chime feedback
    if (data.ruleId && data.ruleAction && data.ruleAction !== 'none') {
      try {
        await FeedbackController.applyRuleAction(data.ruleId, data.ruleAction, message.teamId)
      } catch (error) {
        console.error('[FeedbackController] Failed to apply rule action:', error)
        // Don't throw — feedback was still saved successfully
      }
    }

    return {
      id: feedback.id,
      messageId: feedback.messageId,
      userId: feedback.userId,
      type: feedback.type as FeedbackType,
      reason: (feedback.reason || undefined) as FeedbackReason | undefined,
      comment: feedback.comment || undefined,
      ruleId: feedback.ruleId || undefined,
      ruleAction: (feedback.ruleAction || undefined) as FeedbackRuleAction | undefined,
      createdAt: feedback.createdAt.toISOString(),
    }
  }

  /**
   * Apply rule action from user feedback (Sprint D - Part 4)
   * - reduce-frequency: multiply cooldown by 1.5
   * - disable: set enabled = false
   */
  private static async applyRuleAction(
    ruleId: string,
    action: FeedbackRuleAction,
    teamId: string
  ): Promise<void> {
    // Check if rule exists in DB (team override)
    const existingRule = await prisma.chimeRule.findUnique({ where: { id: ruleId } })

    if (action === 'reduce-frequency') {
      if (existingRule) {
        // Update existing rule's cooldown
        await prisma.chimeRule.update({
          where: { id: ruleId },
          data: { cooldownMinutes: Math.round(existingRule.cooldownMinutes * 1.5) },
        })
        console.log(`[FeedbackController] ⏱ Rule ${ruleId} cooldown increased to ${Math.round(existingRule.cooldownMinutes * 1.5)}min`)
      } else {
        // Create team override with increased cooldown (default system rules have 15min cooldown)
        await prisma.chimeRule.create({
          data: {
            id: ruleId,
            name: `Override: ${ruleId}`,
            type: 'pattern',
            enabled: true,
            priority: 50,
            cooldownMinutes: 23, // 15 * 1.5 rounded
            conditions: '{}',
            action: '{}',
            teamId,
          },
        })
        console.log(`[FeedbackController] ⏱ Created team override for rule ${ruleId} with 23min cooldown`)
      }
    } else if (action === 'disable') {
      if (existingRule) {
        await prisma.chimeRule.update({
          where: { id: ruleId },
          data: { enabled: false },
        })
        console.log(`[FeedbackController] 🚫 Rule ${ruleId} disabled`)
      } else {
        // Create disabled team override
        await prisma.chimeRule.create({
          data: {
            id: ruleId,
            name: `Override: ${ruleId}`,
            type: 'pattern',
            enabled: false,
            priority: 50,
            cooldownMinutes: 15,
            conditions: '{}',
            action: '{}',
            teamId,
          },
        })
        console.log(`[FeedbackController] 🚫 Created disabled team override for rule ${ruleId}`)
      }
    }
  }
}
