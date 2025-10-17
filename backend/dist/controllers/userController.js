/**
 * User Controller
 *
 * Tech Stack: Express, Prisma, @fypai/types
 * Pattern: Controller handles business logic, routes delegate to controller
 *
 * Methods:
 *   - getAllUsers(): Get all users (returns UserDTO[])
 *   - getUserById(id: string): Get single user (returns UserDTO)
 *   - createUser(data: CreateUserRequest): Create new user (returns UserDTO)
 *   - updateUser(id: string, data: UpdateUserRequest): Update user (returns UserDTO)
 *   - deleteUser(id: string): Delete user
 *
 * Architecture:
 *   - Uses Prisma entity types for database operations
 *   - Transforms to DTO types using userToDTO() before returning
 *   - Returns API-friendly types with ISO strings and parsed JSON
 */
import { prisma } from '../db.js';
import { usersToDTO } from '../types.js';
export class UserController {
    /**
     * Get all users
     * @returns {Promise<UserDTO[]>} Array of user DTOs
     */
    static async getAllUsers() {
        const users = await prisma.user.findMany();
        // Transform entities to DTOs
        return usersToDTO(users);
    }
    /**
     * Get single user by ID with team memberships
     * @param {string} id - User ID
     * @returns {Promise<(UserDTO & { teams?: Array<{id: string, name: string, teamRole: string}>})|null>} User DTO or null
     */
    static async getUserById(id) {
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                teamMemberships: {
                    include: {
                        team: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        });
        if (!user)
            return null;
        // Extract the base user without teamMemberships for transformation
        const { teamMemberships, ...baseUser } = user;
        // Transform to DTO
        const userDTO = usersToDTO([baseUser])[0];
        // Add teams if present (this extends the basic UserDTO)
        if (teamMemberships && teamMemberships.length > 0) {
            return {
                ...userDTO,
                teams: teamMemberships.map(tm => ({
                    id: tm.team.id,
                    name: tm.team.name,
                    teamRole: tm.teamRole || 'member',
                }))
            };
        }
        return userDTO;
    }
    /**
     * Create a new user
     * @param {CreateUserRequest} data - User creation data
     * @returns {Promise<UserDTO>} Created user DTO
     */
    static async createUser(data) {
        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                avatar: data.avatar,
                role: data.role || 'member'
            }
        });
        return usersToDTO([user])[0];
    }
    /**
     * Update user details
     * @param {string} id - User ID
     * @param {UpdateUserRequest} data - Update data
     * @returns {Promise<UserDTO>} Updated user DTO
     */
    static async updateUser(id, data) {
        const updateData = {};
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.avatar !== undefined)
            updateData.avatar = data.avatar;
        if (data.role !== undefined)
            updateData.role = data.role;
        const user = await prisma.user.update({
            where: { id },
            data: updateData
        });
        return usersToDTO([user])[0];
    }
    /**
     * Delete a user (cascade deletes team memberships and messages)
     * @param {string} id - User ID
     * @returns {Promise<void>}
     */
    static async deleteUser(id) {
        await prisma.user.delete({
            where: { id }
        });
    }
}
