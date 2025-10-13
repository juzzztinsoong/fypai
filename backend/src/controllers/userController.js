/**
 * User Controller
 * 
 * Tech Stack: Express, Prisma
 * Pattern: Controller handles business logic, routes delegate to controller
 * 
 * Methods:
 *   - getAllUsers(): Get all users
 *   - getUserById(id: string): Get single user
 *   - createUser(data: UserInput): Create new user
 *   - updateUser(id: string, data: UserUpdate): Update user
 *   - deleteUser(id: string): Delete user
 * 
 * Arguments:
 *   UserInput: { name, email?, avatar?, role }
 *   UserUpdate: { name?, avatar?, role? }
 */

import { prisma } from '../db.js'

export class UserController {
  /**
   * Get all users
   * @returns {Promise<Array>} Array of users
   */
  static async getAllUsers() {
    return await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true
      }
    })
  }

  /**
   * Get single user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} User object or null
   */
  static async getUserById(id) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true,
        teamMemberships: {
          include: {
            team: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })
  }

  /**
   * Create a new user
   * @param {Object} data - User data
   * @param {string} data.name - User name
   * @param {string} [data.email] - User email
   * @param {string} [data.avatar] - Avatar URL
   * @param {string} data.role - User role (member/admin/agent)
   * @returns {Promise<Object>} Created user
   */
  static async createUser(data) {
    return await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        avatar: data.avatar,
        role: data.role || 'member'
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true
      }
    })
  }

  /**
   * Update user details
   * @param {string} id - User ID
   * @param {Object} data - Update data
   * @param {string} [data.name] - New name
   * @param {string} [data.avatar] - New avatar URL
   * @param {string} [data.role] - New role
   * @returns {Promise<Object>} Updated user
   */
  static async updateUser(id, data) {
    const updateData = {}
    if (data.name) updateData.name = data.name
    if (data.avatar !== undefined) updateData.avatar = data.avatar
    if (data.role) updateData.role = data.role

    return await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true
      }
    })
  }

  /**
   * Delete a user (cascade deletes team memberships and messages)
   * @param {string} id - User ID
   * @returns {Promise<Object>} Deleted user
   */
  static async deleteUser(id) {
    return await prisma.user.delete({
      where: { id }
    })
  }
}