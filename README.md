# fypai — Collaborative AI Productivity App

A real-time team collaboration platform with an embedded AI agent. Three-column layout: team sidebar, live chat, and an AI insights panel that summarises discussions, tracks decisions, and proactively surfaces action items.

**Stack:** React 18 · TypeScript · Vite · Zustand · TailwindCSS · Node.js · Express · Socket.IO · Prisma (SQLite) · GitHub Models (GPT-4o) · Pinecone (RAG) · BullMQ + Redis

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9 | Included with Node |
| GitHub Personal Access Token | — | For AI features (free via [GitHub Models](https://github.com/marketplace/models)) |
| Redis | 6+ | **Optional** — only needed for background embedding queue. Windows: [Memurai](https://www.memurai.com/), or `docker run -p 6379:6379 redis` |
| Pinecone account | — | **Optional** — only needed for RAG/semantic search. Free tier at [pinecone.io](https://www.pinecone.io) |

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/juzzztinsoong/fypai.git
cd fypai
npm install
```

### 2. Build the shared types package

```bash
npm run build:types
```

### 3. Configure environment variables

**Backend:**

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in at minimum:

```env
DATABASE_URL="file:./dev.db"
GITHUB_TOKEN="ghp_your_token_here"   # get one at github.com/settings/tokens
```

For RAG (semantic search), also add `PINECONE_API_KEY` and `PINECONE_INDEX_NAME` (see `.env.example` for full details).

**Frontend:**

```bash
cd ../frontend
cp .env.example .env
```

The defaults point to `localhost:5000` and work out of the box for local development. Only change them if running the backend on a different host or port (e.g. LAN testing).

### 4. Set up the database

```bash
# Still inside backend/
npm run db:generate   # generate Prisma client
npm run db:migrate    # create SQLite dev.db and apply schema
```

### 5. Seed the database

Two seed options are available:

| Command | What it loads |
|---|---|
| `npm run seed` | General demo data — users, teams, sample chat messages and AI insights |
| `npm run seed:study` | Research-study dataset — structured multi-team sessions with timestamped conversations |

Run one from the `backend/` directory:

```bash
npm run seed
```

> **Note:** Both seed scripts wipe all existing database rows and clear the Pinecone index first (Pinecone clear is skipped gracefully if unconfigured).

---

## Running the App

Open two terminals from the repo root:

**Terminal 1 — Backend**

```bash
cd backend
npm run dev
# API + Socket.IO server → http://localhost:5000
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
# Vite dev server → http://localhost:5173
```

Open `http://localhost:5173` in your browser. Select a team from the left sidebar to start chatting. Mention `@agent` in any message to interact with the AI directly, or use the **Summary** / **Report** buttons in the right panel to generate AI insights.

---

## Monorepo scripts (from root)

```bash
npm run dev:backend      # start backend watch server
npm run dev:frontend     # start frontend dev server
npm run build:all        # build types + backend + frontend
npm run test:backend     # run backend test suite
```

---

## Project Structure

```
fypai/
├── frontend/           # React + Vite client
│   └── src/
│       ├── components/ # Sidebar, Chat, RightPanel
│       ├── stores/     # Zustand (entityStore, uiStore, sessionStore)
│       └── services/   # API & socket clients
│
├── backend/            # Express + Socket.IO server
│   ├── src/
│   │   ├── ai/         # LLM client, agent, chime rules engine
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/   # Prisma, embeddings, Pinecone, Redis
│   │   └── socket/
│   └── prisma/
│       └── schema.prisma
│
└── packages/
    └── types/          # Shared TypeScript DTOs (MessageDTO, AIInsightDTO, …)
```

---

## Key Environment Variables

See [`backend/.env.example`](backend/.env.example) for the complete annotated reference.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `file:./dev.db` | SQLite file path |
| `GITHUB_TOKEN` | ✅* | — | AI LLM + embeddings via GitHub Models |
| `OPENAI_API_KEY` | ✅* | — | Alternative: use OpenAI directly |
| `PINECONE_API_KEY` | Recommended | — | Enables RAG semantic search |
| `PINECONE_INDEX_NAME` | — | `fypai-messages` | Pinecone index name |
| `REDIS_HOST` | — | `localhost` | Redis for embedding queue |
| `REDIS_PORT` | — | `6379` | Redis port |
| `PORT` | — | `5000` | Backend server port |
| `FRONTEND_URL` | — | `http://localhost:5173` | CORS allowed origin |

*One of `GITHUB_TOKEN` or `OPENAI_API_KEY` is required for AI features.

---

## Health Check

Once the backend is running:

```
GET http://localhost:5000/health
```

Returns Redis connection status, Pinecone readiness, and embedding model info.
