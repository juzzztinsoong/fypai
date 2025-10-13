# Backend - Collaborative AI Productivity App

Backend API server and realtime WebSocket handler for team collaboration and AI agent integration.

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Configuration](#environment-configuration)
- [API Documentation](#api-documentation)
- [WebSocket Events](#websocket-events)
- [Database Management](#database-management)
- [Testing](#testing)
- [AI Agent Integration](#ai-agent-integration)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🛠️ Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Runtime** | Node.js | >=18.0.0 |
| **Framework** | Express | 4.18.2 |
| **Realtime** | Socket.IO | 4.6.1 |
| **Database** | SQLite (dev) / PostgreSQL (prod) | - |
| **ORM** | Prisma | 5.7.1 |
| **Module System** | ES Modules | - |
| **Dev Server** | Nodemon | 3.0.2 |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation & Setup

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
# Create .env file (see Environment Configuration section)
cp .env.example .env

# 4. Generate Prisma client
npm run db:generate

# 5. Run database migrations
npm run db:migrate

# 6. Start development server
npm run dev
```

**Server will start at:** `http://localhost:5000`

**API Health Check:** `http://localhost:5000/health`

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.js                  # Main entry point, Express & Socket.IO setup
│   ├── db.js                     # Prisma client singleton with connection management
│   ├── types.js                  # Shared type definitions (JSDoc)
│   │
│   ├── routes/                   # REST API route definitions
│   │   ├── teamRoutes.js        # Team CRUD endpoints
│   │   ├── messageRoutes.js     # Message CRUD endpoints
│   │   └── userRoutes.js        # User CRUD endpoints
│   │
│   ├── controllers/              # Business logic layer
│   │   ├── teamController.js    # Team operations & member management
│   │   ├── messageController.js # Message operations & metadata handling
│   │   └── userController.js    # User operations & profile management
│   │
│   ├── middleware/               # Express middleware
│   │   ├── errorHandler.js      # Global error handling & Prisma error mapping
│   │   └── validation.js        # Request validation (to be implemented)
│   │
│   ├── socket/                   # WebSocket event handlers
│   │   └── socketHandlers.js    # Socket.IO connection, room, and message events
│   │
│   └── ai/                       # AI agent orchestration (to be implemented)
│       ├── rules.js             # Agent "chime" rule evaluation
│       └── orchestration.js     # LLM API calls & job management
│
├── prisma/
│   ├── schema.prisma            # Database schema & models
│   └── migrations/              # Auto-generated migration files
│
├── .env                         # Environment variables (gitignored)
├── .gitignore                   # Git ignore rules
├── package.json                 # Dependencies & scripts
├── package-lock.json           # Locked dependency tree
├── dev.db                       # SQLite database file (gitignored)
├── test-api-fixed.js           # API testing script
└── README.md                    # This file
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
# Database Connection
# For SQLite (development):
DATABASE_URL="file:./dev.db"
# For PostgreSQL (production):
# DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"

# Server Configuration
PORT=5000
NODE_ENV="development"

# CORS Configuration
FRONTEND_URL="http://localhost:5173"

# Future: AI API Keys (add when implementing AI features)
# OPENAI_API_KEY="sk-..."
# ANTHROPIC_API_KEY="sk-ant-..."

# Future: Authentication (add when implementing auth)
# JWT_SECRET="your-secret-key"
# SESSION_SECRET="your-session-secret"
```

### Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | Database connection string | `file:./dev.db` | ✅ Yes |
| `PORT` | Server port | `5000` | ❌ No |
| `NODE_ENV` | Environment mode | `development` | ❌ No |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:5173` | ✅ Yes |

---

## 📡 API Documentation

### Base URL

```
http://localhost:5000/api
```

### Authentication

🚧 **Not yet implemented** - All endpoints currently public. Add JWT/session auth before production.

---

### Teams API

#### `GET /api/teams?userId=:id`
**Get all teams for a user**

**Query Parameters:**
- `userId` (required): User ID to filter teams

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Project Alpha",
    "createdAt": "2025-10-13T12:00:00.000Z",
    "members": [
      {
        "id": "uuid",
        "name": "Alice Johnson",
        "avatar": "👩",
        "role": "member",
        "teamRole": "owner"
      }
    ]
  }
]
```

---

#### `GET /api/teams/:id`
**Get single team with members**

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "Project Alpha",
  "createdAt": "2025-10-13T12:00:00.000Z",
  "members": [...]
}
```

**Errors:**
- `404 Not Found`: Team doesn't exist

---

#### `POST /api/teams`
**Create a new team**

**Request Body:**
```json
{
  "name": "Project Alpha",
  "ownerId": "uuid"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Project Alpha",
  "createdAt": "2025-10-13T12:00:00.000Z",
  "members": [
    {
      "id": "uuid",
      "name": "Alice Johnson",
      "teamRole": "owner"
    }
  ]
}
```

**Errors:**
- `400 Bad Request`: Missing required fields
- `500 Database Error`: User doesn't exist (FK constraint)

---

#### `PATCH /api/teams/:id`
**Update team name**

**Request Body:**
```json
{
  "name": "New Team Name"
}
```

**Response:** `200 OK`

---

#### `DELETE /api/teams/:id`
**Delete a team (cascade deletes members and messages)**

**Response:** `204 No Content`

---

#### `POST /api/teams/:id/members`
**Add member to team**

**Request Body:**
```json
{
  "userId": "uuid",
  "teamRole": "member"  // optional: "owner" | "admin" | "member"
}
```

**Response:** `201 Created`

---

#### `DELETE /api/teams/:id/members/:userId`
**Remove member from team**

**Response:** `204 No Content`

---

### Messages API

#### `GET /api/messages?teamId=:id`
**Get all messages for a team**

**Query Parameters:**
- `teamId` (required): Team ID to fetch messages for

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "teamId": "uuid",
    "authorId": "uuid",
    "content": "Hello, team!",
    "contentType": "text",
    "createdAt": "2025-10-13T12:00:00.000Z",
    "metadata": null,
    "author": {
      "id": "uuid",
      "name": "Alice Johnson",
      "avatar": "👩",
      "role": "member"
    }
  }
]
```

**Content Types:**
- `text`: Plain text message
- `ai_longform`: AI-generated long-form content
- `notebook`: Jupyter notebook or code artifact
- `file`: File attachment

---

#### `POST /api/messages`
**Send a new message**

**Request Body:**
```json
{
  "teamId": "uuid",
  "authorId": "uuid",
  "content": "Hello, team!",
  "contentType": "text",
  "metadata": {
    "suggestions": ["Create timeline", "Define milestones"],
    "parentMessageId": "uuid"  // optional: for threading
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "teamId": "uuid",
  "authorId": "uuid",
  "content": "Hello, team!",
  "contentType": "text",
  "createdAt": "2025-10-13T12:00:00.000Z",
  "metadata": "{...}",
  "author": {
    "id": "uuid",
    "name": "Alice Johnson",
    "avatar": "👩",
    "role": "member"
  }
}
```

---

#### `PATCH /api/messages/:id`
**Update message content**

**Request Body:**
```json
{
  "content": "Updated message content"
}
```

**Response:** `200 OK`

---

#### `DELETE /api/messages/:id`
**Delete a message**

**Response:** `204 No Content`

---

### Users API

#### `GET /api/users`
**Get all users**

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "avatar": "👩",
    "role": "member",
    "createdAt": "2025-10-13T12:00:00.000Z"
  }
]
```

---

#### `GET /api/users/:id`
**Get single user by ID**

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "avatar": "👩",
  "role": "member",
  "createdAt": "2025-10-13T12:00:00.000Z",
  "teamMemberships": [
    {
      "teamRole": "owner",
      "team": {
        "id": "uuid",
        "name": "Project Alpha"
      }
    }
  ]
}
```

**Errors:**
- `404 Not Found`: User doesn't exist

---

#### `POST /api/users`
**Create a new user**

**Request Body:**
```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",  // optional
  "avatar": "👩",                 // optional
  "role": "member"                // "member" | "admin" | "agent"
}
```

**Response:** `201 Created`

---

#### `PATCH /api/users/:id`
**Update user details**

**Request Body:**
```json
{
  "name": "Alice J.",      // optional
  "avatar": "👩‍💻",          // optional
  "role": "admin"          // optional
}
```

**Response:** `200 OK`

---

#### `DELETE /api/users/:id`
**Delete a user (cascade deletes team memberships and messages)**

**Response:** `204 No Content`

---

## 🔌 WebSocket Events

### Connection

```javascript
// Frontend connection
import { io } from 'socket.io-client'
const socket = io('http://localhost:5000')

socket.on('connect', () => {
  console.log('Connected:', socket.id)
})
```

---

### Client → Server Events

#### `team:join`
**Join a team room for scoped broadcasts**

**Payload:**
```json
{
  "teamId": "uuid"
}
```

**Usage:**
```javascript
socket.emit('team:join', { teamId: 'abc-123' })
```

---

#### `team:leave`
**Leave a team room**

**Payload:**
```json
{
  "teamId": "uuid"
}
```

---

#### `message:new`
**Send a new message (persists to DB and broadcasts)**

**Payload:**
```json
{
  "teamId": "uuid",
  "authorId": "uuid",
  "content": "Hello!",
  "contentType": "text",
  "metadata": {
    "suggestions": ["Option 1", "Option 2"]
  }
}
```

**Result:** Message is saved to database and broadcast to all clients in team room

---

#### `presence:typing`
**Send typing indicator**

**Payload:**
```json
{
  "teamId": "uuid",
  "userId": "uuid",
  "isTyping": true
}
```

---

### Server → Client Events

#### `message:new`
**Receive new message broadcast**

**Payload:**
```json
{
  "id": "uuid",
  "teamId": "uuid",
  "authorId": "uuid",
  "content": "Hello!",
  "contentType": "text",
  "createdAt": "2025-10-13T12:00:00.000Z",
  "author": {
    "id": "uuid",
    "name": "Alice",
    "avatar": "👩",
    "role": "member"
  }
}
```

**Usage:**
```javascript
socket.on('message:new', (message) => {
  console.log('New message:', message)
  // Update UI with new message
})
```

---

#### `presence:typing`
**Receive typing indicator from other users**

**Payload:**
```json
{
  "userId": "uuid",
  "isTyping": true
}
```

---

#### `ai:task:status`
**Receive AI task progress updates**

**Payload:**
```json
{
  "taskId": "uuid",
  "status": "processing",  // "processing" | "completed" | "failed"
  "progress": 0.5,         // 0.0 to 1.0
  "result": {              // present when status="completed"
    "content": "...",
    "contentType": "ai_longform"
  }
}
```

---

#### `error`
**Receive error notification**

**Payload:**
```json
{
  "message": "Failed to send message"
}
```

---

## 🗄️ Database Management

### Prisma Commands

```powershell
# Generate Prisma client (after schema changes)
npm run db:generate

# Create and apply new migration
npm run db:migrate

# Push schema changes without migration (dev only)
npm run db:push

# Open Prisma Studio (database GUI)
npm run db:studio
```

---

### Database Schema

#### User Model
```prisma
model User {
  id              String        @id @default(uuid())
  name            String
  email           String?       @unique
  avatar          String?
  role            String        // 'member' | 'admin' | 'agent'
  createdAt       DateTime      @default(now())
  
  teamMemberships TeamMember[]
  messages        Message[]
}
```

#### Team Model
```prisma
model Team {
  id              String        @id @default(uuid())
  name            String
  createdAt       DateTime      @default(now())
  
  teamMemberships TeamMember[]
  messages        Message[]
}
```

#### TeamMember Model (Join Table)
```prisma
model TeamMember {
  id       String   @id @default(uuid())
  teamId   String
  userId   String
  teamRole String?  // 'owner' | 'admin' | 'member'
  joinedAt DateTime @default(now())
  
  team     Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([teamId, userId])
}
```

#### Message Model
```prisma
model Message {
  id          String   @id @default(uuid())
  teamId      String
  authorId    String
  content     String
  contentType String   // 'text' | 'ai_longform' | 'notebook' | 'file'
  createdAt   DateTime @default(now())
  metadata    String?  // JSON string
  
  team        Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  
  @@index([teamId, createdAt])
}
```

---

### Switching from SQLite to PostgreSQL

For production, switch to PostgreSQL:

1. **Update `.env`:**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/fypai?schema=public"
```

2. **Update `prisma/schema.prisma`:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. **Run migrations:**
```powershell
npm run db:migrate
npm run db:generate
```

---

## 🧪 Testing

### Manual API Testing

#### Using PowerShell
```powershell
# Create user
$user = Invoke-RestMethod -Uri http://localhost:5000/api/users -Method POST -Body (@{
  name = "Test User"
  role = "member"
} | ConvertTo-Json) -ContentType "application/json"

# Create team
$team = Invoke-RestMethod -Uri http://localhost:5000/api/teams -Method POST -Body (@{
  name = "Test Team"
  ownerId = $user.id
} | ConvertTo-Json) -ContentType "application/json"

# Send message
Invoke-RestMethod -Uri http://localhost:5000/api/messages -Method POST -Body (@{
  teamId = $team.id
  authorId = $user.id
  content = "Hello!"
  contentType = "text"
} | ConvertTo-Json) -ContentType "application/json"
```

---

#### Using Automated Test Script
```powershell
# Run comprehensive API tests
node test-api-fixed.js
```

**Expected Output:**
```
🧪 Testing Backend API with proper FK handling...

1. Testing health endpoint...
   ✅ Health: { status: 'ok', timestamp: '...' }

2. Creating owner user...
   ✅ Owner created: abc-123 Alice Johnson

3. Creating AI agent...
   ✅ Agent created: def-456 AI Assistant

...

✅ All tests passed!
```

---

### Using Postman/Insomnia

1. Import the collection from `docs/postman-collection.json` (to be created)
2. Set environment variable `BASE_URL=http://localhost:5000`
3. Run collection tests

---

### WebSocket Testing

**Browser Console:**
```javascript
const socket = io('http://localhost:5000')

socket.on('connect', () => console.log('Connected'))
socket.emit('team:join', { teamId: 'YOUR_TEAM_ID' })
socket.on('message:new', msg => console.log('Message:', msg))

socket.emit('message:new', {
  teamId: 'YOUR_TEAM_ID',
  authorId: 'YOUR_USER_ID',
  content: 'Test message',
  contentType: 'text'
})
```

---

## 🤖 AI Agent Integration

### Architecture

The AI agent operates on a **"chime" policy**:
1. Agent subscribes to message streams
2. Rule evaluator checks if agent should respond (e.g., `@agent` mention, keywords, scheduled triggers)
3. Agent posts responses via same `message:new` flow
4. Long-form outputs stored as `contentType: 'ai_longform'`

### Implementation Status

🚧 **To Be Implemented:**

- [ ] Rule evaluator in `src/ai/rules.js`
- [ ] LLM API integration (OpenAI/Anthropic)
- [ ] Vector DB for embeddings (Pinecone/Weaviate)
- [ ] Job queue for async tasks (Bull/BullMQ)
- [ ] Multimodal output handling (notebooks, files)

### Future Endpoints

```
POST /api/ai/should-chime     # Evaluate if agent should respond
POST /api/ai/generate         # Generate long-form content
POST /api/ai/embed            # Create embeddings for search
GET  /api/ai/tasks/:id        # Check task status
```

---

## 🚀 Deployment

### Production Checklist

- [ ] Switch to PostgreSQL database
- [ ] Set `NODE_ENV=production` in environment
- [ ] Add authentication middleware (JWT/session)
- [ ] Implement rate limiting (express-rate-limit)
- [ ] Add input validation (Joi/Zod)
- [ ] Configure HTTPS/TLS
- [ ] Set up logging (Winston/Pino)
- [ ] Configure error monitoring (Sentry)
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Implement database backups
- [ ] Set up CI/CD pipeline

### Deployment Platforms

**Recommended:**
- **Railway**: Zero-config PostgreSQL + Node.js
- **Render**: Free tier available
- **Fly.io**: Global edge deployment
- **Heroku**: Classic PaaS option

**Deploy Steps (Railway example):**
```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Add PostgreSQL database
railway add postgresql

# Deploy
railway up
```

---

## 🔧 Troubleshooting

### Common Issues

#### ❌ `Error: Cannot find module 'X'`
**Solution:** Ensure all imports use `.js` extensions:
```javascript
// ✅ Correct
import { prisma } from './db.js'

// ❌ Wrong
import { prisma } from './db'
```

---

#### ❌ `MODULE_TYPELESS_PACKAGE_JSON` Warning
**Solution:** Add `"type": "module"` to `package.json`

---

#### ❌ `@prisma/client did not initialize yet`
**Solution:**
```powershell
npx prisma generate
npm run dev
```

---

#### ❌ Database errors (P2002, P2003, P2025)
**Solution:**
```powershell
# Regenerate database
rm dev.db
npm run db:migrate
npm run db:generate
```

**Prisma Error Codes:**
- `P2002`: Unique constraint violation
- `P2003`: Foreign key constraint violation
- `P2025`: Record not found

---

#### ❌ CORS errors in frontend
**Solution:** Check `.env` has correct frontend URL:
```env
FRONTEND_URL="http://localhost:5173"
```

---

#### ❌ Port already in use
**Solution:**
```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change port in .env
PORT=5001
```

---

#### ❌ WebSocket connection fails
**Solution:**
1. Check server logs for Socket.IO initialization
2. Verify CORS configuration includes Socket.IO handshake
3. Test connection with Socket.IO client tool

---

### Debug Mode

Enable verbose logging:

```env
NODE_ENV=development
```

This enables Prisma query logging in `src/db.js`.

---

## 🤝 Contributing

### Adding New Features

1. **Routes:** Add new endpoints in `src/routes/`
2. **Controllers:** Add business logic in `src/controllers/`
3. **Database:** Update `prisma/schema.prisma` and run migration
4. **Documentation:** Update this README with new endpoints
5. **Tests:** Add test cases in `test-*.js`

### Code Conventions

- Use ES modules (`import`/`export`)
- Add JSDoc comments to all functions
- Follow RESTful conventions for endpoints
- Use explicit error handling with `try/catch`
- Transform database responses to match frontend types

### Pull Request Process

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes and test locally
3. Update documentation
4. Submit PR with description of changes

---

## 📚 Additional Resources

- [Express Documentation](https://expressjs.com/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Frontend README](../frontend/README.md)
- [Architecture Guide](../.github/copilot-instructions.md)

---

## 📝 License

ISC

---

## 👥 Authors

- Your Name / Team Name

---

**Last Updated:** October 13, 2025
