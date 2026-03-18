/**
 * UNIFIED SEED SCRIPT
 * 
 * Run with:  npx tsx scripts/seed.ts
 * npm alias: npm run seed
 * 
 * This is the SINGLE source of truth for seeding the database.
 * It replaces all scattered seeding scripts and JSON files.
 * 
 * What it does:
 *   1. Wipes all database tables (cascade-safe order)
 *   2. Clears Pinecone vector index
 *   3. Seeds users, teams, memberships, messages, insights
 *   4. Prints a summary of the final database state
 * 
 * Design decisions:
 *   - AI Agent is NOT a user row — "agent" is just a system authorId
 *     (but we create a minimal user row for the FK constraint)
 *   - Memberships are explicit (no agent in memberships)
 *   - Agent messages include agentMetadata (model, tier, cost, tokens)
 *   - Timestamps use relative helpers so seed data always looks "recent"
 */

import { prisma } from './db.js';
import { pineconeService } from './services/pineconeService.js';

// ─── Timestamp Helpers ──────────────────────────────────────

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting unified seed...\n');

  // ═══════════════════════════════════════════════════════════
  // 0. FULL CLEANUP
  // ═══════════════════════════════════════════════════════════
  console.log('🗑️  Wiping database (cascade-safe order)...');

  // Delete in reverse-dependency order to avoid FK violations
  const deleted = {
    chimeLogs:  (await prisma.chimeLog.deleteMany({})).count,
    chimeRules: (await prisma.chimeRule.deleteMany({})).count,
    insights:   (await prisma.aIInsight.deleteMany({})).count,
    messages:   (await prisma.message.deleteMany({})).count,
    members:    (await prisma.teamMember.deleteMany({})).count,
    teams:      (await prisma.team.deleteMany({})).count,
    users:      (await prisma.user.deleteMany({})).count,
  };
  console.log('   Deleted:', deleted);

  console.log('\n🗑️  Clearing Pinecone vector index...');
  try {
    await pineconeService.deleteAllVectors();
    console.log('   ✅ Pinecone index cleared');
  } catch (error) {
    console.log('   ⚠️  Pinecone clear skipped:', (error as Error).message);
  }

  // ═══════════════════════════════════════════════════════════
  // 1. USERS
  //    AI agent is NOT a real user — but we need a row for FK.
  //    It is created later, just before messages.
  // ═══════════════════════════════════════════════════════════
  console.log('\n👤 Seeding users...');
  const users = [
    { id: 'user1', name: 'Alice',   email: 'alice@example.com',   role: 'admin'  },
    { id: 'user2', name: 'Bob',     email: 'bob@example.com',     role: 'member' },
    { id: 'user3', name: 'Charlie', email: 'charlie@example.com', role: 'admin'  },
    { id: 'user4', name: 'David',   email: 'david@example.com',   role: 'admin'  },
    { id: 'user5', name: 'Emma',    email: 'emma@example.com',    role: 'member' },
    { id: 'user6', name: 'Frank',   email: 'frank@example.com',   role: 'member' },
    { id: 'user7', name: 'Grace',   email: 'grace@example.com',   role: 'member' },
    { id: 'user8', name: 'Henry',   email: 'henry@example.com',   role: 'member' },
  ];

  // Create human users
  for (const u of users) {
    await prisma.user.create({ data: u });
  }
  // Create system agent user (needed for FK on memberships and messages)
  await prisma.user.create({ data: { id: 'agent', name: 'AI Agent', role: 'agent' } });
  console.log(`   ✅ ${users.length} users + 1 system agent`);

  // ═══════════════════════════════════════════════════════════
  // 2. TEAMS
  // ═══════════════════════════════════════════════════════════
  console.log('\n👥 Seeding teams...');
  const teams = [
    { id: 'team1', name: 'Sample Team',      isChimeEnabled: true, createdAt: daysAgo(30) },
    { id: 'team2', name: 'AI Research',       isChimeEnabled: true, createdAt: daysAgo(20) },
    { id: 'team3', name: 'Project Alpha',     isChimeEnabled: true, createdAt: daysAgo(15) },
    { id: 'team4', name: 'Design Sprint',     isChimeEnabled: true, createdAt: daysAgo(10) },
    { id: 'team5', name: 'Backend Services',  isChimeEnabled: true, createdAt: daysAgo(25) },
    { id: 'team6', name: 'Data Science Lab',  isChimeEnabled: true, createdAt: daysAgo(18) },
  ];

  for (const t of teams) {
    await prisma.team.create({ data: t });
  }
  console.log(`   ✅ ${teams.length} teams`);

  // ═══════════════════════════════════════════════════════════
  // 3. TEAM MEMBERSHIPS (humans + agent in every team)
  // ═══════════════════════════════════════════════════════════
  console.log('\n🔗 Seeding memberships...');
  const memberships = [
    // team1 — Sample Team
    { teamId: 'team1', userId: 'user1', teamRole: 'admin',  joinedAt: daysAgo(30) },
    { teamId: 'team1', userId: 'user2', teamRole: 'member', joinedAt: daysAgo(25) },
    // team2 — AI Research
    { teamId: 'team2', userId: 'user1', teamRole: 'member', joinedAt: daysAgo(20) },
    { teamId: 'team2', userId: 'user3', teamRole: 'admin',  joinedAt: daysAgo(20) },
    // team3 — Project Alpha
    { teamId: 'team3', userId: 'user1', teamRole: 'member', joinedAt: daysAgo(15) },
    { teamId: 'team3', userId: 'user4', teamRole: 'admin',  joinedAt: daysAgo(15) },
    { teamId: 'team3', userId: 'user5', teamRole: 'member', joinedAt: daysAgo(10) },
    // team4 — Design Sprint
    { teamId: 'team4', userId: 'user1', teamRole: 'admin',  joinedAt: daysAgo(10) },
    { teamId: 'team4', userId: 'user6', teamRole: 'member', joinedAt: daysAgo(8)  },
    // team5 — Backend Services
    { teamId: 'team5', userId: 'user1', teamRole: 'member', joinedAt: daysAgo(25) },
    { teamId: 'team5', userId: 'user2', teamRole: 'admin',  joinedAt: daysAgo(25) },
    { teamId: 'team5', userId: 'user7', teamRole: 'member', joinedAt: daysAgo(20) },
    // team6 — Data Science Lab
    { teamId: 'team6', userId: 'user3', teamRole: 'admin',  joinedAt: daysAgo(18) },
    { teamId: 'team6', userId: 'user8', teamRole: 'member', joinedAt: daysAgo(15) },
    // Agent is a member of every team (no role)
    { teamId: 'team1', userId: 'agent', teamRole: null, joinedAt: daysAgo(30) },
    { teamId: 'team2', userId: 'agent', teamRole: null, joinedAt: daysAgo(20) },
    { teamId: 'team3', userId: 'agent', teamRole: null, joinedAt: daysAgo(15) },
    { teamId: 'team4', userId: 'agent', teamRole: null, joinedAt: daysAgo(10) },
    { teamId: 'team5', userId: 'agent', teamRole: null, joinedAt: daysAgo(25) },
    { teamId: 'team6', userId: 'agent', teamRole: null, joinedAt: daysAgo(18) },
  ];

  for (const m of memberships) {
    await prisma.teamMember.create({ data: m });
  }
  console.log(`   ✅ ${memberships.length} memberships`);

  // ═══════════════════════════════════════════════════════════
  // 4. MESSAGES
  //    Create a minimal 'agent' user row for the FK constraint,
  //    then seed all team messages with agentMetadata on AI msgs.
  // ═══════════════════════════════════════════════════════════
  console.log('\n💬 Seeding messages...');
  const messages = [
    // ── team1: Sample Team ──────────────────────────────────
    {
      id: 'msg1', teamId: 'team1', authorId: 'user1',
      content: 'Welcome to Sample Team! Let\'s collaborate.',
      contentType: 'text',
      createdAt: minutesAgo(60),
    },
    {
      id: 'msg2', teamId: 'team1', authorId: 'agent',
      content: 'Hi, I am your AI assistant. How can I help?',
      contentType: 'text',
      createdAt: minutesAgo(58),
      metadata: JSON.stringify({ suggestions: ['Summarize last meeting', 'Draft project plan'] }),
      agentMetadata: JSON.stringify({
        model: 'gpt-4o-mini', tier: 'tier1',
        tokensUsed: 85, cost: 0.00008, latencyMs: 620, confidence: 0.92,
      }),
    },
    {
      id: 'msg3', teamId: 'team1', authorId: 'user2',
      content: 'Can we schedule a sync tomorrow?',
      contentType: 'text',
      createdAt: minutesAgo(30),
    },

    // ── team2: AI Research ──────────────────────────────────
    {
      id: 'msg4', teamId: 'team2', authorId: 'user3',
      content: 'Let\'s discuss the new AI model architecture.',
      contentType: 'text',
      createdAt: minutesAgo(120),
    },
    {
      id: 'msg5', teamId: 'team2', authorId: 'agent',
      content: 'Here are some research papers you might find useful for transformer models.',
      contentType: 'text',
      createdAt: minutesAgo(118),
      metadata: JSON.stringify({ suggestions: ['Summarize papers', 'Generate experiment plan'] }),
      agentMetadata: JSON.stringify({
        model: 'gpt-4o', tier: 'tier2',
        tokensUsed: 210, cost: 0.0042, latencyMs: 1450, confidence: 0.88,
      }),
    },
    {
      id: 'msg6', teamId: 'team2', authorId: 'user1',
      content: 'Thanks! I\'ll review these papers.',
      contentType: 'text',
      createdAt: minutesAgo(60),
    },

    // ── team3: Project Alpha ────────────────────────────────
    {
      id: 'msg7', teamId: 'team3', authorId: 'user4',
      content: 'Project Alpha kickoff meeting starts now.',
      contentType: 'text',
      createdAt: minutesAgo(180),
    },
    {
      id: 'msg8', teamId: 'team3', authorId: 'user1',
      content: 'I\'ve completed the component library setup.',
      contentType: 'text',
      createdAt: minutesAgo(150),
    },
    {
      id: 'msg9', teamId: 'team3', authorId: 'user5',
      content: 'Great work! Let\'s integrate it with the API.',
      contentType: 'text',
      createdAt: minutesAgo(120),
    },
    {
      id: 'msg10', teamId: 'team3', authorId: 'agent',
      content: 'I can help generate API integration boilerplate code if needed.',
      contentType: 'text',
      createdAt: minutesAgo(90),
      metadata: JSON.stringify({ suggestions: ['Generate API client', 'Create type definitions'] }),
      agentMetadata: JSON.stringify({
        model: 'gpt-4o-mini', tier: 'tier1',
        tokensUsed: 95, cost: 0.00009, latencyMs: 780, confidence: 0.85,
      }),
    },

    // ── team4: Design Sprint ────────────────────────────────
    {
      id: 'msg11', teamId: 'team4', authorId: 'user1',
      content: 'New design sprint starting today! 🎨',
      contentType: 'text',
      createdAt: minutesAgo(240),
    },
    {
      id: 'msg12', teamId: 'team4', authorId: 'user6',
      content: 'I\'ve uploaded the Figma mockups to the shared drive.',
      contentType: 'text',
      createdAt: minutesAgo(210),
    },
    {
      id: 'msg13', teamId: 'team4', authorId: 'agent',
      content: 'I can help analyze the design system for consistency and accessibility.',
      contentType: 'text',
      createdAt: minutesAgo(180),
      metadata: JSON.stringify({ suggestions: ['Check color contrast', 'Generate component specs'] }),
      agentMetadata: JSON.stringify({
        model: 'gpt-4o-mini', tier: 'tier1',
        tokensUsed: 110, cost: 0.00011, latencyMs: 550, confidence: 0.90,
      }),
    },

    // ── team5: Backend Services ─────────────────────────────
    {
      id: 'msg14', teamId: 'team5', authorId: 'user2',
      content: 'Backend API v2 is ready for testing.',
      contentType: 'text',
      createdAt: minutesAgo(300),
    },
    {
      id: 'msg15', teamId: 'team5', authorId: 'user1',
      content: 'Awesome! I\'ll start integration testing from the frontend.',
      contentType: 'text',
      createdAt: minutesAgo(270),
    },
    {
      id: 'msg16', teamId: 'team5', authorId: 'user7',
      content: 'Database migrations look good. All tests passing.',
      contentType: 'text',
      createdAt: minutesAgo(240),
    },
    {
      id: 'msg17', teamId: 'team5', authorId: 'agent',
      content: 'I can help with API documentation generation and test coverage analysis.',
      contentType: 'text',
      createdAt: minutesAgo(210),
      metadata: JSON.stringify({ suggestions: ['Generate OpenAPI spec', 'Run coverage report'] }),
      agentMetadata: JSON.stringify({
        model: 'gpt-4o-mini', tier: 'tier1',
        tokensUsed: 130, cost: 0.00013, latencyMs: 690, confidence: 0.87,
      }),
    },
  ];

  for (const msg of messages) {
    await prisma.message.create({ data: msg });
  }
  console.log(`   ✅ ${messages.length} messages (${messages.filter(m => m.authorId === 'agent').length} from agent)`);

  // ═══════════════════════════════════════════════════════════
  // 6. AI INSIGHTS (with agentMetadata)
  // ═══════════════════════════════════════════════════════════
  console.log('\n🤖 Seeding AI insights...');
  const insights = [
    // ── team1 insights ──────────────────────────────────────
    {
      id: 'insight1', teamId: 'team1', type: 'summary',
      title: 'Chat Summary',
      content: 'The team discussed project collaboration and scheduling. Alice welcomed the team, the AI assistant offered help, and Bob requested a sync meeting for tomorrow.',
      priority: 'medium',
      tags: JSON.stringify(['meeting', 'collaboration']),
      createdAt: minutesAgo(30),
      relatedMessageIds: JSON.stringify(['msg1', 'msg2', 'msg3']),
      agentMetadata: JSON.stringify({ model: 'gpt-4o', tier: 'tier2', tokensUsed: 180, cost: 0.0036 }),
    },
    {
      id: 'insight2', teamId: 'team1', type: 'action',
      title: 'Action Items',
      content: '• Schedule sync meeting for tomorrow\n• Review project plan draft\n• Set up collaboration tools',
      priority: 'high',
      tags: JSON.stringify(['action-items', 'meeting']),
      createdAt: minutesAgo(28),
      agentMetadata: JSON.stringify({ model: 'gpt-4o-mini', tier: 'tier1', tokensUsed: 90, cost: 0.00009 }),
    },
    {
      id: 'insight3', teamId: 'team1', type: 'suggestion',
      title: 'AI Suggestions',
      content: 'Based on the conversation, I recommend:\n\n1. Create a shared project roadmap\n2. Set up recurring weekly syncs\n3. Define clear roles and responsibilities',
      priority: 'medium',
      tags: JSON.stringify(['recommendations', 'planning']),
      createdAt: minutesAgo(26),
      agentMetadata: JSON.stringify({ model: 'gpt-4o-mini', tier: 'tier1', tokensUsed: 120, cost: 0.00012 }),
    },

    // ── team2 insights ──────────────────────────────────────
    {
      id: 'insight4', teamId: 'team2', type: 'summary',
      title: 'Research Discussion Summary',
      content: 'The team is exploring new AI model architectures. Discussion focused on transformer models and relevant research papers.',
      priority: 'high',
      tags: JSON.stringify(['research', 'ai', 'transformers']),
      createdAt: minutesAgo(120),
      relatedMessageIds: JSON.stringify(['msg4', 'msg5', 'msg6']),
      agentMetadata: JSON.stringify({ model: 'gpt-4o', tier: 'tier2', tokensUsed: 250, cost: 0.005 }),
    },
    {
      id: 'insight5', teamId: 'team2', type: 'document',
      title: 'Research Papers Collection',
      content: '## Key Papers on Transformer Models\n\n1. "Attention is All You Need" - Vaswani et al.\n2. "BERT: Pre-training of Deep Bidirectional Transformers" - Devlin et al.\n3. "GPT-3: Language Models are Few-Shot Learners" - Brown et al.\n\nThese papers provide foundational knowledge for your model architecture discussion.',
      priority: 'high',
      tags: JSON.stringify(['research', 'papers', 'reading-list']),
      createdAt: minutesAgo(118),
      agentMetadata: JSON.stringify({ model: 'gpt-4o', tier: 'tier2', tokensUsed: 320, cost: 0.0064 }),
    },

    // ── team3 insights ──────────────────────────────────────
    {
      id: 'insight6', teamId: 'team3', type: 'summary',
      title: 'Project Alpha Kickoff',
      content: 'Team started Project Alpha with component library setup completed by Alice. Discussion about API integration is underway.',
      priority: 'high',
      tags: JSON.stringify(['project-alpha', 'development']),
      createdAt: minutesAgo(90),
      relatedMessageIds: JSON.stringify(['msg7', 'msg8', 'msg9', 'msg10']),
      agentMetadata: JSON.stringify({ model: 'gpt-4o', tier: 'tier2', tokensUsed: 200, cost: 0.004 }),
    },
    {
      id: 'insight7', teamId: 'team3', type: 'code',
      title: 'API Integration Boilerplate',
      content: '```typescript\n// API Client boilerplate\nimport axios from \'axios\';\n\nconst apiClient = axios.create({\n  baseURL: process.env.REACT_APP_API_URL,\n  headers: {\n    \'Content-Type\': \'application/json\',\n  },\n});\n\nexport const fetchData = async (endpoint: string) => {\n  const response = await apiClient.get(endpoint);\n  return response.data;\n};\n```',
      priority: null,
      tags: JSON.stringify(['code', 'api']),
      createdAt: minutesAgo(88),
      metadata: JSON.stringify({ language: 'typescript', filename: 'apiClient.ts' }),
      agentMetadata: JSON.stringify({ model: 'gpt-4o-mini', tier: 'tier1', tokensUsed: 150, cost: 0.00015 }),
    },

    // ── team4 insights ──────────────────────────────────────
    {
      id: 'insight8', teamId: 'team4', type: 'analysis',
      title: 'Design System Analysis',
      content: '## Design System Review\n\n**Color Contrast:** All colors pass WCAG AA standards\n**Component Consistency:** 95% consistency across mockups\n**Accessibility Score:** 92/100\n\n**Recommendations:**\n- Add focus states to all interactive elements\n- Increase touch target sizes on mobile\n- Add alt text guidelines for images',
      priority: 'medium',
      tags: JSON.stringify(['design', 'accessibility', 'analysis']),
      createdAt: minutesAgo(180),
      relatedMessageIds: JSON.stringify(['msg11', 'msg12', 'msg13']),
      agentMetadata: JSON.stringify({ model: 'gpt-4o', tier: 'tier2', tokensUsed: 280, cost: 0.0056 }),
    },

    // ── team5 insights ──────────────────────────────────────
    {
      id: 'insight9', teamId: 'team5', type: 'summary',
      title: 'Backend API v2 Status',
      content: 'Backend API v2 is ready for testing. Frontend integration testing is starting, and all database migrations have been completed successfully with passing tests.',
      priority: 'high',
      tags: JSON.stringify(['backend', 'testing', 'api']),
      createdAt: minutesAgo(210),
      relatedMessageIds: JSON.stringify(['msg14', 'msg15', 'msg16', 'msg17']),
      agentMetadata: JSON.stringify({ model: 'gpt-4o', tier: 'tier2', tokensUsed: 190, cost: 0.0038 }),
    },
    {
      id: 'insight10', teamId: 'team5', type: 'document',
      title: 'API Documentation',
      content: '## API v2 Endpoints\n\n### Authentication\n- `POST /auth/login` - User login\n- `POST /auth/logout` - User logout\n- `POST /auth/refresh` - Refresh token\n\n### Teams\n- `GET /teams` - List all teams\n- `POST /teams` - Create team\n- `GET /teams/:id` - Get team details\n\n### Messages\n- `GET /teams/:id/messages` - Get team messages\n- `POST /teams/:id/messages` - Send message',
      priority: 'high',
      tags: JSON.stringify(['api', 'documentation', 'endpoints']),
      createdAt: minutesAgo(208),
      agentMetadata: JSON.stringify({ model: 'gpt-4o-mini', tier: 'tier1', tokensUsed: 160, cost: 0.00016 }),
    },
  ];

  for (const insight of insights) {
    await prisma.aIInsight.create({ data: insight });
  }
  console.log(`   ✅ ${insights.length} insights across ${new Set(insights.map(i => i.teamId)).size} teams`);

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log('📊 FINAL DATABASE STATE');
  console.log('═'.repeat(50));

  const [userCount, teamCount, memberCount, ruleCount, msgCount, insightCount, logCount] = await Promise.all([
    prisma.user.count(),
    prisma.team.count(),
    prisma.teamMember.count(),
    prisma.chimeRule.count(),
    prisma.message.count(),
    prisma.aIInsight.count(),
    prisma.chimeLog.count(),
  ]);

  console.log(`   Users:        ${userCount} (${userCount - 1} humans + 1 system agent)`);
  console.log(`   Teams:        ${teamCount}`);
  console.log(`   Memberships:  ${memberCount}`);
  console.log(`   Chime Rules:  ${ruleCount}`);
  console.log(`   Messages:     ${msgCount}`);
  console.log(`   AI Insights:  ${insightCount}`);
  console.log(`   Chime Logs:   ${logCount}`);
  console.log('═'.repeat(50));
  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
