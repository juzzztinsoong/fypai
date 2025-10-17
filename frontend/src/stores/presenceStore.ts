/**
 * PRESENCE STORE (Zustand)
 *
 * Tech Stack: Zustand, TypeScript, Socket.IO
 * Purpose: Track online/offline status of users in real-time
 *
 * State:
 *   - onlineUsers: Set<string> - user IDs currently online
 *   - isConnected: boolean - WebSocket connection status
 *
 * Methods & Arguments:
 *   - connect(userId: string): connects to WebSocket and registers presence
 *   - disconnect(): disconnects from WebSocket
 *   - setUserOnline(userId: string): marks user as online
 *   - setUserOffline(userId: string): marks user as offline
 *   - isUserOnline(userId: string): returns boolean for user online status
 *   - getOnlineCount(): returns number of online users
 *   - setMultipleUsersOnline(userIds: string[]): sets multiple users online
 *
 * Exports:
 *   - usePresenceStore: Zustand hook for presence state/methods
 */
import { create } from 'zustand';
import { socketService } from '@/services';

interface PresenceState {
  onlineUsers: Set<string>;
  isConnected: boolean;
  currentUserId: string | null; // Track current user ID
  connect: (userId: string) => Promise<void>;
  disconnect: () => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  isUserOnline: (userId: string) => boolean;
  getOnlineCount: () => number;
  setMultipleUsersOnline: (userIds: string[]) => void;
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  // Initial state: empty set, will be populated when connected
  onlineUsers: new Set(['agent']),
  isConnected: false,
  currentUserId: null,

  // WebSocket Methods
  connect: async (userId: string) => {
    if (socketService.isConnected()) {
      console.log('[PresenceStore] Already connected');
      return;
    }

    // Store current user ID and mark as online
    set({ currentUserId: userId });
    get().setUserOnline(userId);

    // Connect to WebSocket and wait for connection
    console.log('[PresenceStore] Connecting to WebSocket...');
    await socketService.connect(userId);
    console.log('[PresenceStore] ✅ WebSocket connected, setting up presence listeners');
    
    // Listen for presence updates
    socketService.onPresenceUpdate((data) => {
      const currentUser = get().currentUserId;
      
      if (data.online) {
        get().setUserOnline(data.userId);
      } else {
        // Don't mark current user as offline
        if (data.userId !== currentUser) {
          get().setUserOffline(data.userId);
        }
      }
    });

    // Listen for online users list
    socketService.onPresenceList((data) => {
      const currentUser = get().currentUserId;
      // Always include current user in online users list
      const allOnlineUsers = currentUser 
        ? new Set([...data.users, currentUser, 'agent']) 
        : new Set([...data.users, 'agent']);
      set({ onlineUsers: allOnlineUsers });
    });

    set({ isConnected: true });
    console.log('[PresenceStore] Connected and marked user as online:', userId);
  },

  disconnect: () => {
    const currentUser = get().currentUserId;
    socketService.disconnect();
    
    // Mark current user as offline when disconnecting
    if (currentUser) {
      get().setUserOffline(currentUser);
    }
    
    set({ isConnected: false, currentUserId: null });
  },

  // Presence state setters (keep existing functionality)
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
