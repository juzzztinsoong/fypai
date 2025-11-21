/**
 * Backfill Embeddings for Existing Messages
 * 
 * Queues embedding jobs for messages created before RAG deployment
 */

import { PrismaClient } from '@prisma/client';
import { queueMessageEmbedding } from './src/queues/embeddingQueue.js';

const prisma = new PrismaClient();

async function backfillEmbeddings() {
  console.log('\n🔄 Backfilling Embeddings for Existing Messages\n');
  
  // Find all text messages without embeddings
  const unembeddedMessages = await prisma.message.findMany({
    where: {
      embeddingId: null,
      contentType: 'text',
    },
    orderBy: { createdAt: 'desc' },
  });
  
  console.log(`Found ${unembeddedMessages.length} messages to embed`);
  
  let queued = 0;
  let skipped = 0;
  
  for (const msg of unembeddedMessages) {
    // Skip very short messages (not useful for RAG)
    if (msg.content.trim().length < 10) {
      skipped++;
      continue;
    }
    
    try {
      await queueMessageEmbedding({
        messageId: msg.id,
        teamId: msg.teamId,
        content: msg.content,
        authorId: msg.authorId,
        createdAt: msg.createdAt.toISOString(),
        priority: 2, // Lower priority than new messages
      });
      queued++;
      
      if (queued % 10 === 0) {
        console.log(`  Queued ${queued} messages...`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to queue message ${msg.id}:`, error);
    }
  }
  
  console.log(`\n✅ Backfill complete!`);
  console.log(`   Queued: ${queued}`);
  console.log(`   Skipped: ${skipped} (too short)`);
  console.log(`\nEmbedding worker will process these in the background.\n`);
  
  await prisma.$disconnect();
}

backfillEmbeddings().catch(console.error);
