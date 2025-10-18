# Plan: AI Long-Form Content Integration (Task #5)

Based on the Copilot instructions and current architecture, here's the plan for integrating AI-generated summaries and long-form content into the right panel.

---

## 🎯 Goals

1. **Move AI action buttons** from chat window to right panel (AI Insights header)
2. **Display AI long-form content** in the right panel (summaries, code analysis, documents)
3. **Link AI outputs** to originating messages via `metadata.parentMessageId`
4. **Remove duplicate UI** (AI Actions currently in both chat and right panel)
5. **Add content type filtering** (summary, code, document, insight)

---

## 📋 Changes Required

### **1. UI Restructure**

**Move AI generation buttons from chat window to right panel header:**
- ❌ Remove: `ChatActions.tsx` component from chat window
- ✅ Keep: AI action buttons in `RightPanelHeader.tsx` (already exists)
- ✅ Add: Content type tabs (All, Summaries, Code, Documents, Insights)

**Add long-form content viewer:**
- ✅ Create: `LongFormContentViewer.tsx` component
- ✅ Create: `SummaryCard.tsx` component  
- ✅ Create: `CodeOutputCard.tsx` component
- ✅ Create: `DocumentCard.tsx` component

### **2. Data Model Alignment**

**Follow architecture message schema:**
```typescript
{
  id: string,
  teamId: string,
  authorId: 'agent',
  content: string,
  contentType: 'ai_longform' | 'text' | 'notebook' | 'file',
  createdAt: ISOString,
  metadata: {
    parentMessageId?: string,  // Link to original message
    longFormType?: 'summary' | 'code' | 'document',
    prompt?: string,
    model?: string,
  }
}
```

### **3. Backend Updates**

**Ensure AI outputs use correct contentType:**
- Messages from AI agent should set `contentType: 'ai_longform'` for summaries/code/docs
- Regular AI chat responses remain `contentType: 'text'`

---

## 📁 Files to Modify

### **Frontend Components (8 files)**

#### **Remove AI Actions from Chat:**
1. **`frontend/src/components/Chat/ChatWindow.tsx`**
   - Remove `<ChatActions />` component import and usage
   - Keep only `<ChatHeader />`, `<MessageList />`, `<MessageComposer />`

2. **`frontend/src/components/Chat/ChatActions.tsx`**
   - **DELETE THIS FILE** (functionality moved to right panel)

#### **Update Right Panel:**
3. **`frontend/src/components/RightPanel/RightPanel.tsx`**
   - Add content type state: `'all' | 'summaries' | 'code' | 'documents' | 'insights'`
   - Filter displayed content based on selected type
   - Split view: AI Insights (short) at top, Long-form content (scrollable) below

4. **`frontend/src/components/RightPanel/RightPanelHeader.tsx`**
   - Keep existing AI action buttons (Summarize, Generate Code, Generate Doc)
   - Add content type tabs below buttons
   - Update button handlers to create long-form messages

5. **`frontend/src/components/RightPanel/InsightList.tsx`**
   - Rename to `AIContentList.tsx` (handles both insights and long-form)
   - Add rendering for `contentType: 'ai_longform'` messages
   - Group by type (insights vs long-form)

#### **Create New Components:**
6. **`frontend/src/components/RightPanel/LongFormContentViewer.tsx`** (NEW)
   - Displays full AI-generated content
   - Shows metadata (prompt, model, timestamp)
   - Links back to originating message
   - Supports markdown rendering

7. **`frontend/src/components/RightPanel/SummaryCard.tsx`** (NEW)
   - Specialized card for conversation summaries
   - Shows key points, decisions, action items

8. **`frontend/src/components/RightPanel/CodeOutputCard.tsx`** (NEW)
   - Syntax-highlighted code display
   - Copy button, language tag
   - Explanation section

---

### **Frontend Stores (1 file)**

9. **`frontend/src/stores/chatStore.ts`**
   - Add filter helpers:
     - `getLongFormMessages(teamId)` - get messages with `contentType: 'ai_longform'`
     - `getMessagesByType(teamId, longFormType)` - filter by summary/code/document
   - Add method: `linkMessageToParent(messageId, parentMessageId)` for UI navigation

---

### **Backend Controller (1 file)**

10. **`backend/src/controllers/aiAgentController.ts`**
    - Update `generateLongFormContent()`:
      - Set `contentType: 'ai_longform'` (not `'text'`)
      - Add `metadata.longFormType` ('summary' | 'code' | 'document')
      - Add `metadata.parentMessageId` (link to triggering message)
    - Keep `handleNewMessage()` using `contentType: 'text'` for chat responses

---

### **Types Package (1 file)**

11. **`packages/types/src/dtos.ts`**
    - Update `MessageMetadata` interface:
```typescript
export interface MessageMetadata {
  parentMessageId?: string;      // Link to original message
  longFormType?: 'summary' | 'code' | 'document';  // NEW
  prompt?: string;
  model?: string;
  tokensUsed?: number;
  relatedInsightIds?: string[];
}
```

---

## 🔄 Data Flow

