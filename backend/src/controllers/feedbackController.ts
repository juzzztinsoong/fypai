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
}
