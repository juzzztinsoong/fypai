/**
 * Realtime Provider
 * 
 * Wraps the app to initialize Event Bus and Socket connections before rendering.
 * This ensures all real-time infrastructure is ready before components mount.
 * 
 * Architecture:
 * 1. Initialize Event Bus bridge (Event Bus → RealtimeStore)
 * 2. Connect to WebSocket
 * 3. Initialize Socket Bridge (Socket → Event Bus)
 * 4. Render children only after setup complete
 * 
 * Usage:
 * ```tsx
 * <RealtimeProvider userId="user1">
 *   <App />
 * </RealtimeProvider>
 * ```
 */

import { useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { initializeEventBridge } from '@/core/eventBus/bridge'
import { eventBus } from '@/core/eventBus'
import { initializeSocketBridge } from '@/services/realtime/socketBridge'
import { socketService } from '@/services/socketService'
import { usePresenceStore } from '@/stores/presenceStore'

interface RealtimeProviderProps {
  children: ReactNode
  userId: string
}

export const RealtimeProvider = ({ children, userId }: RealtimeProviderProps) => {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Store cleanup functions
  const eventBridgeCleanupRef = useRef<(() => void) | null>(null)
  const socketBridgeCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const initializeRealtime = async () => {
      try {
        console.log('[RealtimeProvider] 🚀 Initializing real-time infrastructure...')
        
        // Step 1: Initialize Event Bus bridge (Event Bus → RealtimeStore)
        console.log('[RealtimeProvider] 🔌 Initializing Event Bus bridge...')
        eventBridgeCleanupRef.current = initializeEventBridge()
        
        // Enable Event Bus logging for debugging real-time updates
        eventBus.setLogging(true)
        console.log('[RealtimeProvider] ✅ Event Bus bridge active (logging enabled)')
        
        // Step 2: Connect to WebSocket via presenceStore (handles its own listeners)
        console.log('[RealtimeProvider] 🔌 Connecting to WebSocket...')
        const presenceStore = usePresenceStore.getState()
        await presenceStore.connect(userId)
        console.log('[RealtimeProvider] ✅ WebSocket connected')
        
        // Step 3: Initialize Socket Bridge (Socket → Event Bus)
        console.log('[RealtimeProvider] 🔌 Initializing Socket Bridge...')
        const socket = socketService.getSocket()
        if (socket) {
          socketBridgeCleanupRef.current = initializeSocketBridge(socket)
          console.log('[RealtimeProvider] ✅ Socket Bridge active')
          console.log('[RealtimeProvider] ✅ Real-time infrastructure ready!')
        } else {
          throw new Error('Socket not available after connection')
        }
        
        setIsReady(true)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error('[RealtimeProvider] ❌ Failed to initialize:', errorMessage)
        setError(errorMessage)
      }
    }

    initializeRealtime()

    // Cleanup on unmount
    return () => {
      console.log('[RealtimeProvider] 🧹 Cleaning up real-time infrastructure...')
      
      // Disconnect via presenceStore
      const presenceStore = usePresenceStore.getState()
      presenceStore.disconnect()
      
      // Cleanup Event Bus bridges
      if (eventBridgeCleanupRef.current) {
        eventBridgeCleanupRef.current()
        console.log('[RealtimeProvider] 🧹 Event Bus bridge cleaned up')
      }
      if (socketBridgeCleanupRef.current) {
        socketBridgeCleanupRef.current()
        console.log('[RealtimeProvider] 🧹 Socket Bridge cleaned up')
      }
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
