/**
 * Team Controller
 * 
 * Tech Stack: Express, Prisma, @fypai/types
 * Pattern: Controller handles business logic, routes delegate to controller
 * 
 * Methods:
 *   - getTeamsForUser(userId: string): Get all teams user is member of (returns TeamWithMembersDTO[])
 *   - getTeamById(id: string): Get single team with members (returns TeamWithMembersDTO)
 *   - createTeam(data: CreateTeamRequest): Create new team with owner (returns TeamWithMembersDTO)
 *   - updateTeam(id: string, data: UpdateTeamRequest): Update team name (returns TeamDTO)
 *   - deleteTeam(id: string): Delete team
 *   - addMember(data: AddTeamMemberRequest): Add member to team (returns TeamMemberDTO)
 *   - removeMember(teamId: string, userId: string): Remove member from team
 * 
 * Architecture:
 *   - Uses Prisma entity types for database operations
 *   - Transforms to DTO types using teamWithMembersToDTO() before returning
 *   - Returns API-friendly types with ISO strings and parsed JSON
 */

import { prisma } from '../db.js'
import { Team, TeamMember } from '@prisma/client'
import { TeamDTO, TeamWithMembersDTO, TeamMemberDTO, CreateTeamRequest, UpdateTeamRequest, AddTeamMemberRequest, teamWithMembersToDTO, teamToDTO } from '../types.js'

export class TeamController {
  /**
   * Get all teams for a user
   * @param {string} userId - User ID
   * @returns {Promise<TeamWithMembersDTO[]>} Array of teams with members
   */
  static async getTeamsForUser(userId: string): Promise<TeamWithMembersDTO[]> {
    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: true,
        user: true
      }
    })

    // Get all team IDs
    const teamIds = teamMemberships.map(tm => tm.teamId)
    
    // Get all members for these teams
    const allTeamMembers = await prisma.teamMember.findMany({
      where: { teamId: { in: teamIds } },
      include: {
        user: true
      }
    })

    // Group members by team
    const membersByTeam = new Map<string, Array<{ teamMember: TeamMember; user: any }>>()
    for (const tm of allTeamMembers) {
      if (!membersByTeam.has(tm.teamId)) {
        membersByTeam.set(tm.teamId, [])
      }
      membersByTeam.get(tm.teamId)!.push({
        teamMember: tm,
        user: tm.user
      })
    }

    // Transform to DTOs
    return teamMemberships.map(tm => 
      teamWithMembersToDTO(tm.team, membersByTeam.get(tm.teamId) || [])
    )
  }

  /**
   * Get single team by ID with all members
   * @param {string} id - Team ID
   * @returns {Promise<TeamWithMembersDTO|null>} Team DTO or null
   */
  static async getTeamById(id: string): Promise<TeamWithMembersDTO | null> {
    const team = await prisma.team.findUnique({
      where: { id }
    })

    if (!team) return null

    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: id },
      include: {
        user: true
      }
    })

    const teamMembersWithUsers = teamMembers.map(tm => ({
      teamMember: tm,
      user: tm.user
    }))

    return teamWithMembersToDTO(team, teamMembersWithUsers)
  }

  /**
   * Create a new team with owner as first member
   * @param {CreateTeamRequest} data - Team data
   * @returns {Promise<TeamWithMembersDTO>} Created team DTO
   */
  static async createTeam(data: CreateTeamRequest): Promise<TeamWithMembersDTO> {
    const team = await prisma.team.create({
      data: {
        name: data.name,
        teamMemberships: {
          create: {
            userId: data.ownerId,
            teamRole: 'owner'
          }
        }
      },
      include: {
        teamMemberships: {
          include: {
            user: true
          }
        }
      }
    })

    const teamMembersWithUsers = team.teamMemberships.map(tm => ({
      teamMember: tm,
      user: tm.user
    }))

    // Extract the base team without teamMemberships
    const { teamMemberships, ...baseTeam } = team

    return teamWithMembersToDTO(baseTeam, teamMembersWithUsers)
  }

  /**
   * Update team name
   * @param {string} id - Team ID
   * @param {UpdateTeamRequest} data - Update data
   * @returns {Promise<TeamDTO>} Updated team DTO
   */
  static async updateTeam(id: string, data: UpdateTeamRequest): Promise<TeamDTO> {
    const team = await prisma.team.update({
      where: { id },
      data: { name: data.name }
    })
    
    return teamToDTO(team)
  }

  /**
   * Delete a team (cascade deletes members and messages)
   * @param {string} id - Team ID
   * @returns {Promise<void>}
   */
  static async deleteTeam(id: string): Promise<void> {
    await prisma.team.delete({
      where: { id }
    })
  }

  /**
   * Add member to team
   * @param {string} teamId - Team ID
   * @param {AddTeamMemberRequest} data - Add member data
   * @returns {Promise<TeamMemberDTO>} Created team membership DTO
   */
  static async addMember(teamId: string, data: AddTeamMemberRequest): Promise<TeamMemberDTO> {
    const teamMember = await prisma.teamMember.create({
      data: {
        teamId,
        userId: data.userId,
        teamRole: data.teamRole || 'member'
      },
      include: {
        user: true
      }
    })

    return {
      id: teamMember.id,
      userId: teamMember.userId,
      name: teamMember.user.name,
      email: teamMember.user.email,
      avatar: teamMember.user.avatar,
      role: teamMember.user.role as any,
      teamRole: (teamMember.teamRole || 'member') as any,
      joinedAt: teamMember.joinedAt.toISOString()
    }
  }

  /**
   * Remove member from team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<void>}
   */
  static async removeMember(teamId: string, userId: string): Promise<void> {
    await prisma.teamMember.deleteMany({
      where: {
        teamId,
        userId
      }
    })
  }
}