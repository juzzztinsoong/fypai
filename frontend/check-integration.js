/**
 * Service Integration Checker
 * 
 * This script checks if the new service layer (Phase 5) is properly
 * integrated with the existing frontend stores and components.
 * 
 * Run: node frontend/check-integration.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
}

function pass(message) {
  console.log(`✅ ${message}`)
  results.passed++
  results.details.push({ status: 'pass', message })
}

function fail(message) {
  console.log(`❌ ${message}`)
  results.failed++
  results.details.push({ status: 'fail', message })
}

function warn(message) {
  console.log(`⚠️  ${message}`)
  results.warnings++
  results.details.push({ status: 'warn', message })
}

function checkFileExists(filePath, description) {
  const fullPath = path.join(__dirname, filePath)
  if (fs.existsSync(fullPath)) {
    pass(`${description} exists: ${filePath}`)
    return true
  } else {
    fail(`${description} missing: ${filePath}`)
    return false
  }
}

function checkFileContains(filePath, searchStrings, description) {
  const fullPath = path.join(__dirname, filePath)
  if (!fs.existsSync(fullPath)) {
    fail(`Cannot check ${description}: ${filePath} not found`)
    return false
  }

  const content = fs.readFileSync(fullPath, 'utf-8')
  const allFound = searchStrings.every(str => content.includes(str))
  
  if (allFound) {
    pass(`${description}: Found in ${filePath}`)
    return true
  } else {
    const missing = searchStrings.filter(str => !content.includes(str))
    fail(`${description}: Missing in ${filePath} - ${missing.join(', ')}`)
    return false
  }
}

function checkServiceImports(storePath, serviceName) {
  const fullPath = path.join(__dirname, storePath)
  if (!fs.existsSync(fullPath)) {
    return false
  }

  const content = fs.readFileSync(fullPath, 'utf-8')
  
  // Check if service is imported
  const hasImport = content.includes(`from '@/services'`) || 
                    content.includes(`from './services'`) ||
                    content.includes(`from '../services'`) ||
                    content.includes(`${serviceName}Service`)
  
  return hasImport
}

console.log('═══════════════════════════════════════════════')
console.log('🔍 Phase 5 Service Integration Check')
console.log('═══════════════════════════════════════════════\n')

// 1. Check service files exist
console.log('📦 Checking Service Files...')
checkFileExists('src/services/api.ts', 'Base API client')
checkFileExists('src/services/teamService.ts', 'Team service')
checkFileExists('src/services/messageService.ts', 'Message service')
checkFileExists('src/services/insightService.ts', 'Insight service')
checkFileExists('src/services/userService.ts', 'User service')
checkFileExists('src/services/socketService.ts', 'Socket service')
checkFileExists('src/services/index.ts', 'Services index')

console.log('\n📋 Checking Store Files...')
checkFileExists('src/stores/teamStore.ts', 'Team store')
checkFileExists('src/stores/chatStore.ts', 'Chat store')
checkFileExists('src/stores/userStore.ts', 'User store')
checkFileExists('src/stores/presenceStore.ts', 'Presence store')
checkFileExists('src/stores/aiInsightsStore.ts', 'AI Insights store')

// 2. Check if stores import services
console.log('\n🔗 Checking Service Integration in Stores...')

const stores = [
  { path: 'src/stores/teamStore.ts', service: 'team', methods: ['getTeamsForUser', 'createTeam'] },
  { path: 'src/stores/chatStore.ts', service: 'message', methods: ['getMessages', 'createMessage'] },
  { path: 'src/stores/userStore.ts', service: 'user', methods: ['getUsers', 'createUser'] },
  { path: 'src/stores/presenceStore.ts', service: 'socket', methods: ['socketService', 'connect'] },
  { path: 'src/stores/aiInsightsStore.ts', service: 'insight', methods: ['getInsights', 'createInsight'] },
]

stores.forEach(store => {
  const hasImport = checkServiceImports(store.path, store.service)
  if (hasImport) {
    pass(`${store.service} service imported in ${store.path}`)
  } else {
    warn(`${store.service} service NOT imported in ${store.path} - Store uses mock data`)
  }
})

// 3. Check TypeScript configuration
console.log('\n⚙️  Checking TypeScript Configuration...')
checkFileContains('tsconfig.json', ['@/services', 'paths'], 'Path alias for services')
checkFileContains('vite.config.ts', ['resolve', 'alias', '@'], 'Vite path alias configuration')

// 4. Check if stores have API methods (not just mock data)
console.log('\n📡 Checking Store API Integration...')

const storesWithAPIMethods = [
  { path: 'src/stores/teamStore.ts', description: 'Team store has fetchTeams method' },
  { path: 'src/stores/chatStore.ts', description: 'Chat store has fetchMessages method' },
  { path: 'src/stores/userStore.ts', description: 'User store has fetchUsers method' },
]

storesWithAPIMethods.forEach(({ path: storePath, description }) => {
  const fullPath = path.join(__dirname, storePath)
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8')
    const hasFetchMethod = content.includes('fetch') || content.includes('Service')
    
    if (hasFetchMethod) {
      pass(description)
    } else {
      warn(`${description} - Store appears to use mock data only`)
    }
  }
})

// 5. Check environment configuration
console.log('\n🌍 Checking Environment Configuration...')
const envExamplePath = path.join(__dirname, '.env.example')
const envPath = path.join(__dirname, '.env')

if (fs.existsSync(envExamplePath)) {
  pass('.env.example exists')
  checkFileContains('.env.example', ['VITE_API_URL', 'VITE_WS_URL'], 'API URLs in .env.example')
} else {
  warn('.env.example not found - should document required env vars')
}

if (fs.existsSync(envPath)) {
  pass('.env file exists')
} else {
  warn('.env file not found - may use default URLs')
}

// 6. Check package.json dependencies
console.log('\n📦 Checking Dependencies...')
const packageJsonPath = path.join(__dirname, 'package.json')
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
  
  if (deps.axios) {
    pass(`axios installed: ${deps.axios}`)
  } else {
    fail('axios NOT installed')
  }
  
  if (deps['socket.io-client']) {
    pass(`socket.io-client installed: ${deps['socket.io-client']}`)
  } else {
    fail('socket.io-client NOT installed')
  }
  
  if (deps['@fypai/types']) {
    pass(`@fypai/types linked: ${deps['@fypai/types']}`)
  } else {
    fail('@fypai/types NOT linked')
  }
}

// 7. Integration recommendations
console.log('\n💡 Integration Status & Recommendations...')

const teamStorePath = path.join(__dirname, 'src/stores/teamStore.ts')
const teamStoreContent = fs.existsSync(teamStorePath) 
  ? fs.readFileSync(teamStorePath, 'utf-8') 
  : ''

if (!teamStoreContent.includes('teamService') && !teamStoreContent.includes('@/services')) {
  warn('Stores are using MOCK DATA instead of real API services')
  console.log('\n   To integrate services with stores:')
  console.log('   1. Import services: import { teamService } from "@/services"')
  console.log('   2. Add async methods: fetchTeams: async () => { ... }')
  console.log('   3. Call API: const teams = await teamService.getTeamsForUser(userId)')
  console.log('   4. Update state: set({ teams, isLoading: false })')
  console.log('')
} else {
  pass('Stores appear to be integrated with services')
}

// Print summary
console.log('\n═══════════════════════════════════════════════')
console.log('📊 Integration Check Results')
console.log('═══════════════════════════════════════════════')
console.log(`✅ Passed:   ${results.passed}`)
console.log(`⚠️  Warnings: ${results.warnings}`)
console.log(`❌ Failed:   ${results.failed}`)
console.log(`📈 Total:    ${results.passed + results.warnings + results.failed}`)

if (results.failed === 0 && results.warnings === 0) {
  console.log('\n🎉 Perfect! All services are fully integrated!')
} else if (results.failed === 0) {
  console.log('\n✅ Good! Services are ready but stores need integration.')
} else {
  console.log('\n⚠️  Issues found. Please review the checklist above.')
}

console.log('═══════════════════════════════════════════════\n')

process.exit(results.failed > 0 ? 1 : 0)
