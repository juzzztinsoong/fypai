// Quick test script to trigger chime rules
import axios from 'axios';

async function sendTestMessage(content) {
  try {
    console.log(`\n🧪 Testing message: "${content}"\n`);
    
    const response = await axios.post('http://localhost:5000/api/messages', {
      teamId: 'team1',
      authorId: 'user1',
      content: content,
      contentType: 'text'
    });

    console.log('✅ Message sent successfully!');
    console.log(`   Message ID: ${response.data.id}`);
    console.log(`\n⏳ Waiting 3 seconds for chime rules to evaluate...`);
    
    // Wait a bit to see if chime triggers
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Fetch chime logs
    const logsResponse = await axios.get(`http://localhost:5000/api/chime/teams/team1/chime-logs?limit=5`);
    const logs = logsResponse.data;
    
    if (logs.length > 0) {
      console.log(`\n📊 Recent Chime Logs:`);
      logs.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.rule.name} - ${log.outcome} (confidence: ${log.confidence?.toFixed(2) || 'N/A'})`);
      });
    } else {
      console.log('\n⚠️  No chime logs found. Rules may not have triggered.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test different message types
const testMessages = [
  "Let's go with option A for the database design",  // Decision detector
  "I'm stuck on this TypeScript error",               // Problem solver
  "We need this feature ASAP!",                       // Urgency detector
];

console.log('🚀 Chime Rules Test Suite\n');
console.log('This will send test messages and check if chime rules trigger.\n');

// Send first test message
await sendTestMessage(testMessages[0]);

console.log('\n✅ Test complete! Check the backend terminal for detailed logs.');
console.log('💡 To test more messages, modify testChime.js and run again.');
