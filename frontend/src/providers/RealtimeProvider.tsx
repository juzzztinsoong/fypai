/**
 * Realtime Provider
 * 
 * Simplified architecture per React 18 remount fix:
 * - Socket lifecycle managed OUTSIDE React (in realtimeInit.ts)
 * - Component only manages UI state (isReady, error)
 * - Handlers registered once globally, persist across remounts
 * 
 * Usage:
 * ```tsx
 * <RealtimeProvider userId="user1">
 *   <App />
 * </RealtimeProvider>
 * ```
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { initializeRealtime, isRealtimeInitialized } from '@/services/realtimeInit'

interface RealtimeProviderProps {
  children: ReactNode
  userId: string
}

export const RealtimeProvider = ({ children, userId }: RealtimeProviderProps) => {
  // Lazy initial state - check if already initialized
  const [isReady, setIsReady] = useState(() => {
    const alreadyReady = isRealtimeInitialized()
    console.log('[RealtimeProvider] 🎬 Component mounting, isRealtimeInitialized():', alreadyReady)
    return alreadyReady
  })
  const [error, setError] = useState<string | null>(null)

  console.log('[RealtimeProvider] 🎨 Render, isReady:', isReady, 'error:', error)

  useEffect(() => {
    console.log('[RealtimeProvider] 🔄 useEffect running, userId:', userId)
    
    // If already initialized and connected, just set ready and return
    if (isRealtimeInitialized()) {
      console.log('[RealtimeProvider] ♻️  Already initialized, setting ready state')
      setIsReady(true)
      return
    }
    
    console.log('[RealtimeProvider] 🚀 Initializing real-time infrastructure...')
    
    // Track if component is still mounted to prevent state updates after unmount
    let mounted = true
    console.log('[RealtimeProvider] 📍 Set mounted flag to true')
    
    // Initialize socket and handlers (happens once globally)
    initializeRealtime(userId)
      .then(() => {
        console.log('[RealtimeProvider] ✅ Init promise resolved, mounted:', mounted)
        if (mounted) {
          console.log('[RealtimeProvider] ✅ Setting ready state to true')
          setIsReady(true)
          setError(null)
        } else {
          console.log('[RealtimeProvider] ⚠️  Component unmounted, skipping state update')
        }
      })
      .catch((err) => {
        console.log('[RealtimeProvider] ❌ Init promise rejected, mounted:', mounted)
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          console.error('[RealtimeProvider] ❌ Initialization failed:', errorMessage)
          setError(errorMessage)
        }
      })
    
    // Cleanup: DON'T clean up socket or handlers - they persist across remounts
    return () => {
      console.log('[RealtimeProvider] 🧹 Cleanup function running')
      console.log('[RealtimeProvider] 🧹 Setting mounted flag to false')
      mounted = false
      console.log('[RealtimeProvider] 🧹 Component unmounting (socket and handlers persist)')
    }
  }, [userId])

  // Show loading state
  if (!isReady && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Connecting to real-time services...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Render children only when ready
  return <>{children}</>
}
