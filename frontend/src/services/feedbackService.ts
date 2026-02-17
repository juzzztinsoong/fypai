import type { CreateFeedbackRequest, FeedbackDTO } from '@fypai/types'
import { api, getErrorMessage } from './api'

export async function submitFeedback(payload: CreateFeedbackRequest): Promise<FeedbackDTO> {
  try {
    const response = await api.post<FeedbackDTO>('/feedback', payload)
    return response.data
  } catch (error) {
    const message = getErrorMessage(error)
    console.error('[FeedbackService] Failed to submit feedback:', message)
    throw new Error(message)
  }
}

export default {
  submitFeedback,
}
