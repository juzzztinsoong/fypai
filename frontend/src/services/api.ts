/**
 * Base API Client Configuration
 * 
 * Tech Stack: Axios
 * Pattern: Singleton instance with interceptors + retry logic
 * 
 * Features:
 * - Centralized HTTP client
 * - Exponential backoff retry (network errors, 5xx, 429)
 * - Request cancellation (AbortController)
 * - Token refresh on 401 (prepared for auth)
 * - Type-safe error responses
 * 
 * Retry Strategy:
 * - Max 3 retries
 * - Exponential backoff: 1s, 2s, 4s (with jitter)
 * - Retry on: network errors, 5xx, 429
 * - Don't retry: 4xx (except 429)
 * 
 * Usage:
 *   import { api } from './api'
 *   const response = await api.get('/teams', { signal: abortSignal })
 */

import axios, { AxiosError } from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosRequestConfig } from 'axios'

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000] // ms: 1s, 2s, 4s
const JITTER_MAX = 200 // ms: random jitter up to 200ms

// Track retry attempts per request
const retryCountMap = new WeakMap<AxiosRequestConfig, number>()

/**
 * Calculate retry delay with exponential backoff and jitter
 * @param retryCount - Current retry attempt (0-indexed)
 * @returns Delay in milliseconds
 */
function getRetryDelay(retryCount: number): number {
  const baseDelay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1]
  const jitter = Math.random() * JITTER_MAX
  return baseDelay + jitter
}

/**
 * Determine if error is retryable
 * @param error - Axios error
 * @returns True if should retry
 */
function isRetryableError(error: AxiosError): boolean {
  // Network errors (no response)
  if (!error.response) {
    return true
  }
  
  const status = error.response.status
  
  // Retry 5xx server errors
  if (status >= 500) {
    return true
  }
  
  // Retry 429 rate limit
  if (status === 429) {
    return true
  }
  
  // Don't retry 4xx client errors (except 429)
  return false
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create Axios instance with base configuration
 */
export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
})

/**
 * Request interceptor
 * Add authentication token to requests (when implemented)
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Initialize retry count for this request
    if (!retryCountMap.has(config)) {
      retryCountMap.set(config, 0)
    }
    
    // TODO: Add auth token when authentication is implemented
    // const token = sessionStorage.getItem('authToken')
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`
    // }
    
    const retryCount = retryCountMap.get(config) || 0
    const retryLabel = retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ''
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}${retryLabel}`)
    
    return config
  },
  (error: AxiosError) => {
    console.error('[API] Request error:', error.message)
    return Promise.reject(error)
  }
)

/**
 * Response interceptor
 * Handle errors globally, retry logic, and token refresh
 */
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Clear retry count on success
    if (response.config) {
      retryCountMap.delete(response.config)
    }
    
    console.log(`[API] ✅ ${response.status} ${response.config.url}`)
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config
    
    if (!originalRequest) {
      return Promise.reject(error)
    }
    
    // Get current retry count
    const retryCount = retryCountMap.get(originalRequest) || 0
    
    // Handle 401 Unauthorized - Token Refresh (prepared for future auth)
    if (error.response?.status === 401 && retryCount === 0) {
      console.log('[API] 🔄 401 Unauthorized - attempting token refresh')
      
      try {
        // TODO: Implement token refresh when auth is added
        // const newToken = await refreshAccessToken()
        // sessionStorage.setItem('authToken', newToken)
        // originalRequest.headers.Authorization = `Bearer ${newToken}`
        
        // Retry original request with new token
        // retryCountMap.set(originalRequest, retryCount + 1)
        // return api.request(originalRequest)
        
        // For now, just reject (no auth yet)
        console.warn('[API] Token refresh not implemented - rejecting request')
        return Promise.reject(error)
      } catch (refreshError) {
        console.error('[API] Token refresh failed - logging out')
        // TODO: Redirect to login
        return Promise.reject(refreshError)
      }
    }
    
    // Check if error is retryable and we haven't exceeded max retries
    if (isRetryableError(error) && retryCount < MAX_RETRIES) {
      const delay = getRetryDelay(retryCount)
      
      console.warn(
        `[API] ⚠️  Retrying request (${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms`,
        error.response?.status || 'network error'
      )
      
      // Wait for backoff delay
      await sleep(delay)
      
      // Increment retry count
      retryCountMap.set(originalRequest, retryCount + 1)
      
      // Retry the request
      return api.request(originalRequest)
    }
    
    // Max retries exceeded or non-retryable error
    retryCountMap.delete(originalRequest)
    
    // Handle different error scenarios
    if (error.response) {
      // Server responded with error status
      const status = error.response.status
      const url = originalRequest.url || 'unknown'
      
      console.error(`[API] ❌ ${status} ${url}:`, error.response.data)
      
      // Handle specific error codes
      switch (status) {
        case 401:
          console.error('[API] Unauthorized - redirecting to login')
          // TODO: Redirect to login when auth is implemented
          break
        case 403:
          console.error('[API] Forbidden - insufficient permissions')
          break
        case 404:
          console.error('[API] Not found')
          break
        case 429:
          console.error('[API] Rate limit exceeded - max retries reached')
          break
        case 500:
          console.error('[API] Server error - max retries reached')
          break
        default:
          console.error(`[API] Error ${status}`)
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('[API] ❌ No response from server (network error):', error.message)
    } else {
      // Error setting up request
      console.error('[API] ❌ Request setup error:', error.message)
    }
    
    return Promise.reject(error)
  }
)

/**
 * Helper to extract error message from API error
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.message) {
      return error.response.data.message
    }
    if (error.response?.data?.error) {
      return error.response.data.error
    }
    if (error.message) {
      return error.message
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unknown error occurred'
}

export default api
