# Next Steps for FYP AI

**Current Status**: Real-time Chat + AI Integration Complete ✅  
**Last Updated**: October 17, 2025

---

## ✅ What's Working Now

You have a **fully functional real-time collaborative chat** with:
- ⚡ Instant message sync across all users (no refresh needed)
- 🤖 AI assistant that responds to @agent mentions and generates content
- 🎯 Room-based team isolation (messages only go to correct team)
- 🚫 No duplicate messages (atomic state updates + duplicate detection)
- 🔄 Optimistic updates for immediate feedback
- 📡 WebSocket connection management with auto-reconnect

**Architecture**: React + TypeScript frontend, Node/Express backend, Socket.IO for real-time, Prisma + SQLite for persistence

---

## 📋 Feature Roadmap

Tasks are organized by **Priority** (1-5) and **Difficulty** (Easy/Medium/Hard).

### Legend
- **Priority**: 1 = Critical, 2 = High, 3 = Medium, 4 = Nice-to-have, 5 = Optional
- **Difficulty**: Easy = 1-2 hours, Medium = 3-8 hours, Hard = 8+ hours
- **Impact**: How much it improves the app (High/Medium/Low)

---

## 🔥 Quick Wins (High Impact, Low Effort)

### 1. Clean Up Debug Logging
- **Priority**: 1 | **Difficulty**: Easy | **Impact**: High
- **Time**: 1 hour
- **Description**: Remove excessive console.logs now that real-time sync is working
- **Tasks**:
  - Remove 🔵, 🟢, 📨, 🎯 debug logs from chatStore and socketService
  - Keep critical logs (errors, connection status)
  - Add log levels (debug, info, warn, error)
- **Files**: `chatStore.ts`, `socketService.ts`, `messageRoutes.ts`

### 2. Typing Indicators
- **Priority**: 2 | **Difficulty**: Easy | **Impact**: High
- **Time**: 2 hours
- **Description**: Show "Alice is typing..." when users are composing messages
- **Tasks**:
  - Emit `typing:start` when user types in composer
  - Emit `typing:stop` after 2s of no typing
  - Display typing indicator below message list
- **Files to create**: `frontend/src/components/Chat/TypingIndicator.tsx`
- **Files to modify**: `MessageComposer.tsx`, `MessageList.tsx`, `chatStore.ts`

### 3. Message Edit/Delete UI
- **Priority**: 2 | **Difficulty**: Easy | **Impact**: Medium
- **Time**: 2 hours
- **Description**: Add edit/delete buttons to messages (backend already supports it)
- **Tasks**:
  - Add "Edit" and "Delete" icons on hover for own messages
  - Show edit modal with text input
  - Confirm before delete
  - Show "(edited)" indicator on edited messages
- **Files to modify**: `MessageList.tsx`, `chatStore.ts`

### 4. Error Toast Notifications
- **Priority**: 1 | **Difficulty**: Easy | **Impact**: Medium
- **Time**: 1 hour
- **Description**: Replace console.error with user-friendly toast messages
- **Tasks**:
  - Install react-hot-toast or sonner
  - Add toast container to App.tsx
  - Replace error handling in all API calls
  - Add success toasts for actions (message sent, team joined)
- **Files to modify**: All components with API calls, `App.tsx`

---

## 🎯 Core Features (High Impact, Medium Effort)

### 5. Right Panel - AI Long-Form Content Display
- **Priority**: 1 | **Difficulty**: Medium | **Impact**: High
- **Time**: 4-6 hours
- **Description**: Display AI-generated summaries, code, and documents in right panel
- **Tasks**:
  - Create `<InsightCard>` component with syntax highlighting
  - Fetch insights when team changes
  - Add "View in Panel" button to AI messages
  - Implement panel toggle (show/hide)
  - Add copy/download buttons for AI content
- **Files to create**: `RightPanel/InsightCard.tsx`, `RightPanel/InsightList.tsx`
- **Files to modify**: `RightPanel.tsx`, `MessageList.tsx`

### 6. AI Chime Rules Engine
- **Priority**: 2 | **Difficulty**: Medium | **Impact**: High
- **Time**: 5-8 hours
- **Description**: Configurable triggers for when AI should respond
- **Tasks**:
  - Create `backend/src/ai/rules/` folder
  - Implement rule evaluator (keywords, patterns, scheduled)
  - Add rule priority system
  - Store rules in database (new `Rule` model)
  - Create admin UI for managing rules
