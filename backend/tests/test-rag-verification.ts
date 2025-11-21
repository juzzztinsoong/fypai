
import 'dotenv/config';
import { ragService } from '../src/services/ragService.js';
import { prisma } from '../src/db.js';
import { pineconeService } from '../src/services/pineconeService.js';
import { embeddingService } from '../src/services/embeddingService.js';
import { MessageController } from '../src/controllers/messageController.js';
import { embeddingQueue } from '../src/queues/embeddingQueue.js';
import { disconnectRedis } from '../src/services/redis.js';

/**
 * RAG Verification Test Suite
 * 
 * Tests the end-to-end RAG flow:
 * 1. Basic Retrieval
 * 2. Team Scoping
 * 3. Recency vs Relevance
 * 4. Threshold Checks
 */

async function runTests() {
  console.log('🧪 Starting RAG Verification Tests...\n');

  // Setup: Ensure we have a test team and messages
  const teamId = 'test-team-rag';
  const otherTeamId = 'test-team-rag-other';
  
  try {
    // Initialize services
    await pineconeService.initialize();
    
    // Cleanup previous tests
    await prisma.message.deleteMany({ where: { teamId: { in: [teamId, otherTeamId] } } });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    
    // Create teams
    await prisma.team.create({ data: { id: teamId, name: 'RAG Test Team' } });
    await prisma.team.create({ data: { id: otherTeamId, name: 'Other Team' } });

    // Ensure user exists
    const userId = 'user1';
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      await prisma.user.create({
        data: { id: userId, name: 'Test User', role: 'member' }
      });
    }

    // Create memberships (optional but good practice)
    await prisma.teamMember.create({ data: { teamId, userId, teamRole: 'owner' } });
    await prisma.teamMember.create({ data: { teamId: otherTeamId, userId, teamRole: 'owner' } });

    console.log('📝 Seeding test data...');

    // 1. Seed Topic A (JWT Auth) in Team 1
    const msg1 = await MessageController.createMessage({
      teamId,
      authorId: 'user1',
      content: 'We should use JWT for authentication because it is stateless.',
      contentType: 'text'
    });
    
    // 2. Seed Topic B (Cookies) in Team 2
    await MessageController.createMessage({
      teamId: otherTeamId,
      authorId: 'user1',
      content: 'We should use Cookies for authentication because they are more secure.',
      contentType: 'text'
    });

    // 3. Seed Old Message (Recency Test)
    const oldMsg = await prisma.message.create({
      data: {
        teamId,
        authorId: 'user1',
        content: 'The legacy system used Basic Auth.',
        contentType: 'text',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      }
    });
    // Manually embed old message since createMessage wasn't used
    const { embedding } = await embeddingService.generateEmbedding(oldMsg.content);
    await pineconeService.upsertVector({
      id: oldMsg.id,
      values: embedding,
      metadata: {
        messageId: oldMsg.id,
        teamId,
        authorId: oldMsg.authorId,
        content: oldMsg.content,
        createdAt: oldMsg.createdAt.toISOString(),
        contentType: oldMsg.contentType
      }
    });

    // Wait for embeddings to settle (if async)
    console.log('⏳ Waiting for embeddings to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // --- TEST 1: Basic Retrieval ---
    console.log('\n--- Test 1: Basic Retrieval ---');
    const res1 = await ragService.getRelevantContext('Why use JWT?', teamId);
    if (res1.relevantMessages.some(m => m.content.includes('stateless'))) {
      console.log('✅ PASS: Retrieved JWT context');
    } else {
      console.error('❌ FAIL: Did not retrieve JWT context');
      console.log('Results:', res1.relevantMessages.map(m => m.content));
    }

    // --- TEST 2: Team Scoping ---
    console.log('\n--- Test 2: Team Scoping ---');
    const res2 = await ragService.getRelevantContext('authentication', teamId);
    const leaked = res2.relevantMessages.some(m => m.teamId === otherTeamId);
    if (!leaked) {
      console.log('✅ PASS: No cross-team leakage');
    } else {
      console.error('❌ FAIL: Leaked messages from other team');
    }

    // --- TEST 3: Recency vs Relevance ---
    console.log('\n--- Test 3: Recency vs Relevance ---');
    // Query specifically for the old topic
    const res3 = await ragService.getRelevantContext('Basic Auth legacy', teamId);
    if (res3.relevantMessages.some(m => m.id === oldMsg.id)) {
      console.log('✅ PASS: Retrieved old relevant message');
    } else {
      console.error('❌ FAIL: Failed to retrieve old relevant message');
    }

    // --- TEST 4: Threshold Check ---
    console.log('\n--- Test 4: Threshold Check ---');
    const res4 = await ragService.getRelevantContext('Supercalifragilisticexpialidocious', teamId, 5, 0.9);
    if (res4.relevantMessages.length === 0) {
      console.log('✅ PASS: No results for nonsense query (high threshold)');
    } else {
      console.error('❌ FAIL: Returned results for nonsense query');
      console.log('Results:', res4.relevantMessages.map(m => m.content));
    }

  } catch (error) {
    console.error('❌ Test Suite Failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await prisma.message.deleteMany({ where: { teamId: { in: [teamId, otherTeamId] } } });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    
    // Close connections
    await prisma.$disconnect();
    await embeddingQueue.close();
    await disconnectRedis();
    console.log('👋 Connections closed');
  }
}

runTests();
