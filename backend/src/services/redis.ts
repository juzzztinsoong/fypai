/**
 * Redis Client Singleton
 * 
 * Tech Stack: ioredis
 * Pattern: Singleton with lazy initialization
 * 
 * Configuration:
 *   - REDIS_HOST (default: localhost)
 *   - REDIS_PORT (default: 6379)
 *   - REDIS_PASSWORD (optional)
 *   - REDIS_DB (default: 0)
 * 
 * Features:
 *   - Connection pooling
 *   - Auto-reconnect
 *   - Health check
 *   - Graceful shutdown
 */

import Redis, { RedisOptions } from 'ioredis'

let redisClient: Redis | null = null
let redisDisabled = false // Flag to stop retry attempts

/**
 * Get Redis client instance (singleton)
 * Creates client on first call, returns existing instance on subsequent calls
 */
export function getRedisClient(): Redis {
  // If Redis is disabled due to connection failure, throw error
  if (redisDisabled) {
    throw new Error('Redis is disabled - connection failed')
  }
  
  if (!redisClient) {
    const options: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      
      // Connection pooling
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      
      // Auto-reconnect strategy - stop after 3 attempts
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.log('[Redis] ⚠️  Max retry attempts reached, disabling Redis')
          redisDisabled = true
          return null // Stop retrying
        }
        const delay = Math.min(times * 1000, 3000) // 1s, 2s, 3s
        console.log(`[Redis] Retry attempt ${times}/3, waiting ${delay}ms`)
        return delay
      },
      
      // Timeouts
      connectTimeout: 10000,
      commandTimeout: 5000,
    }

    redisClient = new Redis(options)

    // Event handlers
    redisClient.on('connect', () => {
      console.log('[Redis] ✅ Connected to Redis server')
    })

    redisClient.on('ready', () => {
      console.log('[Redis] 🚀 Redis client ready')
    })

    redisClient.on('error', (err) => {
      console.error('[Redis] ❌ Connection error:', err.message)
    })

    redisClient.on('close', () => {
      console.log('[Redis] 🔌 Connection closed')
    })

    redisClient.on('reconnecting', () => {
      console.log('[Redis] 🔄 Reconnecting...')
    })
  }

  return redisClient
}

/**
 * Check if Redis is available (not disabled)
 * @returns {boolean} True if Redis can be used
 */
export function isRedisAvailable(): boolean {
  return !redisDisabled && redisClient !== null
}

/**
 * Check Redis connection health
 * @returns {Promise<boolean>} True if connected and responsive
 */
export async function checkRedisHealth(): Promise<boolean> {
  if (redisDisabled) {
    return false
  }
  
  try {
    const client = getRedisClient()
    const pong = await client.ping()
    return pong === 'PONG'
  } catch (error) {
    console.error('[Redis] Health check failed:', error)
    return false
  }
}

/**
 * Gracefully disconnect from Redis
 * Call this on application shutdown
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('[Redis] 👋 Disconnected')
  }
}

/**
 * Get Redis client stats
 * @returns {Object} Connection stats
 */
export function getRedisStats() {
  if (!redisClient) {
    return { status: 'not-initialized' }
  }

  return {
    status: redisClient.status,
    host: redisClient.options.host,
    port: redisClient.options.port,
    db: redisClient.options.db,
  }
}