- **Files to create**: `backend/src/ai/rules/ruleEngine.ts`, `backend/src/ai/rules/ruleTypes.ts`
- **Schema changes**: Add `Rule` model to Prisma schema

### 7. Team Management UI
- **Priority**: 2 | **Difficulty**: Medium | **Impact**: Medium
- **Time**: 4-6 hours
- **Description**: Create, edit, and manage teams from UI
- **Tasks**:
  - "Create Team" modal in sidebar
  - Team settings page (name, description, avatar)
  - Add/remove members UI
  - Leave/delete team functionality
- **Files to create**: `Team/CreateTeamModal.tsx`, `Team/TeamSettings.tsx`, `Team/MemberList.tsx`
- **Files to modify**: `Sidebar.tsx`, `teamStore.ts`

### 8. Message Search
- **Priority**: 3 | **Difficulty**: Medium | **Impact**: Medium
- **Time**: 5-7 hours
- **Description**: Search messages across all teams
- **Tasks**:
  - Add search API with full-text search
  - Create search bar component (top of chat)
  - Highlight search matches in results
  - Add filters (date range, author, team)
  - Implement "jump to message" from search results
- **Files to create**: `backend/src/controllers/searchController.ts`, `Search/SearchBar.tsx`, `Search/SearchResults.tsx`

---

## 🚀 Enhanced Features (Medium Impact, Varied Effort)

### 9. File Attachments
- **Priority**: 3 | **Difficulty**: Medium | **Impact**: Medium
- **Time**: 6-8 hours
- **Description**: Upload and share files in messages
- **Tasks**:
  - Add file upload backend endpoint (multer)
  - Store files locally or in S3
  - Update Message schema to include attachments
  - Add file picker to composer
  - Display file previews (images, PDFs)
  - Download button for files
- **Files to create**: `backend/src/routes/uploadRoutes.ts`, `Chat/FileUpload.tsx`, `Chat/FilePreview.tsx`
- **Schema changes**: Add `attachments: Json?` to Message model

### 10. Desktop Notifications
- **Priority**: 3 | **Difficulty**: Easy | **Impact**: Low
- **Time**: 2-3 hours
- **Description**: Browser notifications for mentions and new messages
- **Tasks**:
  - Request notification permissions
  - Show notifications when:
    - @mentioned
    - New message while tab is inactive
    - AI task completes
  - Add notification settings (enable/disable, sound)
- **Files to create**: `utils/notifications.ts`, `Settings/NotificationSettings.tsx`

### 11. Message Reactions
- **Priority**: 4 | **Difficulty**: Medium | **Impact**: Low
- **Time**: 4-5 hours
- **Description**: React to messages with emoji (like Slack)
- **Tasks**:
  - Add reactions array to Message schema
  - Create emoji picker component
  - Display reaction counts on messages
  - Broadcast reactions via WebSocket
- **Files to create**: `Chat/ReactionPicker.tsx`, `Chat/ReactionDisplay.tsx`
- **Schema changes**: Add `reactions: Json?` to Message model

### 12. Message Threading
- **Priority**: 4 | **Difficulty**: Hard | **Impact**: Medium
- **Time**: 10-15 hours
- **Description**: Reply to specific messages (threaded conversations)
- **Tasks**:
  - Add `parentMessageId` to Message schema
  - Create thread view component (right panel)
  - "Reply" button on messages
  - Thread indicators in main chat
  - Navigate between threads
- **Schema changes**: Add `parentMessageId: String?` and relation to Message model

---

## 🔒 Production Readiness (Critical for Deployment)

### 13. User Authentication
- **Priority**: 1 (for production) | **Difficulty**: Hard | **Impact**: High
- **Time**: 10-15 hours
- **Description**: Secure login/signup system
- **Tasks**:
  - JWT token generation (backend)
  - Login/signup API endpoints
  - Password hashing (bcrypt)
  - Login/signup UI
  - Protected routes (middleware)
  - Token refresh logic
  - Update all API calls to include auth header
- **Files to create**: `backend/src/middleware/auth.ts`, `controllers/authController.ts`, `Auth/Login.tsx`, `Auth/Signup.tsx`
- **Alternative**: Use Auth0, Clerk, or Supabase Auth (easier, 4-6 hours)

### 14. Database Migration to PostgreSQL
- **Priority**: 1 (for production) | **Difficulty**: Easy | **Impact**: High
- **Time**: 1-2 hours
- **Description**: Move from SQLite to PostgreSQL
- **Tasks**:
  - Update Prisma schema provider
  - Create PostgreSQL database (local or cloud)
  - Run migrations
  - Update DATABASE_URL environment variable
  - Test all endpoints
