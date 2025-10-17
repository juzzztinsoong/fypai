/**
 * Prisma Database Client Singleton
 * 
 * Tech Stack: Prisma ORM 5.7.1, SQLite (dev) / PostgreSQL (prod)
 * Pattern: Singleton to prevent multiple client instances
 * 
 * Usage:
 *   import { prisma } from './db.js'
 *   const users = await prisma.user.findMany()
 * 
 * Methods:
 *   - prisma.user.*     : User model CRUD
 *   - prisma.team.*     : Team model CRUD
 *   - prisma.teamMember.*: TeamMember model CRUD
 *   - prisma.message.*  : Message model CRUD
 * 
 * Connection:
 *   - Auto-connects on first query
 *   - Use prisma.$disconnect() in graceful shutdown
 */

import { PrismaClient } from '@prisma/client'

// Singleton instance
let prismaInstance: PrismaClient | null = null

/**
 * Get Prisma client instance (singleton pattern)
 * @returns {PrismaClient} Prisma client instance
 */
export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
  }
  return prismaInstance
}

// Export singleton
export const prisma = getPrisma()

// Graceful shutdown handler
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})