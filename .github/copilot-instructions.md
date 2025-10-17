# Copilot Instructions for AI Coding Agents

This repository holds the scaffold for a collaborative AI-enabled productivity app for students / teams. The app's core UX is:

- Left sidebar: teams, switching project contexts, navigation and settings.
- Main (center) column: realtime team chat where users converse and collaborate.
- Right column (equal width to the main chat): long-form AI-produced content and multimodal suggestions (notebooks, files, planning artifacts).

This file documents the minimal, discoverable conventions and the intended architecture so AI agents can be productive immediately.

Important assumptions (inferred from project brief):
- The repo is currently empty; recommended stacks and file layouts below are suggestions to be implemented.
- We'll assume a web frontend (React + TypeScript), a backend API (Node/Express or Python/FastAPI), realtime over WebSockets (Socket.IO or WS), and a persistence layer (Postgres + vector DB for embeddings). If you prefer different technologies, adapt the guidance and update this file.

## Big-picture architecture

- Frontend: SPA responsible for chat UI, right-hand long-form panel, team/sidebar UX. Communicates with backend via REST for persistence and WebSocket for realtime events.
- Backend: HTTP API for CRUD (teams, projects, messages, files) + WebSocket/real-time server for live chat and presence. Also hosts AI orchestration endpoints (prompt building, job submission, multimodal outputs).
- AI Agent service: a worker or microservice that receives events ("should-chime" triggers), can post messages into chat, produce long-form outputs, and call embedding/vectorization pipelines. It may call external LLM APIs or an internal model host.
- Persistence: Relational DB for domain data (users, teams, messages, projects), object store for large outputs (files, notebooks), and vector DB (Milvus/Pinecone/Weaviate/FAISS) for semantic search and retrieval.

## Suggested top-level folders and files (examples)

- `frontend/` — React + TypeScript app
	- `src/components/Sidebar/*` — team switcher, nav
	- `src/components/Chat/*` — chat window, message list, composer
	- `src/components/RightPanel/*` — long-form editor/viewer, notebook viewer
- `backend/` — API server and realtime handlers
	- `src/routes/*.ts` or `app/*.py` — REST endpoints
	- `src/realtime/*` — WebSocket event handlers
	- `src/ai/*` — orchestration for LLM calls and agent behavior
- `ai-agent/` — optional separate worker for asynchronous jobs
- `infra/` — deployment manifests, dockerfiles
- `migrations/` — DB schema migrations
- `notebooks/` — example flows and prompts used for AI features
- `README.md` — project overview and run instructions

If you implement a folder, add a short README explaining purpose and entry commands.

## Key data shapes and conventions (discoverable patterns to follow)

- Message schema (recommended):

	{
		id: string,
		teamId: string,
		authorId: string | 'agent',
		content: string,
		contentType: 'text' | 'ai_longform' | 'notebook' | 'file',
		createdAt: ISOString,
		metadata?: { suggestions?: string[] }
	}

- Realtime events (socket names):
	- `message:new` — payload = message object
	- `presence:update` — users online / typing indicators
	- `ai:task:status` — job progress for long-form generation

Follow this naming scheme when adding new events to keep signals consistent across frontend/backend.

## AI agent integration points

- "Chime" policy: the agent subscribes to message streams and receives a compact event when a message meets rule criteria (e.g., `@agent` mention, certain keywords, or scheduled triggers). Implement a small rule-evaluator (configurable) in `backend/src/ai/rules`.
- The agent posts messages via the same `message:new` flow so chat history and persistence are unified.
- Long-form outputs and multimodal content should be stored as `contentType: 'ai_longform'` and linked to the originating message via `metadata.parentMessageId`.

## Developer workflows (recommended / discoverable)

Because the repo currently has no build/test scripts, these are suggested workflows to standardize on. If you adopt them, update this file and add the scripts.

- Frontend dev (React):

```powershell
cd frontend; npm install; npm run dev
```

- Backend dev (Node):

```powershell
cd backend; npm install; npm run dev
```

- Run tests (suggested):

```powershell
cd frontend; npm test
cd backend; npm test
```

Place CI actions in `.github/workflows/ci.yml` once stacks are chosen.

## Conventions and patterns to maintain

- Keep frontend components pure and use a small shared types package (`packages/types` or `backend/src/types`) to share message/team types between frontend and backend.
- Persist only canonical message objects to the DB; derive ephemeral UI states (typing, selection) in-memory or via Redis presence.
- Use event-sourcing style socket events for UI state (emit small deltas like `message:edit` rather than full re-syncs).

## Files to update when you add features

- Update this file (`.github/copilot-instructions.md`) with any new conventions or stacks.
- Add a top-level `README.md` describing how to run the project locally.
- Add `frontend/README.md` and `backend/README.md` with exact commands used by the team.

## What an AI agent should do when working in this repo

- When asked to implement UI/UX: create components under `frontend/src/components` and include small stories or a demo page.
- When asked to implement API endpoints: add routes under `backend/src/routes` and wire the realtime events in `backend/src/realtime`.
- When unsure about a stack choice: add a brief RFC in `docs/rfcs/` describing pros/cons and next steps.

## Documentation Policy - IMPORTANT

**DO NOT create markdown documentation files after every fix or change unless explicitly requested by the user.**

- Only create documentation when the user specifically asks for it
- Only create documentation for major features or complex architectural changes
- Prefer updating existing documentation over creating new files
- Use inline code comments for explaining specific implementations
- Answer questions directly in chat instead of creating files
- Existing documentation files to update when relevant:
  - `README.md` - project overview and setup
  - `SETUP_GUIDE.md` - comprehensive setup instructions
  - `NEXT_STEPS.md` - roadmap and future work
  - `AI_INTEGRATION_COMPLETE.md` - AI feature documentation

**Examples of when NOT to create documentation:**
- ❌ After fixing a bug
- ❌ After applying a code change
- ❌ After implementing a small feature
- ❌ After answering a question
- ❌ After debugging an issue

**Examples of when to create documentation:**
- ✅ User explicitly asks "can you document this?"
- ✅ New major feature with complex setup (e.g., new authentication system)
- ✅ Significant architectural changes that affect multiple systems
- ✅ User asks for a guide or tutorial

## Next steps / ask the maintainer

- Please confirm preferred stacks (frontend/backend language, DB choice, vector DB) so I can convert these recommendations into concrete scaffolding (src files, package.json, minimal runnable example).

---
If anything above is unclear or you'd like me to scaffold the initial frontend + backend using these conventions, tell me which stack you prefer and I'll generate the starter files and a minimal README next.
