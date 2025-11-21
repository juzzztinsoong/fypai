# Future Roadmap: Vision & Goals

**Project**: FYP AI - Collaborative Team AI Assistant  
**Purpose**: Strategic roadmap for advanced features beyond Phase 5  
**Timeline**: Post-MVP enhancements (Phases 6-9)  
**Status**: Planning

---

## Overview

This document outlines the strategic vision for transforming the FYP AI assistant from a functional RAG-enabled chatbot into an intelligent, production-ready multi-agent collaboration platform. These features build upon the foundation established in Phases 1-5 (refactoring, RAG infrastructure, and validation).

---

## Phase 6: Multi-Agent Architecture

### Goal
Replace single-model approach with tiered agent system for **90% cost reduction** while improving response quality through specialization.

### Core Concept: Two-Tier Agent System

**Tier 1 - Monitoring & Drafting (Cheap & Fast)**
- Model: `gpt-4o-mini` or `gpt-3.5-turbo`
- Role: Pattern detection, monitoring, draft generation
- Cost: ~$0.0001-0.0003 per response
- Handles 90% of agent work

**Tier 2 - Reasoning & Approval (Smart & Expensive)**
- Model: `gpt-4o` or `claude-sonnet-4.5`
- Role: Complex analysis, final decision-making, quality assurance
- Cost: ~$0.003-0.015 per response
- Handles 10% of critical decisions

### Key Features

#### 6.1 Intelligent Chat/Insight Routing
**Scope**: Automatically determine whether AI responses should appear in chat (main column) or insights panel (right column).

**Decision Logic:**
- **Short responses (<200 chars)** → Chat message
- **Conversational replies** → Chat message
- **Long-form content (>500 chars)** → Insight panel
- **Structured output (lists, reports, code)** → Insight panel
- **Document generation** → Insight panel with summary in chat

**Implementation:**
- Tier 1 agent generates response
- Classification logic evaluates: length, structure, format
- Routes to appropriate channel
- Stores in correct database table (Message vs AIInsight)

**Benefits:**
- Cleaner chat history (no walls of text)
- Insights panel becomes valuable knowledge repository
- Better UX for different content types

---

#### 6.2 Bidirectional Chat-Insight Linking
**Scope**: Allow navigation between related chat messages and AI insights.

**Features:**
- Insights store `relatedMessageIds` (already in schema)
- Chat messages can reference `relatedInsightId` (new field)
- Click on insight → scroll to triggering message in chat
- Click on message → view related insights in sidebar
- Visual indicators: "💡 3 insights related to this discussion"

**Use Cases:**
- User asks question → AI generates insight → user clicks insight → sees original question context
- User reviews summary → clicks to see full conversation that was summarized
- Trace AI reasoning back to source messages

---

#### 6.3 Semantic Vector-Based Chime Rules
**Scope**: Replace regex pattern matching with vector similarity for autonomous AI interventions.

**Current State (Regex-based):**
```
Pattern: "let's go with" → triggers decision detector
```

**Future State (Semantic):**
```
Query: "team made a decision" → vector similarity > 0.85 → trigger
```

**Features:**
- Store rule conditions as embeddings
- Real-time semantic matching on new messages
- Goal-oriented detection (e.g., "team is confused" vs matching specific words)
- Higher accuracy, fewer false positives

**Example Rules:**
- **Confusion Detection**: Semantically match "unclear concept" instead of "I'm confused"
- **Decision Detection**: Match intent of commitment vs specific phrases
- **Topic Drift**: Compare semantic distance from meeting agenda
- **Knowledge Gap**: Detect repeated unfamiliar terminology regardless of phrasing

**Implementation:**
- Embed rule condition descriptions (e.g., "user expresses confusion")
- For each new message, compute similarity to all active rule embeddings
- Trigger if similarity > threshold (e.g., 0.85)
- Use Tier 1 agent to validate match, Tier 2 to generate response

---

#### 6.4 Agent Specialization & Orchestration
**Scope**: Different agents for different tasks, orchestrated by central coordinator.

**Specialized Agents:**

**MonitorAgent (Tier 1)**
- Watches conversation flow
- Detects patterns (confusion, decisions, questions)
- Generates low-risk suggestions
- Drafts responses for approval

**SummaryAgent (Tier 1)**
- Generates quick summaries
- Creates meeting notes
- Extracts action items
- Produces progress updates

**AnalysisAgent (Tier 2)**
- Deep reasoning about complex topics
- Multi-step problem solving
- Strategic recommendations
- Quality assurance for Tier 1 outputs

**CodeAgent (Tier 2)**
- Code generation and review
- Technical explanations
- Architecture recommendations
- Debugging assistance

**Orchestrator Pattern:**
```
New Message → MonitorAgent detects pattern
              ↓
           Generates draft response
              ↓
           Routes to AnalysisAgent if:
           - High stakes decision
           - Complex reasoning needed
           - Code generation required
              ↓
           AnalysisAgent reviews/approves/rewrites
              ↓
           Posts final response
```

