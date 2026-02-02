
import { PrismaClient } from '@prisma/client';
import { embeddingQueue } from '../src/queues/embeddingQueue.js';
import { createEmbeddingWorker, shutdownEmbeddingWorker } from '../src/workers/embeddingWorker.js';
import { redisConnection } from '../src/queues/queueConfig.js';
import { pineconeService } from '../src/services/pineconeService.js';

const prisma = new PrismaClient();

async function testCostOptimization() {
  console.log('🧪 Starting Cost Optimization Test...');

  // 0. Initialize Services
  await pineconeService.initialize();

  // 1. Start Worker
  const worker = createEmbeddingWorker();
  
  try {
    // 2. Create Trivial Message
    const trivialMsg = await prisma.message.create({
      data: {
        content: 'ok',
        teamId: 'team1',
        authorId: 'user1',
        contentType: 'text'
      }
    });
    console.log(`📝 Created trivial message: ${trivialMsg.id} ("ok")`);

    // 3. Create Significant Message
    const significantMsg = await prisma.message.create({
      data: {
        content: 'The project deadline has been moved to next Friday due to the API integration issues.',
        teamId: 'team1',
        authorId: 'user1',
        contentType: 'text'
      }
    });
    console.log(`📝 Created significant message: ${significantMsg.id}`);

    // 4. Enqueue Jobs manually (simulating MessageController)
    await embeddingQueue.add('generate-embedding', {
      messageId: trivialMsg.id,
      content: trivialMsg.content,
      teamId: trivialMsg.teamId,
      authorId: trivialMsg.authorId,
      createdAt: trivialMsg.createdAt
    });

    await embeddingQueue.add('generate-embedding', {
      messageId: significantMsg.id,
      content: significantMsg.content,
      teamId: significantMsg.teamId,
      authorId: significantMsg.authorId,
      createdAt: significantMsg.createdAt
    });

    console.log('⏳ Waiting for worker to process (10s)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 5. Verify Results
    const trivialCheck = await prisma.message.findUnique({ where: { id: trivialMsg.id } });
    const significantCheck = await prisma.message.findUnique({ where: { id: significantMsg.id } });

    console.log('\n📊 Results:');
    
    if (trivialCheck?.embeddingId === null) {
      console.log('✅ Trivial message was SKIPPED (embeddingId is null)');
    } else {
      console.log('❌ Trivial message was PROCESSED (embeddingId is set)');
    }

    if (significantCheck?.embeddingId !== null) {
      console.log('✅ Significant message was PROCESSED (embeddingId is set)');
    } else {
      console.log('❌ Significant message was SKIPPED (embeddingId is null)');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await shutdownEmbeddingWorker(worker);
    // redisConnection is just config, no need to quit
    await prisma.$disconnect();
  }
}

testCostOptimization();
