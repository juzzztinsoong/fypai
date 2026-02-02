/**
 * UNIFIED SEED SCRIPT
 * 
 * Run with: npx tsx scripts/seed.ts
 * 
 * This is the SINGLE source of truth for seeding the database.
 * Replaces all scattered seeding scripts.
 * 
 * Also clears and resets Pinecone vector index.
 */

import { prisma } from '../src/db.js';
import { RuleSeederService } from '../src/services/ruleSeederService.js';
import { pineconeService } from '../src/services/pineconeService.js';

async function main() {
  console.log('🌱 Starting unified seed...\n');
  
  // ═══════════════════════════════════════════════════════════
  // 0. CLEAR PINECONE INDEX
  // ═══════════════════════════════════════════════════════════
  console.log('🗑️  Clearing Pinecone vector index...');
  try {
    await pineconeService.deleteAllVectors();
    console.log('   ✅ Pinecone index cleared\n');
  } catch (error) {
    console.log('   ⚠️  Pinecone clear failed (may not be configured):', (error as Error).message, '\n');
  }
  
  // ═══════════════════════════════════════════════════════════
  // 1. USERS (AI agent is NOT a user - just a system identifier)
  // ═══════════════════════════════════════════════════════════
  console.log('👤 Seeding users...');
  const users = [
    { id: 'user1', name: 'Alice', email: 'alice@test.com', role: 'user' },
    { id: 'user2', name: 'Bob', email: 'bob@test.com', role: 'user' },
    { id: 'user3', name: 'Charlie', email: 'charlie@test.com', role: 'user' },
  ];
  
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name, email: user.email },
      create: user,
    });
  }
  console.log(`   ✅ ${users.length} users ready\n`);
  
  // ═══════════════════════════════════════════════════════════
  // 2. TEAMS
  // ═══════════════════════════════════════════════════════════
  console.log('👥 Seeding teams...');
  const teams = [
    { id: 'team1', name: 'Alpha Team', isChimeEnabled: true },
    { id: 'team2', name: 'Beta Team', isChimeEnabled: true },
  ];
  
  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: { name: team.name, isChimeEnabled: team.isChimeEnabled },
      create: team,
    });
  }
  console.log(`   ✅ ${teams.length} teams ready\n`);
  
  // ═══════════════════════════════════════════════════════════
  // 3. TEAM MEMBERSHIPS
  // ═══════════════════════════════════════════════════════════
  console.log('🔗 Seeding team memberships...');
  const memberships = [
    { id: 'tm1', teamId: 'team1', userId: 'user1', teamRole: 'owner' },
    { id: 'tm2', teamId: 'team1', userId: 'user2', teamRole: 'member' },
    { id: 'tm3', teamId: 'team1', userId: 'user3', teamRole: 'member' },
    { id: 'tm4', teamId: 'team2', userId: 'user2', teamRole: 'owner' },
    { id: 'tm5', teamId: 'team2', userId: 'user3', teamRole: 'member' },
  ];
  
  for (const m of memberships) {
    await prisma.teamMember.upsert({
      where: { id: m.id },
      update: { teamRole: m.teamRole },
      create: m,
    });
  }
  console.log(`   ✅ ${memberships.length} memberships ready\n`);
  
  // ═══════════════════════════════════════════════════════════
  // 4. CHIME RULES (for each team)
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Seeding chime rules...');
  
  // First, clear existing rules to avoid conflicts
  const deleteResult = await prisma.chimeRule.deleteMany({});
  if (deleteResult.count > 0) {
    console.log(`   🗑️  Cleared ${deleteResult.count} existing rules`);
  }
  
  // Seed rules for all teams
  const result = await RuleSeederService.seedAllTeams();
  console.log(`   ✅ ${result.seeded} teams seeded with rules\n`);
  
  // ═══════════════════════════════════════════════════════════
  // 5. SAMPLE MESSAGES (for testing)
  // ═══════════════════════════════════════════════════════════
  console.log('💬 Seeding sample messages...');
  const messages = [
    // Team 1 conversation
    { id: 'msg1', teamId: 'team1', authorId: 'user1', content: 'Hey team, let\'s discuss the project timeline for next week.', contentType: 'text' },
    { id: 'msg2', teamId: 'team1', authorId: 'user2', content: 'Sure! I think we should focus on the API integration first.', contentType: 'text' },
    { id: 'msg3', teamId: 'team1', authorId: 'user3', content: 'I agree. I can take the frontend components while Bob handles the backend.', contentType: 'text' },
    { id: 'msg4', teamId: 'team1', authorId: 'user1', content: 'Perfect! Let\'s go with that plan. @agent can you summarize our decisions?', contentType: 'text' },
    { id: 'msg5', teamId: 'team1', authorId: 'agent', content: 'Here\'s a summary of your decisions:\n\n1. **Focus**: API integration is the priority for next week\n2. **Task Split**: Charlie handles frontend, Bob handles backend\n3. **Timeline**: Starting immediately\n\nLet me know if you need any help!', contentType: 'text', metadata: JSON.stringify({ chimeRuleName: 'Agent Mention Response' }), agentMetadata: JSON.stringify({ model: 'gpt-4o-mini', tier: 'tier1', tokensUsed: 120, cost: 0.00012 }) },
    { id: 'msg6', teamId: 'team1', authorId: 'user2', content: 'I\'m stuck on the database schema. Not sure how to model the relationships.', contentType: 'text' },
    { id: 'msg7', teamId: 'team1', authorId: 'agent', content: 'I noticed you\'re stuck! For database relationships, consider:\n\n1. Start with your main entities (User, Team, etc.)\n2. Map the relationships (one-to-many, many-to-many)\n3. Use junction tables for many-to-many\n\nWould you like me to help design the schema?', contentType: 'text', metadata: JSON.stringify({ chimeRuleName: 'Blocker Alert' }), agentMetadata: JSON.stringify({ model: 'gpt-4o-mini', tier: 'tier1', tokensUsed: 95, cost: 0.00009, confidence: 0.85 }) },
    
    // Team 2 conversation  
    { id: 'msg8', teamId: 'team2', authorId: 'user2', content: 'Starting the design review for the new dashboard.', contentType: 'text' },
    { id: 'msg9', teamId: 'team2', authorId: 'user3', content: 'Looking good! I like the minimalist approach.', contentType: 'text' },
  ];
  
  for (const msg of messages) {
    await prisma.message.upsert({
      where: { id: msg.id },
      update: { content: msg.content },
      create: {
        id: msg.id,
        teamId: msg.teamId,
        authorId: msg.authorId,
        content: msg.content,
        contentType: msg.contentType,
        metadata: (msg as any).metadata || null,
        agentMetadata: (msg as any).agentMetadata || null,
      },
    });
  }
  console.log(`   ✅ ${messages.length} messages ready\n`);
  
  // ═══════════════════════════════════════════════════════════
  // 6. SAMPLE AI INSIGHTS (for testing)
  // ═══════════════════════════════════════════════════════════
  console.log('🤖 Seeding sample AI insights...');
  const insights = [
    {
      id: 'insight1',
      teamId: 'team1',
      type: 'action',
      title: 'Task Assignment Captured',
      content: '**Action Item Detected**\n\n- **Owner**: Charlie\n- **Task**: Handle frontend components\n- **Deadline**: Next week\n- **Context**: Part of API integration project',
      priority: 'high',
      tags: JSON.stringify(['auto-generated', 'action', 'commitment']),
    },
    {
      id: 'insight2',
      teamId: 'team1',
      type: 'action',
      title: 'Task Assignment Captured',
      content: '**Action Item Detected**\n\n- **Owner**: Bob\n- **Task**: Handle backend API integration\n- **Deadline**: Next week\n- **Context**: Working alongside Charlie on frontend',
      priority: 'high',
      tags: JSON.stringify(['auto-generated', 'action', 'commitment']),
    },
    {
      id: 'insight3',
      teamId: 'team1',
      type: 'summary',
      title: 'Project Planning Summary',
      content: '## Team Discussion Summary\n\nThe team discussed project planning for next week:\n\n### Key Decisions\n1. API integration is the priority\n2. Work split between frontend (Charlie) and backend (Bob)\n\n### Blockers Identified\n- Bob needs help with database schema design\n\n### Next Steps\n- Continue with assigned tasks\n- Review database schema together',
      priority: 'medium',
      tags: JSON.stringify(['auto-generated', 'summary', 'gpt-4o']),
    },
  ];
  
  for (const insight of insights) {
    await prisma.aIInsight.upsert({
      where: { id: insight.id },
      update: { content: insight.content },
      create: insight,
    });
  }
  console.log(`   ✅ ${insights.length} insights ready\n`);
  
  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log('📊 Final database state:');
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.team.count(),
    prisma.teamMember.count(),
    prisma.chimeRule.count(),
    prisma.message.count(),
    prisma.aIInsight.count(),
  ]);
  console.log(`   Users: ${counts[0]}`);
  console.log(`   Teams: ${counts[1]}`);
  console.log(`   Memberships: ${counts[2]}`);
  console.log(`   Chime Rules: ${counts[3]}`);
  console.log(`   Messages: ${counts[4]}`);
  console.log(`   AI Insights: ${counts[5]}`);
  
  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
