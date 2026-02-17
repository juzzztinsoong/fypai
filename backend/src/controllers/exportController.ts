import { prisma } from '../db.js'
import { MessageController } from './messageController.js'
import { AIInsightController } from './aiInsightController.js'
import { Prisma } from '@prisma/client'

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export class ExportController {
  static async exportSession(teamId: string, format: string = 'json') {
    if (!teamId) {
      throw new Error('teamId is required')
    }

    if (format !== 'json' && format !== 'csv') {
      throw new Error('Unsupported format. Use json or csv')
    }

    const [messages, insights] = await Promise.all([
      MessageController.getMessages(teamId),
      AIInsightController.getInsights(teamId),
    ])

    let feedbackRows: Array<{
      id: string
      messageId: string
      userId: string
      type: string
      reason: string | null
      comment: string | null
      ruleId: string | null
      ruleAction: string | null
      createdAt: Date
    }> = []

    try {
      feedbackRows = await prisma.feedback.findMany({
        where: {
          message: { teamId },
        },
        orderBy: { createdAt: 'asc' },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
        console.warn('[ExportController] Feedback table not found. Exporting without feedback rows.')
        feedbackRows = []
      } else {
        throw error
      }
    }

    const feedback = feedbackRows.map((item) => ({
      id: item.id,
      messageId: item.messageId,
      userId: item.userId,
      type: item.type,
      reason: item.reason,
      comment: item.comment,
      ruleId: item.ruleId,
      ruleAction: item.ruleAction,
      createdAt: item.createdAt.toISOString(),
    }))

    if (format === 'json') {
      return {
        teamId,
        exportedAt: new Date().toISOString(),
        messages,
        insights,
        feedback,
      }
    }

    const headers = [
      'messageId',
      'messageCreatedAt',
      'messageAuthorId',
      'messageContent',
      'agentModel',
      'agentTier',
      'agentTokensInput',
      'agentTokensOutput',
      'feedbackId',
      'feedbackUserId',
      'feedbackType',
      'feedbackReason',
      'feedbackComment',
      'feedbackRuleId',
      'feedbackRuleAction',
      'feedbackCreatedAt',
    ]

    const feedbackByMessage = new Map<string, typeof feedback>()
    for (const item of feedback) {
      const list = feedbackByMessage.get(item.messageId) || []
      list.push(item)
      feedbackByMessage.set(item.messageId, list)
    }

    const rows: string[] = [headers.join(',')]

    for (const message of messages) {
      const messageFeedback = feedbackByMessage.get(message.id) || [null]

      for (const fb of messageFeedback) {
        const row = [
          csvEscape(message.id),
          csvEscape(message.createdAt),
          csvEscape(message.authorId),
          csvEscape(message.content),
          csvEscape(message.agentMetadata?.model),
          csvEscape(message.agentMetadata?.tier),
          csvEscape(message.agentMetadata?.tokensUsed?.input),
          csvEscape(message.agentMetadata?.tokensUsed?.output),
          csvEscape(fb?.id),
          csvEscape(fb?.userId),
          csvEscape(fb?.type),
          csvEscape(fb?.reason),
          csvEscape(fb?.comment),
          csvEscape(fb?.ruleId),
          csvEscape(fb?.ruleAction),
          csvEscape(fb?.createdAt),
        ]

        rows.push(row.join(','))
      }
    }

    return rows.join('\n')
  }
}
