# AI Insights Feature - Per-Chat Basis

## Overview
Added a comprehensive AI insights system that displays AI-generated content, summaries, and recommendations on a per-team/chat basis in the right panel.

## New Features

### 1. **AI Insights Store** (`frontend/src/stores/aiInsightsStore.ts`)

A new Zustand store that manages AI-generated insights organized by team.

#### State Structure
```typescript
interface AIInsight {
  id: string;
  teamId: string;
  type: 'summary' | 'action-item' | 'suggestion' | 'analysis' | 'code' | 'document';
  title: string;
  content: string;
  createdAt: string;
  relatedMessageIds?: string[];
  metadata?: {
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
    language?: string;
    filename?: string;
  };
}
```

#### Methods
- `addInsight(teamId, insight)` - Add new insight to a team
- `updateInsight(teamId, insightId, updates)` - Update existing insight
- `deleteInsight(teamId, insightId)` - Remove an insight
- `getTeamInsights(teamId)` - Get all insights for a team
- `clearTeamInsights(teamId)` - Clear all insights for a team

#### Insight Types

1. **Summary** 📄
   - Chat summaries and key discussion points
   - Color: Blue
   - Example: "The team discussed project collaboration and scheduling..."

2. **Action Items** ✅
   - Extracted tasks and to-dos from conversations
   - Color: Green
   - Priority indicators (low/medium/high)
   - Example: "• Schedule sync meeting\n• Review project plan"

3. **Suggestions** 💡
   - AI recommendations and best practices
   - Color: Purple
   - Example: "Based on the conversation, I recommend..."

4. **Analysis** 📊
   - Data analysis, reports, and evaluations
   - Color: Orange
   - Example: "Design System Review: 92/100 accessibility score"

5. **Code** 💻
   - Code snippets, boilerplate, and examples
   - Color: Gray
   - Syntax highlighted
   - Example: API client code, type definitions

6. **Document** 📋
   - Generated documentation and reference materials
   - Color: Teal
   - Example: API documentation, research papers list

### 2. **Enhanced Right Panel** (`frontend/src/components/RightPanel/RightPanel.tsx`)

Completely redesigned right panel to display insights with rich UI.

#### Features

**Header Section:**
- Shows current team name
- Displays total insight count
- Updates automatically when switching teams

**Filter Tabs:**
- Dynamic tabs that only show when insights exist
- Filter by insight type (All, Summary, Actions, Suggestions, Code)
- Shows count for each type
- Color-coded for easy identification

**Insights Display:**
- Card-based layout with hover effects
- Type-specific icons and colors
- Priority badges (HIGH/MEDIUM/LOW)
- Timestamps in human-readable format
- Tags for categorization
- Code syntax highlighting for code insights

**Empty State:**
- Friendly message when no insights available
- Icon and helper text

#### Visual Design

Each insight type has unique styling:
- **Border color** matches insight type
- **Icon** represents the insight category
- **Priority badge** shows importance level
- **Tags** for topic categorization

## Mock Data

### Team 1 (Sample Team)
- ✅ Chat summary
- ✅ Action items (high priority)
- 💡 AI suggestions for project planning

### Team 2 (AI Research)
- 📄 Research discussion summary
- 📋 Research papers collection with reading list

### Team 3 (Project Alpha)
- 📄 Project kickoff summary
- 💻 API integration boilerplate code

### Team 4 (Design Team)
- 📊 Design system analysis with accessibility scores
- Recommendations for improvements

### Team 5 (Backend Team)
- 📄 API v2 status summary
- 📋 Complete API documentation

## Usage Examples

### Adding a New Insight Programmatically

