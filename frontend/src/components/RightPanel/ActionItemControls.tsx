/**
 * ActionItemControls Component (Sprint D - Part 3)
 * 
 * Inline controls for mutable action items.
 * Only shown on action-type insights that have been accepted.
 */
import { useState, useCallback } from 'react';
import type { AIInsightDTO } from '@fypai/types';
import { updateInsight } from '@/services/insightService';

interface ActionItemControlsProps {
  insight: AIInsightDTO;
}

export const ActionItemControls = ({ insight }: ActionItemControlsProps) => {
  const [saving, setSaving] = useState(false);

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

  return (
    <div className={`mt-4 pt-4 border-t border-gray-100 ${saving ? 'opacity-60' : ''}`}>
      <button
        onClick={handleToggleComplete}
        disabled={saving}
        className={`h-9 inline-flex items-center space-x-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
          isCompleted
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <span>{isCompleted ? '✅' : '⬜'}</span>
        <span>{isCompleted ? 'Completed' : 'Mark complete'}</span>
      </button>
    </div>
  );
};
