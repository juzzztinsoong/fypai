# Collaborative AI Productivity App - Complete Implementation Guide

## 1. Project Architecture Overview

```
collaborative-ai-app/
├── client/                          # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx           # Main split-panel layout
│   │   │   │   ├── Sidebar.tsx             # Team/workspace navigation
│   │   │   │   └── Header.tsx              # Top bar with user/team info
│   │   │   ├── chat/
│   │   │   │   ├── ChatWindow.tsx          # Main chat interface
│   │   │   │   ├── MessageList.tsx         # Scrollable message area
│   │   │   │   ├── MessageInput.tsx        # Input with file upload
│   │   │   │   ├── Message.tsx             # Individual message component
│   │   │   │   └── AIAgentIndicator.tsx    # Shows AI presence/status
│   │   │   ├── content/
│   │   │   │   ├── ContentPanel.tsx        # Right panel for AI content
│   │   │   │   ├── DocumentEditor.tsx      # Long-form text editor
│   │   │   │   ├── ContentVersions.tsx     # Version history
│   │   │   │   └── ContentActions.tsx      # Export, share, edit
│   │   │   ├── team/
│   │   │   │   ├── TeamMembers.tsx         # Active members list
│   │   │   │   ├── InviteModal.tsx         # Invite team members
│   │   │   │   └── MemberPermissions.tsx   # Role management
│   │   │   └── shared/
│   │   │       ├── Avatar.tsx
│   │   │       ├── Button.tsx
│   │   │       └── Modal.tsx
│   │   ├── hooks/
│   │   │   ├── useChat.ts                  # Chat state management
│   │   │   ├── useAIStream.ts              # AI streaming responses
│   │   │   ├── useWebSocket.ts             # Real-time collaboration
│   │   │   ├── useTeam.ts                  # Team management
│   │   │   └── useContent.ts               # Content CRUD operations
│   │   ├── services/
│   │   │   ├── api.ts                      # HTTP client
│   │   │   ├── websocket.ts                # WebSocket client
│   │   │   └── ai.ts                       # AI API abstraction
│   │   ├── stores/
│   │   │   ├── authStore.ts                # Zustand: Auth state
│   │   │   ├── chatStore.ts                # Zustand: Chat state
│   │   │   ├── teamStore.ts                # Zustand: Team state
│   │   │   └── contentStore.ts             # Zustand: Content state
│   │   ├── types/
│   │   │   ├── chat.ts
│   │   │   ├── team.ts
│   │   │   ├── content.ts
│   │   │   └── ai.ts
│   │   ├── utils/
│   │   │   ├── formatting.ts
│   │   │   ├── validation.ts
│   │   │   └── date.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── server/                          # Node.js + Express (Future)
└── shared/                          # Shared types
```

---

## 2. Phase 1: Frontend-First Implementation (Weeks 1-2)

### **Step 1: Setup & Configuration**

```bash
# Initialize with Vite
npm create vite@latest client -- --template react-ts
cd client
npm install

# Essential dependencies
npm install zustand                    # State management
npm install @tanstack/react-query     # Data fetching
npm install react-router-dom          # Routing
npm install react-markdown            # Markdown rendering
npm install react-syntax-highlighter  # Code highlighting
npm install lucide-react              # Icons
npm install date-fns                  # Date utilities
npm install clsx                      # Class utilities
npm install @dnd-kit/core @dnd-kit/sortable  # Drag and drop

# Development
npm install -D @types/node
```

**`vite.config.ts`** - Add this for better Copilot context:
```typescript
// Vite config for React + TypeScript collaborative app
// Features: Fast refresh, path aliases, proxy for API
// Optimization: Code splitting, tree shaking

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@types': path.resolve(__dirname, './src/types'),
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      }
    }
  }
})
```

---

### **Step 2: Define Core Types First**

