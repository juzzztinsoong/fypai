
import 'dotenv/config';
import { ragService } from '../src/services/ragService.js';
import { prisma } from '../src/db.js';
import { pineconeService } from '../src/services/pineconeService.js';
import { MessageController } from '../src/controllers/messageController.js';
import { embeddingQueue } from '../src/queues/embeddingQueue.js';
import { disconnectRedis } from '../src/services/redis.js';

/**
 * Similarity Threshold Tuning Script
 * 
 * Runs a set of queries against a test dataset with varying thresholds
 * to help determine the optimal similarity threshold for RAG.
 * 
 * Usage: npx tsx tune-similarity-threshold.ts
 */

async function runTuning() {
  console.log('🎚️  Starting Similarity Threshold Tuning...\n');

  const teamId = 'tuning-team';
  const thresholds = [0.6, 0.65, 0.7, 0.75, 0.8, 0.85];
  
  try {
    await pineconeService.initialize();
    
    // Cleanup
    await prisma.message.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    
    // Setup
    await prisma.team.create({ data: { id: teamId, name: 'Tuning Team' } });
    
    // Ensure user exists
    const userId = 'user1';
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      await prisma.user.create({
        data: { id: userId, name: 'Test User', role: 'member' }
      });
    }

    console.log('📝 Seeding corpus...');
    
    const corpus = [
      "The API endpoint for user login is POST /api/auth/login.",
      "To reset your password, click the 'Forgot Password' link on the login page.",
      "The database schema uses PostgreSQL with Prisma ORM.",
      "We use Redis for caching session data and background jobs.",
      "The frontend is built with React and TailwindCSS.",
      "Deployment is handled via Vercel for frontend and Railway for backend.",
      "The project uses a monorepo structure with npm workspaces.",
      "AI features are powered by OpenAI's GPT-4o model.",
      "Vector embeddings are stored in Pinecone.",
      "Real-time updates are managed by Socket.IO."
    ];

    // Seed messages
    for (const content of corpus) {
      await MessageController.createMessage({
        teamId,
        authorId: userId,
        content,
        contentType: 'text'
      });
    }

    // Wait for embeddings
    console.log('⏳ Waiting for embeddings (10s)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const queries = [
      { q: "How do I log in?", expected: "POST /api/auth/login" },
      { q: "What database do we use?", expected: "PostgreSQL" },
      { q: "Where is the frontend deployed?", expected: "Vercel" },
      { q: "How does the AI work?", expected: "GPT-4o" },
      { q: "What about real-time?", expected: "Socket.IO" },
      { q: "Tell me about the weather", expected: null } // Negative test
    ];

    console.log('\n📊 Results:\n');

    // Debug run to see actual scores
    console.log('--- Debug: Checking Top Scores ---');
    for (const { q, expected } of queries) {
        const result = await ragService.getRelevantContext(q, teamId, 3, 0.1); // Low threshold
        if (result.relevantMessages.length > 0) {
            const top = result.relevantMessages[0];
            console.log(`Q: "${q}"`);
            console.log(`   Top Match: "${top.content.substring(0, 50)}..."`);
            console.log(`   Score: ${top.relevanceScore}`);
        } else {
            console.log(`Q: "${q}" -> No results even at 0.1 threshold`);
        }
    }
    console.log('----------------------------------\n');

    for (const threshold of thresholds) {
      console.log(`\n--- Threshold: ${threshold} ---`);
      let hits = 0;
      let falsePositives = 0;
      let misses = 0;

      for (const { q, expected } of queries) {
        const result = await ragService.getRelevantContext(q, teamId, 3, threshold);
        const retrieved = result.relevantMessages.map(m => m.content);
        
        const found = expected ? retrieved.some(c => c.includes(expected)) : false;
        const hasResults = retrieved.length > 0;

        if (expected) {
          if (found) hits++;
          else misses++;
        } else {
          if (hasResults) falsePositives++;
        }
        
        // console.log(`   Q: "${q}" -> Found: ${retrieved.length} msgs`);
      }

      console.log(`   Hits: ${hits}/${queries.length - 1}`);
      console.log(`   Misses: ${misses}`);
      console.log(`   False Positives: ${falsePositives}`);
    }

  } catch (error) {
    console.error('❌ Tuning Failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await prisma.message.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    
    // Close connections
    await prisma.$disconnect();
    await embeddingQueue.close();
    await disconnectRedis();
    console.log('👋 Connections closed');
  }
}

runTuning();
