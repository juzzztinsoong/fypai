/**
 * CHAT STORE (Zustand)
 *
 * Tech Stack: Zustand, TypeScript, @fypai/types
 * Purpose: Manage per-team chat history and message operations for multi-team chat app
 *
 * State:
 *   - chat: Record<string, MessageDTO[]> - all chat histories by teamId
 *   - messages: MessageDTO[] - current team's messages (for MessageList compatibility)
 *
 * Methods & Arguments:
 *   - setMessages(teamId: string, messages: MessageDTO[]): sets messages for a team
 *   - addMessage(teamId: string, message: MessageDTO): adds message to team chat
 *   - updateMessage(teamId: string, messageId: string, updates: Partial<MessageDTO>): updates a message
 *   - deleteMessage(teamId: string, messageId: string): deletes a message
 *   - setCurrentTeamMessages(messages: MessageDTO[]): sets messages for current team (UI sync)
 *
 * Architecture:
 *   - Uses MessageDTO from @fypai/types (matches backend API responses)
 *   - Messages include optional author info (for display without extra lookups)
 *   - Timestamps are ISO strings, metadata is parsed object
 *
 * Exports:
 *   - useChatStore: Zustand hook for chat state/methods
 */
import { create } from 'zustand';
import type { MessageDTO, CreateMessageRequest, UpdateMessageRequest } from '../types';
import { messageService, getErrorMessage, socketService } from '@/services';

interface ChatState {
  chat: Record<string, MessageDTO[]>;
  messages: MessageDTO[];
  isLoading: boolean;
  error: string | null;
  isSocketListening: boolean;
  fetchMessages: (teamId: string) => Promise<void>;
  sendMessage: (data: CreateMessageRequest) => Promise<MessageDTO>;
  updateMessageById: (messageId: string, updates: UpdateMessageRequest) => Promise<void>;
  deleteMessageById: (messageId: string) => Promise<void>;
  setMessages: (teamId: string, messages: MessageDTO[]) => void;
  addMessage: (teamId: string, message: MessageDTO) => void;
  updateMessage: (teamId: string, messageId: string, updates: Partial<MessageDTO>) => void;
  deleteMessage: (teamId: string, messageId: string) => void;
  setCurrentTeamMessages: (messages: MessageDTO[]) => void;
  initializeSocketListeners: () => void;
  cleanupSocketListeners: () => void;
  // Filter helpers for long-form content
  getLongFormMessages: (teamId: string) => MessageDTO[];
  getMessagesByType: (teamId: string, longFormType?: 'summary' | 'code' | 'document') => MessageDTO[];
}

// Mock initial chat data (kept for backward compatibility)
const initialChat: Record<string, MessageDTO[]> = {};

