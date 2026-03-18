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
import { UnifiedRuleEngine } from '../ai/autonomous/unifiedRuleEngine.js';
import { IntentClassifier, MessageClassification } from '../ai/core/intentClassifier.js';
import { MessageDTO } from '@fypai/types';

// Buffer configuration
const BATCH_SIZE = 20;
const FLUSH_TIMEOUT_MS = 60000; // 60 seconds
const ASYNC_CHIME_MAX_AGE_MS = parseInt(process.env.ASYNC_CHIME_MAX_AGE_MS || '120000', 10); // 2 minutes default
const CLASSIFICATION_CONCURRENCY = Math.max(1, parseInt(process.env.CLASSIFICATION_CONCURRENCY || '2', 10));

// Trivial content filter
const TRIVIAL_WORDS = new Set([
  'ok', 'okay', 'k', 'kk', 'thx', 'thanks', 'ty', 'lol', 'lmao', 'haha', 
  'yes', 'no', 'yep', 'nope', 'sure', 'cool', 'nice', 'good', 'bad',
  'hello', 'hi', 'hey', 'bye', 'goodbye', 'gm', 'gn'
]);

function isSemanticallySignificant(content: string): boolean {
  const trimmed = content.trim();
  
  // 1. Too short to be meaningful context
  if (trimmed.length < 4) return false;
  
  // 2. Common trivial responses
  if (trimmed.length < 15 && TRIVIAL_WORDS.has(trimmed.toLowerCase().replace(/[!.?]+$/, ''))) {
    return false;
  }
  
  return true;
}

interface BufferedJob {
  job: Job<EmbeddingJobData>;
  resolve: () => void;
  reject: (err: Error) => void;
}

const jobBuffer: BufferedJob[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  const pending: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const next = worker(items[i], i).finally(() => {
      const idx = pending.indexOf(next);
      if (idx >= 0) pending.splice(idx, 1);
    });

    pending.push(next);

    if (pending.length >= concurrency) {
      await Promise.race(pending);
    }
  }

  await Promise.all(pending);
}

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

  try {
    const texts = batch.map(b => b.job.data.content);
    
    // Step 1: Generate batch embeddings
    // This uses 1 API call for N messages
    const result = await embeddingService.generateBatch(texts);

    // Step 2: Process each result with bounded concurrency to avoid LLM rate-limit bursts
    await mapWithConcurrency(batch, CLASSIFICATION_CONCURRENCY, async (item, index) => {
      const { job, resolve, reject } = item;
      const embedding = result.embeddings[index];
      const { messageId, teamId, authorId, content, createdAt } = job.data;

      try {
        const existingMessage = await prisma.message.findUnique({
          where: { id: messageId },
          select: { metadata: true },
        });

        if (!existingMessage) {
          resolve();
          return;
        }

        // Build MessageDTO for classification
        const messageDTO: MessageDTO = {
          id: messageId,
          teamId,
          authorId,
          content,
          contentType: 'text',
          createdAt: createdAt,
        };

        // Phase 6.2: Intent Classification (Tier 1 LLM)
        // Run classification in parallel with Pinecone upsert for efficiency
        const classificationPromise = IntentClassifier.getInstance().classifyAsync(messageDTO);
        
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

        // Await classification result. If classification fails after retries, keep ingestion flowing.
        let classification: MessageClassification;
        try {
          classification = await classificationPromise;
        } catch (classificationError) {
          console.warn(`[EmbeddingWorker] ⚠️ Classification fallback for ${messageId}:`, classificationError);
          classification = {
            intent: 'none',
            sentiment: 'neutral',
            urgency: 'low',
            topics: [],
            confidence: 0,
          };
        }

        // Update Message record with embedding and classification
        const updateResult = await prisma.message.updateMany({
          where: { id: messageId },
          data: {
            embeddingId: vectorId,
            embeddedAt: new Date(),
            // Store classification in metadata (JSON merge)
            metadata: JSON.stringify({
              ...JSON.parse(existingMessage.metadata || '{}'),
              classification: {
                intent: classification.intent,
                sentiment: classification.sentiment,
                urgency: classification.urgency,
                topics: classification.topics,
                confidence: classification.confidence
              }
            })
          },
        });

        if (updateResult.count === 0) {
          await pineconeService.deleteVector(vectorId).catch(() => undefined);
          resolve();
          return;
        }

        // Phase 6: Async Semantic Rule Evaluation with Classification
        // Fire and forget (don't block worker completion)
        // CRITICAL: Skip async chime for @agent messages — they are already handled
        //          by the reactive path in aiAgentController.handleNewMessage()
        const isAgentMention = content.toLowerCase().includes('@agent');
        const messageAgeMs = Date.now() - new Date(createdAt).getTime();
        if (messageAgeMs <= ASYNC_CHIME_MAX_AGE_MS && !isAgentMention) {
          UnifiedRuleEngine.getInstance().evaluateAsync(messageDTO, embedding, classification).catch(err => {
            console.error(`[EmbeddingWorker] Error in async rule evaluation for ${messageId}:`, err);
          });
        } else if (isAgentMention) {
          console.log(`[EmbeddingWorker] ⏭️ Skipping async chime for @agent message ${messageId} (handled reactively)`);
        }
        resolve();
      } catch (err) {
        console.error(`[EmbeddingWorker] ❌ Failed to process message ${messageId} in batch:`, err);
        reject(err as Error);
      }
    });

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
  const { content, messageId } = job.data;

  // Step 0: Cost Optimization - Skip trivial messages
  if (!isSemanticallySignificant(content)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Add to buffer
    jobBuffer.push({ job, resolve, reject });

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
  worker.on('completed', () => {});

  worker.on('failed', (job, error) => {
    console.error(`[EmbeddingWorker] ❌ Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[EmbeddingWorker] ❌ Worker error:', error);
  });

  console.log(`[EmbeddingWorker] 🏃 Worker started (concurrency: ${BATCH_SIZE}, classification concurrency: ${CLASSIFICATION_CONCURRENCY})`);

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