**`src/types/chat.ts`** - Let Copilot help:
```typescript
// Type definitions for collaborative chat system
// Features: User messages, AI agent messages, team context
// Support: Text, images, files, code blocks
// Real-time: WebSocket updates with optimistic UI

export type MessageRole = 'user' | 'ai' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'error';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'member' | 'viewer';
  isOnline: boolean;
}

export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  userId?: string;  // null if AI
  user?: User;      // Populated user data
  timestamp: Date;
  status: MessageStatus;
  attachments?: Attachment[];
  reactions?: Reaction[];
  metadata?: MessageMetadata;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'code';
  url: string;
  filename: string;
  size: number;
}

export interface Reaction {
  emoji: string;
  userId: string;
  timestamp: Date;
}

export interface MessageMetadata {
  isEdited?: boolean;
  editedAt?: Date;
  replyToId?: string;
  aiModel?: string;
  tokensUsed?: number;
}

export interface Conversation {
  id: string;
  teamId: string;
  title: string;
  messages: Message[];
  participants: User[];
  aiAgent: AIAgent;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIAgent {
  id: string;
  name: string;
  avatar: string;
  model: 'gpt-4' | 'claude-3-opus' | 'gpt-3.5-turbo';
  systemPrompt: string;
  capabilities: string[];
}

// Add more types as Copilot suggests...
```

**`src/types/content.ts`**:
```typescript
// Type definitions for AI-generated long-form content
// Features: Documents, version history, collaborative editing
// Export: Markdown, PDF, DOCX
// AI Generation: Streaming, regeneration, refinement

export interface ContentDocument {
  id: string;
  title: string;
  content: string;
  format: 'markdown' | 'html' | 'plaintext';
  conversationId: string;
  teamId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  versions: ContentVersion[];
  metadata: ContentMetadata;
}

export interface ContentVersion {
  id: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  changeDescription?: string;
}

export interface ContentMetadata {
  wordCount: number;
  readingTime: number;
  aiGenerated: boolean;
  aiModel?: string;
  prompt?: string;
  tags: string[];
}

// Copilot will suggest more...
```

**`src/types/team.ts`**:
```typescript
// Type definitions for team collaboration
// Features: Multi-user teams, permissions, invites
// Real-time: Presence indicators, typing status

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  conversations: string[];  // Conversation IDs
  aiAgent: AIAgent;
  settings: TeamSettings;
  createdAt: Date;
}

export interface TeamMember {
  userId: string;
  user: User;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
  permissions: Permission[];
}

export type Permission = 
  | 'chat.send'
  | 'chat.delete'
  | 'content.create'
  | 'content.edit'
  | 'content.delete'
  | 'team.invite'
  | 'team.remove_member'
  | 'ai.configure';

export interface TeamSettings {
  allowAIGeneration: boolean;
  defaultAIModel: string;
  maxStorageGB: number;
  retentionDays: number;
}

// More types...
```

---

### **Step 3: State Management with Zustand**

