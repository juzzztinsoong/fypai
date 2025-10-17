/**
 * User Service
 * 
 * Handles all user-related API operations using shared DTOs
 * 
 * Tech Stack: Axios
 * Types: @fypai/types (UserDTO, CreateUserRequest, UpdateUserRequest)
 * 
 * Operations:
 * - Get all users
 * - Get user by ID
 * - Create new user
 * - Update user
 * - Delete user
 */

import { api, getErrorMessage } from './api'
import type { UserDTO, CreateUserRequest, UpdateUserRequest } from '@fypai/types'

/**
 * Get all users
 * GET /users
 * @returns Array of users
 */
export async function getUsers(): Promise<UserDTO[]> {
  try {
    const response = await api.get<UserDTO[]>('/users')
    return response.data
  } catch (error) {
    console.error('[UserService] Failed to fetch users:', getErrorMessage(error))
    throw error
  }
}

/**
 * Get a specific user by ID
 * GET /users/:id
 * @param userId - User ID
 * @returns User data
 */
export async function getUserById(userId: string): Promise<UserDTO> {
  try {
    const response = await api.get<UserDTO>(`/users/${userId}`)
    return response.data
  } catch (error) {
    console.error(`[UserService] Failed to fetch user ${userId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Create a new user
 * POST /users
 * @param data - User creation data (username, email, displayName, avatarUrl, role)
 * @returns Newly created user
 */
export async function createUser(data: CreateUserRequest): Promise<UserDTO> {
  try {
    const response = await api.post<UserDTO>('/users', data)
    console.log('[UserService] User created:', response.data.name)
    return response.data
  } catch (error) {
    console.error('[UserService] Failed to create user:', getErrorMessage(error))
    throw error
  }
}

/**
 * Update an existing user
 * PATCH /users/:id
 * @param userId - User ID to update
 * @param data - Update data (username, email, displayName, avatarUrl, role)
 * @returns Updated user
 */
export async function updateUser(
  userId: string,
  data: UpdateUserRequest
): Promise<UserDTO> {
  try {
    const response = await api.patch<UserDTO>(`/users/${userId}`, data)
    console.log('[UserService] User updated:', userId)
    return response.data
  } catch (error) {
    console.error(`[UserService] Failed to update user ${userId}:`, getErrorMessage(error))
    throw error
  }
}

/**
 * Delete a user
 * DELETE /users/:id
 * @param userId - User ID to delete
 * @returns Deleted user confirmation
 */
export async function deleteUser(userId: string): Promise<{ id: string }> {
  try {
    const response = await api.delete<{ id: string }>(`/users/${userId}`)
    console.log('[UserService] User deleted:', userId)
    return response.data
  } catch (error) {
    console.error(`[UserService] Failed to delete user ${userId}:`, getErrorMessage(error))
    throw error
  }
}

export default {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
}
