import { prisma } from '../db.js';
import { queueMessageEmbedding } from '../queues/embeddingQueue.js';

interface DeferredEmbeddingMetadata {
  status?: string;
  reason?: string;
  retryAfterSeconds?: number;
  deferredAt?: string;
  deferredUntil?: string;
  requeuedAt?: string;
}

interface MessageMetadataRecord {
  embedding?: DeferredEmbeddingMetadata;
  [key: string]: unknown;
}

function parseMetadata(raw: string | null): MessageMetadataRecord {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as MessageMetadataRecord;
    }
  } catch {
    return {};
  }

  return {};
}

function isDeferredAndDue(metadata: MessageMetadataRecord, nowMs: number): boolean {
  const embedding = metadata.embedding;
  if (!embedding || embedding.status !== 'deferred_rate_limit') return false;
  if (!embedding.deferredUntil) return true;

  const deferredUntilMs = new Date(embedding.deferredUntil).getTime();
  if (Number.isNaN(deferredUntilMs)) return true;

  return deferredUntilMs <= nowMs;
}

export async function requeueDeferredEmbeddings(limit?: number): Promise<{
  scanned: number;
  queued: number;
  skippedNotDue: number;
  skippedInvalid: number;
}> {
  const batchSize = Math.max(1, limit || parseInt(process.env.EMBEDDING_BACKFILL_BATCH_SIZE || '100', 10));
  const now = Date.now();

  const candidates = await prisma.message.findMany({
    where: {
      embeddingId: null,
      contentType: 'text',
      metadata: {
        contains: 'deferred_rate_limit',
      },
    },
    select: {
      id: true,
      teamId: true,
      authorId: true,
      content: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  let queued = 0;
  let skippedNotDue = 0;
  let skippedInvalid = 0;

  for (const msg of candidates) {
    const metadata = parseMetadata(msg.metadata);

    if (!isDeferredAndDue(metadata, now)) {
      skippedNotDue += 1;
      continue;
    }

    if (!msg.content || msg.content.trim().length < 5) {
      skippedInvalid += 1;
      continue;
    }

    try {
      await queueMessageEmbedding({
        messageId: msg.id,
        teamId: msg.teamId,
        authorId: msg.authorId,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        priority: 5,
      });

      const nextMetadata: MessageMetadataRecord = {
        ...metadata,
        embedding: {
          ...(metadata.embedding || {}),
          status: 'requeued',
          requeuedAt: new Date().toISOString(),
        },
      };

      await prisma.message.update({
        where: { id: msg.id },
        data: {
          metadata: JSON.stringify(nextMetadata),
        },
      });

      queued += 1;
    } catch {
      // Ignore single-message queue errors and continue with remaining items.
    }
  }

  return {
    scanned: candidates.length,
    queued,
    skippedNotDue,
    skippedInvalid,
  };
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startEmbeddingBackfillScheduler(): void {
  const enabled = process.env.ENABLE_EMBEDDING_BACKFILL_SCHEDULER !== 'false';
  if (!enabled) {
    console.log('[EmbeddingBackfill] Scheduler disabled by ENABLE_EMBEDDING_BACKFILL_SCHEDULER=false');
    return;
  }

  const intervalMs = Math.max(15000, parseInt(process.env.EMBEDDING_BACKFILL_INTERVAL_MS || '300000', 10));

  const tick = async () => {
    try {
      const result = await requeueDeferredEmbeddings();
      if (result.queued > 0) {
        console.log(
          `[EmbeddingBackfill] Requeued ${result.queued}/${result.scanned} deferred embeddings ` +
            `(notDue=${result.skippedNotDue}, invalid=${result.skippedInvalid})`,
        );
      }
    } catch (error) {
      console.warn('[EmbeddingBackfill] Scheduler tick failed:', error);
    }
  };

  schedulerTimer = setInterval(() => {
    void tick();
  }, intervalMs);

  console.log(`[EmbeddingBackfill] Scheduler started (interval=${intervalMs}ms)`);

  // Kick once on startup.
  void tick();
}

export function stopEmbeddingBackfillScheduler(): void {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
  console.log('[EmbeddingBackfill] Scheduler stopped');
}
