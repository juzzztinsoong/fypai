/**
 * ActionItemControls Component (Sprint D - Part 3)
 * 
 * Inline controls for mutable action items: assignee, due date, priority.
 * Only shown on action-type insights that have been accepted.
 */
import { useState, useCallback } from 'react';
import type { AIInsightDTO, ActionPriority } from '@fypai/types';
import { updateInsight } from '@/services/insightService';

interface ActionItemControlsProps {
  insight: AIInsightDTO;
}

const PRIORITY_OPTIONS: { value: ActionPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-gray-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' },
];

export const ActionItemControls = ({ insight }: ActionItemControlsProps) => {
  const [saving, setSaving] = useState(false);

  const handlePriorityChange = useCallback(async (priority: ActionPriority) => {
    setSaving(true);
    try {
      await updateInsight(insight.id, { actionPriority: priority });
    } catch (error) {
      console.error('[ActionItemControls] Failed to update priority:', error);
    } finally {
      setSaving(false);
    }
  }, [insight.id]);

  const handleDueDateChange = useCallback(async (dateStr: string) => {
    setSaving(true);
    try {
      const dueDate = dateStr ? new Date(dateStr).toISOString() : null;
      await updateInsight(insight.id, { dueDate });
    } catch (error) {
      console.error('[ActionItemControls] Failed to update due date:', error);
    } finally {
      setSaving(false);
    }
  }, [insight.id]);

  const handleToggleComplete = useCallback(async () => {
    setSaving(true);
    try {
      const completedAt = insight.completedAt ? null : new Date().toISOString();
      await updateInsight(insight.id, { completedAt });
    } catch (error) {
      console.error('[ActionItemControls] Failed to toggle completion:', error);
    } finally {
      setSaving(false);
    }
  }, [insight.id, insight.completedAt]);

  const isCompleted = !!insight.completedAt;
  const isOverdue = insight.dueDate && !isCompleted && new Date(insight.dueDate) < new Date();

  // Format due date for input
  const dueDateValue = insight.dueDate 
    ? new Date(insight.dueDate).toISOString().split('T')[0]
    : '';

  return (
    <div className={`mt-3 pt-3 border-t border-gray-100 space-y-2 ${saving ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Completion toggle */}
        <button
          onClick={handleToggleComplete}
          disabled={saving}
          className={`h-8 inline-flex items-center space-x-1.5 px-2.5 rounded-md text-xs font-medium transition-colors ${
            isCompleted
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span>{isCompleted ? '✅' : '⬜'}</span>
          <span>{isCompleted ? 'Completed' : 'Mark complete'}</span>
        </button>

        {/* Priority selector */}
        <select
          value={insight.actionPriority || ''}
          onChange={(e) => handlePriorityChange(e.target.value as ActionPriority)}
          disabled={saving}
          className="h-8 text-xs px-2.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">Priority...</option>
          {PRIORITY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Due date */}
        <div className="flex items-center space-x-1">
          <span className="text-xs text-gray-500">📅</span>
          <input
            type="date"
            value={dueDateValue}
            onChange={(e) => handleDueDateChange(e.target.value)}
            disabled={saving}
            className={`h-8 text-xs px-2.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 ${
              isOverdue ? 'border-red-300 text-red-600' : 'border-gray-200'
            }`}
          />
        </div>
      </div>

      {/* Overdue warning */}
      {isOverdue && (
        <p className="text-xs text-red-500 font-medium">⚠ Overdue</p>
      )}
    </div>
  );
};
