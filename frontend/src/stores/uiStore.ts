/**
 * UIStore - UI State and Preferences
 * 
 * Per Refactoring Guide Section 2.1:
 * - Current team context (currentTeamId)
 * - Loading and error states per resource
 * - User preferences (theme, layout, sidebar)
 * - View states (filters, scroll positions, expanded items)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================================================
// STATE TYPES
// ============================================================================

interface FilterState {
  types: string[]
  priority?: string
  searchQuery?: string
}

interface UIState {
  // Current Context
  currentTeamId: string | null
  
  // Loading States
  loadingStates: Record<string, boolean>
  
  // Error States
  errorStates: Record<string, string | null>
  
  // User Preferences
  preferences: {
    theme: 'light' | 'dark'
    layout: string  // Future: 'compact' | 'comfortable' | 'spacious'
    sidebarCollapsed: boolean
  }
  
  // View States (per guide section 2.1)
  viewStates: {
    insightFilters: Record<string, FilterState>  // teamId -> FilterState
    scrollPositions: Record<string, number>      // teamId -> scroll position
    expandedInsights: string[]                   // insightId array (for HMR compatibility)
  }
}

interface UIActions {
  // Context methods
  setCurrentTeam: (teamId: string | null) => void
  getCurrentTeamId: () => string | null
  
  // Loading methods
  setLoading: (key: string, isLoading: boolean) => void
  getLoading: (key: string) => boolean
  
  // Error methods
  setError: (key: string, errorMessage: string | null) => void
  clearError: (key: string) => void
  getError: (key: string) => string | null
  
  // Preference methods
  updatePreference: <K extends keyof UIState['preferences']>(
    key: K,
    value: UIState['preferences'][K]
  ) => void
  getPreferences: () => UIState['preferences']
  
  // View state methods
  setInsightFilter: (teamId: string, filter: FilterState) => void
  getInsightFilter: (teamId: string) => FilterState | undefined
  setScrollPosition: (teamId: string, position: number) => void
  getScrollPosition: (teamId: string) => number
  toggleInsightExpanded: (insightId: string) => void
  isInsightExpanded: (insightId: string) => boolean
}

type UIStore = UIState & UIActions

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentTeamId: null,
      
      loadingStates: {},
      
      errorStates: {},
      
      preferences: {
        theme: 'light',
        layout: 'comfortable',
        sidebarCollapsed: false,
      },
      
      viewStates: {
        insightFilters: {},
        scrollPositions: {},
        expandedInsights: [],
      },
      
      // ============================================================================
      // CONTEXT METHODS
      // ============================================================================
      
      setCurrentTeam: (teamId) => set({ currentTeamId: teamId }),
      
      getCurrentTeamId: () => get().currentTeamId,
      
      // ============================================================================
      // LOADING METHODS
      // ============================================================================
      
      setLoading: (key, isLoading) => set((state) => ({
        loadingStates: {
          ...state.loadingStates,
          [key]: isLoading,
        },
      })),
      
      getLoading: (key) => get().loadingStates[key] || false,
      
      // ============================================================================
      // ERROR METHODS
      // ============================================================================
      
      setError: (key, errorMessage) => set((state) => ({
        errorStates: {
          ...state.errorStates,
          [key]: errorMessage,
        },
      })),
      
      clearError: (key) => set((state) => ({
        errorStates: {
          ...state.errorStates,
          [key]: null,
        },
      })),
      
      getError: (key) => get().errorStates[key] || null,
      
      // ============================================================================
      // PREFERENCE METHODS
      // ============================================================================
      
      updatePreference: (key, value) => set((state) => ({
        preferences: {
          ...state.preferences,
          [key]: value,
        },
      })),
      
      getPreferences: () => get().preferences,
      
      // ============================================================================
      // VIEW STATE METHODS
      // ============================================================================
      
      setInsightFilter: (teamId, filter) => set((state) => ({
        viewStates: {
          ...state.viewStates,
          insightFilters: {
            ...state.viewStates.insightFilters,
            [teamId]: filter,
          },
        },
      })),
      
      getInsightFilter: (teamId) => get().viewStates.insightFilters[teamId],
      
      setScrollPosition: (teamId, position) => set((state) => ({
        viewStates: {
          ...state.viewStates,
          scrollPositions: {
            ...state.viewStates.scrollPositions,
            [teamId]: position,
          },
        },
      })),
      
      getScrollPosition: (teamId) => get().viewStates.scrollPositions[teamId] || 0,
      
      toggleInsightExpanded: (insightId) => set((state) => {
        const expanded = state.viewStates.expandedInsights
        const isExpanded = expanded.includes(insightId)
        
        return {
          viewStates: {
            ...state.viewStates,
            expandedInsights: isExpanded
              ? expanded.filter(id => id !== insightId)
              : [...expanded, insightId],
          },
        }
      }),
      
      isInsightExpanded: (insightId) => get().viewStates.expandedInsights.includes(insightId),
    }),
    {
      name: 'ui-store',
      partialize: (state) => ({
        currentTeamId: state.currentTeamId,
        preferences: state.preferences,
        viewStates: {
          insightFilters: state.viewStates.insightFilters,
          scrollPositions: state.viewStates.scrollPositions,
          expandedInsights: Array.from(state.viewStates.expandedInsights),
        },
      }),
      // Merge function to properly restore expandedInsights array
      merge: (persistedState: any, currentState: UIStore) => {
        const merged = {
          ...currentState,
          ...persistedState,
        }
        
        // Ensure expandedInsights is an array
        if (persistedState?.viewStates?.expandedInsights && Array.isArray(persistedState.viewStates.expandedInsights)) {
          merged.viewStates = {
            ...merged.viewStates,
            expandedInsights: persistedState.viewStates.expandedInsights,
          }
        }
        
        return merged
      },
    }
  )
)
