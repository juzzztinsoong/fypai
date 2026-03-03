import { api, getErrorMessage } from './api'

export type IntentRouteMode = 'ask' | 'research'

export interface IntentClassificationResult {
  mode: IntentRouteMode
  confidence: number
  rationale: string
  classifierIntent: string
}

export async function classifyIntent(content: string, teamId?: string): Promise<IntentClassificationResult> {
  try {
    const response = await api.post<IntentClassificationResult>('/intent/classify', {
      content,
      teamId,
    })

    return response.data
  } catch (error) {
    console.error('[IntentService] Failed to classify intent:', getErrorMessage(error))
    throw error
  }
}

export default {
  classifyIntent,
}
