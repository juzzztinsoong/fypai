/**
 * Queue Configuration
 * 
 * Shared BullMQ configuration for all queues.
 * 
 * Tech Stack: BullMQ + Redis (ioredis)
 * Pattern: Shared connection pool
 * 
 * Features:
 * - Redis connection from existing service
 * - Retry strategies with exponential backoff
 * - Job retention policies
 * - Dead letter queue for failed jobs
 */

import { ConnectionOptions, QueueOptions, WorkerOptions } from 'bullmq';

/**
 * Redis connection options for BullMQ
 * Uses same Redis instance as cache service
 */
export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false, // Required for BullMQ
};

/**
 * Default queue options
 */
export const defaultQueueOptions: Omit<QueueOptions, 'connection'> = {
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s, then 4s, 8s
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

/**
 * Default worker options
 */
export const defaultWorkerOptions: Omit<WorkerOptions, 'connection'> = {
  concurrency: 5, // Process 5 jobs in parallel per worker
  limiter: {
    max: 100, // Max 100 jobs
    duration: 60000, // per minute
  },
};

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  EMBEDDING: 'embedding',
  AI_AGENT: 'ai-agent',
  INSIGHT: 'insight',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
