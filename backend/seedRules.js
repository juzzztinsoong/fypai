/**
 * Seed Chime Rules Script
 * 
 * Clears all existing rules and seeds default rules to team1
 * Uses the API endpoint to leverage compiled TypeScript code
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedRules() {
  try {
    console.log('🧹 Clearing existing chime rules...\n');
    
    // Delete all existing rules
    const deleted = await prisma.chimeRule.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} existing rule(s)\n`);
    
    console.log('🌱 Loading default rules from defaultRules.ts...\n');
    
    // Use the controller's seed endpoint by importing and calling directly
    // This requires the backend to compile the TypeScript first
    console.log('📡 Calling seed endpoint via HTTP...\n');
    
    const response = await fetch('http://localhost:5000/api/chime/rules/seed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ teamId: 'team1' }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json();
    const createdRules = result.rules || [];
    
    console.log('✅ Successfully seeded rules!');
    console.log(`📊 Created ${createdRules.length} rules:\n`);
    
    // Display results
    createdRules.forEach((rule, i) => {
      const statusIcon = rule.enabled ? '✅' : '❌';
      const priorityEmoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '⚪',
      }[rule.priority] || '⚪';
      
      console.log(`${i + 1}. ${statusIcon} ${rule.name}`);
      console.log(`   ${priorityEmoji} Priority: ${rule.priority}`);
      console.log(`   Type: ${rule.type}`);
      console.log(`   Cooldown: ${rule.cooldownMinutes}min`);
      console.log('');
    });
    
    console.log('💡 Key Updates:');
    console.log('   - Decision Detector: now MEDIUM priority (was high)');
    console.log('   - This prevents it from overriding critical/high priority rules\n');
    
  } catch (error) {
    console.error('❌ Error seeding rules:', error.message);
    console.error('\n⚠️  Make sure:');
    console.error('   1. Backend server is running: npm run dev');
    console.error('   2. Server is on http://localhost:5000');
    console.error('   3. TypeScript is compiled (happens automatically with dev server)\n');
  } finally {
    await prisma.$disconnect();
  }
}

seedRules();
