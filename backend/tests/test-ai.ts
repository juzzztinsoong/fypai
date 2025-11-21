/**
 * AI Integration Test Script
 * 
 * Quick test to verify AI agent is working
 * Run with: tsx backend/test-ai.ts
 */

import 'dotenv/config';

console.log('🧪 Testing AI Integration...\n');

// Test 1: Environment variables
console.log('1️⃣ Checking environment variables:');
console.log(`   GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log(`   AI_MODEL: ${process.env.AI_MODEL || '❌ Not set'}`);
console.log(`   AI_MAX_TOKENS: ${process.env.AI_MAX_TOKENS || '2048'}`);
console.log(`   AI_TEMPERATURE: ${process.env.AI_TEMPERATURE || '0.7'}\n`);

// Test 2: Import AI modules
try {
  console.log('2️⃣ Importing AI modules...');
  
  const { GitHubModelsClient } = await import('../src/ai/llm/githubModelsClient.js');
  console.log('   ✅ GitHubModelsClient imported');
  
  const { SYSTEM_PROMPTS, buildConversationContext } = await import('../src/ai/llm/prompts.js');
  console.log('   ✅ Prompts imported');
  
  const { shouldAgentRespond, CHIME_RULES } = await import('../src/ai/agent/rules.js');
  console.log('   ✅ Chime rules imported');
  console.log(`   📋 ${CHIME_RULES.length} rules configured\n`);

  // Test 3: Test LLM client
  console.log('3️⃣ Testing LLM client...');
  const client = new GitHubModelsClient();
  console.log('   ✅ Client initialized\n');

  // Test 4: Make a real API call
  console.log('4️⃣ Making test API call to GitHub Models...');
  console.log('   Sending: "Hello, can you introduce yourself?"');
  
  const response = await client.generate({
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.assistant },
      { role: 'user', content: 'Hello AI! Can you introduce yourself in one sentence?' }
    ],
    maxTokens: 100,
    temperature: 0.7,
  });

  console.log(`\n   ✅ Response received!`);
  console.log(`   Model: ${response.model}`);
  console.log(`   Tokens: ${response.usage.inputTokens} in + ${response.usage.outputTokens} out`);
  console.log(`\n   AI Response:\n   "${response.content}"\n`);

  // Test 5: Test chime rules
  console.log('5️⃣ Testing chime rules...');
  
  const testMessages = [
    { id: '1', authorId: 'user1', content: '@agent hello', teamId: 'team1', contentType: 'text', createdAt: new Date().toISOString() },
    { id: '2', authorId: 'user1', content: 'I had pizza for lunch', teamId: 'team1', contentType: 'text', createdAt: new Date().toISOString() },
    { id: '3', authorId: 'user1', content: 'What is TypeScript?', teamId: 'team1', contentType: 'text', createdAt: new Date().toISOString() },
  ];

  for (const msg of testMessages) {
    const decision = shouldAgentRespond(msg, {
      recentMessages: [],
      teamSettings: { autoRespond: true, cooldownMinutes: 2 },
    });
    
    const result = decision.should ? '✅ RESPOND' : '❌ IGNORE';
    console.log(`   ${result}: "${msg.content}" (reason: ${decision.reason})`);
  }

  console.log('\n✨ All tests passed! AI integration is working!\n');
  console.log('📝 Next steps:');
  console.log('   1. Start backend: npm run dev');
  console.log('   2. Start frontend: npm run dev');
  console.log('   3. Send a message with @agent');
  console.log('   4. Watch AI respond automatically!\n');

} catch (error) {
  console.error('\n❌ Test failed:', error);
  console.log('\n🔧 Troubleshooting:');
  console.log('   1. Make sure GITHUB_TOKEN is set in backend/.env');
  console.log('   2. Run: npm install (to ensure all dependencies are installed)');
  console.log('   3. Check that you have internet connection');
  console.log('   4. Verify GitHub token has "models" scope\n');
  process.exit(1);
}
