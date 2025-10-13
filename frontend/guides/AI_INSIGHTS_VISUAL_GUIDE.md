# AI Insights - Quick Visual Guide

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Insights                                                    │
│  Sample Team • 3 insights                                       │
├─────────────────────────────────────────────────────────────────┤
│  [All (3)] [Summary (1)] [Actions (1)] [Suggestions (1)]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📄 Chat Summary                          [MEDIUM]       │   │
│  │ The team discussed project collaboration...             │   │
│  │ #meeting #collaboration                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✅ Action Items                          [HIGH]         │   │
│  │ • Schedule sync meeting for tomorrow                    │   │
│  │ • Review project plan draft                             │   │
│  │ #action-items #meeting                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 💡 AI Suggestions                        [MEDIUM]       │   │
│  │ Based on the conversation, I recommend:                 │   │
│  │ 1. Create a shared project roadmap                      │   │
│  │ 2. Set up recurring weekly syncs                        │   │
│  │ #recommendations #planning                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Insight Card Anatomy

```
┌──────────────────────────────────────────────────┐
│ [ICON] Title                        [PRIORITY]   │  ← Header
│        Timestamp                                 │
├──────────────────────────────────────────────────┤
│                                                  │
│  Content goes here...                            │  ← Body
│  Can be multi-line with markdown support         │
│                                                  │
├──────────────────────────────────────────────────┤
│  #tag1 #tag2 #tag3                               │  ← Footer (optional)
└──────────────────────────────────────────────────┘
```

## Color Coding

| Type        | Color  | Icon | Example Use Case                    |
|-------------|--------|------|-------------------------------------|
| Summary     | Blue   | 📄   | Chat recaps, key points            |
| Action Item | Green  | ✅   | Tasks, to-dos, deadlines           |
| Suggestion  | Purple | 💡   | Recommendations, best practices    |
| Analysis    | Orange | 📊   | Reports, metrics, evaluations      |
| Code        | Gray   | 💻   | Code snippets, examples            |
| Document    | Teal   | 📋   | Documentation, references          |

## Priority Badges

```
[LOW]    - Gray background, gray text
[MEDIUM] - Yellow background, yellow text
[HIGH]   - Red background, red text
```

## Filter Tabs

Active tab:
```
[All (5)]  - Blue background when selected
```

Inactive tabs:
```
[Summary (2)]  - Gray background, hover effect
```

## Empty State

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         ⚠️                                  │
│                                                             │
│              No insights yet                                │
│    AI will generate insights as the                         │
│         conversation progresses                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Team-Specific Examples

### Team 1: Sample Team (3 insights)
- 📄 Chat Summary (medium priority)
- ✅ Action Items (high priority) - "Schedule sync meeting"
- 💡 AI Suggestions (medium priority) - Project planning tips

### Team 2: AI Research (2 insights)
- 📄 Research Discussion Summary (high priority)
- 📋 Research Papers Collection (high priority) - Curated reading list

### Team 3: Project Alpha (2 insights)
- 📄 Project Kickoff (high priority)
- 💻 API Integration Boilerplate (TypeScript code)

### Team 4: Design Team (1 insight)
- 📊 Design System Analysis (medium priority) - Accessibility report

### Team 5: Backend Team (2 insights)
- 📄 Backend API v2 Status (high priority)
- 📋 API Documentation (high priority) - Complete endpoint reference

## Interaction Flow

```
User Action                    →  System Response
─────────────────────────────     ─────────────────────────────
1. Click team in sidebar       →  Load team's insights
2. Insights appear             →  Show filter tabs with counts
3. Click "Actions" tab         →  Show only action items
4. Click "All" tab             →  Show all insights again
5. Switch to different team    →  Load new team's insights
6. Team has no insights        →  Show empty state message
```

## Responsive Behavior

- **Header**: Fixed at top, shows team context
- **Filter Tabs**: Horizontal scroll on narrow screens
- **Insights List**: Vertical scroll, independent of chat
- **Cards**: Stack vertically, full width
- **Hover Effects**: Shadow increases on card hover

## Integration Points

```
Component Tree:
App
├── Sidebar (left)
│   └── Team selection
├── ChatWindow (center)
│   ├── ChatHeader
│   ├── MessageList
│   └── MessageInput
└── RightPanel (right)  ← AI Insights live here
    ├── Header
    ├── FilterTabs
    └── InsightsList
```

## State Flow

```
teamStore.currentTeamId
        ↓
RightPanel reads currentTeam
        ↓
aiInsightsStore.getTeamInsights(teamId)
        ↓
Filter & display insights
```

---

**Pro Tip**: The right panel automatically updates when you switch teams, showing context-relevant AI insights for each conversation!