**`src/stores/chatStore.ts`** - Use Copilot heavily here:
```typescript
// Zustand store: Chat state management
// Features: Messages, optimistic updates, real-time sync
// Actions: Send message, receive message, update status
// Persistence: LocalStorage for offline draft support

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, Conversation } from '@types/chat';

interface ChatState {
  // State
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  typingUsers: string[];  // User IDs currently typing
  
  // Actions - Copilot will generate implementations
  setActiveConversation: (id: string) => void;
  sendMessage: (content: string, attachments?: File[]) => Promise<void>;
  receiveMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus) => void;
  addReaction: (messageId: string, emoji: string) => void;
  setTypingStatus: (userId: string, isTyping: boolean) => void;
  loadConversation: (conversationId: string) => Promise<void>;
  createConversation: (teamId: string, title: string) => Promise<Conversation>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      messages: [],
      isLoading: false,
      error: null,
      typingUsers: [],
      
      setActiveConversation: (id) => {
        set({ activeConversationId: id });
        // Load messages for this conversation
        get().loadConversation(id);
      },
      
      sendMessage: async (content, attachments) => {
        // Optimistic update: Add message immediately
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: Message = {
          id: tempId,
          content,
          role: 'user',
          userId: 'current-user', // Get from auth store
          timestamp: new Date(),
          status: 'sending',
          attachments: [], // Handle file uploads
        };
        
        set((state) => ({
          messages: [...state.messages, optimisticMessage]
        }));
        
        try {
          // Will integrate with API later
          // const response = await api.sendMessage(content, attachments);
          
          // Update with real message
          set((state) => ({
            messages: state.messages.map(msg => 
              msg.id === tempId 
                ? { ...optimisticMessage, id: 'real-id', status: 'sent' }
                : msg
            )
          }));
        } catch (error) {
          // Handle error
          set((state) => ({
            messages: state.messages.map(msg =>
              msg.id === tempId ? { ...msg, status: 'error' } : msg
            ),
            error: 'Failed to send message'
          }));
        }
      },
      
      receiveMessage: (message) => {
        // Add message from WebSocket or AI stream
        set((state) => ({
          messages: [...state.messages, message]
        }));
      },
      
      // Copilot will generate rest of the implementations...
      updateMessageStatus: (messageId, status) => {
        set((state) => ({
          messages: state.messages.map(msg =>
            msg.id === messageId ? { ...msg, status } : msg
          )
        }));
      },
      
      addReaction: (messageId, emoji) => {
        // Implementation...
      },
      
      setTypingStatus: (userId, isTyping) => {
        set((state) => ({
          typingUsers: isTyping
            ? [...state.typingUsers, userId]
            : state.typingUsers.filter(id => id !== userId)
        }));
      },
      
      loadConversation: async (conversationId) => {
        // Load messages for conversation
        set({ isLoading: true });
        try {
          // const messages = await api.getMessages(conversationId);
          // set({ messages, isLoading: false });
        } catch (error) {
          set({ error: 'Failed to load conversation', isLoading: false });
        }
      },
      
      createConversation: async (teamId, title) => {
        // Implementation...
        return {} as Conversation;
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
      }),
    }
  )
);
```