**Cost Optimization Example:**
- 100 messages/day
- 90 handled by Tier 1 ($0.027)
- 10 handled by Tier 2 ($0.150)
- **Total: $0.18/day** vs **$1.50/day** (100% Tier 2)
- **90% cost reduction**

---

## Phase 7: Authentication & User Management

### Goal
Replace hardcoded `user1` with real authentication system for multi-user production deployment.

### Core Features

#### 7.1 Clerk Integration
**Scope**: Third-party auth provider for user management.

**Features:**
- Email/password authentication
- OAuth (Google, GitHub, Microsoft)
- Session management
- User profiles
- Automatic token refresh

**Why Clerk:**
- 1-day setup vs weeks building custom auth
- Free tier: 10,000 monthly active users
- Built-in security best practices
- React SDK with hooks

**Implementation Scope:**
- Frontend: `<ClerkProvider>`, `<SignIn>`, `<UserButton>`
- Backend: Verify Clerk JWT tokens
- Database: Map Clerk userId to User records
- Socket.IO: Authenticate WebSocket connections

---

#### 7.2 Team Membership & Permissions
**Scope**: Multi-user teams with role-based access.

**Features:**
- Team owners, admins, members
- Invitation system (email invites)
- Access control (who can see which teams)
- User presence per team

**Database Schema:**
```
TeamMember:
  - userId
  - teamId
  - role: 'owner' | 'admin' | 'member'
  - joinedAt
  
TeamInvitation:
  - email
  - teamId
  - invitedBy
  - status: 'pending' | 'accepted' | 'expired'
```

**Permissions:**
- Owner: full control, delete team, billing
- Admin: invite/remove members, manage settings
- Member: read/write messages, view insights

---

#### 7.3 Onboarding Flow
**Scope**: Smooth first-time user experience.

**Steps:**
1. Sign up with Clerk
2. Create profile (name, avatar)
3. Create first team OR accept invitation
4. Tutorial walkthrough (optional)
5. Enter team workspace

**Features:**
- Sample team data for new users
- Interactive tutorial ("Try asking @agent...")
- Default settings preconfigured

---

## Phase 8: Production Deployment Infrastructure

### Goal
Migrate from local development to cloud-hosted production environment.

### Core Components

#### 8.1 PostgreSQL Migration
**Scope**: Replace SQLite with production database.

**Why PostgreSQL:**
- Concurrent connections (SQLite single-writer bottleneck)
- Better performance at scale
- Native JSON support
- pgvector for embeddings (native vector search)

**Migration Path:**
- Update `DATABASE_URL` in `.env`
- Run Prisma migrations
- Deploy with connection pooling (PgBouncer)
- Consider read replicas for scaling

**Hosting Options:**
- Supabase (free tier, managed Postgres + pgvector)
- Railway (PostgreSQL add-on)
- AWS RDS (production scale)

---

#### 8.2 Team Creation & Invitation System
**Scope**: Allow users to create teams and invite others.

**Features:**
- Create new team form (name, description, settings)
- Generate invitation links
- Email invitations (SendGrid, Resend, Postmark)
- Accept/decline flow
- Public vs private teams (future)

**Email Service:**
- Transactional emails for invites
- Notification preferences
- Digest emails (daily summaries)

---

#### 8.3 Cloud Deployment
**Scope**: Deploy frontend and backend to production.

**Architecture:**
```
Frontend (Vercel):
- Static site hosting
- Automatic previews per commit
- CDN distribution
- HTTPS by default

Backend (Railway/Render):
- Node.js server
- WebSocket support
- Auto-scaling
- Background workers (BullMQ)

Database (Supabase/Railway):
- Managed PostgreSQL
- Automated backups
- Connection pooling

Vector DB (Pinecone):
- Serverless tier
- Multi-region replication

Cache (Upstash Redis):
- Serverless Redis
- Global edge caching
```

**Environment Variables:**
- Secrets management (Doppler, Railway secrets)
- Per-environment configs (dev/staging/prod)
- Secure token storage

**CI/CD:**
- GitHub Actions for tests
- Automatic deployment on merge to `main`
- Preview environments for PRs

---

## Phase 9: Adaptive Interface & Personalization

### Goal
Allow users to customize AI behavior and UI to their preferences.

### Core Features

#### 9.1 Plain-Language Rule Builder
**Scope**: Non-technical users can create custom agent behavior.

**UI Concept:**
```
┌─────────────────────────────────────┐
│ Create Custom Agent Rule            │
├─────────────────────────────────────┤
│ When: [Dropdown: Pattern Detected ] │
│       ▼ Team discusses a decision   │
│                                     │
│ Then: [Dropdown: Create Insight   ] │
│       ▼ Extract action items        │
│                                     │
│ How often: [Every 30 minutes      ] │
│                                     │
│ Priority: [●●●○○] Medium            │
│                                     │
│           [Create Rule] [Cancel]    │
└─────────────────────────────────────┘
```

**Implementation:**
- Template library: "Detect decisions", "Answer repeated questions", "Summarize daily"
- Natural language input: "Remind me if no response for 10 minutes"
- AI converts to structured ChimeRule
- User reviews and activates

