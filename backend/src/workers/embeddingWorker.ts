/**
 * Embedding Worker
 * 
 * Background worker that processes embedding jobs.
 * 
 * Tech Stack: BullMQ, Pinecone, OpenAI
 * Pattern: Job processor with error handling
 * 
 * Flow:
 * 1. Receive job from embedding queue
 * 2. Generate embedding using OpenAI API
 * 3. Store vector in Pinecone with metadata
 * 4. Update Message record with embeddingId
 * 5. Mark job complete
 */

import { Worker, Job } from 'bullmq';
import { redisConnection, defaultWorkerOptions, QUEUE_NAMES } from '../queues/queueConfig.js';
import { EmbeddingJobData } from '../queues/embeddingQueue.js';
import { embeddingService } from '../services/embeddingService.js';
import { pineconeService } from '../services/pineconeService.js';
import { prisma } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

import { Worker, Job } from 'bullmq';
import { redisConnection, defaultWorkerOptions, QUEUE_NAMES } from '../queues/queueConfig.js';
import { EmbeddingJobData } from '../queues/embeddingQueue.js';
import { embeddingService } from '../services/embeddingService.js';
import { pineconeService } from '../services/pineconeService.js';
import { prisma } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

// Buffer configuration
const BATCH_SIZE = 20;
const FLUSH_TIMEOUT_MS = 60000; // 60 seconds

interface BufferedJob {
  job: Job<EmbeddingJobData>;
  resolve: () => void;
  reject: (err: Error) => void;
}

const jobBuffer: BufferedJob[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

/**
 * Flush the buffer: Generate embeddings for the batch and process results
 */
async function flushBuffer() {
  if (jobBuffer.length === 0) return;

  // Take current batch (up to BATCH_SIZE)
  const batch = jobBuffer.splice(0, BATCH_SIZE);

  // Clear timeout if buffer is empty
  if (jobBuffer.length === 0 && flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  console.log(`[EmbeddingWorker] 🔄 Flushing batch of ${batch.length} messages...`);

  try {
    const texts = batch.map(b => b.job.data.content);
    
    // Step 1: Generate batch embeddings
    // This uses 1 API call for N messages
    const result = await embeddingService.generateBatch(texts);
    console.log(`[EmbeddingWorker] ✅ Generated batch embeddings (${result.totalTokens} tokens)`);

    // Step 2: Process each result
    // We process them in parallel to speed up DB/Pinecone ops
    await Promise.all(batch.map(async (item, index) => {
      const { job, resolve, reject } = item;
      const embedding = result.embeddings[index];
      const { messageId, teamId, authorId, content, createdAt } = job.data;

      try {
        // Store in Pinecone
        const vectorId = uuidv4();
        await pineconeService.upsertVector({
          id: vectorId,
          values: embedding,
          metadata: {
            messageId,
            teamId,
            authorId,
            content: content.substring(0, 500), // Store preview (Pinecone metadata limit)
            createdAt,
            contentType: 'text',
          },
        });

        // Update Message record
        await prisma.message.update({
          where: { id: messageId },
          data: {
            embeddingId: vectorId,
            embeddedAt: new Date(),
          },
        });

        console.log(`[EmbeddingWorker] ✅ Processed message: ${messageId}`);
        resolve();
      } catch (err) {
        console.error(`[EmbeddingWorker] ❌ Failed to process message ${messageId} in batch:`, err);
        reject(err as Error);
      }
    }));

    // Log cost estimate for the whole batch
    const cost = embeddingService.estimateCost(result.totalTokens);
    console.log(`[EmbeddingWorker] 💰 Batch cost: $${cost.toFixed(6)}`);

  } catch (error) {
    console.error('[EmbeddingWorker] ❌ Batch generation failed:', error);
    // Fail all jobs in this batch so they can be retried (individually or in next batch)
    batch.forEach(b => b.reject(error as Error));
  }
}

/**
 * Process embedding job
 * Instead of processing immediately, add to buffer and wait.
 */
async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<void> {
  return new Promise((resolve, reject) => {
    // Add to buffer
    jobBuffer.push({ job, resolve, reject });
    console.log(`[EmbeddingWorker] 📥 Buffered job ${job.id} (Buffer: ${jobBuffer.length}/${BATCH_SIZE})`);

    // Trigger flush if buffer full
    if (jobBuffer.length >= BATCH_SIZE) {
      if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
      }
      flushBuffer();
    } 
    // Start timeout if not running
    else if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        console.log('[EmbeddingWorker] ⏰ Flush timeout reached');
        flushTimeout = null;
        flushBuffer();
      }, FLUSH_TIMEOUT_MS);
    }
  });
}

/**
 * Create and start embedding worker
 */
export function createEmbeddingWorker(): Worker {
  const worker = new Worker<EmbeddingJobData>(
    QUEUE_NAMES.EMBEDDING,
    processEmbeddingJob,
    {
      connection: redisConnection,
      ...defaultWorkerOptions,
      // CRITICAL: Concurrency must be >= BATCH_SIZE to allow buffer to fill
      concurrency: BATCH_SIZE, 
    }
  );

  // Event listeners
  worker.on('completed', (job) => {
    console.log(`[EmbeddingWorker] ✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[EmbeddingWorker] ❌ Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[EmbeddingWorker] ❌ Worker error:', error);
  });

  console.log(`[EmbeddingWorker] 🏃 Worker started (concurrency: ${BATCH_SIZE})`);

  return worker;
}

/**
 * Gracefully shutdown worker
 */
export async function shutdownEmbeddingWorker(worker: Worker): Promise<void> {
  console.log('[EmbeddingWorker] 🛑 Shutting down...');
  await worker.close();
  console.log('[EmbeddingWorker] ✅ Shutdown complete');
}