**`src/stores/contentStore.ts`**:
```typescript
// Zustand store: Content/document state management
// Features: CRUD operations, version history, AI generation
// Actions: Create, update, delete, generate with AI
// Real-time: Collaborative editing with conflict resolution

import { create } from 'zustand';
import type { ContentDocument, ContentVersion } from '@types/content';

interface ContentState {
  documents: ContentDocument[];
  activeDocumentId: string | null;
  isGenerating: boolean;
  generationProgress: number;
  
  // Actions
  setActiveDocument: (id: string) => void;
  createDocument: (title: string, conversationId: string) => Promise<ContentDocument>;
  updateDocument: (id: string, content: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  generateWithAI: (prompt: string, options: GenerationOptions) => Promise<void>;
  regenerateSection: (documentId: string, sectionIndex: number) => Promise<void>;
  revertToVersion: (documentId: string, versionId: string) => Promise<void>;
  exportDocument: (documentId: string, format: 'pdf' | 'docx' | 'md') => Promise<void>;
}

interface GenerationOptions {
  model: string;
  length: 'short' | 'medium' | 'long';
  tone: 'professional' | 'casual' | 'academic';
  includeReferences: boolean;
}

export const useContentStore = create<ContentState>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  isGenerating: false,
  generationProgress: 0,
  
  setActiveDocument: (id) => {
    set({ activeDocumentId: id });
  },
  
  createDocument: async (title, conversationId) => {
    // Create new document
    const newDoc: ContentDocument = {
      id: `doc-${Date.now()}`,
      title,
      content: '',
      format: 'markdown',
      conversationId,
      teamId: 'current-team',
      createdBy: 'current-user',
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [],
      metadata: {
        wordCount: 0,
        readingTime: 0,
        aiGenerated: false,
        tags: [],
      }
    };
    
    set((state) => ({
      documents: [...state.documents, newDoc],
      activeDocumentId: newDoc.id,
    }));
    
    return newDoc;
  },
  
  updateDocument: async (id, content) => {
    // Update document content and create version
    set((state) => ({
      documents: state.documents.map(doc =>
        doc.id === id
          ? {
              ...doc,
              content,
              updatedAt: new Date(),
              metadata: {
                ...doc.metadata,
                wordCount: content.split(/\s+/).length,
                readingTime: Math.ceil(content.split(/\s+/).length / 200),
              }
            }
          : doc
      )
    }));
  },
  
  generateWithAI: async (prompt, options) => {
    // Stream AI generation
    set({ isGenerating: true, generationProgress: 0 });
    
    try {
      // Will integrate with AI service
      // Simulate streaming for now
      const content = await streamAIGeneration(prompt, options, (progress) => {
        set({ generationProgress: progress });
      });
      
      // Create new document with generated content
      const doc = await get().createDocument('AI Generated Document', 'current-conversation');
      await get().updateDocument(doc.id, content);
      
      set({ isGenerating: false, generationProgress: 100 });
    } catch (error) {
      set({ isGenerating: false, generationProgress: 0 });
      console.error('AI generation failed:', error);
    }
  },
  
  // Copilot will fill in other methods...
  deleteDocument: async (id) => {},
  regenerateSection: async (documentId, sectionIndex) => {},
  revertToVersion: async (documentId, versionId) => {},
  exportDocument: async (documentId, format) => {},
}));

// Mock function for AI streaming - will replace with real implementation
async function streamAIGeneration(
  prompt: string, 
  options: GenerationOptions,
  onProgress: (progress: number) => void
): Promise<string> {
  // Simulate streaming
  return new Promise((resolve) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      onProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        resolve('# Generated Content\n\nThis is AI generated content...');
      }
    }, 500);
  });
}
```

---

### **Step 4: Build Layout Components**

**`src/components/layout/AppLayout.tsx`** - Main split panel:
```typescript
// Component: AppLayout
// Layout: Split panel with resizable divider
// Left: Chat window (60% default)
// Right: Content panel (40% default)
// Features: Drag to resize, collapse panels, responsive mobile

import { useState } from 'react';
import { ChatWindow } from '@components/chat/ChatWindow';
import { ContentPanel } from '@components/content/ContentPanel';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout() {
  const [chatWidth, setChatWidth] = useState(60); // percentage
  const [isContentPanelOpen, setIsContentPanelOpen] = useState(true);
  
  const handleDividerDrag = (e: React.MouseEvent) => {
    // Drag handler for resizing panels
    const startX = e.clientX;
    const startWidth = chatWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = ((e.clientX - startX) / window.innerWidth) * 100;
      const newWidth = Math.max(30, Math.min(70, startWidth + delta));
      setChatWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for teams/workspaces */}
        <Sidebar />
        
        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat panel */}
          <div 
            className="flex flex-col border-r border-gray-200 bg-white"
            style={{ width: isContentPanelOpen ? `${chatWidth}%` : '100%' }}
          >
            <ChatWindow />
          </div>
          
          {/* Resizable divider */}
          {isContentPanelOpen && (
            <div
              className="w-1 hover:w-2 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-all"
              onMouseDown={handleDividerDrag}
            />
          )}
          
          {/* Content panel */}
          {isContentPanelOpen && (
            <div 
              className="flex flex-col bg-white"
              style={{ width: `${100 - chatWidth}%` }}
            >
              <ContentPanel onClose={() => setIsContentPanelOpen(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**`src/components/layout/Sidebar.tsx`**:
```typescript
// Component: Sidebar
// Features: Team list, workspace switcher, new conversation
// Navigation: Switch between teams and conversations
// State: Active team, active conversation
// Icons: Lucide React icons

