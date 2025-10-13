interface PriorityBadgeProps {
  priority?: 'low' | 'medium' | 'high';
}

export const PriorityBadge = ({ priority }: PriorityBadgeProps) => {
  if (!priority) return null;
  
  const colors = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[priority]}`}>
      {priority.toUpperCase()}
    </span>
  );
};
