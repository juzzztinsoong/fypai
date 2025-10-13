# Frontend-Backend Integration Migration Guide

**Project:** FYP AI Collaborative Productivity App  
**Date Started:** October 14, 2025  
**Status:** 🚧 In Progress

---

## Overview

This guide walks through migrating from frontend mock data to a fully integrated backend with real-time WebSocket communication.

**Current State:**
- ✅ Frontend working with mock data in Zustand stores
- ✅ Backend API endpoints implemented
- ✅ Prisma schema with User, Team, Message, AIInsight models
- ❌ Frontend not connected to backend
- ❌ Mock data not in database

**Target State:**
- ✅ All data in PostgreSQL/SQLite database
- ✅ Frontend fetches data via REST API
- ✅ Real-time updates via Socket.IO
- ✅ Shared TypeScript types between frontend/backend
- ✅ No mock data in stores

---

## Phase 1: Type Alignment & Preparation

### ✅ Checkpoint 1.1: Create Shared Types Package

**Goal:** Single source of truth for data structures across frontend and backend.

**Location:** `backend/src/types/shared.ts`

<details>
<summary>📝 Implementation Steps</summary>

1. **Create the shared types file:**
   ```powershell
   cd backend\src
   mkdir types
   cd types
   New-Item shared.ts
   ```

2. **Add canonical type definitions:**
   ```typescript
   // backend/src/types/shared.ts
   
   export interface User {
     id: string
     name: string
     email?: string
     avatar?: string
     role: 'member' | 'admin' | 'agent'
     createdAt: string // ISOString
   }
   
   export interface Team {
     id: string
     name: string
     createdAt: string
     members?: TeamMember[] // Populated via join
   }
   
   export interface TeamMember {
     id: string
     name: string
     avatar?: string
     role: 'member' | 'admin' | 'agent'
     teamRole?: 'owner' | 'admin' | 'member'
   }
   
   export interface Message {
     id: string
     teamId: string
     authorId: string
     content: string
     contentType: 'text' | 'ai_longform' | 'notebook' | 'file'
     createdAt: string
     metadata?: {
       suggestions?: string[]
       parentMessageId?: string
       fileName?: string
     }
     author?: User // Populated via join
   }
   
   export interface AIInsight {
     id: string
     teamId: string
     type: 'summary' | 'action-item' | 'suggestion' | 'analysis' | 'code' | 'document'
     title: string
     content: string
     priority?: 'low' | 'medium' | 'high'
     tags?: string[]
     createdAt: string
     relatedMessageIds?: string[]
     metadata?: {
       language?: string
       filename?: string
     }
   }
   
   export interface PresenceUpdate {
     userId: string
     status: 'online' | 'offline'
     teamId?: string
   }
   ```

3. **Copy to frontend:**
   ```powershell
   # From project root
   Copy-Item backend\src\types\shared.ts frontend\src\types\shared.ts
   ```

4. **Update frontend imports:**
   - Replace `import type { User, Team, Message } from '../types'`
   - With `import type { User, Team, Message } from '../types/shared'`

</details>

**Verification:**
```powershell
# Check files exist
Test-Path backend\src\types\shared.ts
Test-Path frontend\src\types\shared.ts
```

---

### ✅ Checkpoint 1.2: Verify Prisma Schema Alignment

**Goal:** Ensure database schema matches shared types.

**Location:** `backend/prisma/schema.prisma`

<details>
<summary>📝 Implementation Steps</summary>

1. **Compare Prisma models with shared types:**
   - ✅ User model → matches `User` interface
   - ✅ Team model → matches `Team` interface
   - ✅ TeamMember model → matches join table
   - ✅ Message model → matches `Message` interface
   - ✅ AIInsight model → matches `AIInsight` interface

2. **Run migration to apply schema:**
   ```powershell
   cd backend
   npx prisma migrate dev --name add-ai-insights
   ```

3. **Generate Prisma Client:**
   ```powershell
   npx prisma generate
   ```

   **If you get EPERM error:**
   ```powershell
   # Stop all node processes
   taskkill /F /IM node.exe
   
   # Delete and regenerate
   Remove-Item -Recurse -Force node_modules\.prisma
   npx prisma generate
   ```

4. **Verify generation:**
   ```powershell
   node -e "const { PrismaClient } = require('@prisma/client'); console.log('✅ Prisma client loaded')"
   ```

</details>

**Verification:**
```powershell
# Check migration files created
Get-ChildItem backend\prisma\migrations
```

---

## Phase 2: Data Migration & Seeding

### ✅ Checkpoint 2.1: Extract Mock Data from Frontend

**Goal:** Create JSON files with all current mock data for database seeding.

**Location:** `backend/src/seed-data/`

<details>
<summary>📝 Implementation Steps</summary>

1. **Create seed-data directory:**
   ```powershell
   cd backend\src
   mkdir seed-data
   ```

