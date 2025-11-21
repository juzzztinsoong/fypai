/**
 * Send test message and check embedding stats
 */

async function testEmbeddingStats() {
  console.log('📨 Sending test message to trigger embedding...\n');
  
  // Send a test message
  const createResponse = await fetch('http://localhost:5000/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: 'team1',
      authorId: 'user1',
      content: 'Testing GitHub Models embedding usage tracking with a sample message about AI and machine learning.',
      contentType: 'text',
    }),
  });
  
  const message = await createResponse.json();
  console.log(`✅ Message sent: ${message.id}`);
  console.log(`   "${message.content}"\n`);
  
  // Wait for worker to process
  console.log('⏳ Waiting for embedding worker to process (5 seconds)...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check stats
  const statsResponse = await fetch('http://localhost:5000/api/stats/embeddings');
  const stats = await statsResponse.json();
  
  console.log('📊 Updated Embedding Usage Statistics:\n');
  console.log(`   Provider: ${stats.provider}`);
  console.log(`   Model: ${stats.model}`);
  console.log(`   Total Requests: ${stats.totalRequests}`);
  console.log(`   Total Tokens: ${stats.totalTokens.toLocaleString()}`);
  console.log(`   Estimated Cost: $${stats.estimatedCost.toFixed(6)}`);
  console.log(`   ${stats.costNote}\n`);
  
  console.log('💡 Tips for monitoring GitHub Models usage:');
  console.log('   1. Visit: https://github.com/settings/models');
  console.log('   2. Check this endpoint anytime: GET /api/stats/embeddings');
  console.log('   3. Watch backend logs for per-request token counts\n');
}

testEmbeddingStats().catch(console.error);
