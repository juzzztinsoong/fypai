import { api, getErrorMessage } from './api'
import { useSessionStore } from '@/stores/sessionStore'
import type { ResearchRun } from '@/stores/sessionStore'

interface CreateResearchJobRequest {
  teamId: string
  query: string
}

export async function createResearchJob(data: CreateResearchJobRequest): Promise<ResearchRun> {
  try {
    const response = await api.post<ResearchRun>('/research/jobs', data)
    useSessionStore.getState().upsertResearchRun(response.data)
    return response.data
  } catch (error) {
    console.error('[ResearchJobService] Failed to create research job:', getErrorMessage(error))
    throw error
  }
}

export async function getResearchJobs(teamId: string): Promise<ResearchRun[]> {
  try {
    const response = await api.get<ResearchRun[]>('/research/jobs', {
      params: { teamId },
    })

    useSessionStore.getState().setResearchRuns(teamId, response.data)
    return response.data
  } catch (error) {
    console.error(`[ResearchJobService] Failed to fetch research jobs for team ${teamId}:`, getErrorMessage(error))
    throw error
  }
}

export default {
  createResearchJob,
  getResearchJobs,
}