2. **Extract users from frontend stores:**
   - Open `frontend/src/stores/teamStore.ts`
   - Copy all unique user objects
   - Create `backend/src/seed-data/users.json`:
   ```json
   [
     {
       "id": "user1",
       "name": "Alice Johnson",
       "email": "alice@example.com",
       "avatar": null,
       "role": "member"
     },
     {
       "id": "user2",
       "name": "Bob Smith",
       "email": "bob@example.com",
       "role": "member"
     },
     {
       "id": "agent",
       "name": "AI Assistant",
       "role": "agent"
     }
     // ... add all other users
   ]
   ```

3. **Extract teams:**
   - Create `backend/src/seed-data/teams.json`:
   ```json
   [
     {
       "id": "team1",
       "name": "Sample Team"
     },
     {
       "id": "team2",
       "name": "AI Research"
     }
     // ... add all teams
   ]
   ```

4. **Extract team memberships:**
   - Create `backend/src/seed-data/team-members.json`:
   ```json
   [
     {
       "teamId": "team1",
       "userId": "user1",
       "teamRole": "admin"
     },
     {
       "teamId": "team1",
       "userId": "user2",
       "teamRole": "member"
     }
     // ... add all memberships
   ]
   ```

5. **Extract messages:**
   - Open `frontend/src/stores/chatStore.ts`
   - Create `backend/src/seed-data/messages.json`:
   ```json
   [
     {
       "id": "msg1",
       "teamId": "team1",
       "authorId": "user1",
       "content": "Welcome to the team!",
       "contentType": "text",
       "metadata": null
     }
     // ... add all messages
   ]
   ```

6. **Extract AI insights:**
   - Open `frontend/src/stores/aiInsightsStore.ts`
   - Create `backend/src/seed-data/insights.json`:
   ```json
   [
     {
       "id": "insight1",
       "teamId": "team1",
       "type": "summary",
       "title": "Chat Summary",
       "content": "The team discussed...",
       "priority": "medium",
       "tags": ["meeting", "collaboration"],
       "relatedMessageIds": ["msg1", "msg2"]
     }
     // ... add all insights
   ]
   ```

</details>

**Verification:**
```powershell
# Check all seed files exist
Get-ChildItem backend\src\seed-data\*.json
```

---

### ✅ Checkpoint 2.2: Create Database Seed Script

**Goal:** Populate database with all mock data.

**Location:** `backend/src/seed.ts`

<details>
<summary>📝 Implementation Steps</summary>

1. **Create seed script:**
   ```powershell
   cd backend\src
   New-Item seed.ts
   ```

2. **Add seed implementation:**
   ```typescript
   // backend/src/seed.ts
   import { PrismaClient } from '@prisma/client'
   import * as fs from 'fs'
   import * as path from 'path'
   
   const prisma = new PrismaClient()
   
   async function loadJSON(filename: string) {
     const filePath = path.join(__dirname, 'seed-data', filename)
     const data = fs.readFileSync(filePath, 'utf-8')
     return JSON.parse(data)
   }
   
   async function seed() {
     console.log('🌱 Starting database seed...')
   
     // 1. Clear existing data (dev only!)
     console.log('🗑️  Clearing existing data...')
     await prisma.aIInsight.deleteMany()
     await prisma.message.deleteMany()
     await prisma.teamMember.deleteMany()
     await prisma.team.deleteMany()
     await prisma.user.deleteMany()
   
     // 2. Create users
     console.log('👥 Creating users...')
     const users = await loadJSON('users.json')
     for (const user of users) {
       await prisma.user.create({ 
         data: {
           ...user,
           createdAt: new Date()
         } 
       })
     }
     console.log(`✅ Created ${users.length} users`)
   
     // 3. Create teams
     console.log('🏢 Creating teams...')
     const teams = await loadJSON('teams.json')
     for (const team of teams) {
       await prisma.team.create({ 
         data: {
           ...team,
           createdAt: new Date()
         } 
       })
     }
     console.log(`✅ Created ${teams.length} teams`)
   
     // 4. Create team memberships
     console.log('🔗 Creating team memberships...')
     const teamMembers = await loadJSON('team-members.json')
     for (const member of teamMembers) {
       await prisma.teamMember.create({ 
         data: {
           ...member,
           joinedAt: new Date()
         } 
       })
     }
     console.log(`✅ Created ${teamMembers.length} team memberships`)
   
     // 5. Create messages
     console.log('💬 Creating messages...')
     const messages = await loadJSON('messages.json')
     for (const msg of messages) {
       await prisma.message.create({
         data: {
           ...msg,
           metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
           createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date()
         }
       })
     }
     console.log(`✅ Created ${messages.length} messages`)
   
     // 6. Create AI insights
     console.log('🤖 Creating AI insights...')
     const insights = await loadJSON('insights.json')
     for (const insight of insights) {
       await prisma.aIInsight.create({
         data: {
           ...insight,
           tags: insight.tags ? JSON.stringify(insight.tags) : null,
           relatedMessageIds: insight.relatedMessageIds ? JSON.stringify(insight.relatedMessageIds) : null,
           createdAt: insight.createdAt ? new Date(insight.createdAt) : new Date()
         }
       })
     }
     console.log(`✅ Created ${insights.length} AI insights`)
   
     console.log('🎉 Seed complete!')
   }
   
   seed()
     .catch((error) => {
       console.error('❌ Seed failed:', error)
       process.exit(1)
     })
     .finally(async () => {
       await prisma.$disconnect()
     })
   ```

