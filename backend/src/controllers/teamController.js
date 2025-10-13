/**
 * Team Controller
 * 
 * Tech Stack: Express, Prisma
 * Pattern: Controller handles business logic, routes delegate to controller
 * 
 * Methods:
 *   - getTeamsForUser(userId: string): Get all teams user is member of
 *   - getTeamById(id: string): Get single team with members
 *   - createTeam(data: TeamInput): Create new team with owner
 *   - updateTeam(id: string, name: string): Update team name
 *   - deleteTeam(id: string): Delete team
 *   - addMember(teamId: string, userId: string, teamRole?: string): Add member
 *   - removeMember(teamId: string, userId: string): Remove member
 * 
 * Arguments:
 *   TeamInput: { name, ownerId }
 */

import { prisma } from '../db.js'

export class TeamController {
  /**
   * Get all teams for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of teams with members
   */
  static async getTeamsForUser(userId) {
    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            teamMemberships: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true, role: true }
                }
              }
            }
          }
        }
      }
    })

    // Transform to return teams with nested members array
    return teamMemberships.map(tm => ({
      ...tm.team,
      members: tm.team.teamMemberships.map(m => ({
        ...m.user,
        teamRole: m.teamRole
      }))
    }))
  }

  /**
   * Get single team by ID with all members
   * @param {string} id - Team ID
   * @returns {Promise<Object|null>} Team object or null
   */
  static async getTeamById(id) {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        teamMemberships: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, role: true }
            }
          }
        }
      }
    })

    if (!team) return null

    // Transform to match frontend shape
    return {
      ...team,
      members: team.teamMemberships.map(m => ({
        ...m.user,
        teamRole: m.teamRole
      }))
    }
  }

  /**
   * Create a new team with owner as first member
   * @param {Object} data - Team data
   * @param {string} data.name - Team name
   * @param {string} data.ownerId - Owner user ID
   * @returns {Promise<Object>} Created team
   */
  static async createTeam({ name, ownerId }) {
    const team = await prisma.team.create({
      data: {
        name,
        teamMemberships: {
          create: {
            userId: ownerId,
            teamRole: 'owner'
          }
        }
      },
      include: {
        teamMemberships: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, role: true }
            }
          }
        }
      }
    })

    // Transform to match frontend shape
    return {
      ...team,
      members: team.teamMemberships.map(m => ({
        ...m.user,
        teamRole: m.teamRole
      }))
    }
  }

  /**
   * Update team name
   * @param {string} id - Team ID
   * @param {string} name - New team name
   * @returns {Promise<Object>} Updated team
   */
  static async updateTeam(id, name) {
    return await prisma.team.update({
      where: { id },
      data: { name }
    })
  }

  /**
   * Delete a team (cascade deletes members and messages)
   * @param {string} id - Team ID
   * @returns {Promise<Object>} Deleted team
   */
  static async deleteTeam(id) {
    return await prisma.team.delete({
      where: { id }
    })
  }

  /**
   * Add member to team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID to add
   * @param {string} [teamRole='member'] - Team role (owner/admin/member)
   * @returns {Promise<Object>} Created team membership
   */
  static async addMember(teamId, userId, teamRole = 'member') {
    return await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        teamRole
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      }
    })
  }

  /**
   * Remove member from team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<Object>} Deleted team membership
   */
  static async removeMember(teamId, userId) {
    return await prisma.teamMember.deleteMany({
      where: {
        teamId,
        userId
      }
    })
  }
}