- **Files to modify**: `prisma/schema.prisma`, `.env`

### 15. Error Monitoring & Logging
- **Priority**: 2 (for production) | **Difficulty**: Easy | **Impact**: High
- **Time**: 2-3 hours
- **Description**: Track errors and monitor app health
- **Tasks**:
  - Add Sentry for error tracking
  - Add structured logging (pino or winston)
  - Set up uptime monitoring (UptimeRobot)
  - Add health check endpoints
- **Files to create**: `backend/src/middleware/logger.ts`, `utils/sentry.ts`

### 16. Performance Optimization
- **Priority**: 3 (for production) | **Difficulty**: Medium | **Impact**: Medium
- **Time**: 6-10 hours
- **Description**: Improve app speed and efficiency
- **Tasks**:
  - Add Redis for presence tracking (replace in-memory)
  - Implement message pagination (load on scroll)
  - Add database indexes (teamId, createdAt)
  - Code splitting with React.lazy
  - Compress images/assets
  - Enable gzip compression
  - CDN for static assets
- **Files to modify**: Multiple backend and frontend files

### 17. Deployment Setup
- **Priority**: 1 (for production) | **Difficulty**: Medium | **Impact**: High
- **Time**: 4-6 hours
- **Description**: Deploy to production hosting
- **Tasks**:
  - **Frontend** (Vercel):
    - Push to GitHub
    - Import in Vercel
    - Add environment variables
    - Deploy
  - **Backend** (Railway/Render):
    - Create project
    - Connect GitHub repo
    - Add environment variables
    - Deploy
    - Update frontend API URL
  - Set up custom domain (optional)
- **Files to create**: `vercel.json`, `Dockerfile` (optional)

---

## 🧪 Testing & Quality Assurance

### 18. Unit Tests
- **Priority**: 3 | **Difficulty**: Medium | **Impact**: Medium
- **Time**: 8-12 hours
- **Description**: Test critical functionality
- **Tasks**:
  - Install Vitest (frontend) and Jest (backend)
  - Test Zustand stores (chatStore, teamStore)
  - Test API endpoints (message CRUD, team CRUD)
  - Test AI agent logic
  - Test WebSocket event handlers
- **Files to create**: `*.test.ts` files for each module

### 19. E2E Tests
- **Priority**: 4 | **Difficulty**: Hard | **Impact**: Low
- **Time**: 10-15 hours
- **Description**: Test critical user flows
- **Tasks**:
  - Install Playwright or Cypress
  - Test: send message → appears for other users
  - Test: @agent mention → AI responds
  - Test: create team → appears in sidebar
  - Test: real-time sync across multiple browsers
- **Files to create**: `e2e/*.spec.ts` test files

---

## 🎨 UX Polish (Low Priority, Nice-to-have)

### 20. Link Previews
- **Priority**: 4 | **Difficulty**: Medium | **Impact**: Low
- **Time**: 3-4 hours
- **Description**: Show preview cards for URLs in messages
- **Tasks**:
  - Detect URLs in message content
  - Fetch Open Graph metadata
  - Display preview card (title, description, image)
- **Files to create**: `backend/src/utils/linkPreview.ts`, `Chat/LinkPreview.tsx`

