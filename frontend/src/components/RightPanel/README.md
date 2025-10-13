# RightPanel Components

This directory contains the modular components for the AI Insights panel (right column of the app).

## Architecture Overview

The RightPanel has been split into focused, single-responsibility components for better maintainability, testability, and reusability.

## Component Structure

```
RightPanel/
├── index.ts                    # Centralized exports
├── README.md                   # This file
│
├── RightPanel.tsx              # Main container component
├── EmptyState.tsx              # Display when no team selected
│
├── RightPanelHeader.tsx        # Team name and insight count
├── InsightFilters.tsx          # Filter tabs for insight types
├── InsightsList.tsx            # List container with empty state
├── InsightCard.tsx             # Individual insight display
├── InsightTypeIcon.tsx         # Type-specific icons
├── PriorityBadge.tsx           # Priority indicator badge
│
├── AIToggle.tsx                # AI assistant toggle switch
├── ActionButtons.tsx           # Action buttons footer
│
├── insightUtils.ts             # Utility functions
└── useActionHandlers.ts        # Custom hook for action handlers
```

## Component Responsibilities

### Main Components

#### **RightPanel.tsx**
- Main container and orchestrator
- Manages state (selected filter type)
- Fetches data from stores (team, insights, AI state)
- Renders header, filters, list, and footer
- Handles team-specific AI toggle

#### **EmptyState.tsx**
- Displayed when no team is selected
- Shows placeholder message
- Includes AI toggle and disabled action buttons

### Header & Info

#### **RightPanelHeader.tsx**
- Displays "AI Insights" title
- Shows current team name
- Shows insight count with pluralization

### Content Display

#### **InsightFilters.tsx**
- Renders filter tabs (All, Summary, Actions, etc.)
- Shows counts for each type
- Only shows tabs for types that have insights
- Handles filter selection

#### **InsightsList.tsx**
- Container for insight cards
- Renders empty state when no insights
- Maps insights to InsightCard components

#### **InsightCard.tsx**
- Displays individual insight
- Shows type icon, title, timestamp, priority
- Renders content (text or code with syntax highlighting)
- Displays tags

#### **InsightTypeIcon.tsx**
- Returns appropriate SVG icon for each insight type
- Types: summary, action-item, suggestion, analysis, code, document

#### **PriorityBadge.tsx**
- Displays priority level (low, medium, high)
- Color-coded styling
- Returns null if no priority

### Actions & Controls

#### **AIToggle.tsx**
- Toggle switch for AI assistant
- Shows enabled/disabled state
- Displays status text

#### **ActionButtons.tsx**
- Grid of 6 action buttons (2 columns × 3 rows)
- Audio Overview, Video Overview, Report, Mindmap, Export PDF, Share
- Buttons disabled when no insights available
- Color-coded styling for each action type

### Utilities & Hooks

#### **insightUtils.ts**
- `getInsightTypeColor()`: Returns Tailwind classes for each insight type
- `getInsightTypeCounts()`: Calculates counts for each insight type

#### **useActionHandlers.ts**
- Custom hook returning all action button handlers
- Handlers include: audio, video, report, mindmap, export, share
- Currently shows alerts (TODO: connect to backend)

## Props Interfaces

### InsightFilters
```typescript
{
  selectedType: AIInsight['type'] | 'all';
  onTypeChange: (type: AIInsight['type'] | 'all') => void;
  typeCounts: {
    all: number;
    summary: number;
    'action-item': number;
    suggestion: number;
    analysis: number;
    code: number;
    document: number;
  };
}
```

### InsightCard
```typescript
{
  insight: AIInsight;
}
```

### ActionButtons
```typescript
{
  hasInsights: boolean;
  teamName?: string;
  onAudioOverview: () => void;
  onVideoOverview: () => void;
  onGenerateReport: () => void;
  onGenerateMindmap: () => void;
  onExportPDF: () => void;
  onShareInsights: () => void;
}
```

### AIToggle
```typescript
{
  isEnabled: boolean;
  onToggle: () => void;
}
```

## Data Flow

1. **RightPanel** fetches current team and insights from stores
2. Calculates filtered insights based on selected type
3. Passes data down to child components via props
4. Child components are purely presentational (except RightPanel)
5. Action handlers defined in custom hook, passed to ActionButtons
6. AI toggle state managed per-team in aiInsightsStore

## Styling

- All components use Tailwind CSS
- Consistent color scheme:
  - Blue: Summary, Audio
  - Green: Action Items, Report
  - Purple: Suggestions, Video
  - Orange: Analysis, Mindmap
  - Red: Export PDF
  - Teal: Documents, Share
  - Gray: Code, disabled states

## State Management

- **Team state**: teamStore (current team selection)
- **Insights state**: aiInsightsStore (insights per team, AI enabled state)
- **Local state**: Filter selection (useState in RightPanel)

## Future Enhancements

- [ ] Connect action handlers to backend services
- [ ] Add loading states during AI generation
- [ ] Add insight editing/deletion
- [ ] Add insight sharing via email/link
- [ ] Add real code syntax highlighting
- [ ] Add markdown rendering for insight content
- [ ] Add insight search/filtering
- [ ] Add insight export formats (JSON, Markdown)
- [ ] Add insight versioning/history

## Testing Strategy

Each component should be unit tested separately:
- Test InsightCard rendering with different insight types
- Test InsightFilters with various counts
- Test ActionButtons enabled/disabled states
- Test AIToggle state changes
- Test InsightsList empty state
- Test EmptyState display

## Usage Example

```typescript
import { RightPanel } from './components/RightPanel';

// In your main layout:
<div className="flex">
  <Sidebar />
  <ChatWindow />
  <RightPanel />
</div>
```

## Debugging Tips

- Check browser console for action handler logs
- Use React DevTools to inspect component props
- Check teamStore for current team selection
- Check aiInsightsStore for insights data and AI state
- Verify filter type matches available insights