3. **Add seed script to package.json:**
   ```json
   {
     "scripts": {
       "db:seed": "ts-node src/seed.ts",
       "db:reset": "npx prisma migrate reset --force && npm run db:seed",
       "db:studio": "npx prisma studio"
     }
   }
   ```

4. **Install ts-node if needed:**
   ```powershell
   npm install --save-dev ts-node @types/node
   ```

5. **Run seed script:**
   ```powershell
   npm run db:seed
   ```

6. **Verify data in Prisma Studio:**
   ```powershell
   npm run db:studio
   # Opens http://localhost:5555
   ```

</details>

**Verification:**
```powershell
# Count records in database
npx prisma db execute --stdin < "SELECT COUNT(*) FROM User;"
npx prisma db execute --stdin < "SELECT COUNT(*) FROM Team;"
npx prisma db execute --stdin < "SELECT COUNT(*) FROM Message;"
```

---

## Phase 3: Backend API Completion

### ✅ Checkpoint 3.1: Add AI Insights Endpoints

**Goal:** Complete CRUD endpoints for AI insights.

**Location:** `backend/src/routes/aiInsightRoutes.js`

<details>
<summary>📝 Implementation Steps</summary>

1. **Create AI Insights controller:**
   ```powershell
   cd backend\src\controllers
   New-Item aiInsightController.js
   ```

2. **Implement controller:**
   ```javascript
   // backend/src/controllers/aiInsightController.js
   import { prisma } from '../db.js'
   
   export class AIInsightController {
     static async getInsights(req, res) {
       try {
         const { teamId } = req.query
         
         if (!teamId) {
           return res.status(400).json({ error: 'teamId query parameter required' })
         }
         
         const insights = await prisma.aIInsight.findMany({
           where: { teamId },
           orderBy: { createdAt: 'desc' }
         })
         
         // Parse JSON fields
         const parsedInsights = insights.map(insight => ({
           ...insight,
           tags: insight.tags ? JSON.parse(insight.tags) : [],
           relatedMessageIds: insight.relatedMessageIds ? JSON.parse(insight.relatedMessageIds) : [],
           createdAt: insight.createdAt.toISOString()
         }))
         
         res.json(parsedInsights)
       } catch (error) {
         res.status(500).json({ error: error.message })
       }
     }
     
     static async createInsight(req, res) {
       try {
         const { teamId, type, title, content, priority, tags, relatedMessageIds } = req.body
         
         const insight = await prisma.aIInsight.create({
           data: {
             teamId,
             type,
             title,
             content,
             priority: priority || null,
             tags: tags ? JSON.stringify(tags) : null,
             relatedMessageIds: relatedMessageIds ? JSON.stringify(relatedMessageIds) : null
           }
         })
         
         res.status(201).json({
           ...insight,
           tags: tags || [],
           relatedMessageIds: relatedMessageIds || [],
           createdAt: insight.createdAt.toISOString()
         })
       } catch (error) {
         res.status(500).json({ error: error.message })
       }
     }
     
     static async deleteInsight(req, res) {
       try {
         const { id } = req.params
         
         await prisma.aIInsight.delete({
           where: { id }
         })
         
         res.status(204).send()
       } catch (error) {
         res.status(500).json({ error: error.message })
       }
     }
   }
   ```

3. **Create routes file:**
   ```powershell
   cd backend\src\routes
   New-Item aiInsightRoutes.js
   ```

4. **Add routes:**
   ```javascript
   // backend/src/routes/aiInsightRoutes.js
   import express from 'express'
   import { AIInsightController } from '../controllers/aiInsightController.js'
   
   const router = express.Router()
   
   router.get('/', AIInsightController.getInsights)
   router.post('/', AIInsightController.createInsight)
   router.delete('/:id', AIInsightController.deleteInsight)
   
   export default router
   ```

5. **Register routes in main app:**
   - Open `backend/src/index.js`
   - Add:
   ```javascript
   import aiInsightRoutes from './routes/aiInsightRoutes.js'
   app.use('/api/insights', aiInsightRoutes)
   ```

6. **Test endpoints:**
   ```powershell
   # Start server
   npm run dev
   
   # In another terminal, test:
   curl http://localhost:5000/api/insights?teamId=team1
   ```

</details>

**Verification:**
- [ ] GET `/api/insights?teamId=team1` returns insights
- [ ] POST `/api/insights` creates new insight
- [ ] DELETE `/api/insights/:id` removes insight

---

### ✅ Checkpoint 3.2: Add Presence Tracking (In-Memory)

**Goal:** Track online/offline users via WebSocket.

**Location:** `backend/src/socket/presenceHandler.js`

