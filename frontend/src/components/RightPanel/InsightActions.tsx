/**
 * InsightActions Component (Sprint D - Part 2)
 * 
 * Action buttons for insight lifecycle management.
 * Shows contextual actions based on current status.
 */
import { useState } from 'react';
import type { InsightStatus } from '@fypai/types';
import { updateInsightStatus } from '@/services/insightService';

interface InsightActionsProps {
  insightId: string;
  status?: InsightStatus;
  userId?: string;
}

/** Which transitions are available from each status */
const AVAILABLE_ACTIONS: Record<InsightStatus, { status: InsightStatus; label: string; icon: string; className: string }[]> = {
  new: [
    { status: 'accepted', label: 'Accept', icon: '✓', className: 'text-green-600 hover:bg-green-50' },
    { status: 'dismissed', label: 'Dismiss', icon: '✕', className: 'text-gray-500 hover:bg-gray-100' },
  ],
  reviewed: [
    { status: 'accepted', label: 'Accept', icon: '✓', className: 'text-green-600 hover:bg-green-50' },
    { status: 'dismissed', label: 'Dismiss', icon: '✕', className: 'text-gray-500 hover:bg-gray-100' },
  ],
  accepted: [
    { status: 'archived', label: 'Archive', icon: '📦', className: 'text-gray-500 hover:bg-gray-100' },
  ],
  dismissed: [
    { status: 'new', label: 'Restore', icon: '↩', className: 'text-blue-600 hover:bg-blue-50' },
  ],
  archived: [
    { status: 'new', label: 'Restore', icon: '↩', className: 'text-blue-600 hover:bg-blue-50' },
  ],
};

export const InsightActions = ({ insightId, status = 'new', userId = 'user1' }: InsightActionsProps) => {
  const [loading, setLoading] = useState(false);
  const actions = AVAILABLE_ACTIONS[status] || AVAILABLE_ACTIONS.new;

  const handleAction = async (newStatus: InsightStatus) => {
    setLoading(true);
    try {
      await updateInsightStatus(insightId, newStatus, userId);
    } catch (error) {
      console.error('[InsightActions] Failed to update status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (actions.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {actions.map(({ status: newStatus, label, icon, className }) => (
        <button
          key={newStatus}
          onClick={(e) => {
            e.stopPropagation();
            handleAction(newStatus);
          }}
          disabled={loading}
          className={`h-8 px-2.5 rounded-md text-xs font-medium transition-colors ${className} ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title={label}
        >
          <span className="mr-0.5">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
};