export const useChatStore = create<ChatState>()((set, get) => ({
  chat: initialChat,
  messages: [],
  isLoading: false,
  error: null,
  isSocketListening: false,

  // API Methods
  fetchMessages: async (teamId: string) => {
    set({ isLoading: true, error: null });
    try {
      const messages = await messageService.getMessages(teamId);
      set((state) => ({
        chat: { ...state.chat, [teamId]: messages },
        messages: messages,
        isLoading: false,
      }));
    } catch (error) {
      console.error('[ChatStore] Failed to fetch messages:', error);
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  sendMessage: async (data: CreateMessageRequest) => {
    set({ isLoading: true, error: null });
    try {
      // Send message via HTTP API
      const newMessage = await messageService.createMessage(data);
      
      console.log('[ChatStore] 📤 Message created by backend:', newMessage.id);
      
      // Optimistically add message for immediate feedback
      // Backend will also broadcast via socket, but socket listener will check for duplicates
      const teamId = data.teamId;
      get().addMessage(teamId, newMessage);
      console.log('[ChatStore] ✅ Optimistically added message:', newMessage.id);
      
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
      const updatedMessage = await messageService.updateMessage(messageId, updates);
      const teamId = updatedMessage.teamId;
      get().updateMessage(teamId, messageId, updatedMessage);
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
      await messageService.deleteMessage(messageId);
      // Remove from all teams
      const state = get();
      Object.keys(state.chat).forEach((teamId) => {
        const messageInTeam = state.chat[teamId].find((m) => m.id === messageId);
        if (messageInTeam) {
          get().deleteMessage(teamId, messageId);
        }
      });
      set({ isLoading: false });
    } catch (error) {
      console.error('[ChatStore] Failed to delete message:', error);
      set({ error: getErrorMessage(error), isLoading: false });
      throw error;
    }
  },

  // Internal state setters (keep existing functionality)
  setMessages: (teamId, messages) =>
    set((state) => ({
      chat: { ...state.chat, [teamId]: messages },
      messages: messages, // Always update messages when explicitly set
    })),

  addMessage: (teamId, message) =>
    set((state) => {
      console.log('[ChatStore] 🔵 addMessage called:', {
        teamId,
        messageId: message.id,
        currentMessagesCount: state.messages.length,
        currentTeamId: state.messages?.[0]?.teamId,
        chatTeamMessagesCount: state.chat[teamId]?.length || 0,
      });

      // Check if message already exists (prevents duplicates from race conditions)
      const teamMessages = state.chat[teamId] || [];
      const messageExists = teamMessages.some((m) => m.id === message.id);
      
      if (messageExists) {
        console.log('[ChatStore] ⏭️  Message already exists, skipping add:', message.id);
        return state; // No state change
      }

      const newTeamMessages = [...teamMessages, message];
      const newChat = {
        ...state.chat,
        [teamId]: newTeamMessages,
      };
      
      // Only update 'messages' if this is for the currently displayed team
      // Check if the new message's teamId matches the first message in current messages
      const currentTeamId = state.messages?.[0]?.teamId;
      const shouldUpdateMessages = !currentTeamId || teamId === currentTeamId;
      
      console.log('[ChatStore] 🔵 addMessage decision:', {
        currentTeamId,
        incomingTeamId: teamId,
        shouldUpdateMessages,
        newMessagesCount: newTeamMessages.length,
      });
      
      const newState = {
        chat: newChat,
        messages: shouldUpdateMessages ? newTeamMessages : state.messages,
      };

      console.log('[ChatStore] 🔵 addMessage result:', {
        messagesCount: newState.messages.length,
        messagesTeamId: newState.messages?.[0]?.teamId,
      });

      return newState;
    }),

  updateMessage: (teamId, messageId, updates) =>
    set((state) => {
      const updatedTeamMessages = (state.chat[teamId] || []).map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      );
      
      const newChat = {
        ...state.chat,
        [teamId]: updatedTeamMessages,
      };
      
      // Only update 'messages' if this is for the currently displayed team
      const currentTeamId = state.messages?.[0]?.teamId;
      const shouldUpdateMessages = !currentTeamId || teamId === currentTeamId;
      
      return {
        chat: newChat,
        messages: shouldUpdateMessages ? updatedTeamMessages : state.messages,
      };
    }),

  deleteMessage: (teamId, messageId) =>
    set((state) => {
      const filteredTeamMessages = (state.chat[teamId] || []).filter((m) => m.id !== messageId);
      
      const newChat = {
        ...state.chat,
        [teamId]: filteredTeamMessages,
      };
      
      // Only update 'messages' if this is for the currently displayed team
      const currentTeamId = state.messages?.[0]?.teamId;
      const shouldUpdateMessages = !currentTeamId || teamId === currentTeamId;
      
      return {
        chat: newChat,
        messages: shouldUpdateMessages ? filteredTeamMessages : state.messages,
      };
    }),

  setCurrentTeamMessages: (messages) => set({ messages }),

  // Socket Listeners Setup
  initializeSocketListeners: () => {
    if (get().isSocketListening) {
      console.log('[ChatStore] Socket listeners already initialized');
      return;
    }

    console.log('[ChatStore] Initializing socket listeners for real-time sync');

    // Listen for new messages from other users or AI
    socketService.onMessage((message: MessageDTO) => {
      console.log('[ChatStore] 📨 Received message via socket:', message.id, 'for team:', message.teamId);
      
      // addMessage now handles duplicate detection internally
      get().addMessage(message.teamId, message);
    });

    // Listen for message edits
    socketService.onMessageEdit((message: MessageDTO) => {
      console.log('[ChatStore] Message edited via socket:', message.id);
      get().updateMessage(message.teamId, message.id, message);
    });

    // Listen for message deletions
    socketService.onMessageDelete((data: { messageId: string }) => {
      console.log('[ChatStore] Message deleted via socket:', data.messageId);
      // Find which team the message belongs to and delete it
      const state = get();
      Object.keys(state.chat).forEach((teamId) => {
        const messageExists = state.chat[teamId].find((m) => m.id === data.messageId);
        if (messageExists) {
          get().deleteMessage(teamId, data.messageId);
        }
      });
    });

    set({ isSocketListening: true });
  },

  cleanupSocketListeners: () => {
    console.log('[ChatStore] Cleaning up socket listeners');
    socketService.off('message:new');
    socketService.off('message:edited');
    socketService.off('message:deleted');
    set({ isSocketListening: false });
  },

  // Filter helpers for AI long-form content
  getLongFormMessages: (teamId: string) => {
    const state = get();
    const teamMessages = state.chat[teamId] || [];
    return teamMessages.filter((m) => m.contentType === 'ai_longform');
  },

  getMessagesByType: (teamId: string, longFormType?: 'summary' | 'code' | 'document') => {
    const state = get();
    const teamMessages = state.chat[teamId] || [];
    
    if (!longFormType) {
      // Return all messages (for "All" tab)
      return teamMessages;
    }
    
    // Filter by long-form type
    return teamMessages.filter(
      (m) => m.contentType === 'ai_longform' && m.metadata?.longFormType === longFormType
    );
  },
}));