<details>
<summary>📝 Implementation Steps</summary>

1. **Create presence handler:**
   ```powershell
   cd backend\src\socket
   New-Item presenceHandler.js
   ```

2. **Implement in-memory tracking:**
   ```javascript
   // backend/src/socket/presenceHandler.js
   
   // In-memory set of online users
   const onlineUsers = new Set()
   
   export function setupPresenceHandlers(io, socket) {
     // User comes online
     socket.on('presence:online', ({ userId }) => {
       onlineUsers.add(userId)
       io.emit('presence:update', { userId, status: 'online' })
       console.log(`👤 User ${userId} is online`)
     })
     
     // User goes offline
     socket.on('presence:offline', ({ userId }) => {
       onlineUsers.delete(userId)
       io.emit('presence:update', { userId, status: 'offline' })
       console.log(`👤 User ${userId} is offline`)
     })
     
     // Handle disconnect
     socket.on('disconnect', () => {
       // Remove user from all presence tracking
       // (You'd need to track socket.userId mapping)
       console.log('👤 User disconnected')
     })
     
     // Get current online users
     socket.on('presence:get', () => {
       socket.emit('presence:list', Array.from(onlineUsers))
     })
   }
   
   export function getOnlineUsers() {
     return Array.from(onlineUsers)
   }
   ```

3. **Register in socket handler:**
   - Open `backend/src/socket/socketHandler.js`
   - Add:
   ```javascript
   import { setupPresenceHandlers } from './presenceHandler.js'
   
   export function setupSocketHandlers(io) {
     io.on('connection', (socket) => {
       console.log('Socket connected:', socket.id)
       
       setupMessageHandlers(io, socket)
       setupPresenceHandlers(io, socket) // Add this
       
       socket.on('disconnect', () => {
         console.log('Socket disconnected:', socket.id)
       })
     })
   }
   ```

</details>

**Verification:**
- [ ] User connects → presence:online event tracked
- [ ] User disconnects → presence:offline event broadcast
- [ ] Multiple clients see presence updates

---

## Phase 4: Frontend Service Layer

### ✅ Checkpoint 4.1: Create API Client Services

**Goal:** Abstraction layer for all backend API calls.

**Location:** `frontend/src/services/`

<details>
<summary>📝 Implementation Steps</summary>

1. **Create services directory:**
   ```powershell
   cd frontend\src
   mkdir services
   ```

2. **Create base API client:**
   ```powershell
   cd services
   New-Item api.ts
   ```

3. **Configure Axios instance:**
   ```typescript
   // frontend/src/services/api.ts
   import axios from 'axios'
   
   export const api = axios.create({
     baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
     headers: {
       'Content-Type': 'application/json'
     }
   })
   
   // Add request interceptor for auth tokens (future)
   api.interceptors.request.use(
     (config) => {
       // Add auth token here when implemented
       return config
     },
     (error) => Promise.reject(error)
   )
   
   // Add response interceptor for error handling
   api.interceptors.response.use(
     (response) => response,
     (error) => {
       console.error('API Error:', error.response?.data || error.message)
       return Promise.reject(error)
     }
   )
   ```

4. **Create team service:**
   ```typescript
   // frontend/src/services/teamService.ts
   import { api } from './api'
   import type { Team } from '../types/shared'
   
   export const teamService = {
     async getTeamsForUser(userId: string): Promise<Team[]> {
       const { data } = await api.get(`/teams?userId=${userId}`)
       return data
     },
   
     async getTeamById(id: string): Promise<Team> {
       const { data } = await api.get(`/teams/${id}`)
       return data
     },
   
     async createTeam(name: string, ownerId: string): Promise<Team> {
       const { data } = await api.post('/teams', { name, ownerId })
       return data
     },
   
     async addMember(teamId: string, userId: string, teamRole?: string): Promise<void> {
       await api.post(`/teams/${teamId}/members`, { userId, teamRole })
     },
   
     async removeMember(teamId: string, userId: string): Promise<void> {
       await api.delete(`/teams/${teamId}/members/${userId}`)
     }
   }
   ```

5. **Create message service:**
   ```typescript
   // frontend/src/services/messageService.ts
   import { api } from './api'
   import type { Message } from '../types/shared'
   
   export const messageService = {
     async getMessages(teamId: string): Promise<Message[]> {
       const { data } = await api.get(`/messages?teamId=${teamId}`)
       return data
     },
   
     async createMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
       const { data } = await api.post('/messages', message)
       return data
     },
   
     async deleteMessage(id: string): Promise<void> {
       await api.delete(`/messages/${id}`)
     }
   }
   ```

6. **Create insight service:**
   ```typescript
   // frontend/src/services/insightService.ts
   import { api } from './api'
   import type { AIInsight } from '../types/shared'
   
   export const insightService = {
     async getInsights(teamId: string): Promise<AIInsight[]> {
       const { data } = await api.get(`/insights?teamId=${teamId}`)
       return data
     },
   
     async createInsight(insight: Omit<AIInsight, 'id' | 'createdAt'>): Promise<AIInsight> {
       const { data } = await api.post('/insights', insight)
       return data
     },
   
     async deleteInsight(id: string): Promise<void> {
       await api.delete(`/insights/${id}`)
     }
   }
   ```

