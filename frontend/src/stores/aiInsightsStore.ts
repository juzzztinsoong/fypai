/**
 * AI INSIGHTS STORE (Zustand)
 *
 * Tech Stack: Zustand, TypeScript, @fypai/types
 * Purpose: Manage AI-generated insights, summaries, and recommendations per team chat
 *
 * State:
 *   - insights: Record<teamId, AIInsightDTO[]> - AI insights organized by team
 *   - aiEnabled: Record<teamId, boolean> - AI toggle state per team
 *   - isLoading: boolean - API request loading state
 *   - error: string | null - Last error message
 *
 * Methods & Arguments:
 *   - fetchInsights(teamId: string): fetch all insights for team from backend
 *   - createInsight(data: CreateInsightRequest): create new insight via API
 *   - deleteInsightById(insightId: string): delete insight via API
 *   - addInsight(teamId: string, insight: AIInsightDTO): adds new insight to team (internal)
 *   - updateInsight(teamId: string, insightId: string, updates: Partial<AIInsightDTO>): updates insight (internal)
 *   - deleteInsight(teamId: string, insightId: string): removes insight (internal)
 *   - getTeamInsights(teamId: string): returns all insights for a team
 *   - clearTeamInsights(teamId: string): removes all insights for a team
 *   - isAIEnabled(teamId: string): returns AI enabled status for team
 *   - toggleAI(teamId: string): toggles AI enabled/disabled for team
 *
 * Architecture:
 *   - Uses AIInsightDTO from @fypai/types (matches backend API responses)
 *   - Type is InsightTypeString ('summary' | 'action' | 'suggestion' | 'analysis' | 'code' | 'document')
 *   - Priority and tags are parsed objects (not JSON strings)
 *   - Timestamps are ISO strings
 *
 * Exports:
 *   - useAIInsightsStore: Zustand hook for AI insights state/methods
 *
 * Future:
 *   - Add voting/feedback on insights
 */
import { create } from 'zustand';
import type { AIInsightDTO, CreateAIInsightRequest } from '../types';
import { insightService } from '@/services';
import { getErrorMessage } from '@/services';
import { socketService } from '@/services/socketService';

interface AIInsightsState {
  insights: Record<string, AIInsightDTO[]>;
  aiEnabled: Record<string, boolean>; // Track AI toggle state per team
  isLoading: boolean;
  error: string | null;
  isSocketListening: boolean;
  // API methods
  fetchInsights: (teamId: string) => Promise<void>;
  createInsight: (data: CreateAIInsightRequest) => Promise<void>;
  deleteInsightById: (insightId: string) => Promise<void>;
  // Internal setters
  addInsight: (teamId: string, insight: AIInsightDTO) => void;
  updateInsight: (teamId: string, insightId: string, updates: Partial<AIInsightDTO>) => void;
  deleteInsight: (teamId: string, insightId: string) => void;
  getTeamInsights: (teamId: string) => AIInsightDTO[];
  clearTeamInsights: (teamId: string) => void;
  isAIEnabled: (teamId: string) => boolean;
  toggleAI: (teamId: string) => void;
  // Socket listeners
  initializeInsightListeners: () => void;
  cleanupInsightListeners: () => void;
}

