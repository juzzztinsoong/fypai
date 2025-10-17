// Simple test to debug the user creation issue

const API_BASE = 'http://localhost:5000'

async function simpleTest() {
  console.log('Testing user creation...\n')
  
  const res = await fetch(`${API_BASE}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      role: 'member',
      avatar: '👩'
    })
  })
  
  console.log('Response status:', res.status)
  console.log('Response headers:', Object.fromEntries(res.headers))
  
  const text = await res.text()
  console.log('Response body (raw):', text)
  
  try {
    const json = JSON.parse(text)
    console.log('Parsed JSON:', json)
    console.log('ID:', json.id)
    console.log('Name:', json.name)
  } catch (e) {
    console.error('Failed to parse JSON:', e.message)
  }
}

simpleTest().catch(console.error)