```typescript
import { useAIInsightsStore } from './stores/aiInsightsStore';

const { addInsight } = useAIInsightsStore();

// Add a summary insight
addInsight('team1', {
  id: crypto.randomUUID(),
  teamId: 'team1',
  type: 'summary',
  title: 'Meeting Recap',
  content: 'Discussed Q4 goals and resource allocation...',
  createdAt: new Date().toISOString(),
  metadata: {
    priority: 'high',
    tags: ['meeting', 'planning', 'q4'],
  },
});

// Add a code insight
addInsight('team3', {
  id: crypto.randomUUID(),
  teamId: 'team3',
  type: 'code',
  title: 'React Hook Example',
  content: '```typescript\nconst [state, setState] = useState(...);\n```',
  createdAt: new Date().toISOString(),
  metadata: {
    language: 'typescript',
    filename: 'useCustomHook.ts',
    tags: ['react', 'hooks', 'example'],
  },
});
```

### Viewing Insights for Current Team

The right panel automatically shows insights for the currently selected team. Just switch teams in the sidebar, and the insights update automatically.

### Filtering Insights

Click any filter tab to show only insights of that type:
- **All** - Shows all insights
- **Summary** - Only chat summaries
- **Actions** - Only action items
- **Suggestions** - Only AI recommendations
- **Code** - Only code snippets

## Backend Integration (Future)

To connect this feature to your backend AI service:

### 1. WebSocket Events

```javascript
// Listen for new insights from AI service
socket.on('ai:insight:new', ({ teamId, insight }) => {
  const { addInsight } = useAIInsightsStore.getState();
  addInsight(teamId, insight);
});

// Request insights for a team
socket.emit('ai:insight:generate', {
  teamId: 'team1',
  type: 'summary',
  messageRange: { start: 0, end: 10 }
});
```

### 2. REST API Endpoints

```typescript
// Fetch insights for a team
GET /api/teams/:teamId/insights

// Generate new insight
POST /api/teams/:teamId/insights
{
  "type": "summary",
  "prompt": "Summarize the last 10 messages"
}

// Delete insight
DELETE /api/teams/:teamId/insights/:insightId
```

### 3. AI Service Integration

Connect to your AI orchestration service (from `backend/src/ai/` directory):
- Trigger insight generation based on chat activity
- Use "should-chime" rules to auto-generate insights
- Store insights in database for persistence
- Sync insights across team members in real-time

## Styling Guide

### Color Palette
- **Summary**: Blue (`bg-blue-100`, `text-blue-700`, `border-blue-200`)
- **Action Items**: Green (`bg-green-100`, `text-green-700`, `border-green-200`)
- **Suggestions**: Purple (`bg-purple-100`, `text-purple-700`, `border-purple-200`)
- **Analysis**: Orange (`bg-orange-100`, `text-orange-700`, `border-orange-200`)
- **Code**: Gray (`bg-gray-100`, `text-gray-700`, `border-gray-300`)
- **Document**: Teal (`bg-teal-100`, `text-teal-700`, `border-teal-200`)

### Priority Badges
- **Low**: Gray background
- **Medium**: Yellow background
- **High**: Red background

## Files Created/Modified

### Created
- ✅ `frontend/src/stores/aiInsightsStore.ts` - Zustand store for AI insights
- ✅ `frontend/AI_INSIGHTS.md` - This documentation

### Modified
- ✅ `frontend/src/components/RightPanel/RightPanel.tsx` - Complete redesign

## Testing

1. **Switch between teams** - Insights should update to show team-specific content
2. **Click filter tabs** - Only insights of selected type should display
3. **Check empty state** - Teams with no insights show friendly message
4. **Verify styling** - Each insight type has correct colors and icons
5. **Check responsive design** - Panel should scroll independently

## Next Steps

1. **Backend Integration**: Connect to AI service for real-time insight generation
2. **Persistence**: Store insights in database
3. **User Actions**: Add ability to edit, delete, or regenerate insights
4. **Feedback System**: Add thumbs up/down for insight quality
5. **Export**: Allow exporting insights to PDF or markdown
6. **Notifications**: Alert users when new insights are generated
7. **Search**: Add search functionality to find specific insights
8. **Templates**: Create insight templates for common use cases

---

**Status**: ✅ Feature complete with mock data. Ready for backend integration.