### 21. Code Syntax Highlighting
- **Priority**: 4 | **Difficulty**: Easy | **Impact**: Low
- **Time**: 1-2 hours
- **Description**: Highlight code blocks in messages
- **Tasks**:
  - Install react-syntax-highlighter
  - Detect code blocks (```language)
  - Apply syntax highlighting
  - Add language indicator
- **Files to modify**: `MessageList.tsx`

### 22. Accessibility Improvements
- **Priority**: 3 | **Difficulty**: Medium | **Impact**: Medium
- **Time**: 5-8 hours
- **Description**: Make app accessible to all users
- **Tasks**:
  - Add ARIA labels to all interactive elements
  - Keyboard navigation for all actions
  - Focus management (modal, dropdown)
  - Screen reader support
  - Color contrast improvements (WCAG AA)
  - Test with screen reader
- **Files to modify**: All components

### 23. Dark Mode
- **Priority**: 4 | **Difficulty**: Easy | **Impact**: Low
- **Time**: 2-3 hours
- **Description**: Add dark theme
- **Tasks**:
  - Add theme toggle in settings
  - Create dark color palette
  - Update Tailwind config with dark: variants
  - Persist theme preference (localStorage)
- **Files to modify**: `tailwind.config.js`, all components with colors

---

## 🤖 Advanced AI Features

### 24. Semantic Search with Vector DB
- **Priority**: 3 | **Difficulty**: Hard | **Impact**: Medium
- **Time**: 10-15 hours
- **Description**: Search messages by meaning, not just keywords
- **Tasks**:
  - Choose vector DB (Pinecone, Weaviate, or local FAISS)
  - Generate embeddings for all messages
  - Implement semantic search API
  - Update search UI to support semantic search
  - Auto-embed new messages
- **Files to create**: `backend/src/ai/embeddings.ts`, `backend/src/ai/vectorStore.ts`

### 25. Context-Aware AI
- **Priority**: 3 | **Difficulty**: Hard | **Impact**: High
- **Time**: 12-20 hours
- **Description**: Make AI aware of conversation history and context
- **Tasks**:
  - Fetch recent conversation history when AI responds
  - Include team context (members, projects)
  - Use semantic search to find relevant past messages
  - Implement RAG (Retrieval Augmented Generation)
  - Add "Learn from feedback" (thumbs up/down)
- **Files to modify**: `backend/src/ai/agent.ts`, AI controller files

### 26. Multi-Modal AI Outputs
- **Priority**: 4 | **Difficulty**: Hard | **Impact**: Medium
- **Time**: 15-25 hours
- **Description**: AI generates notebooks, diagrams, and files
- **Tasks**:
  - Generate Jupyter notebooks from code discussions
  - Create markdown planning documents
  - Generate diagrams (Mermaid, PlantUML)
  - Export conversation summaries as PDF
  - Link related AI outputs together
- **Files to create**: `backend/src/ai/generators/`, `RightPanel/NotebookViewer.tsx`, `RightPanel/DiagramViewer.tsx`

---

## 📊 Recommended Priority Order

### Phase 1: Quick Wins & Polish (1-2 weeks)
1. **Clean Up Debug Logging** (1 hour) - Quick cleanup
2. **Error Toast Notifications** (1 hour) - Better UX
3. **Typing Indicators** (2 hours) - Real-time enhancement
4. **Message Edit/Delete UI** (2 hours) - Backend ready, just needs UI

**Total**: ~6 hours

### Phase 2: Core Features (2-3 weeks)
5. **Right Panel - AI Content Display** (6 hours) - Core architecture piece
6. **Team Management UI** (6 hours) - Usability improvement
7. **AI Chime Rules Engine** (8 hours) - Make AI smarter
8. **Message Search** (7 hours) - Productivity feature

**Total**: ~27 hours

### Phase 3: Enhanced Features (2-4 weeks)
9. **File Attachments** (8 hours) - High user value
10. **Desktop Notifications** (3 hours) - Engagement
11. **Message Reactions** (5 hours) - Social feature
12. **Code Syntax Highlighting** (2 hours) - Quick win

**Total**: ~18 hours

### Phase 4: Production Readiness (2-3 weeks)
13. **User Authentication** (15 hours or 6 with Auth0) - Critical for production
14. **Database Migration to PostgreSQL** (2 hours) - Production requirement
15. **Error Monitoring & Logging** (3 hours) - Operations
16. **Deployment Setup** (6 hours) - Go live
17. **Performance Optimization** (10 hours) - Scale

**Total**: ~36 hours (or 27 with Auth0)

### Phase 5: Quality & Advanced (Ongoing)
18. **Unit Tests** (12 hours) - Quality assurance
19. **Accessibility** (8 hours) - Inclusive design
20. **Context-Aware AI** (20 hours) - Advanced AI
21. **Semantic Search** (15 hours) - Next-gen search

**Total**: ~55 hours

---

## 🎯 Suggested Next Steps

If you're looking for **immediate impact** with **minimal effort**:

1. **Start here**: Clean up logging (30 min) + Add error toasts (1 hour)
2. **Then**: Typing indicators (2 hours) - makes chat feel alive
3. **Then**: Right panel AI content display (6 hours) - completes core architecture
4. **Then**: Team management UI (6 hours) - improves usability

**Total for Week 1**: ~15 hours of work for high-impact features.

---

## 📚 Resources

- **Setup Guide**: `SETUP_GUIDE.md`
- **AI Integration Docs**: `AI_INTEGRATION_COMPLETE.md`
- **Architecture Guidelines**: `.github/copilot-instructions.md`
- **Current Codebase**: Fully functional real-time chat with AI integration

---

**Ready to start?** Pick a task from the list above and let me know - I'll help you implement it! 🚀
