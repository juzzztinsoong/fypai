/**
 * CHAT STORE (Zustand)
 *
 * Tech Stack: Zustand, TypeScript
 * Purpose: Manage per-team chat history and message operations for multi-team chat app
 *
 * State:
 *   - chat: Record<string, Message[]> - all chat histories by teamId
 *   - messages: Message[] - current team's messages (for MessageList compatibility)
 *
 * Methods & Arguments:
 *   - setMessages(teamId: string, messages: Message[]): sets messages for a team
 *   - addMessage(teamId: string, message: Message): adds message to team chat
 *   - updateMessage(teamId: string, messageId: string, updates: Partial<Message>): updates a message
 *   - deleteMessage(teamId: string, messageId: string): deletes a message
 *   - setCurrentTeamMessages(messages: Message[]): sets messages for current team (UI sync)
 *
 * Exports:
 *   - useChatStore: Zustand hook for chat state/methods
 */
import { create } from 'zustand';
import type { Message } from '../types';

interface ChatState {
  chat: Record<string, Message[]>;
  messages: Message[];
  setMessages: (teamId: string, messages: Message[]) => void;
  addMessage: (teamId: string, message: Message) => void;
  updateMessage: (teamId: string, messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (teamId: string, messageId: string) => void;
  setCurrentTeamMessages: (messages: Message[]) => void;
}

// Pre-populated sample chat history for each team
const initialChat: Record<string, Message[]> = {
  team1: [
    {
      id: 'msg1',
      teamId: 'team1',
      authorId: 'user1',
      content: 'Welcome to Sample Team! Let\'s collaborate.',
      contentType: 'text',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'msg2',
      teamId: 'team1',
      authorId: 'agent',
      content: 'Hi, I am your AI assistant. How can I help?',
      contentType: 'ai_longform',
      createdAt: new Date(Date.now() - 3500000).toISOString(),
      metadata: { suggestions: ['Summarize last meeting', 'Draft project plan'] },
    },
    {
      id: 'msg3',
      teamId: 'team1',
      authorId: 'user2',
      content: 'Can we schedule a sync tomorrow?',
      contentType: 'text',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ],
  team2: [
    {
      id: 'msg3',
      teamId: 'team2',
      authorId: 'user3',
      content: 'Let’s discuss the new AI model.',
      contentType: 'text',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'msg4',
      teamId: 'team2',
      authorId: 'user3',
      content: 'Let\'s discuss the new AI model architecture.',
      contentType: 'text',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'msg5',
      teamId: 'team2',
      authorId: 'agent',
      content: 'Here are some research papers you might find useful for transformer models.',
      contentType: 'ai_longform',
      createdAt: new Date(Date.now() - 7100000).toISOString(),
      metadata: { suggestions: ['Summarize papers', 'Generate experiment plan'] },
    },
    {
      id: 'msg6',
      teamId: 'team2',
      authorId: 'user1',
      content: 'Thanks! I\'ll review these papers.',
      contentType: 'text',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
  team3: [
    {
      id: 'msg7',
      teamId: 'team3',
      authorId: 'user4',
      content: 'Project Alpha kickoff meeting starts now.',
      contentType: 'text',
      createdAt: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      id: 'msg8',
      teamId: 'team3',
      authorId: 'user1',
      content: 'I\'ve completed the component library setup.',
      contentType: 'text',
      createdAt: new Date(Date.now() - 9000000).toISOString(),
    },
    {
      id: 'msg9',
      teamId: 'team3',
      authorId: 'user5',
      content: 'Great work! Let\'s integrate it with the API.',
      contentType: 'text',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'msg10',
      teamId: 'team3',
      authorId: 'agent',
      content: 'I can help generate API integration boilerplate code if needed.',
      contentType: 'ai_longform',
      createdAt: new Date(Date.now() - 5400000).toISOString(),
      metadata: { suggestions: ['Generate API client', 'Create type definitions'] },
    },
  ],
  team4: [
    {
      id: 'msg11',
      teamId: 'team4',
      authorId: 'user1',
      content: 'New design sprint starting today! 🎨',
      contentType: 'text',
      createdAt: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      id: 'msg12',
      teamId: 'team4',
      authorId: 'user6',
      content: 'I\'ve uploaded the Figma mockups to the shared drive.',
      contentType: 'text',
      createdAt: new Date(Date.now() - 12600000).toISOString(),
    },
    {
      id: 'msg13',
      teamId: 'team4',
      authorId: 'agent',
      content: 'I can help analyze the design system for consistency and accessibility.',
      contentType: 'ai_longform',
      createdAt: new Date(Date.now() - 10800000).toISOString(),
      metadata: { suggestions: ['Check color contrast', 'Generate component specs'] },
    },
  ],
  team5: [
    {
      id: 'msg14',
      teamId: 'team5',
      authorId: 'user2',
      content: 'Backend API v2 is ready for testing.',
      contentType: 'text',
      createdAt: new Date(Date.now() - 18000000).toISOString(),
    },
    {
      id: 'msg15',
      teamId: 'team5',
      authorId: 'user1',
      content: 'Awesome! I\'ll start integration testing from the frontend.',
      contentType: 'text',
      createdAt: new Date(Date.now() - 16200000).toISOString(),
    },
    {
      id: 'msg16',
      teamId: 'team5',
      authorId: 'user7',
      content: 'Database migrations look good. All tests passing.',
      contentType: 'text',
      createdAt: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      id: 'msg17',
      teamId: 'team5',
      authorId: 'agent',
      content: 'I can help with API documentation generation and test coverage analysis.',
      contentType: 'ai_longform',
      createdAt: new Date(Date.now() - 12600000).toISOString(),
      metadata: { suggestions: ['Generate OpenAPI spec', 'Run coverage report'] },
    },
  ],
};

export const useChatStore = create<ChatState>()((set) => ({
  chat: initialChat,
  messages: initialChat['team1'],

  setMessages: (teamId, messages) =>
    set((state) => ({
      chat: { ...state.chat, [teamId]: messages },
      messages: teamId === (state.messages?.[0]?.teamId ?? 'team1') ? messages : state.messages,
    })),

  addMessage: (teamId, message) =>
    set((state) => ({
      chat: {
        ...state.chat,
        [teamId]: [...(state.chat[teamId] || []), message],
      },
      messages:
        teamId === (state.messages?.[0]?.teamId ?? 'team1')
          ? [...(state.chat[teamId] || []), message]
          : state.messages,
    })),

  updateMessage: (teamId, messageId, updates) =>
    set((state) => ({
      chat: {
        ...state.chat,
        [teamId]: (state.chat[teamId] || []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
      messages:
        teamId === (state.messages?.[0]?.teamId ?? 'team1')
          ? (state.chat[teamId] || []).map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            )
          : state.messages,
    })),

  deleteMessage: (teamId, messageId) =>
    set((state) => ({
      chat: {
        ...state.chat,
        [teamId]: (state.chat[teamId] || []).filter((m) => m.id !== messageId),
      },
      messages:
        teamId === (state.messages?.[0]?.teamId ?? 'team1')
          ? (state.chat[teamId] || []).filter((m) => m.id !== messageId)
          : state.messages,
    })),

  setCurrentTeamMessages: (messages) => set({ messages }),
}));

