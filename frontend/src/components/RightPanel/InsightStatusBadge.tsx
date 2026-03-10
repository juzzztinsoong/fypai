/**
 * InsightStatusBadge Component (Sprint D - Part 2)
 * 
 * Visual indicator for insight lifecycle status.
 * Shows colored badge with status label.
 */
import type { InsightStatus } from '@fypai/types';
import { getChipClass, type ChipVariant } from '@/styles/uiTokens';

interface InsightStatusBadgeProps {
  status?: InsightStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<InsightStatus, { label: string; variant: ChipVariant }> = {
  new: {
    label: 'New',
    variant: 'brand',
  },
  reviewed: {
    label: 'Reviewed',
    variant: 'warning',
  },
  accepted: {
    label: 'Accepted',
    variant: 'success',
  },
  dismissed: {
    label: 'Dismissed',
    variant: 'neutral',
  },
  archived: {
    label: 'Archived',
    variant: 'muted',
  },
};

export const InsightStatusBadge = ({ status = 'new', size = 'sm' }: InsightStatusBadgeProps) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const chipSize = size === 'sm' ? 'xs' : 'md';

  return (
    <span className={getChipClass(config.variant, chipSize)}>
      {config.label}
    </span>
  );
};
