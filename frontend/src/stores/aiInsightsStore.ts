/**
 * AI INSIGHTS STORE (Zustand) - REFACTORED for Event Bus Architecture
 *
 * Tech Stack: Zustand, TypeScript, @fypai/types, Event Bus
 * Purpose: Manage UI state for AI insights (loading, errors, AI toggle) and delegate data to RealtimeStore
 *
 * State:
 *   - aiEnabled: Record<teamId, boolean> - AI toggle state per team
 *   - isLoading: boolean - API request loading state
 *   - error: string | null - Last error message
 *
 * Methods & Arguments:
 *   - fetchInsights(teamId: string): fetch insights from API (publishes to Event Bus)
 *   - createInsight(data: CreateInsightRequest): create insight via API (publishes to Event Bus)
 *   - deleteInsightById(insightId: string): delete insight via API (publishes to Event Bus)
 *   - getTeamInsights(teamId: string): reads insights from RealtimeStore
 *   - isAIEnabled(teamId: string): returns AI enabled status for team
 *   - toggleAI(teamId: string): toggles AI enabled/disabled for team
 *
 * Architecture:
 *   - NO LONGER stores insights directly (delegated to RealtimeStore)
 *   - Services publish to Event Bus → Event Bridge → RealtimeStore updates
 *   - This store reads from RealtimeStore via selectors
 *   - Socket Bridge handles real-time events (no direct socket listeners here)
 *   - Backward compatible: provides same interface for components
 *
 * Migration Notes:
 *   - Old: aiInsightsStore.insights[teamId] → New: aiInsightsStore.getTeamInsights(teamId) or read from RealtimeStore
 *   - Socket listeners removed (handled by Socket Bridge → Event Bus)
 *
 * Exports:
 *   - useAIInsightsStore: Zustand hook for AI insights UI state/methods
 */
import { create } from 'zustand';
import type { AIInsightDTO, CreateAIInsightRequest } from '../types';
import { insightService } from '@/services';
import { getErrorMessage } from '@/services';
import { useRealtimeStore } from '@/core/eventBus/RealtimeStore';

interface AIInsightsState {
  // UI State
  aiEnabled: Record<string, boolean>; // Track AI toggle state per team
  isLoading: boolean;
  error: string | null;
  
  // API methods (trigger Event Bus publications)
  fetchInsights: (teamId: string) => Promise<void>;
  createInsight: (data: CreateAIInsightRequest) => Promise<void>;
  deleteInsightById: (insightId: string) => Promise<void>;
  
  // Data Readers (delegate to RealtimeStore)
  getTeamInsights: (teamId: string) => AIInsightDTO[];
  
  // UI State Methods
  isAIEnabled: (teamId: string) => boolean;
  toggleAI: (teamId: string) => void;
  
  // DEPRECATED (kept for backward compatibility during migration)
  insights: Record<string, AIInsightDTO[]>; // Getter property that delegates to RealtimeStore
  initializeInsightListeners: () => void;
  cleanupInsightListeners: () => void;
}

export const useAIInsightsStore = create<AIInsightsState>()((set, get) => ({
  // UI State (DEPRECATED - now delegated to RealtimeStore)
  aiEnabled: {},  // Legacy field - now reads from RealtimeStore.isAIEnabled()
  isLoading: false,
  error: null,

  // DEPRECATED - Backward compatibility getter (delegates to RealtimeStore)
  get insights(): Record<string, AIInsightDTO[]> {
    return useRealtimeStore.getState().insights;
  },

  // API Methods - these now trigger Event Bus publications via services
  fetchInsights: async (teamId: string) => {
    set({ isLoading: true, error: null });
    try {
      // insightService.getInsights publishes 'insights:fetched' event to Event Bus
      // Event Bridge → RealtimeStore updates automatically
      await insightService.getInsights(teamId);
      set({ isLoading: false });
      console.log('[AIInsightsStore] ✅ Insights fetched for team:', teamId);
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
      console.error('[AIInsightsStore] Failed to fetch insights:', error);
    }
  },

  createInsight: async (data: CreateAIInsightRequest) => {
    set({ isLoading: true, error: null });
    try {
      // insightService.createInsight publishes 'insight:created' event to Event Bus
      await insightService.createInsight(data);
      set({ isLoading: false });
      console.log('[AIInsightsStore] ✅ Insight created for team:', data.teamId);
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
      console.error('[AIInsightsStore] Failed to create insight:', error);
    }
  },

  deleteInsightById: async (insightId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Find teamId from RealtimeStore
      const realtimeInsights = useRealtimeStore.getState().insights;
      let teamId: string | null = null;
      
      for (const tid of Object.keys(realtimeInsights)) {
        const insightExists = realtimeInsights[tid]?.find((i: AIInsightDTO) => i.id === insightId);
        if (insightExists) {
          teamId = tid;
          break;
        }
      }
      
      if (!teamId) {
        throw new Error(`Insight ${insightId} not found in any team`);
      }
      
      // insightService.deleteInsight publishes 'insight:deleted' event to Event Bus
      await insightService.deleteInsight(insightId, teamId);
      set({ isLoading: false });
      console.log('[AIInsightsStore] ✅ Insight deleted:', insightId);
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
      console.error('[AIInsightsStore] Failed to delete insight:', error);
    }
  },

  // Data Readers - delegate to RealtimeStore
  getTeamInsights: (teamId: string) => {
    const realtimeInsights = useRealtimeStore.getState().insights;
    return realtimeInsights[teamId] || [];
  },

  // UI State Methods
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

  // DEPRECATED (no-op stubs for backward compatibility during migration)
  initializeInsightListeners: () => {
    console.log('[AIInsightsStore] ⚠️ DEPRECATED: Socket listeners now handled by Socket Bridge');
  },

  cleanupInsightListeners: () => {
    console.log('[AIInsightsStore] ⚠️ DEPRECATED: Socket cleanup now handled by Socket Bridge');
  },
}));
