/**
 * Base API Client Configuration
 * 
 * Tech Stack: Axios
 * Pattern: Singleton instance with interceptors
 * 
 * Features:
 * - Centralized HTTP client
 * - Environment variable for API URL
 * - Request interceptor for auth tokens (future)
 * - Response interceptor for error handling
 * - Type-safe error responses
 * 
 * Usage:
 *   import { api } from './api'
 *   const response = await api.get('/teams')
 */

import axios, { AxiosError } from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

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
    // TODO: Add auth token when authentication is implemented
    // const token = localStorage.getItem('authToken')
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`
    // }
    
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error: AxiosError) => {
    console.error('[API] Request error:', error.message)
    return Promise.reject(error)
  }
)

/**
 * Response interceptor
 * Handle errors globally and provide consistent error format
 */
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`[API] ${response.status} ${response.config.url}`)
    return response
  },
  (error: AxiosError) => {
    // Handle different error scenarios
    if (error.response) {
      // Server responded with error status
      const status = error.response.status
      const url = error.config?.url || 'unknown'
      
      console.error(`[API] ${status} ${url}:`, error.response.data)
      
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
        case 500:
          console.error('[API] Server error')
          break
        default:
          console.error(`[API] Error ${status}`)
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('[API] No response from server:', error.message)
    } else {
      // Error setting up request
      console.error('[API] Request setup error:', error.message)
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
