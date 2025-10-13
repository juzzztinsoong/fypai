# RightPanel Component Hierarchy

## Visual Structure

```
┌─────────────────────────────────────────────────────────┐
│                      RightPanel                         │
│  (Main container - manages state & data fetching)      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           RightPanelHeader                        │ │
│  │  (Team name + insight count)                      │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           InsightFilters                          │ │
│  │  (Filter tabs: All, Summary, Actions, etc.)      │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           InsightsList                            │ │
│  │  (Scrollable container)                           │ │
│  │                                                   │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │         InsightCard                         │ │ │
│  │  │  ┌──────────────┐  ┌──────────────────┐    │ │ │
│  │  │  │InsightType   │  │  PriorityBadge   │    │ │ │
│  │  │  │Icon          │  │                  │    │ │ │
│  │  │  └──────────────┘  └──────────────────┘    │ │ │
│  │  │  Content + Tags                            │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  │                                                   │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │         InsightCard                         │ │ │
│  │  │  ┌──────────────┐  ┌──────────────────┐    │ │ │
│  │  │  │InsightType   │  │  PriorityBadge   │    │ │ │
│  │  │  │Icon          │  │                  │    │ │ │
│  │  │  └──────────────┘  └──────────────────┘    │ │ │
│  │  │  Content + Tags                            │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  │                                                   │ │
│  │  ... (more InsightCards)                         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           Footer (Action Controls)                │ │
│  │                                                   │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │           AIToggle                          │ │ │
│  │  │  (Toggle switch + status text)              │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  │                                                   │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │           ActionButtons                     │ │ │
│  │  │  ┌────────┐  ┌────────┐                    │ │ │
│  │  │  │ Audio  │  │ Video  │                    │ │ │
│  │  │  └────────┘  └────────┘                    │ │ │
│  │  │  ┌────────┐  ┌────────┐                    │ │ │
│  │  │  │ Report │  │Mindmap │                    │ │ │
│  │  │  └────────┘  └────────┘                    │ │ │
│  │  │  ┌────────┐  ┌────────┐                    │ │ │
│  │  │  │ Export │  │ Share  │                    │ │ │
│  │  │  └────────┘  └────────┘                    │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Empty State (No Team Selected)

```
┌─────────────────────────────────────────────────────────┐
│                     EmptyState                          │
│  (Displayed when currentTeam is null)                   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │           "AI Insights"                           │ │
│  │                                                   │ │
│  │     Select a team to view AI-generated            │ │
│  │     insights and recommendations                  │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           Footer (Action Controls)                │ │
│  │                                                   │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │           AIToggle                          │ │ │
│  │  │  (Toggle switch + status text)              │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  │                                                   │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │           ActionButtons (All Disabled)      │ │ │
│  │  │  ┌────────┐  ┌────────┐  (Greyed out)      │ │ │
│  │  │  │ Audio  │  │ Video  │                    │ │ │
│  │  │  └────────┘  └────────┘                    │ │ │
│  │  │  ┌────────┐  ┌────────┐                    │ │ │
│  │  │  │ Report │  │Mindmap │                    │ │ │
│  │  │  └────────┘  └────────┘                    │ │ │
│  │  │  ┌────────┐  ┌────────┐                    │ │ │
│  │  │  │ Export │  │ Share  │                    │ │ │
│  │  │  └────────┘  └────────┘                    │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Component Communication Flow

```
┌────────────────┐
│   teamStore    │ ──→ currentTeam
└────────────────┘
                           │
                           ↓
┌────────────────┐    ┌─────────────────┐
│aiInsightsStore │ ──→│   RightPanel    │
│                │    │                 │
│ • insights     │    │ State:          │
│ • isAIEnabled  │    │ • selectedType  │
│ • toggleAI     │    │                 │
└────────────────┘    │ Computed:       │
                      │ • filteredInsights
                      │ • typeCounts    │
                      │ • actionHandlers│
                      └─────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ↓                     ↓                     ↓
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│ RightPanelHeader│  │  InsightFilters  │  │  InsightsList   │
│                 │  │                  │  │                 │
│ Props:          │  │ Props:           │  │ Props:          │
│ • teamName      │  │ • selectedType   │  │ • insights      │
│ • insightCount  │  │ • onTypeChange   │  │                 │
└─────────────────┘  │ • typeCounts     │  └─────────────────┘
                     └──────────────────┘           │
                                                    │
                                      ┌─────────────┴─────────────┐
                                      │                           │
                                      ↓                           ↓
                            ┌──────────────────┐      ┌──────────────────┐
                            │   InsightCard    │      │   Empty State    │
                            │                  │      │   (No insights)  │
                            │ Props:           │      └──────────────────┘
                            │ • insight        │
                            │                  │
                            │ Uses:            │
                            │ • InsightTypeIcon│
                            │ • PriorityBadge  │
                            └──────────────────┘

         ┌─────────────────────┴─────────────────────┐
         │                                           │
         ↓                                           ↓
┌─────────────────┐                        ┌─────────────────┐
│    AIToggle     │                        │  ActionButtons  │
│                 │                        │                 │
│ Props:          │                        │ Props:          │
│ • isEnabled     │                        │ • hasInsights   │
│ • onToggle      │                        │ • 6 handlers    │
└─────────────────┘                        └─────────────────┘
```

## File Dependencies

```
RightPanel.tsx
├── imports teamStore (useCurrentTeam)
├── imports aiInsightsStore (useAIInsightsStore)
├── imports useState from 'react'
├── imports RightPanelHeader
├── imports InsightFilters
├── imports InsightsList
├── imports AIToggle
├── imports ActionButtons
├── imports EmptyState
├── imports getInsightTypeCounts from insightUtils
├── imports useActionHandlers
└── exports RightPanel

EmptyState.tsx
├── imports AIToggle
├── imports ActionButtons
└── exports EmptyState

InsightsList.tsx
├── imports InsightCard
└── exports InsightsList

InsightCard.tsx
├── imports InsightTypeIcon
├── imports PriorityBadge
├── imports getInsightTypeColor from insightUtils
└── exports InsightCard

InsightFilters.tsx
└── exports InsightFilters

RightPanelHeader.tsx
└── exports RightPanelHeader

InsightTypeIcon.tsx
└── exports InsightTypeIcon

PriorityBadge.tsx
└── exports PriorityBadge

AIToggle.tsx
└── exports AIToggle

ActionButtons.tsx
└── exports ActionButtons

insightUtils.ts
├── exports getInsightTypeColor
└── exports getInsightTypeCounts

useActionHandlers.ts
└── exports useActionHandlers (custom hook)

index.ts
└── exports all components and utilities
```

## Benefits of This Architecture

1. **Single Responsibility**: Each component has one clear purpose
2. **Reusability**: Components like AIToggle, PriorityBadge can be reused elsewhere
3. **Testability**: Small, focused components are easier to unit test
4. **Maintainability**: Bugs are easier to locate and fix
5. **Readability**: Smaller files are easier to understand
6. **Scalability**: Easy to add new insight types or action buttons
7. **Performance**: Can optimize individual components without affecting others
8. **Type Safety**: Clear prop interfaces for each component
