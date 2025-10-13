/**
 * PRESENCE STORE (Zustand)
 *
 * Tech Stack: Zustand, TypeScript
 * Purpose: Track online/offline status of users in real-time
 *
 * State:
 *   - onlineUsers: Set<string> - user IDs currently online
 *
 * Methods & Arguments:
 *   - setUserOnline(userId: string): marks user as online
 *   - setUserOffline(userId: string): marks user as offline
 *   - isUserOnline(userId: string): returns boolean for user online status
 *   - getOnlineCount(): returns number of online users
 *
 * Exports:
 *   - usePresenceStore: Zustand hook for presence state/methods
 *
 * Future:
 *   - Connect to WebSocket for real-time presence updates
 *   - Add typing indicators
 *   - Add last seen timestamps
 */
import { create } from 'zustand';

interface PresenceState {
  onlineUsers: Set<string>;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  isUserOnline: (userId: string) => boolean;
  getOnlineCount: () => number;
  setMultipleUsersOnline: (userIds: string[]) => void;
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  // Initial mock data: simulate some users online
  onlineUsers: new Set(['user1', 'user2', 'user4', 'user5', 'agent']),

  setUserOnline: (userId: string) =>
    set((state) => {
      const newOnlineUsers = new Set(state.onlineUsers);
      newOnlineUsers.add(userId);
      return { onlineUsers: newOnlineUsers };
    }),

  setUserOffline: (userId: string) =>
    set((state) => {
      const newOnlineUsers = new Set(state.onlineUsers);
      newOnlineUsers.delete(userId);
      return { onlineUsers: newOnlineUsers };
    }),

  isUserOnline: (userId: string) => {
    return get().onlineUsers.has(userId);
  },

  getOnlineCount: () => {
    return get().onlineUsers.size;
  },

  setMultipleUsersOnline: (userIds: string[]) =>
    set({ onlineUsers: new Set(userIds) }),
}));