// Mock initial insights for demonstration
const initialInsights: Record<string, AIInsightDTO[]> = {
  team1: [
    {
      id: 'insight1',
      teamId: 'team1',
      type: 'summary',
      title: 'Chat Summary',
      content: 'The team discussed project collaboration and scheduling. Alice welcomed the team, the AI assistant offered help, and Bob requested a sync meeting for tomorrow.',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      relatedMessageIds: ['msg1', 'msg2', 'msg3'],
      priority: 'medium',
      tags: ['meeting', 'collaboration'],
    },
    {
      id: 'insight2',
      teamId: 'team1',
      type: 'action',
      title: 'Action Items',
      content: '• Schedule sync meeting for tomorrow\n• Review project plan draft\n• Set up collaboration tools',
      createdAt: new Date(Date.now() - 1700000).toISOString(),
      relatedMessageIds: undefined,
      priority: 'high',
      tags: ['action-items', 'meeting'],
    },
    {
      id: 'insight3',
      teamId: 'team1',
      type: 'suggestion',
      title: 'AI Suggestions',
      content: 'Based on the conversation, I recommend:\n\n1. Create a shared project roadmap\n2. Set up recurring weekly syncs\n3. Define clear roles and responsibilities',
      createdAt: new Date(Date.now() - 1600000).toISOString(),
      relatedMessageIds: undefined,
      priority: 'medium',
      tags: ['recommendations', 'planning'],
    },
  ],
  team2: [
    {
      id: 'insight4',
      teamId: 'team2',
      type: 'summary',
      title: 'Research Discussion Summary',
      content: 'The team is exploring new AI model architectures. Discussion focused on transformer models and relevant research papers.',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      relatedMessageIds: ['msg4', 'msg5', 'msg6'],
      priority: 'high',
      tags: ['research', 'ai', 'transformers'],
    },
    {
      id: 'insight5',
      teamId: 'team2',
      type: 'document',
      title: 'Research Papers Collection',
      content: '## Key Papers on Transformer Models\n\n1. "Attention is All You Need" - Vaswani et al.\n2. "BERT: Pre-training of Deep Bidirectional Transformers" - Devlin et al.\n3. "GPT-3: Language Models are Few-Shot Learners" - Brown et al.\n\nThese papers provide foundational knowledge for your model architecture discussion.',
      createdAt: new Date(Date.now() - 7100000).toISOString(),
      relatedMessageIds: undefined,
      priority: 'high',
      tags: ['research', 'papers', 'reading-list'],
    },
  ],
  team3: [
    {
      id: 'insight6',
      teamId: 'team3',
      type: 'summary',
      title: 'Project Alpha Kickoff',
      content: 'Team started Project Alpha with component library setup completed by Alice. Discussion about API integration is underway.',
      createdAt: new Date(Date.now() - 5400000).toISOString(),
      relatedMessageIds: ['msg7', 'msg8', 'msg9', 'msg10'],
      priority: 'high',
      tags: ['project-alpha', 'development'],
    },
    {
      id: 'insight7',
      teamId: 'team3',
      type: 'code',
      title: 'API Integration Boilerplate',
      content: '```typescript\n// API Client boilerplate\nimport axios from \'axios\';\n\nconst apiClient = axios.create({\n  baseURL: process.env.REACT_APP_API_URL,\n  headers: {\n    \'Content-Type\': \'application/json\',\n  },\n});\n\nexport const fetchData = async (endpoint: string) => {\n  const response = await apiClient.get(endpoint);\n  return response.data;\n};\n```',
      createdAt: new Date(Date.now() - 5300000).toISOString(),
      relatedMessageIds: undefined,
      priority: undefined,
      tags: ['code', 'api'],
      metadata: {
        language: 'typescript',
        filename: 'apiClient.ts',
      },
    },
  ],
  team4: [
    {
      id: 'insight8',
      teamId: 'team4',
      type: 'analysis',
      title: 'Design System Analysis',
      content: '## Design System Review\n\n**Color Contrast:** All colors pass WCAG AA standards\n**Component Consistency:** 95% consistency across mockups\n**Accessibility Score:** 92/100\n\n**Recommendations:**\n- Add focus states to all interactive elements\n- Increase touch target sizes on mobile\n- Add alt text guidelines for images',
      createdAt: new Date(Date.now() - 10800000).toISOString(),
      relatedMessageIds: ['msg11', 'msg12', 'msg13'],
      priority: 'medium',
      tags: ['design', 'accessibility', 'analysis'],
    },
  ],
  team5: [
    {
      id: 'insight9',
      teamId: 'team5',
      type: 'summary',
      title: 'Backend API v2 Status',
      content: 'Backend API v2 is ready for testing. Frontend integration testing is starting, and all database migrations have been completed successfully with passing tests.',
      createdAt: new Date(Date.now() - 12600000).toISOString(),
      relatedMessageIds: ['msg14', 'msg15', 'msg16', 'msg17'],
      priority: 'high',
      tags: ['backend', 'testing', 'api'],
    },
    {
      id: 'insight10',
      teamId: 'team5',
      type: 'document',
      title: 'API Documentation',
      content: '## API v2 Endpoints\n\n### Authentication\n- `POST /auth/login` - User login\n- `POST /auth/logout` - User logout\n- `POST /auth/refresh` - Refresh token\n\n### Teams\n- `GET /teams` - List all teams\n- `POST /teams` - Create team\n- `GET /teams/:id` - Get team details\n\n### Messages\n- `GET /teams/:id/messages` - Get team messages\n- `POST /teams/:id/messages` - Send message',
      createdAt: new Date(Date.now() - 12500000).toISOString(),
      relatedMessageIds: undefined,
      priority: 'high',
      tags: ['api', 'documentation', 'endpoints'],
    },
  ],
};