7. **Add environment variable:**
   ```powershell
   # Create .env file in frontend root
   cd frontend
   New-Item .env
   ```
   
   Add to `.env`:
   ```
   VITE_API_URL=http://localhost:5000/api
   ```

</details>

**Verification:**
```powershell
# Test service (in browser console after starting frontend)
# import { teamService } from './services/teamService'
# teamService.getTeamsForUser('user1').then(console.log)
```

---

### ✅ Checkpoint 4.2: Create WebSocket Service

**Goal:** Centralized Socket.IO client for real-time updates.

**Location:** `frontend/src/services/socketService.ts`

<details>
<summary>📝 Implementation Steps</summary>

1. **Install Socket.IO client:**
   ```powershell
   cd frontend
   npm install socket.io-client
   ```

2. **Create socket service:**
   ```typescript
   // frontend/src/services/socketService.ts
   import { io, Socket } from 'socket.io-client'
   import { useChatStore } from '../stores/chatStore'
   import { usePresenceStore } from '../stores/presenceStore'
   import { useAIInsightsStore } from '../stores/aiInsightsStore'
   
   class SocketService {
     private socket: Socket | null = null
     private currentUserId: string | null = null
   
     connect(userId: string) {
       this.currentUserId = userId
       const url = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'
       
       this.socket = io(url, {
         transports: ['websocket'],
         reconnection: true,
         reconnectionAttempts: 5,
         reconnectionDelay: 1000
       })
   
       this.socket.on('connect', () => {
         console.log('✅ Socket connected:', this.socket?.id)
         // Announce presence
         this.socket?.emit('presence:online', { userId })
       })
   
       this.socket.on('disconnect', () => {
         console.log('❌ Socket disconnected')
       })
   
       this.socket.on('connect_error', (error) => {
         console.error('Socket connection error:', error)
       })
   
       // Message events
       this.socket.on('message:new', (message) => {
         console.log('📨 New message:', message)
         useChatStore.getState().addMessage(message.teamId, message)
       })
   
       // Presence events
       this.socket.on('presence:update', ({ userId, status }) => {
         console.log('👤 Presence update:', userId, status)
         if (status === 'online') {
           usePresenceStore.getState().setUserOnline(userId)
         } else {
           usePresenceStore.getState().setUserOffline(userId)
         }
       })
   
       // AI insight events
       this.socket.on('ai:insight:new', (insight) => {
         console.log('🤖 New AI insight:', insight)
         useAIInsightsStore.getState().addInsight(insight.teamId, insight)
       })
     }
   
     joinTeam(teamId: string) {
       console.log('🏢 Joining team:', teamId)
       this.socket?.emit('team:join', { teamId })
     }
   
     leaveTeam(teamId: string) {
       console.log('🏢 Leaving team:', teamId)
       this.socket?.emit('team:leave', { teamId })
     }
   
     sendMessage(message: any) {
       console.log('📤 Sending message:', message)
       this.socket?.emit('message:new', message)
     }
   
     disconnect() {
       if (this.currentUserId) {
         this.socket?.emit('presence:offline', { userId: this.currentUserId })
       }
       this.socket?.disconnect()
       this.socket = null
     }
   }
   
   export const socketService = new SocketService()
   ```

3. **Add Socket.IO URL to .env:**
   ```
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```

</details>

**Verification:**
- [ ] Socket connects when user logs in
- [ ] Socket disconnects on page close
- [ ] Presence updates broadcast to all clients

---

## Phase 5: Store Migration (Connect to Backend)

### ✅ Checkpoint 5.1: Update Team Store

**Goal:** Replace mock data with API calls.

**Location:** `frontend/src/stores/teamStore.ts`

<details>
<summary>📝 Implementation Steps</summary>

1. **Backup current store:**
   ```powershell
   Copy-Item frontend\src\stores\teamStore.ts frontend\src\stores\teamStore.ts.backup
   ```

2. **Update imports:**
   ```typescript
   import { create } from 'zustand'
   import { teamService } from '../services/teamService'
   import type { Team } from '../types/shared'
   ```

3. **Add loading/error states:**
   ```typescript
   interface TeamState {
     teams: Team[]
     currentTeamId: string | null
     loading: boolean
     error: string | null
     
     // Actions
     fetchTeams: (userId: string) => Promise<void>
     setCurrentTeam: (teamId: string) => void
     createTeam: (name: string, ownerId: string) => Promise<void>
     addMember: (teamId: string, userId: string) => Promise<void>
   }
   ```

