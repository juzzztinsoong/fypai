import { prisma } from '../db.js'
import { MessageController } from './messageController.js'
import { AIInsightController } from './aiInsightController.js'
import { SessionEventController } from './sessionEventController.js'
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
  static async exportSession(
    teamId: string,
    format: string = 'json',
    options?: { sessionId?: string }
  ) {
    if (!teamId) {
      throw new Error('teamId is required')
    }

    const validFormats = ['json', 'csv', 'timeline-json', 'metrics-csv']
    if (!validFormats.includes(format)) {
      throw new Error('Unsupported format. Use json, csv, timeline-json, or metrics-csv')
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

    const events = await SessionEventController.getEvents(teamId, {
      sessionId: options?.sessionId,
      limit: 5000,
    })

    const metrics = SessionEventController.computeMetrics(events, teamId, options?.sessionId)

    if (format === 'timeline-json') {
      return {
        teamId,
        sessionId: options?.sessionId,
        exportedAt: new Date().toISOString(),
        timeline: events,
        metrics,
      }
    }

    if (format === 'metrics-csv') {
      const headers = [
        'teamId',
        'sessionId',
        'windowStart',
        'windowEnd',
        'totalEvents',
        'uniqueUsers',
        'messageSentCount',
        'insightStatusChangeCount',
        'tabSwitchCount',
        'contextEditCount',
        'exportCount',
        'resetCount',
        'markerJumpCount',
        'timelineSyncCount',
        'linkHoverCount',
        'actionAcceptedCount',
        'actionDismissedCount',
        'actionCompletedCount',
        'avgSecondsBetweenEvents',
      ]

      const row = [
        csvEscape(metrics.teamId),
        csvEscape(metrics.sessionId),
        csvEscape(metrics.windowStart),
        csvEscape(metrics.windowEnd),
        csvEscape(metrics.totalEvents),
        csvEscape(metrics.uniqueUsers),
        csvEscape(metrics.messageSentCount),
        csvEscape(metrics.insightStatusChangeCount),
        csvEscape(metrics.tabSwitchCount),
        csvEscape(metrics.contextEditCount),
        csvEscape(metrics.exportCount),
        csvEscape(metrics.resetCount),
        csvEscape(metrics.markerJumpCount),
        csvEscape(metrics.timelineSyncCount),
        csvEscape(metrics.linkHoverCount),
        csvEscape(metrics.actionAcceptedCount),
        csvEscape(metrics.actionDismissedCount),
        csvEscape(metrics.actionCompletedCount),
        csvEscape(metrics.avgSecondsBetweenEvents),
      ]

      return [headers.join(','), row.join(',')].join('\n')
    }

    if (format === 'json') {
      return {
        teamId,
        sessionId: options?.sessionId,
        exportedAt: new Date().toISOString(),
        messages,
        insights,
        feedback,
        events,
        timeline: events,
        metrics,
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