**Benefits:**
- Teams customize agent without coding
- Domain-specific behaviors (engineering team vs marketing team)
- Empowers non-technical users

---

#### 9.2 User Preference System
**Scope**: Per-user settings for AI behavior and UI.

**Settings Categories:**

**AI Behavior:**
- Proactivity level: "Only when mentioned" vs "Very active"
- Response style: "Concise" vs "Detailed"
- Notification preferences: Which chimes to enable
- Language/tone: "Professional" vs "Casual"

**UI Preferences:**
- Theme: Light/Dark/Auto
- Layout: Two-column vs Three-column
- Sidebar collapsed by default
- Insight filters (show all vs only high priority)
- Message density (compact vs spacious)

**Notifications:**
- Desktop notifications on/off
- Email digest frequency
- Sound alerts
- Typing indicators on/off

**Database Schema:**
```
UserPreference:
  - userId
  - preferences: JSONB {
      aiProactivity: 'medium',
      responseStyle: 'balanced',
      theme: 'dark',
      layout: 'three-column',
      notifications: {...}
    }
```

---

#### 9.3 Custom Insight Categories
**Scope**: Teams define their own insight types beyond default (summary, action, suggestion).

**Examples:**
- Engineering team: "Bug Report", "Architecture Decision Record"
- Marketing team: "Campaign Idea", "Content Brief"
- Research team: "Literature Note", "Experiment Result"

**Features:**
- Create custom categories with icons and colors
- Filter insights by custom categories
- AI learns to auto-classify into custom types
- Export insights by category

---

## Implementation Priorities

### Critical Path (Required for Production)
1. **Phase 6**: Multi-agent architecture (cost reduction)
2. **Phase 7**: Authentication (security)
3. **Phase 8**: Production deployment (hosting)

### Enhancement Path (Post-Launch)
4. **Phase 9**: Adaptive interface (personalization)

---

## Success Metrics

### Phase 6 Success:
- ✅ 90% of requests handled by Tier 1 agents
- ✅ Cost per 1000 messages < $0.50
- ✅ Chat/insight routing accuracy > 95%
- ✅ Semantic rules reduce false positives by 70%

### Phase 7 Success:
- ✅ Users can sign up and create accounts
- ✅ Team invitations working end-to-end
- ✅ No hardcoded user IDs in codebase

### Phase 8 Success:
- ✅ Frontend deployed and accessible via HTTPS
- ✅ Backend handling concurrent users
- ✅ PostgreSQL operational with backups
- ✅ 99% uptime over 30 days

### Phase 9 Success:
- ✅ Users can create custom rules without code
- ✅ Preference changes persist across sessions
- ✅ Custom insight categories functional

---

## Technical Dependencies

### Phase 6 Requirements:
- OpenAI API (multiple models)
- Response classification logic
- Agent orchestrator service
- Chime rules database (already exists)

### Phase 7 Requirements:
- Clerk account and API keys
- Email service (SendGrid/Resend)
- Updated Prisma schema (TeamMember, Invitation)

### Phase 8 Requirements:
- Vercel account (free tier sufficient)
- Railway/Render account
- Supabase account (or managed Postgres)
- Domain name (optional)
- Environment variable management

### Phase 9 Requirements:
- UserPreference schema
- Custom rule builder UI
- Insight category management UI
- Frontend preference storage

---

## Effort Estimates

| Phase | Description | Estimated Days | Complexity |
|-------|-------------|----------------|------------|
| Phase 6 | Multi-agent architecture | 5-7 days | High |
| Phase 7 | Authentication (Clerk) | 2-3 days | Medium |
| Phase 8 | Production deployment | 3-4 days | Medium |
| Phase 9 | Adaptive interface | 4-5 days | Medium-High |

**Total: 14-19 days** (3-4 weeks at full-time pace)

---

## Risk Assessment

### Phase 6 Risks:
- **Over-complexity**: Too many agents → maintenance burden
- **Mitigation**: Start with 2 tiers, expand only if needed

### Phase 7 Risks:
- **Third-party dependency**: Clerk downtime affects auth
- **Mitigation**: Implement graceful fallback, monitor Clerk status

### Phase 8 Risks:
- **Database migration**: Data loss during SQLite → PostgreSQL
- **Mitigation**: Automated migration script, backup before deploy

### Phase 9 Risks:
- **Feature creep**: Too many customization options
- **Mitigation**: MVP preference set first, expand based on user feedback

---

## Next Steps

1. **Complete Phase 5** (RAG verification and enhancement)
2. **Design Phase 6 architecture** (agent orchestration patterns)
3. **Prototype Tier 1/Tier 2 routing** (validate cost savings)
4. **Set up Clerk development account** (prepare for Phase 7)
5. **Research deployment platforms** (compare Vercel/Railway/Render)

---

**Document Status:** Strategic Planning  
**Last Updated:** November 20, 2025  
**Owner:** Justin Soong  
**Review Cadence:** After each phase completion
