
import { prisma } from '../src/db';
import { UnifiedRuleEngine } from '../src/ai/autonomous/unifiedRuleEngine';
import { MessageController } from '../src/controllers/messageController';
import { embeddingService } from '../src/services/embeddingService';
import { v4 as uuidv4 } from 'uuid';

async function testMultiAgentArchitecture() {
  console.log('🚀 Starting Phase 6 Multi-Agent Test Suite...');

  // 1. Setup Test Data
  const teamId = uuidv4();
  const userId = uuidv4();
  
  console.log(`\n1️⃣ Setting up test environment (Team: ${teamId})`);
  
  await prisma.team.create({
    data: { id: teamId, name: 'Phase 6 Test Team' }
  });

  await prisma.user.create({
    data: { id: userId, name: 'Test User', role: 'member' }
  });

  await prisma.teamMember.create({
    data: { teamId, userId, teamRole: 'member' }
  });

  // 2. Seed Rules
  console.log('\n2️⃣ Seeding Rules...');
  
  // Sync Rule (Regex) - Unique trigger to avoid system rule conflict
  await prisma.chimeRule.create({
    data: {
      name: 'Test Sync Rule',
      type: 'pattern',
      triggerType: 'regex',
      execution: 'sync',
      priority: 'critical',
      conditions: JSON.stringify({ patterns: ['test_sync_trigger'] }),
      action: JSON.stringify({ type: 'chat_message', template: 'Sync trigger received.' }),
      teamId
    }
  });

  // Async Rule (Semantic)
  await prisma.chimeRule.create({
    data: {
      name: 'Test Async Rule',
      type: 'semantic',
      triggerType: 'vector',
      execution: 'async',
      priority: 'medium',
      conditions: JSON.stringify({ semanticQuery: 'User is confused' }),
      action: JSON.stringify({ type: 'chat_message', template: 'Async trigger received.' }),
      teamId
    }
  });

  console.log('✅ Rules seeded.');

  // 3. Test Sync Execution
  console.log('\n3️⃣ Testing Sync Execution (Regex: "test_sync_trigger")...');
  
  const syncMsg = await MessageController.createMessage({
    teamId,
    authorId: userId,
    content: 'This is a test_sync_trigger message.',
    contentType: 'text'
  });

  // Manually trigger sync evaluation
  await UnifiedRuleEngine.getInstance().evaluateSync(syncMsg);

  // Check for response
  const syncResponse = await prisma.message.findFirst({
    where: { 
      teamId, 
      authorId: 'agent',
      metadata: { contains: 'Test Sync Rule' }
    }
  });

  if (syncResponse) {
    console.log('✅ Sync Rule Triggered!');
    console.log(`   Response: "${syncResponse.content}"`);
    if (syncResponse.agentMetadata) {
      const meta = JSON.parse(syncResponse.agentMetadata as string);
      console.log(`   Metadata: Model=${meta.model}, Tier=${meta.tier}, Cost=$${meta.cost?.toFixed(6)}`);
    } else {
      console.log('   ⚠️ No agentMetadata found.');
    }
  } else {
    console.error('❌ Sync Rule FAILED to trigger.');
    // Debug: print all agent messages
    const allAgentMsgs = await prisma.message.findMany({ where: { teamId, authorId: 'agent' } });
    console.log('   Found agent messages:', allAgentMsgs.length);
    allAgentMsgs.forEach(m => console.log(`   - ${m.content} (Meta: ${m.metadata})`));
  }

  // 4. Test Async Execution
  console.log('\n4️⃣ Testing Async Execution (Semantic: "confused")...');

  const asyncMsg = await MessageController.createMessage({
    teamId,
    authorId: userId,
    content: 'I am very confused about how this works.',
    contentType: 'text'
  });

  console.log('   Generating embedding for async evaluation...');
  try {
    const embeddingResponse = await embeddingService.generateEmbedding(asyncMsg.content);
    const embedding = embeddingResponse.embedding;

    console.log('   Executing evaluateAsync...');
    await UnifiedRuleEngine.getInstance().evaluateAsync(asyncMsg, embedding);

    // Check for response
    const asyncResponse = await prisma.message.findFirst({
      where: { 
        teamId, 
        authorId: 'agent',
        metadata: { contains: 'Test Async Rule' }
      }
    });

    if (asyncResponse) {
      console.log('✅ Async Rule Triggered!');
      console.log(`   Response: "${asyncResponse.content}"`);
      if (asyncResponse.agentMetadata) {
        const meta = JSON.parse(asyncResponse.agentMetadata as string);
        console.log(`   Metadata: Model=${meta.model}, Tier=${meta.tier}, Cost=$${meta.cost?.toFixed(6)}`);
      } else {
        console.log('   ⚠️ No agentMetadata found.');
      }
    } else {
      console.error('❌ Async Rule FAILED to trigger.');
      // Debug: print all agent messages
      const allAgentMsgs = await prisma.message.findMany({ where: { teamId, authorId: 'agent' } });
      console.log('   Found agent messages:', allAgentMsgs.length);
      allAgentMsgs.forEach(m => console.log(`   - ${m.content} (Meta: ${m.metadata})`));
    }

  } catch (error) {
    console.error('   ⚠️ Failed to test Async execution (API error?):', error);
  }
  
  console.log('\n✅ Test Suite Complete.');
  process.exit(0);
}

testMultiAgentArchitecture().catch(console.error);
