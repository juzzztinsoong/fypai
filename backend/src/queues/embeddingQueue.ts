/**
 * Embedding Queue
 * 
 * Queue for generating and storing message embeddings.
 * 
 * Tech Stack: BullMQ
 * Pattern: Producer-Consumer
 * 
 * Job Data:
 * - messageId: string - Message to embed
 * - teamId: string - Team context
 * - content: string - Text to embed
 * - priority: number (optional) - Job priority (higher = sooner)
 */

import { Queue } from 'bullmq';
import { redisConnection, defaultQueueOptions, QUEUE_NAMES } from './queueConfig.js';

export interface EmbeddingJobData {
  messageId: string;
  teamId: string;
  content: string;
  authorId: string;
  createdAt: string;
  priority?: number;
}

/**
 * Embedding Queue
 * Processes message embeddings in background
 */
export const embeddingQueue = new Queue<EmbeddingJobData>(QUEUE_NAMES.EMBEDDING, {
  connection: redisConnection,
  ...defaultQueueOptions,
});

/**
 * Add a message to the embedding queue
 */
export async function queueMessageEmbedding(data: EmbeddingJobData): Promise<void> {
  try {
    await embeddingQueue.add('embed-message', data, {
      priority: data.priority || 1,
      jobId: `embed-${data.messageId}`, // Prevent duplicates
    });

    console.log(`[EmbeddingQueue] ✅ Queued message: ${data.messageId}`);
  } catch (error) {
    console.error('[EmbeddingQueue] ❌ Failed to queue message:', error);
    throw error;
  }
}

/**
 * Get queue metrics
 */
export async function getEmbeddingQueueMetrics() {
  const [waiting, active, completed, failed] = await Promise.all([
    embeddingQueue.getWaitingCount(),
    embeddingQueue.getActiveCount(),
    embeddingQueue.getCompletedCount(),
    embeddingQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed,
  };
}

/**
 * Clean up old jobs
 */
export async function cleanEmbeddingQueue() {
  await embeddingQueue.clean(24 * 3600 * 1000, 1000, 'completed'); // Keep 24h
  await embeddingQueue.clean(7 * 24 * 3600 * 1000, 100, 'failed'); // Keep 7 days
  console.log('[EmbeddingQueue] 🧹 Cleaned old jobs');
}