export const useAIInsightsStore = create<AIInsightsState>()((set, get) => ({
  insights: initialInsights,
  // AI is enabled by default for all teams
  aiEnabled: {
    team1: true,
    team2: true,
    team3: true,
    team4: true,
    team5: true,
  },
  isLoading: false,
  error: null,
  isSocketListening: false,

  // API Methods
  fetchInsights: async (teamId: string) => {
    set({ isLoading: true, error: null });
    try {
      const insights = await insightService.getInsights(teamId);
      set((state) => ({
        insights: {
          ...state.insights,
          [teamId]: insights,
        },
        isLoading: false,
      }));
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  createInsight: async (data: CreateAIInsightRequest) => {
    set({ isLoading: true, error: null });
    try {
      const newInsight = await insightService.createInsight(data);
      get().addInsight(data.teamId, newInsight);
      set({ isLoading: false });
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  deleteInsightById: async (insightId: string) => {
    set({ isLoading: true, error: null });
    try {
      await insightService.deleteInsight(insightId);
      // Find which team this insight belongs to and remove it
      const { insights } = get();
      for (const teamId in insights) {
        const insight = insights[teamId].find((i) => i.id === insightId);
        if (insight) {
          get().deleteInsight(teamId, insightId);
          break;
        }
      }
      set({ isLoading: false });
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  // Internal setters
  addInsight: (teamId: string, insight: AIInsightDTO) =>
    set((state) => ({
      insights: {
        ...state.insights,
        [teamId]: [...(state.insights[teamId] || []), insight],
      },
    })),

  updateInsight: (teamId: string, insightId: string, updates: Partial<AIInsightDTO>) =>
    set((state) => ({
      insights: {
        ...state.insights,
        [teamId]: (state.insights[teamId] || []).map((insight) =>
          insight.id === insightId ? { ...insight, ...updates } : insight
        ),
      },
    })),

  deleteInsight: (teamId: string, insightId: string) =>
    set((state) => ({
      insights: {
        ...state.insights,
        [teamId]: (state.insights[teamId] || []).filter((insight) => insight.id !== insightId),
      },
    })),

  getTeamInsights: (teamId: string) => {
    return get().insights[teamId] || [];
  },

  clearTeamInsights: (teamId: string) =>
    set((state) => ({
      insights: {
        ...state.insights,
        [teamId]: [],
      },
    })),

  isAIEnabled: (teamId: string) => {
    return get().aiEnabled[teamId] ?? true; // Default to enabled
  },

  toggleAI: (teamId: string) =>
    set((state) => ({
      aiEnabled: {
        ...state.aiEnabled,
        [teamId]: !(state.aiEnabled[teamId] ?? true),
      },
    })),

  // Socket Listeners
  initializeInsightListeners: () => {
    if (get().isSocketListening) {
      console.log('[AIInsightsStore] Socket listeners already initialized');
      return;
    }

    console.log('[AIInsightsStore] Initializing insight socket listeners');

    // Listen for new AI-generated insights
    socketService.onAIInsight((insight: AIInsightDTO) => {
      console.log('[AIInsightsStore] 🤖 Received new insight via socket:', insight.id, 'for team:', insight.teamId);
      get().addInsight(insight.teamId, insight);
    });

    set({ isSocketListening: true });
  },

  cleanupInsightListeners: () => {
    console.log('[AIInsightsStore] Cleaning up insight socket listeners');
    socketService.off('ai:insight:new');
    set({ isSocketListening: false });
  },
}));
