/**
 * USER STORE (Zustand)
 *
 * Tech Stack: Zustand, TypeScript
 * Purpose: Manage current user context (ID, name, avatar, role)
 *
 * State:
 *   - user: { id: string, name: string, avatar?: string, role?: string }
 *
 * Methods & Arguments:
 *   - setUser(user): sets the current user object
 *   - setUserId(id): sets only the user ID
 *   - setUserName(name): sets only the user name
 *   - setUserAvatar(avatar): sets only the avatar
 *   - setUserRole(role): sets only the role
 *
 * Exports:
 *   - useUserStore: Zustand hook for user state/methods
 */
import { create } from 'zustand'

export interface UserContext {
  id: string
  name: string
  avatar?: string
  role?: string
}

interface UserState {
  user: UserContext
  setUser: (user: UserContext) => void
  setUserId: (id: string) => void
  setUserName: (name: string) => void
  setUserAvatar: (avatar: string) => void
  setUserRole: (role: string) => void
}

export const useUserStore = create<UserState>()((set) => ({
  user: {
    id: 'user1',
    name: 'Alice',
    avatar: undefined,
    role: 'admin',
  },
  setUser: (user) => set({ user }),
  setUserId: (id) => set((state) => ({ user: { ...state.user, id } })),
  setUserName: (name) => set((state) => ({ user: { ...state.user, name } })),
  setUserAvatar: (avatar) => set((state) => ({ user: { ...state.user, avatar } })),
  setUserRole: (role) => set((state) => ({ user: { ...state.user, role } })),
}))
