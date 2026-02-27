/**
 * InsightStatusBadge Component (Sprint D - Part 2)
 * 
 * Visual indicator for insight lifecycle status.
 * Shows colored badge with status label.
 */
import type { InsightStatus } from '@fypai/types';

interface InsightStatusBadgeProps {
  status?: InsightStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<InsightStatus, { label: string; className: string }> = {
  new: {
    label: 'New',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  reviewed: {
    label: 'Reviewed',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  dismissed: {
    label: 'Dismissed',
    className: 'bg-gray-100 text-gray-500 border-gray-200',
  },
  archived: {
    label: 'Archived',
    className: 'bg-gray-100 text-gray-400 border-gray-200',
  },
};

export const InsightStatusBadge = ({ status = 'new', size = 'sm' }: InsightStatusBadgeProps) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <span className={`inline-flex items-center rounded border font-medium ${config.className} ${sizeClass}`}>
      {config.label}
    </span>
  );
};
