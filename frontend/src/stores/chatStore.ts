/**
 * CHAT STORE (Zustand) - REFACTORED for Event Bus Architecture
 *
 * Tech Stack: Zustand, TypeScript, @fypai/types, Event Bus
 * Purpose: Manage UI state for chat (loading, errors) and delegate data to RealtimeStore
 *
 * State:
 *   - isLoading: boolean - API request loading state
 *   - error: string | null - Last error message
 *   - currentTeamId: string | null - Currently selected team (for filtering)
 *
 * Methods & Arguments:
 *   - fetchMessages(teamId: string): fetch messages from API (publishes to Event Bus)
 *   - sendMessage(data: CreateMessageRequest): send message via API (publishes to Event Bus)
 *   - updateMessageById(messageId: string, updates: UpdateMessageRequest): update message via API
 *   - deleteMessageById(messageId: string): delete message via API
 *   - setCurrentTeam(teamId: string): sets current team for filtering
 *   - getMessages(teamId: string): reads messages from RealtimeStore
 *   - getCurrentMessages(): reads current team's messages from RealtimeStore
 *
 * Architecture:
 *   - NO LONGER stores messages directly (delegated to RealtimeStore)
 *   - Services publish to Event Bus → Event Bridge → RealtimeStore updates
 *   - This store reads from RealtimeStore via selectors
 *   - Socket Bridge handles real-time events (no direct socket listeners here)
 *   - Backward compatible: provides same interface for components
 *
 * Migration Notes:
 *   - Old: chatStore.messages → New: chatStore.getCurrentMessages() or read from RealtimeStore
 *   - Old: chatStore.chat[teamId] → New: chatStore.getMessages(teamId)
 *   - Socket listeners removed (handled by Socket Bridge → Event Bus)
 *
 * Exports:
 *   - useChatStore: Zustand hook for chat UI state/methods
 */
import { create } from 'zustand';
import type { MessageDTO, CreateMessageRequest, UpdateMessageRequest } from '../types';
import { messageService, getErrorMessage } from '@/services';
import { useRealtimeStore } from '@/core/eventBus/RealtimeStore';

interface ChatState {
  // UI State only
  isLoading: boolean;
  error: string | null;
  currentTeamId: string | null;
  
  // API Methods (trigger Event Bus publications)
  fetchMessages: (teamId: string) => Promise<void>;
  sendMessage: (data: CreateMessageRequest) => Promise<MessageDTO>;
  updateMessageById: (messageId: string, updates: UpdateMessageRequest) => Promise<void>;
  deleteMessageById: (messageId: string) => Promise<void>;
  
  // UI State Methods
  setCurrentTeam: (teamId: string) => void;
  
  // Data Readers (delegate to RealtimeStore)
  getMessages: (teamId: string) => MessageDTO[];
  getCurrentMessages: () => MessageDTO[];
  
  // DEPRECATED (kept for backward compatibility during migration)
  messages: MessageDTO[]; // Getter property that delegates to RealtimeStore
  chat: Record<string, MessageDTO[]>; // Getter property that delegates to RealtimeStore
  setMessages: (teamId: string, messages: MessageDTO[]) => void;
  setCurrentTeamMessages: (messages: MessageDTO[]) => void;
  initializeSocketListeners: () => void;
  cleanupSocketListeners: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  // UI State
  isLoading: false,
  error: null,
  currentTeamId: null,

  // DEPRECATED - Backward compatibility getters (delegate to RealtimeStore)
  get messages(): MessageDTO[] {
    const { currentTeamId } = get();
    if (!currentTeamId) return [];
    return get().getMessages(currentTeamId);
  },
  get chat(): Record<string, MessageDTO[]> {
    return useRealtimeStore.getState().messages;
  },