4. **Implement fetch method:**
   ```typescript
   export const useTeamStore = create<TeamState>((set, get) => ({
     teams: [],
     currentTeamId: null,
     loading: false,
     error: null,
   
     fetchTeams: async (userId: string) => {
       set({ loading: true, error: null })
       try {
         const teams = await teamService.getTeamsForUser(userId)
         set({ teams, loading: false })
       } catch (error: any) {
         set({ error: error.message, loading: false })
         console.error('Failed to fetch teams:', error)
       }
     },
   
     setCurrentTeam: (teamId: string) => {
       set({ currentTeamId: teamId })
       // Load messages for this team
       const { fetchMessages } = useChatStore.getState()
       fetchMessages(teamId)
       // Load insights for this team (handled by RightPanel)
     },
   
     createTeam: async (name, ownerId) => {
       try {
         const team = await teamService.createTeam(name, ownerId)
         set({ teams: [...get().teams, team] })
       } catch (error: any) {
         console.error('Failed to create team:', error)
         throw error
       }
     },
   
     addMember: async (teamId, userId) => {
       try {
         await teamService.addMember(teamId, userId)
         // Refresh teams
         const userId = useUserStore.getState().currentUser?.id
         if (userId) {
           await get().fetchTeams(userId)
         }
       } catch (error: any) {
         console.error('Failed to add member:', error)
         throw error
       }
     }
   }))
   ```

5. **Remove mock data:**
   - Delete `initialTeams` array
   - Delete `mockUsers` array

6. **Update App.tsx to fetch on mount:**
   ```typescript
   // frontend/src/App.tsx
   import { useEffect } from 'react'
   import { useTeamStore } from './stores/teamStore'
   import { useUserStore } from './stores/userStore'
   import { socketService } from './services/socketService'
   
   function App() {
     const currentUser = useUserStore(state => state.currentUser)
     const fetchTeams = useTeamStore(state => state.fetchTeams)
   
     useEffect(() => {
       // Connect socket and fetch data
       if (currentUser) {
         socketService.connect(currentUser.id)
         fetchTeams(currentUser.id)
       }
   
       return () => {
         socketService.disconnect()
       }
     }, [currentUser, fetchTeams])
   
     return <AppLayout />
   }
   ```

</details>

**Verification:**
- [ ] Teams load from backend on app start
- [ ] Can switch teams
- [ ] Loading state shows during fetch
- [ ] Error state shows on API failure

---

### ✅ Checkpoint 5.2: Update Chat Store

**Goal:** Load messages from backend, send via WebSocket.

**Location:** `frontend/src/stores/chatStore.ts`

<details>
<summary>📝 Implementation Steps</summary>

1. **Backup current store:**
   ```powershell
   Copy-Item frontend\src\stores\chatStore.ts frontend\src\stores\chatStore.ts.backup
   ```

2. **Update store:**
   ```typescript
   import { create } from 'zustand'
   import { messageService } from '../services/messageService'
   import { socketService } from '../services/socketService'
   import type { Message } from '../types/shared'
   
   interface ChatState {
     messages: Record<string, Message[]>
     loading: boolean
     error: string | null
     
     // Actions
     fetchMessages: (teamId: string) => Promise<void>
     addMessage: (teamId: string, message: Message) => void
     sendMessage: (teamId: string, content: string, authorId: string) => Promise<void>
   }
   
   export const useChatStore = create<ChatState>((set, get) => ({
     messages: {},
     loading: false,
     error: null,
   
     fetchMessages: async (teamId: string) => {
       set({ loading: true, error: null })
       try {
         const messages = await messageService.getMessages(teamId)
         set(state => ({
           messages: {
             ...state.messages,
             [teamId]: messages
           },
           loading: false
         }))
       } catch (error: any) {
         set({ error: error.message, loading: false })
         console.error('Failed to fetch messages:', error)
       }
     },
   
     addMessage: (teamId: string, message: Message) => {
       set(state => ({
         messages: {
           ...state.messages,
           [teamId]: [...(state.messages[teamId] || []), message]
         }
       }))
     },
   
     sendMessage: async (teamId: string, content: string, authorId: string) => {
       const message = {
         teamId,
         authorId,
         content,
         contentType: 'text' as const
       }
       
       try {
         // Send via WebSocket for real-time broadcast
         socketService.sendMessage(message)
         
         // Also save to backend (WebSocket handler does this)
         // The message will come back via 'message:new' event
       } catch (error: any) {
         console.error('Failed to send message:', error)
         throw error
       }
     }
   }))
   ```

3. **Update MessageComposer to use new sendMessage:**
   ```typescript
   // frontend/src/components/Chat/MessageComposer.tsx
   const handleSend = async () => {
     if (!input.trim() || !currentTeam) return
     
     await sendMessage(currentTeam.id, input, currentUser.id)
     setInput('')
   }
   ```

4. **Remove mock data:**
   - Delete `initialChat` object
   - Delete all mock messages

</details>

**Verification:**
- [ ] Messages load when switching teams
- [ ] Can send new message
- [ ] Message appears in real-time
- [ ] Other clients see message instantly

---

### ✅ Checkpoint 5.3: Update AI Insights Store

**Goal:** Load insights from backend, toggle persists to DB.

