/**
 * RightPanel Module Exports
 * 
 * Centralized exports for all RightPanel components and utilities.
 * This makes imports cleaner throughout the application.
 */

// Main component
export { RightPanel } from './RightPanel';

// Sub-components
export { RightPanelHeader } from './RightPanelHeader';
export { InsightsList } from './InsightsList';
export { InsightCard } from './InsightCard';
export { InsightTypeIcon } from './InsightTypeIcon';
export { PriorityBadge } from './PriorityBadge';

// Utilities and hooks
export { getInsightTypeColor, getInsightTypeCounts } from './insightUtils';
