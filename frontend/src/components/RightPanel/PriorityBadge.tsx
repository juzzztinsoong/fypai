import { getChipClass, type ChipVariant } from '@/styles/uiTokens';

interface PriorityBadgeProps {
  priority?: 'low' | 'medium' | 'high';
}

export const PriorityBadge = ({ priority }: PriorityBadgeProps) => {
  if (!priority) return null;

  const variants: Record<NonNullable<PriorityBadgeProps['priority']>, ChipVariant> = {
    low: 'neutral',
    medium: 'warning',
    high: 'danger',
  };

  return (
    <span className={getChipClass(variants[priority], 'sm')}>
      {priority.toUpperCase()}
    </span>
  );
};
