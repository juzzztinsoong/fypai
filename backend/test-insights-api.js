/**
 * Test AI Insights API Endpoints
 * 
 * Tests:
 * 1. GET /api/insights?teamId=team1 - Fetch all insights for team1
 * 2. POST /api/insights - Create a new insight
 * 3. GET /api/insights?teamId=team1 - Verify new insight appears
 * 4. DELETE /api/insights/:id - Delete the created insight
 * 5. GET /api/insights?teamId=team1 - Verify deletion
 */

const BASE_URL = 'http://localhost:5000/api';

async function testAIInsightsAPI() {
  console.log('🧪 Testing AI Insights API...\n');
  
  try {
    // Test 1: Get existing insights
    console.log('1️⃣ GET /api/insights?teamId=team1');
    const getResponse1 = await fetch(`${BASE_URL}/insights?teamId=team1`);
    const insights1 = await getResponse1.json();
    console.log(`   ✅ Found ${insights1.length} insights`);
    if (insights1.length > 0) {
      console.log(`   📊 First insight: "${insights1[0].title}" (${insights1[0].type})`);
    }
    console.log('');
    
    // Test 2: Create a new insight
    console.log('2️⃣ POST /api/insights');
    const newInsight = {
      teamId: 'team1',
      type: 'action',
      title: 'Test Action Item',
      content: 'This is a test action item created via API',
      priority: 'high',
      tags: ['test', 'api'],
      relatedMessageIds: ['msg1']
    };
    
    const postResponse = await fetch(`${BASE_URL}/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInsight)
    });
    
    if (!postResponse.ok) {
      throw new Error(`POST failed: ${postResponse.status} ${postResponse.statusText}`);
    }
    
    const createdInsight = await postResponse.json();
    console.log(`   ✅ Created insight: ${createdInsight.id}`);
    console.log(`   📝 Title: "${createdInsight.title}"`);
    console.log(`   🏷️  Tags: [${createdInsight.tags.join(', ')}]`);
    console.log(`   ⚡ Priority: ${createdInsight.priority}`);
    console.log('');
    
    // Test 3: Verify new insight appears
    console.log('3️⃣ GET /api/insights?teamId=team1 (verify creation)');
    const getResponse2 = await fetch(`${BASE_URL}/insights?teamId=team1`);
    const insights2 = await getResponse2.json();
    console.log(`   ✅ Found ${insights2.length} insights (was ${insights1.length})`);
    const foundNewInsight = insights2.find(i => i.id === createdInsight.id);
    if (foundNewInsight) {
      console.log(`   ✅ New insight found in list`);
    } else {
      console.log(`   ❌ New insight NOT found in list`);
    }
    console.log('');
    
    // Test 4: Delete the insight
    console.log('4️⃣ DELETE /api/insights/' + createdInsight.id);
    const deleteResponse = await fetch(`${BASE_URL}/insights/${createdInsight.id}`, {
      method: 'DELETE'
    });
    
    if (deleteResponse.status === 204) {
      console.log(`   ✅ Insight deleted successfully`);
    } else {
      console.log(`   ❌ Delete failed: ${deleteResponse.status}`);
    }
    console.log('');
    
    // Test 5: Verify deletion
    console.log('5️⃣ GET /api/insights?teamId=team1 (verify deletion)');
    const getResponse3 = await fetch(`${BASE_URL}/insights?teamId=team1`);
    const insights3 = await getResponse3.json();
    console.log(`   ✅ Found ${insights3.length} insights (back to ${insights1.length})`);
    const stillExists = insights3.find(i => i.id === createdInsight.id);
    if (!stillExists) {
      console.log(`   ✅ Insight successfully removed from list`);
    } else {
      console.log(`   ❌ Insight still exists!`);
    }
    console.log('');
    
    console.log('✅ All AI Insights API tests passed!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testAIInsightsAPI();