**Location:** `frontend/src/stores/aiInsightsStore.ts`

<details>
<summary>📝 Implementation Steps</summary>

1. **Backup current store:**
   ```powershell
   Copy-Item frontend\src\stores\aiInsightsStore.ts frontend\src\stores\aiInsightsStore.ts.backup
   ```

2. **Update store:**
   ```typescript
   import { create } from 'zustand'
   import { insightService } from '../services/insightService'
   import type { AIInsight } from '../types/shared'
   
   interface AIInsightsState {
     insights: Record<string, AIInsight[]>
     aiEnabled: Record<string, boolean>
     loading: boolean
     error: string | null
     
     // Actions
     fetchInsights: (teamId: string) => Promise<void>
     addInsight: (teamId: string, insight: AIInsight) => void
     deleteInsight: (teamId: string, insightId: string) => Promise<void>
     getTeamInsights: (teamId: string) => AIInsight[]
     isAIEnabled: (teamId: string) => boolean
     toggleAI: (teamId: string) => void
   }
   
   export const useAIInsightsStore = create<AIInsightsState>((set, get) => ({
     insights: {},
     aiEnabled: {},
     loading: false,
     error: null,
   
     fetchInsights: async (teamId: string) => {
       set({ loading: true, error: null })
       try {
         const insights = await insightService.getInsights(teamId)
         set(state => ({
           insights: {
             ...state.insights,
             [teamId]: insights
           },
           loading: false
         }))
       } catch (error: any) {
         set({ error: error.message, loading: false })
         console.error('Failed to fetch insights:', error)
       }
     },
   
     addInsight: (teamId: string, insight: AIInsight) => {
       set(state => ({
         insights: {
           ...state.insights,
           [teamId]: [...(state.insights[teamId] || []), insight]
         }
       }))
     },
   
     deleteInsight: async (teamId: string, insightId: string) => {
       try {
         await insightService.deleteInsight(insightId)
         set(state => ({
           insights: {
             ...state.insights,
             [teamId]: (state.insights[teamId] || []).filter(i => i.id !== insightId)
           }
         }))
       } catch (error: any) {
         console.error('Failed to delete insight:', error)
         throw error
       }
     },
   
     getTeamInsights: (teamId: string) => {
       return get().insights[teamId] || []
     },
   
     isAIEnabled: (teamId: string) => {
       return get().aiEnabled[teamId] ?? true
     },
   
     toggleAI: (teamId: string) => {
       set(state => ({
         aiEnabled: {
           ...state.aiEnabled,
           [teamId]: !(state.aiEnabled[teamId] ?? true)
         }
       }))
       // TODO: Persist to backend user preferences table
     }
   }))
   ```

3. **Update RightPanel to fetch insights:**
   ```typescript
   // frontend/src/components/RightPanel/RightPanel.tsx
   useEffect(() => {
     if (currentTeam) {
       fetchInsights(currentTeam.id)
     }
   }, [currentTeam, fetchInsights])
   ```

4. **Remove mock data:**
   - Delete `initialInsights` object

</details>

**Verification:**
- [ ] Insights load for each team
- [ ] AI toggle works per team
- [ ] Can delete insights

---

### ✅ Checkpoint 5.4: Update Presence Store

**Goal:** Track online users via WebSocket events.

**Location:** `frontend/src/stores/presenceStore.ts`

<details>
<summary>📝 Implementation Steps</summary>

1. **Update store (already configured via socketService):**
   ```typescript
   // Presence store just needs setUserOnline/setUserOffline
   // These are already called by socketService.ts
   
   // Verify methods exist:
   export const usePresenceStore = create<PresenceState>((set) => ({
     onlineUsers: new Set<string>(),
   
     setUserOnline: (userId: string) => {
       set(state => ({
         onlineUsers: new Set(state.onlineUsers).add(userId)
       }))
     },
   
     setUserOffline: (userId: string) => {
       set(state => {
         const updated = new Set(state.onlineUsers)
         updated.delete(userId)
         return { onlineUsers: updated }
       })
     },
   
     isUserOnline: (userId: string) => {
       return usePresenceStore.getState().onlineUsers.has(userId)
     }
   }))
   ```

2. **Remove mock data:**
   - Delete `mockOnlineUsers`

</details>

**Verification:**
- [ ] User shows as online when connected
- [ ] User shows as offline when disconnected
- [ ] Multiple browser tabs show correct presence

---

## Phase 6: Testing & Validation

### ✅ Checkpoint 6.1: End-to-End Flow Test

**Test Scenario:** Full user journey

<details>
<summary>📝 Test Steps</summary>

