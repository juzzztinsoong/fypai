/**
 * RightPanel Module Exports
 * 
 * Centralized exports for all RightPanel components and utilities.
 * This makes imports cleaner throughout the application.
 */

// Main component
export { RightPanel } from './RightPanel';

// Sub-components
export { EmptyState } from './EmptyState';
export { RightPanelHeader } from './RightPanelHeader';
export { InsightFilters } from './InsightFilters';
export { InsightsList } from './InsightsList';
export { InsightCard } from './InsightCard';
export { InsightTypeIcon } from './InsightTypeIcon';
export { PriorityBadge } from './PriorityBadge';
export { AIToggle } from './AIToggle';
export { ActionButtons } from './ActionButtons';

// Utilities and hooks
export { getInsightTypeColor, getInsightTypeCounts } from './insightUtils';
export { useActionHandlers } from './useActionHandlers';
