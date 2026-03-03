import { Server as SocketIOServer } from 'socket.io'
import { prisma } from '../db.js'
import { AIInsightController } from './aiInsightController.js'

interface ResearchJobDTO {
  id: string
  teamId: string
  query: string
  status: 'queued' | 'running' | 'done' | 'failed'
  error?: string
  insightId?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  finishedAt?: string
}

export class ResearchJobController {
  private static io: SocketIOServer | null = null

  private static getResearchJobModel(): any {
    return (prisma as any).researchJob
  }

  static setSocketIO(io: SocketIOServer): void {
    this.io = io
    console.log('[ResearchJobController] ✅ Socket.IO instance configured for research job broadcasts')
  }

  private static toDTO(job: {
    id: string
    teamId: string
    query: string
    status: string
    error: string | null
    insightId: string | null
    createdAt: Date
    updatedAt: Date
    startedAt: Date | null
    finishedAt: Date | null
  }): ResearchJobDTO {
    return {
      id: job.id,
      teamId: job.teamId,
      query: job.query,
      status: job.status as ResearchJobDTO['status'],
      error: job.error || undefined,
      insightId: job.insightId || undefined,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      finishedAt: job.finishedAt?.toISOString(),
    }
  }

  private static emitJobUpdate(job: ResearchJobDTO): void {
    if (!this.io) return

    this.io.to(`team:${job.teamId}`).emit('research:job:updated', job)
    console.log(`[ResearchJobController] 📡 Broadcasted research:job:updated (${job.status}) for team: ${job.teamId}`)
  }

  static async getJobs(teamId: string): Promise<ResearchJobDTO[]> {
    const jobs = await this.getResearchJobModel().findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return jobs.map((job: any) => this.toDTO(job))
  }

  static async createJob(teamId: string, query: string): Promise<ResearchJobDTO> {
    const job = await this.getResearchJobModel().create({
      data: {
        teamId,
        query,
        status: 'queued',
      },
    })

    const jobDTO = this.toDTO(job)
    this.emitJobUpdate(jobDTO)

    void this.processJob(job.id)

    return jobDTO
  }

  private static async processJob(jobId: string): Promise<void> {
    const queuedJob = await this.getResearchJobModel().findUnique({ where: { id: jobId } })
    if (!queuedJob) return

    const runningJob = await this.getResearchJobModel().update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date(),
        error: null,
      },
    })
    this.emitJobUpdate(this.toDTO(runningJob))

    const researchPrompt = `Create a focused research brief for this user request from the ongoing team context.

User research request:
${runningJob.query}

Output requirements:
- Summarize relevant background and assumptions
- Compare practical options with tradeoffs
- Recommend a path forward with rationale
- Call out risks, unknowns, and validation steps
- Keep it concise and highly actionable
- Do not include task checklists or assignee/deadline formatting`

    try {
      const insight = await AIInsightController.generateReport(runningJob.teamId, researchPrompt)

      const completedJob = await this.getResearchJobModel().update({
        where: { id: jobId },
        data: {
          status: 'done',
          insightId: insight.id,
          finishedAt: new Date(),
          error: null,
        },
      })

      this.emitJobUpdate(this.toDTO(completedJob))
    } catch (error) {
      const failedJob = await this.getResearchJobModel().update({
        where: { id: jobId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : 'Research job failed',
        },
      })

      this.emitJobUpdate(this.toDTO(failedJob))
      console.error('[ResearchJobController] ❌ Job failed:', error)
    }
  }
}
