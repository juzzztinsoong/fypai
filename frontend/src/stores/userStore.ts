/**
 * USER STORE (Zustand)
 *
 * Tech Stack: Zustand, TypeScript, @fypai/types
 * Purpose: Manage current user context (ID, name, avatar, role)
 *
 * State:
 *   - user: UserDTO - current user with all properties
 *   - isLoading: boolean - loading state for async operations
 *   - error: string | null - error message if operation fails
 *
 * Methods & Arguments:
 *   - fetchUser(userId: string): fetches user from API
 *   - updateUser(userId: string, updates: UpdateUserRequest): updates user via API
 *   - setUser(user: UserDTO): sets the complete user object
 *   - setUserId(id: string): sets only the user ID
 *   - setUserName(name: string): sets only the user name
 *   - setUserAvatar(avatar: string | null): sets only the avatar
 *   - setUserRole(role: UserRoleString): sets only the role
 *
 * Architecture:
 *   - Uses UserDTO from @fypai/types (matches backend API responses)
 *   - Integrates with userService for all API calls
 *   - Stores user data with ISO timestamp strings
 *   - Role is typed as UserRoleString ('member' | 'admin' | 'agent')
 *
 * Exports:
 *   - useUserStore: Zustand hook for user state/methods
 */
import { create } from 'zustand'
import type { UserDTO, UserRoleString, UpdateUserRequest } from '../types'
import { userService, getErrorMessage } from '@/services'

interface UserState {
  user: UserDTO
  isLoading: boolean
  error: string | null
  fetchUser: (userId: string) => Promise<void>
  updateUserProfile: (userId: string, updates: UpdateUserRequest) => Promise<void>
  setUser: (user: UserDTO) => void
  setUserId: (id: string) => void
  setUserName: (name: string) => void
  setUserAvatar: (avatar: string | null) => void
  setUserRole: (role: UserRoleString) => void
}

export const useUserStore = create<UserState>()((set) => ({
  user: {
    id: 'user1',
    name: 'Alice',
    email: null,
    avatar: null,
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
  isLoading: false,
  error: null,

  // API Methods
  fetchUser: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = await userService.getUserById(userId);
      set({ user, isLoading: false });
    } catch (error) {
      console.error('[UserStore] Failed to fetch user:', error);
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  updateUserProfile: async (userId: string, updates: UpdateUserRequest) => {
    set({ isLoading: true, error: null });
    try {
      const updatedUser = await userService.updateUser(userId, updates);
      set({ user: updatedUser, isLoading: false });
    } catch (error) {
      console.error('[UserStore] Failed to update user:', error);
      set({ error: getErrorMessage(error), isLoading: false });
      throw error;
    }
  },

  // Internal state setters (keep existing functionality)
  setUser: (user) => set({ user }),
  setUserId: (id) => set((state) => ({ user: { ...state.user, id } })),
  setUserName: (name) => set((state) => ({ user: { ...state.user, name } })),
  setUserAvatar: (avatar) => set((state) => ({ user: { ...state.user, avatar } })),
  setUserRole: (role) => set((state) => ({ user: { ...state.user, role } })),
}))