  // API Methods - these now trigger Event Bus publications via services
  fetchMessages: async (teamId: string) => {
    set({ isLoading: true, error: null, currentTeamId: teamId });
    try {
      // messageService.getMessages publishes 'messages:fetched' event to Event Bus
      // Event Bridge → RealtimeStore updates automatically
      await messageService.getMessages(teamId);
      set({ isLoading: false });
      console.log('[ChatStore] ✅ Messages fetched for team:', teamId);
    } catch (error) {
      console.error('[ChatStore] Failed to fetch messages:', error);
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  sendMessage: async (data: CreateMessageRequest) => {
    set({ isLoading: true, error: null });
    try {
      // messageService.createMessage publishes 'message:created' event to Event Bus with requestId
      // Event Bridge → RealtimeStore handles both REST response and socket event (deduplication)
      const newMessage = await messageService.createMessage(data);
      console.log('[ChatStore] ✅ Message sent:', newMessage.id);
      
      set({ isLoading: false });
      return newMessage;
    } catch (error) {
      console.error('[ChatStore] Failed to send message:', error);
      set({ error: getErrorMessage(error), isLoading: false });
      throw error;
    }
  },

  updateMessageById: async (messageId: string, updates: UpdateMessageRequest) => {
    set({ isLoading: true, error: null });
    try {
      // messageService.updateMessage publishes 'message:updated' event to Event Bus
      await messageService.updateMessage(messageId, updates);
      console.log('[ChatStore] ✅ Message updated:', messageId);
      set({ isLoading: false });
    } catch (error) {
      console.error('[ChatStore] Failed to update message:', error);
      set({ error: getErrorMessage(error), isLoading: false });
      throw error;
    }
  },

  deleteMessageById: async (messageId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Find teamId from RealtimeStore
      const realtimeMessages = useRealtimeStore.getState().messages;
      let teamId: string | null = null;
      
      for (const tid of Object.keys(realtimeMessages)) {
        const messageExists = realtimeMessages[tid]?.find((m: MessageDTO) => m.id === messageId);
        if (messageExists) {
          teamId = tid;
          break;
        }
      }
      
      if (!teamId) {
        throw new Error(`Message ${messageId} not found in any team`);
      }
      
      // messageService.deleteMessage publishes 'message:deleted' event to Event Bus
      await messageService.deleteMessage(messageId, teamId);
      console.log('[ChatStore] ✅ Message deleted:', messageId);
      
      set({ isLoading: false });
    } catch (error) {
      console.error('[ChatStore] Failed to delete message:', error);
      set({ error: getErrorMessage(error), isLoading: false });
      throw error;
    }
  },

  // UI State Methods
  setCurrentTeam: (teamId: string) => {
    set({ currentTeamId: teamId });
    console.log('[ChatStore] Current team set to:', teamId);
  },

  // Data Readers - delegate to RealtimeStore
  getMessages: (teamId: string) => {
    const realtimeMessages = useRealtimeStore.getState().messages;
    return realtimeMessages[teamId] || [];
  },

  getCurrentMessages: () => {
    const { currentTeamId } = get();
    if (!currentTeamId) return [];
    return get().getMessages(currentTeamId);
  },

  // DEPRECATED (no-op stubs for backward compatibility during migration)
  setMessages: (_teamId: string, _messages: MessageDTO[]) => {
    console.log('[ChatStore] ⚠️ DEPRECATED: setMessages() - data now managed by RealtimeStore');
    // No-op: RealtimeStore handles this via Event Bus
  },

  setCurrentTeamMessages: (_messages: MessageDTO[]) => {
    console.log('[ChatStore] ⚠️ DEPRECATED: setCurrentTeamMessages() - data now managed by RealtimeStore');
    // No-op: RealtimeStore handles this via Event Bus
  },

  initializeSocketListeners: () => {
    console.log('[ChatStore] ⚠️ DEPRECATED: Socket listeners now handled by Socket Bridge');
  },

  cleanupSocketListeners: () => {
    console.log('[ChatStore] ⚠️ DEPRECATED: Socket cleanup now handled by Socket Bridge');
  },
}));
