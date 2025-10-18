/**
 * Database Reset Script
 * 
 * Clears all data from the database before seeding.
 * Useful for starting fresh with new seed data.
 * 
 * Clears:
 * - Chime logs (AI autonomous behavior audit trail)
 * - Chime rules (AI behavior rules)
 * - AI insights
 * - Messages
 * - Team members
 * - Teams
 * - Users
 * 
 * Usage: npm run db:reset
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Clearing database...\n');

  try {
    // Delete in reverse order of foreign key dependencies
    
    // Delete chime logs first (depends on chime rules and teams)
    await prisma.chimeLog.deleteMany();
    console.log('✅ Deleted all chime logs');

    // Delete chime rules (depends on teams)
    await prisma.chimeRule.deleteMany();
    console.log('✅ Deleted all chime rules');

    await prisma.aIInsight.deleteMany();
    console.log('✅ Deleted all AI insights');

    await prisma.message.deleteMany();
    console.log('✅ Deleted all messages');

    await prisma.teamMember.deleteMany();
    console.log('✅ Deleted all team members');

    await prisma.team.deleteMany();
    console.log('✅ Deleted all teams');

    await prisma.user.deleteMany();
    console.log('✅ Deleted all users');

    console.log('\n✨ Database cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