### **Before (Current):**
```
User clicks "Summarize" in ChatActions
  ↓
POST /api/ai/generate-summary
  ↓
Backend creates message with contentType: 'text'
  ↓
Message appears in chat window mixed with conversation
  ↓
AI Insights panel shows separate insights (not linked)
```

### **After (Proposed):**
```
User clicks "Summarize" in RightPanelHeader
  ↓
POST /api/ai/generate-summary { parentMessageId: 'msg_xyz' }
  ↓
Backend creates message with:
  - contentType: 'ai_longform'
  - metadata.longFormType: 'summary'
  - metadata.parentMessageId: 'msg_xyz'
  ↓
Socket broadcasts message:new
  ↓
Frontend filters:
  - Chat window: ignores (contentType !== 'text')
  - Right panel: displays in "Summaries" tab
  ↓
User can click summary → jumps to original message in chat
```

---

## 🎨 UI Mockup Changes

### **Right Panel Layout (After):**

```
┌─────────────────────────────────┐
│  AI Insights                  ⚙ │
│  [📝 Summarize] [💻 Code] [📄 Doc] │
│  ─────────────────────────────   │
│  [All] [Summaries] [Code] [Docs] │ ← Content type tabs
├─────────────────────────────────┤
│                                  │
│  📊 Summary - 2:30 PM           │
│  Conversation about auth...      │
│  → Jump to source message        │
│                                  │
│  💻 Code Output - 2:28 PM       │
│  ```typescript                   │
│  function handleAuth() { ... }   │
│  ```                             │
│  → Jump to source message        │
│                                  │
│  🔍 Insight - 2:25 PM           │
│  Action: Implement JWT tokens    │
│                                  │
│  (scrollable list...)            │
│                                  │
└─────────────────────────────────┘
```

### **Chat Window Layout (After):**

```
┌─────────────────────────────────┐
│  Team Alpha              👥 🔔   │ ← ChatHeader
├─────────────────────────────────┤
│                                  │
│  Alice: Let's add auth           │
│  Bob: Good idea                  │
│  Agent: I can help with that     │ ← Regular text responses only
│                                  │
│  (scrollable messages...)        │
│                                  │
├─────────────────────────────────┤
│  [📎] Type a message...    [Send]│ ← MessageComposer
└─────────────────────────────────┘
   ❌ No more AI Actions here
```

---

## ✅ Implementation Checklist

### **Phase 1: Backend Updates (1 hour)** ✅ COMPLETE
- [x] Update `aiAgentController.ts` to set correct `contentType` and metadata
- [x] Update `MessageMetadata` type in `packages/types`
- [x] Test API endpoints return proper structure
- [x] Rebuild types package: `cd packages/types && npm run build`

### **Phase 2: Remove Duplicate UI (30 min)** ✅ COMPLETE
- [x] Delete `frontend/src/components/Chat/ChatActions.tsx` (did not exist)
- [x] Remove ChatActions import/usage from `ChatWindow.tsx`
- [x] Verify chat window still works

### **Phase 3: Right Panel - Content Filtering (2 hours)** ✅ COMPLETE
- [x] Add content type tabs to `RightPanel.tsx`
- [x] Update `RightPanel.tsx` to filter by contentType and longFormType
- [x] Add store methods: `getLongFormMessages()`, `getMessagesByType()`

### **Phase 4: New Components (3 hours)** ✅ COMPLETE
- [x] Create `LongFormContentViewer.tsx` (markdown renderer, metadata)
- [x] Create `SummaryCard.tsx` (structured summary display)
- [x] Create `CodeOutputCard.tsx` (syntax highlighting)
- [x] Wire up "Jump to source" navigation (placeholder for now)

### **Phase 5: Integration & Testing (1 hour)** 🔄 IN PROGRESS
- [ ] Test: Click "Summarize" → content appears in right panel
- [ ] Test: Summary links back to original message
- [ ] Test: Content type filtering works
- [ ] Test: Multiple AI outputs display correctly
- [ ] Test: Socket sync across multiple tabs

---

## 📊 Estimated Time

- **Backend**: 1 hour
- **UI Removal**: 0.5 hours
- **Right Panel Updates**: 2 hours  
- **New Components**: 3 hours
- **Testing**: 1 hour
- **Total**: ~7.5 hours

---

## 🚀 Benefits

✅ **Clean separation**: Chat for conversation, right panel for AI artifacts  
✅ **Better discoverability**: All AI features in one place  
✅ **Linked context**: Jump from AI output back to source conversation  
✅ **Scalable**: Easy to add new content types (notebooks, files, planning docs)  
✅ **Follows architecture**: Uses `contentType: 'ai_longform'` + `metadata.parentMessageId`

---

## ❓ Decisions Made

1. **AI Insights vs Long-form**: Two sections in right panel (Insights at top, Long-form below)
2. **Regular AI chat responses**: Stay in chat window (only long-form goes to right panel)
3. **Navigation**: Scroll chat to message + highlight it when clicking "Jump to source"

---

**Status**: Ready for implementation
**Start Date**: October 17, 2025
