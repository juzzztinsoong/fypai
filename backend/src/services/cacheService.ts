/**
 * Cache Service
 * 
 * Tech Stack: Redis via ioredis
 * Pattern: Service layer for caching with typed methods
 * 
 * Cache Keys:
 *   - conversation:{teamId}:context -> MessageDTO[] (recent messages)
 *   - ai:response:{promptHash} -> string (LLM response)
 *   - team:{teamId}:* -> various team-related data
 * 
 * TTL Defaults:
 *   - Conversation context: 300s (5 minutes)
 *   - AI responses: 3600s (1 hour)
 *   - Team data: 600s (10 minutes)
 * 
 * Methods:
 *   - getConversationContext(teamId): Get cached messages
 *   - setConversationContext(teamId, messages, ttl): Cache messages
 *   - getAIResponse(promptHash): Get cached AI response
 *   - setAIResponse(promptHash, response, ttl): Cache AI response
 *   - invalidateTeamCache(teamId): Clear all team-related cache
 *   - get/set/del: Generic cache operations
 */

import { getRedisClient, isRedisAvailable } from './redis.js'
import type { MessageDTO } from '../types.js'

export class CacheService {
  private static readonly DEFAULT_TTL = {
    CONVERSATION: 300,      // 5 minutes
    AI_RESPONSE: 3600,      // 1 hour
    TEAM_DATA: 600,         // 10 minutes
  }

  /**
   * Get conversation context (recent messages) for a team
   * @param {string} teamId - Team ID
   * @returns {Promise<MessageDTO[] | null>} Cached messages or null
   */
  static async getConversationContext(teamId: string): Promise<MessageDTO[] | null> {
    if (!isRedisAvailable()) {
      return null
    }
    
    try {
      const key = `conversation:${teamId}:context`
      const cached = await getRedisClient().get(key)
      
      if (!cached) {
        console.log(`[CacheService] ❌ Cache miss: ${key}`)
        return null
      }
      
      console.log(`[CacheService] ✅ Cache hit: ${key}`)
      return JSON.parse(cached)
    } catch (error) {
      console.error('[CacheService] getConversationContext error:', error)
      return null
    }
  }

  /**
   * Set conversation context (cache recent messages)
   * @param {string} teamId - Team ID
   * @param {MessageDTO[]} messages - Messages to cache
   * @param {number} ttl - Time to live in seconds (default: 300s)
   */
  static async setConversationContext(
    teamId: string,
    messages: MessageDTO[],
    ttl: number = this.DEFAULT_TTL.CONVERSATION
  ): Promise<void> {
    if (!isRedisAvailable()) {
      return
    }
    
    try {
      const key = `conversation:${teamId}:context`
      await getRedisClient().setex(key, ttl, JSON.stringify(messages))
      console.log(`[CacheService] 💾 Cached conversation context for team ${teamId} (TTL: ${ttl}s)`)
    } catch (error) {
      console.error('[CacheService] setConversationContext error:', error)
    }
  }

  /**
   * Get cached AI response by prompt hash
   * @param {string} promptHash - Hash of the prompt
   * @returns {Promise<string | null>} Cached response or null
   */
  static async getAIResponse(promptHash: string): Promise<string | null> {
    try {
      const key = `ai:response:${promptHash}`
      const cached = await getRedisClient().get(key)
      
      if (!cached) {
        console.log(`[CacheService] ❌ Cache miss: ${key}`)
        return null
      }
      
      console.log(`[CacheService] ✅ Cache hit: ${key}`)
      return cached
    } catch (error) {
      console.error('[CacheService] getAIResponse error:', error)
      return null
    }
  }

  /**
   * Set cached AI response with prompt hash
   * @param {string} promptHash - Hash of the prompt
   * @param {string} response - AI response to cache
   * @param {number} ttl - Time to live in seconds (default: 3600s)
   */
  static async setAIResponse(
    promptHash: string,
    response: string,
    ttl: number = this.DEFAULT_TTL.AI_RESPONSE
  ): Promise<void> {
    try {
      const key = `ai:response:${promptHash}`
      await getRedisClient().setex(key, ttl, response)
      console.log(`[CacheService] 💾 Cached AI response ${promptHash} (TTL: ${ttl}s)`)
    } catch (error) {
      console.error('[CacheService] setAIResponse error:', error)
    }
  }

  /**
   * Invalidate all cache entries for a team
   * Deletes: conversation:{teamId}:*, team:{teamId}:*
   * @param {string} teamId - Team ID
   */
  static async invalidateTeamCache(teamId: string): Promise<void> {
    try {
      const redis = getRedisClient()
      
      // Find all keys matching patterns
      const patterns = [
        `conversation:${teamId}:*`,
        `team:${teamId}:*`,
      ]
      
      let deletedCount = 0
      
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.del(...keys)
          deletedCount += keys.length
        }
      }
      
      console.log(`[CacheService] 🗑️  Invalidated ${deletedCount} cache entries for team ${teamId}`)
    } catch (error) {
      console.error('[CacheService] invalidateTeamCache error:', error)
    }
  }

  /**
   * Generic get operation
   * @param {string} key - Cache key
   * @returns {Promise<string | null>} Cached value or null
   */
  static async get(key: string): Promise<string | null> {
    try {
      return await getRedisClient().get(key)
    } catch (error) {
      console.error('[CacheService] get error:', error)
      return null
    }
  }

  /**
   * Generic set operation
   * @param {string} key - Cache key
   * @param {string} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   */
  static async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await getRedisClient().setex(key, ttl, value)
      } else {
        await getRedisClient().set(key, value)
      }
    } catch (error) {
      console.error('[CacheService] set error:', error)
    }
  }

  /**
   * Generic delete operation
   * @param {string} key - Cache key
   */
  static async del(key: string): Promise<void> {
    try {
      await getRedisClient().del(key)
      console.log(`[CacheService] 🗑️  Deleted cache key: ${key}`)
    } catch (error) {
      console.error('[CacheService] del error:', error)
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Redis info stats
   */
  static async getStats(): Promise<any> {
    try {
      const redis = getRedisClient()
      const info = await redis.info('stats')
      const dbsize = await redis.dbsize()
      
      return {
        dbsize,
        info: info.split('\r\n').reduce((acc: any, line) => {
          const [key, value] = line.split(':')
          if (key && value) {
            acc[key] = value
          }
          return acc
        }, {}),
      }
    } catch (error) {
      console.error('[CacheService] getStats error:', error)
      return null
    }
  }
}