1. **Start both servers:**
   ```powershell
   # Terminal 1: Backend
   cd backend
   npm run dev
   
   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

2. **Open browser to http://localhost:5173**

3. **Test team loading:**
   - [ ] Teams appear in sidebar
   - [ ] Can click to switch teams
   - [ ] Team members show in header

4. **Test messaging:**
   - [ ] Messages load for selected team
   - [ ] Can type and send message
   - [ ] Message appears immediately
   - [ ] Open second browser tab → message appears there too

5. **Test AI insights:**
   - [ ] Insights load in right panel
   - [ ] Can filter by type
   - [ ] AI toggle works per team

6. **Test presence:**
   - [ ] User shows as online in header
   - [ ] Open incognito window → user count increases
   - [ ] Close tab → user count decreases

</details>

**Verification Checklist:**
- [ ] No console errors
- [ ] No failed network requests
- [ ] All data from database (check Prisma Studio)
- [ ] Real-time updates work
- [ ] Presence tracking works

---

### ✅ Checkpoint 6.2: Database Verification

**Verify all data persisted correctly:**

<details>
<summary>📝 Verification Steps</summary>

```powershell
# Open Prisma Studio
cd backend
npm run db:studio
```

**Check counts:**
- [ ] Users table: 9 users (including agent)
- [ ] Teams table: 6 teams
- [ ] TeamMembers table: ~15+ memberships
- [ ] Messages table: ~20+ messages
- [ ] AIInsights table: ~10+ insights

**Check relationships:**
- [ ] Each message has valid teamId + authorId
- [ ] Each insight has valid teamId
- [ ] Team memberships link correctly

</details>

---

## Phase 7: Cleanup & Documentation

### ✅ Checkpoint 7.1: Remove Mock Data

**Delete all backup and mock files:**

<details>
<summary>📝 Cleanup Steps</summary>

```powershell
# Remove backup files
Remove-Item frontend\src\stores\*.backup

# Remove mock data comments
# Search for "TODO: Replace with API" and remove
# Search for "Mock data" and verify removed
```

**Update READMEs:**
1. Backend README: Document new `/api/insights` endpoints
2. Frontend README: Document service layer usage
3. Update `.github/copilot-instructions.md` with integration notes

</details>

---

### ✅ Checkpoint 7.2: Final Testing

**Run complete test suite:**

<details>
<summary>📝 Test Checklist</summary>

**Backend:**
- [ ] All endpoints return 200/201
- [ ] WebSocket events broadcast
- [ ] Database constraints enforced

**Frontend:**
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] All stores use backend
- [ ] Real-time updates work

**Integration:**
- [ ] Send message in one browser → appears in another
- [ ] Switch teams → messages/insights load
- [ ] Presence updates in real-time

</details>

---

## Troubleshooting

### Common Issues

**Issue: "Cannot connect to backend"**
```powershell
# Check backend is running
curl http://localhost:5000/api/health

# Check CORS settings in backend
# Update backend/src/index.js cors configuration
```

**Issue: "Prisma Client not found"**
```powershell
cd backend
npx prisma generate
```

**Issue: "WebSocket connection failed"**
- Check `VITE_SOCKET_URL` in frontend `.env`
- Verify backend Socket.IO is running
- Check browser console for CORS errors

**Issue: "Data not loading"**
```powershell
# Check database has data
cd backend
npm run db:studio

# Re-run seed if empty
npm run db:seed
```

---

## Success Criteria

✅ **Migration complete when:**

- [ ] All stores fetch from backend (no mock data)
- [ ] WebSocket events work bidirectionally  
- [ ] Database populated with all seed data
- [ ] Can switch teams and see correct data
- [ ] Messages send in real-time
- [ ] Presence tracking works
- [ ] AI toggle state persists per team
- [ ] No console errors or failed requests
- [ ] Both servers run without errors
- [ ] Documentation updated

---

## Next Steps After Migration

1. **Add Authentication:**
   - User login/signup
   - JWT tokens
   - Protected routes

2. **Add Redis for Presence:**
   - Persistent presence tracking
   - Cross-server presence sync

3. **Add Real AI Integration:**
   - Connect to LLM API
   - Generate insights automatically
   - AI agent responses

4. **Deploy to Production:**
   - PostgreSQL instead of SQLite
   - Environment configs
   - Docker containers

---

## Progress Tracking

**Started:** October 14, 2025  
**Current Phase:** Phase 1 - Type Alignment  
**Completed Checkpoints:** 
- [ ] 1.1 - Shared Types Created
- [ ] 1.2 - Prisma Schema Aligned
- [ ] 2.1 - Mock Data Extracted
- [ ] 2.2 - Seed Script Created
- [ ] 3.1 - AI Insights Endpoints Added
- [ ] 3.2 - Presence Tracking Added
- [ ] 4.1 - API Services Created
- [ ] 4.2 - WebSocket Service Created
- [ ] 5.1 - Team Store Updated
- [ ] 5.2 - Chat Store Updated
- [ ] 5.3 - AI Insights Store Updated
- [ ] 5.4 - Presence Store Updated
- [ ] 6.1 - E2E Testing Complete
- [ ] 6.2 - Database Verified
- [ ] 7.1 - Cleanup Complete
- [ ] 7.2 - Final Testing Passed

---

**Ready to start? Let's begin with Phase 1, Checkpoint 1.1! 🚀**