import { Plus, Users, MessageSquare } from 'lucide-react';
import { useChatStore } from '@stores/chatStore';
import { useTeamStore } from '@stores/teamStore';

export function Sidebar() {
  const { conversations, activeConversationId, setActiveConversation } = useChatStore();
  const { teams, activeTeamId, setActiveTeam } = useTeamStore();
  
  // Copilot will generate the UI structure
  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Team selector */}
      <div className="p-4 border-b border-gray-700">
        <select 
          className="w-full bg-gray-800 rounded px-3 py-2"
          value={activeTeamId || ''}
          onChange={(e) => setActiveTeam(e.target.value)}
        >
          {teams.map(team => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* New conversation button */}
      <button className="m-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 rounded px-4 py-2 transition">
        <Plus size={20} />
        <span>New Conversation</span>
      </button>
      
      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map(conversation => (
          <button
            key={conversation.id}
            onClick={() => setActiveConversation(conversation.id)}
            className={`
              w-full text-left px-4 py-3 hover:bg-gray-800 transition
              ${activeConversationId === conversation.id ? 'bg-gray-800 border-l-4 border-blue-500' : ''}
            `}
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={16} />
              <span className="truncate">{conversation.title}</span>
            </div>
          </button>
        ))}
      </div>
      
      {/* Team members */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Users size={16} />
          <span>3 members online</span>
        </div>
      </div>
    </div>
  );
}
```

---

### **Step 5: Build Chat Components**

**`src/components/chat/ChatWindow.tsx`**:
```typescript
// Component: ChatWindow
// Layout: Header, message list, input
// Features: Scroll to bottom, load more, typing indicators
// Real-time: WebSocket for team messages, SSE for AI responses

import { useEffect, useRef } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { AIAgentIndicator } from './AIAgentIndicator';
import { useChatStore } from '@stores/chatStore';

export function ChatWindow() {
  const { messages, activeConversationId, sendMessage, typingUsers } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async (content: string, files?: File[]) => {
    await sendMessage(content, files);
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold">Team Conversation</h2>
          <p className="text-sm text-gray-500">3 members + AI Agent</p>
        </div>
        <AIAgentIndicator />
      </div>
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <MessageList messages={messages} />
        
        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{typingUsers.length} {typingUsers.length === 1 ? 'person is' : 'people are'} typing...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div className="border-t border-gray-200">
        <MessageInput onSend={handleSendMessage} />
      </div>
    </div>
  );
}
```

**`src/components/chat/MessageList.tsx`**:
```typescript
// Component: MessageList
// Displays: Array of messages with grouping by sender
// Features: Date separators, user avatars, message actions
// Optimization: Virtual scrolling for large message lists

import { Message as MessageComponent } from './Message';
import type { Message } from '@types/chat';
import { format, isToday, isYesterday } from 'date-fns';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(message.timestamp, 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);
  
  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };
  
  return (
    <div className="space-y-6">
      {Object.entries(groupedMessages).map(([date, msgs]) => (
        <div key={date}>
          {/* Date separator */}
          <div className="flex items-center justify-center my-4">
            <div className="px-4 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
              {formatDateSeparator(date)}
            </div>
          </div>
          
          {/* Messages for this date */}
          <div className="space-y-4">
            {msgs.map((message) => (
              <MessageComponent key={message.id} message={message} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**`src/components/chat/Message.tsx`**:
```typescript
// Component: Message
// Display: Single message with user info or AI badge
// Features: Markdown rendering, code highlighting, reactions
// Actions: Reply, copy, edit (own messages), delete
// Styling: Different styles for user vs AI messages

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, MoreVertical, Smile, Reply } from 'lucide-react';
import type { Message as MessageType } from '@types/chat';
import { format } from 'date-fns';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const isAI = message.role === 'ai';
  
  return (
    <div className={`flex gap-3 ${isAI ? 'bg-blue-50 -mx-6 px-6 py-4' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        