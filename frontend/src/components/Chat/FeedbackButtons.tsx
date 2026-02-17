import { useMemo, useState } from 'react'
import type { FeedbackReason, FeedbackRuleAction } from '@fypai/types'
import { submitFeedback } from '@/services/feedbackService'

interface FeedbackButtonsProps {
  messageId: string
  userId?: string
  chimeRuleId?: string
}

const REASON_OPTIONS: Array<{ value: FeedbackReason; label: string }> = [
  { value: 'irrelevant', label: 'Irrelevant to conversation' },
  { value: 'incorrect', label: 'Factually incorrect' },
  { value: 'too-verbose', label: 'Too verbose' },
  { value: 'too-brief', label: 'Too brief' },
  { value: 'misunderstood', label: "Didn't understand my question" },
  { value: 'other', label: 'Other' },
]

export const FeedbackButtons = ({ messageId, userId, chimeRuleId }: FeedbackButtonsProps) => {
  const [selected, setSelected] = useState<'positive' | 'negative' | null>(null)
  const [showNegativeDetails, setShowNegativeDetails] = useState(false)
  const [reason, setReason] = useState<FeedbackReason | ''>('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmitNegative = useMemo(() => {
    return reason !== '' || comment.trim().length > 0
  }, [reason, comment])

  const submitPositive = async () => {
    if (!userId || submitting || selected) return

    try {
      setSubmitting(true)
      setError(null)
      await submitFeedback({
        messageId,
        userId,
        type: 'positive',
      })
      setSelected('positive')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  const onNegativeClick = () => {
    if (!userId || submitting || selected) return
    setShowNegativeDetails(true)
    setSelected('negative')
  }

  const submitNegative = async () => {
    if (!userId || submitting || !canSubmitNegative) return

    try {
      setSubmitting(true)
      setError(null)

      const ruleAction: FeedbackRuleAction | undefined = chimeRuleId ? 'none' : undefined

      await submitFeedback({
        messageId,
        userId,
        type: 'negative',
        reason: reason || undefined,
        comment: comment.trim() || undefined,
        ruleId: chimeRuleId,
        ruleAction,
      })
      setShowNegativeDetails(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-2 w-full rounded-lg border border-purple-200 bg-white/80 px-3 py-2 text-purple-900">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">Was this helpful?</span>
        <button
          type="button"
          onClick={submitPositive}
          disabled={!userId || submitting || selected !== null}
          className={`rounded px-2 py-1 border transition-colors ${
            selected === 'positive'
              ? 'border-green-300 bg-green-100 text-green-700'
              : 'border-gray-200 hover:bg-gray-100'
          }`}
        >
          👍
        </button>
        <button
          type="button"
          onClick={onNegativeClick}
          disabled={!userId || submitting || selected !== null}
          className={`rounded px-2 py-1 border transition-colors ${
            selected === 'negative'
              ? 'border-red-300 bg-red-100 text-red-700'
              : 'border-gray-200 hover:bg-gray-100'
          }`}
        >
          👎
        </button>
        {selected === 'positive' && <span className="text-green-700">Thanks for your feedback.</span>}
      </div>

      {showNegativeDetails && (
        <div className="mt-2 space-y-2 text-xs">
          <label className="block">
            <span className="mb-1 block text-gray-700">Why was this not helpful?</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as FeedbackReason | '')}
              className="w-full rounded border border-gray-300 px-2 py-1"
            >
              <option value="">Select a reason</option>
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-gray-700">Optional comment</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full resize-none rounded border border-gray-300 px-2 py-1"
              placeholder="Tell us what was missing"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submitNegative}
              disabled={!canSubmitNegative || submitting}
              className="rounded bg-red-600 px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNegativeDetails(false)
                setSelected(null)
                setReason('')
                setComment('')
              }}
              disabled={submitting}
              className="rounded border border-gray-300 px-2 py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  )
}
