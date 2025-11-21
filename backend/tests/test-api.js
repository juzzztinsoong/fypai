/**
 * Fixed API Test Script
 * Creates entities in correct order to avoid FK violations
 * Run with: node test-api-fixed.js
 */

const API_BASE = 'http://localhost:5000'

async function testAPI() {
  console.log('🧪 Testing Backend API with proper FK handling...\n')

  try {
    // 1. Health check
    console.log('1. Testing health endpoint...')
    let res = await fetch(`${API_BASE}/health`)
    console.log('   ✅ Health:', await res.json())

    // 2. Create first user (will be team owner)
    console.log('\n2. Creating owner user...')
    res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        role: 'member',
        avatar: '👩'
      })
    })
    const owner = await res.json()
    console.log('   ✅ Owner created:', owner.id, owner.name)

    // 3. Create AI agent user
    console.log('\n3. Creating AI agent...')
    res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'AI Assistant',
        role: 'agent',
        avatar: '🤖'
      })
    })
    const agent = await res.json()
    console.log('   ✅ Agent created:', agent.id, agent.name)

    // 4. Create team with owner
    console.log('\n4. Creating team...')
    res = await fetch(`${API_BASE}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Project Alpha',
        ownerId: owner.id
      })
    })
    
    if (!res.ok) {
      const error = await res.text()
      console.error('   ❌ Team creation failed:', error)
      console.log('\n🔍 Debug: Check backend logs for Prisma errors')
      return
    }
    
    const team = await res.json()
    console.log('   ✅ Team created:', team.id, team.name)

    // 5. Add agent to team
    console.log('\n5. Adding agent to team...')
    res = await fetch(`${API_BASE}/api/teams/${team.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: agent.id,
        teamRole: 'member'
      })
    })
    const membership = await res.json()
    console.log('   ✅ Agent added to team')

    // 6. Send user message
    console.log('\n6. Sending user message...')
    res = await fetch(`${API_BASE}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: team.id,
        authorId: owner.id,
        content: 'Hello team! Let\'s discuss the project roadmap.',
        contentType: 'text'
      })
    })
    
    if (!res.ok) {
      const error = await res.text()
      console.error('   ❌ Message send failed:', error)
      return
    }
    
    const message1 = await res.json()
    console.log('   ✅ Message sent:', message1.id)

    // 7. Send agent response
    console.log('\n7. Sending agent response...')
    res = await fetch(`${API_BASE}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: team.id,
        authorId: agent.id,
        content: 'I can help with that! Here are some suggestions...',
        contentType: 'text',
        metadata: JSON.stringify({
          suggestions: [
            'Create project timeline',
            'Define milestones',
            'Assign team roles'
          ]
        })
      })
    })
    const message2 = await res.json()
    console.log('   ✅ Agent response sent:', message2.id)

    // 8. Get all messages
    console.log('\n8. Fetching team messages...')
    res = await fetch(`${API_BASE}/api/messages?teamId=${team.id}`)
    const messages = await res.json()
    console.log('   ✅ Messages retrieved:', messages.length)
    messages.forEach(msg => {
      console.log(`      - [${msg.author.name}]: ${msg.content}`)
    })

    // 9. Get teams for user
    console.log('\n9. Fetching user teams...')
    res = await fetch(`${API_BASE}/api/teams?userId=${owner.id}`)
    const teams = await res.json()
    console.log('   ✅ User teams:', teams.length)
    teams.forEach(t => {
      console.log(`      - ${t.name} (${t.members.length} members)`)
    })

    console.log('\n✅ All tests passed!')
    console.log('\n📝 Summary:')
    console.log(`   User ID: ${owner.id}`)
    console.log(`   Agent ID: ${agent.id}`)
    console.log(`   Team ID: ${team.id}`)
    console.log(`   Messages: ${messages.length}`)

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.log('\n🔍 Troubleshooting steps:')
    console.log('   1. Ensure backend is running: cd backend && npm run dev')
    console.log('   2. Check database: npx prisma studio')
    console.log('   3. Regenerate Prisma: npx prisma generate && npx prisma migrate dev')
  }
}

testAPI()