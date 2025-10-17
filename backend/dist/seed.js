/**
 * Database Seeding Script
 *
 * Populates the database with mock data extracted from frontend stores.
 * This ensures consistent data between development frontend and backend.
 *
 * Usage: npm run seed
 *
 * Data Sources:
 * - users.json: User accounts (Alice, Bob, Charlie, etc. + AI Agent)
 * - teams.json: Teams and their members
 * - messages.json: Chat messages per team
 * - insights.json: AI-generated insights per team
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const prisma = new PrismaClient();
// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Helper to calculate date from minutes/days ago
function minutesAgo(minutes) {
    return new Date(Date.now() - minutes * 60 * 1000);
}
function daysAgo(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
async function seedUsers() {
    console.log('🌱 Seeding users...');
    const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data', 'users.json'), 'utf-8'));
    for (const user of usersData) {
        await prisma.user.upsert({
            where: { id: user.id },
            update: {
                name: user.name,
                email: user.email,
                role: user.role,
            },
            create: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    console.log(`✅ Seeded ${usersData.length} users`);
}
async function seedTeams() {
    console.log('🌱 Seeding teams...');
    const teamsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data', 'teams.json'), 'utf-8'));
    for (const teamData of teamsData) {
        // Create team
        const team = await prisma.team.upsert({
            where: { id: teamData.id },
            update: {
                name: teamData.name,
                createdAt: daysAgo(teamData.createdAtDaysAgo),
            },
            create: {
                id: teamData.id,
                name: teamData.name,
                createdAt: daysAgo(teamData.createdAtDaysAgo),
            },
        });
        // Create team members
        for (const member of teamData.members) {
            await prisma.teamMember.upsert({
                where: {
                    teamId_userId: {
                        teamId: team.id,
                        userId: member.userId,
                    },
                },
                update: {
                    teamRole: member.teamRole,
                    joinedAt: daysAgo(member.joinedAtDaysAgo),
                },
                create: {
                    userId: member.userId,
                    teamId: team.id,
                    teamRole: member.teamRole,
                    joinedAt: daysAgo(member.joinedAtDaysAgo),
                },
            });
        }
    }
    console.log(`✅ Seeded ${teamsData.length} teams with members`);
}
async function seedMessages() {
    console.log('🌱 Seeding messages...');
    const messagesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data', 'messages.json'), 'utf-8'));
    for (const message of messagesData) {
        await prisma.message.upsert({
            where: { id: message.id },
            update: {
                teamId: message.teamId,
                authorId: message.authorId,
                content: message.content,
                contentType: message.contentType,
                createdAt: minutesAgo(message.createdAtMinutesAgo),
                metadata: message.metadata ? JSON.stringify(message.metadata) : null,
            },
            create: {
                id: message.id,
                teamId: message.teamId,
                authorId: message.authorId,
                content: message.content,
                contentType: message.contentType,
                createdAt: minutesAgo(message.createdAtMinutesAgo),
                metadata: message.metadata ? JSON.stringify(message.metadata) : null,
            },
        });
    }
    console.log(`✅ Seeded ${messagesData.length} messages`);
}
async function seedInsights() {
    console.log('🌱 Seeding AI insights...');
    const insightsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data', 'insights.json'), 'utf-8'));
    for (const insight of insightsData) {
        // Note: metadata field from JSON is ignored as it's not in the Prisma schema
        // Language and filename info can be included in the content or added to schema later
        await prisma.aIInsight.upsert({
            where: { id: insight.id },
            update: {
                teamId: insight.teamId,
                type: insight.type,
                title: insight.title,
                content: insight.content,
                priority: insight.priority,
                tags: insight.tags ? JSON.stringify(insight.tags) : null,
                createdAt: minutesAgo(insight.createdAtMinutesAgo),
                relatedMessageIds: insight.relatedMessageIds ? JSON.stringify(insight.relatedMessageIds) : null,
            },
            create: {
                id: insight.id,
                teamId: insight.teamId,
                type: insight.type,
                title: insight.title,
                content: insight.content,
                priority: insight.priority,
                tags: insight.tags ? JSON.stringify(insight.tags) : null,
                createdAt: minutesAgo(insight.createdAtMinutesAgo),
                relatedMessageIds: insight.relatedMessageIds ? JSON.stringify(insight.relatedMessageIds) : null,
            },
        });
    }
    console.log(`✅ Seeded ${insightsData.length} AI insights`);
}
async function main() {
    console.log('🚀 Starting database seeding...\n');
    try {
        // Seed in order due to foreign key constraints
        await seedUsers();
        await seedTeams();
        await seedMessages();
        await seedInsights();
        console.log('\n✨ Database seeding completed successfully!');
    }
    catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
});
