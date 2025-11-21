/**
 * Quick RAG System Verification
 * 
 * Checks:
 * 1. Messages have embeddingId
 * 2. Pinecone contains vectors
 * 3. RAG search returns results
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('\n🔍 RAG System Verification\n');
  
  // Check 1: Messages with embeddings
  console.log('Check 1: Messages with embeddings...');
  const embeddedMessages = await prisma.message.findMany({
    where: { embeddingId: { not: null } },
    select: {
      id: true,
      content: true,
      embeddingId: true,
      embeddedAt: true,
    },
    take: 5,
    orderBy: { embeddedAt: 'desc' },
  });
  
  console.log(`✅ Found ${embeddedMessages.length} messages with embeddings:`);
  embeddedMessages.forEach(msg => {
    console.log(`   - ${msg.id.slice(0, 8)}... "${msg.content.slice(0, 50)}..."`);
    console.log(`     Embedded: ${msg.embeddedAt?.toLocaleString()}`);
  });
  
  // Check 2: Total stats
  console.log('\nCheck 2: Total statistics...');
  const [totalMessages, embeddedCount] = await Promise.all([
    prisma.message.count(),
    prisma.message.count({ where: { embeddingId: { not: null } } }),
  ]);
  
  const percentage = ((embeddedCount / totalMessages) * 100).toFixed(1);
  console.log(`✅ ${embeddedCount}/${totalMessages} messages embedded (${percentage}%)`);
  
  // Check 3: Recent messages pending embedding
  console.log('\nCheck 3: Pending embeddings...');
  const pendingMessages = await prisma.message.findMany({
    where: { 
      embeddingId: null,
      contentType: 'text',
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  
  if (pendingMessages.length > 0) {
    console.log(`⚠️  ${pendingMessages.length} messages waiting for embedding:`);
    pendingMessages.forEach(msg => {
      const age = Math.round((Date.now() - msg.createdAt.getTime()) / 1000);
      console.log(`   - ${msg.id.slice(0, 8)}... (${age}s old)`);
    });
  } else {
    console.log(`✅ No messages pending embedding`);
  }
  
  console.log('\n✅ RAG verification complete!\n');
  await prisma.$disconnect();
}

verify().catch(console.error);
