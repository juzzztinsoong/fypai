/**
 * Main Backend Server Entry Point
 * 
 * Tech Stack: Express 4.18.2, Socket.IO 4.6.1, Prisma 5.7.1
 * Pattern: Modular route/controller architecture
 * 
 * Features:
 *   - REST API for teams, users, messages
 *   - WebSocket for realtime chat
 *   - SQLite database (dev) / PostgreSQL (prod)
 *   - CORS enabled for frontend
 * 
 * Environment:
 *   PORT          : Server port (default 5000)
 *   DATABASE_URL  : Database connection string
 *   FRONTEND_URL  : Frontend origin for CORS
 * 
 * Startup:
 *   node src/index.js  OR  npm run dev
 */

import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

import { prisma } from './db.js'
import { errorHandler } from './middleware/errorHandler.js'
import { setupSocketHandlers } from './socket/socketHandlers.js'
import { getRedisClient, checkRedisHealth, disconnectRedis } from './services/redis.js'
import { pineconeService } from './services/pineconeService.js'
import { embeddingService } from './services/embeddingService.js'
import { createEmbeddingWorker, shutdownEmbeddingWorker } from './workers/embeddingWorker.js'
import { startEmbeddingBackfillScheduler, stopEmbeddingBackfillScheduler } from './services/embeddingBackfillService.js'
import type { Worker } from 'bullmq'

// Import routes
import teamRoutes from './routes/teamRoutes.js'
import messageRoutes, { setSocketIO as setMessageSocketIO } from './routes/messageRoutes.js'
import userRoutes from './routes/userRoutes.js'
import aiInsightRoutes from './routes/aiInsightRoutes.js'
import chimeRuleRoutes from './routes/chimeRuleRoutes.js'
import agentPreferenceRoutes from './routes/agentPreferenceRoutes.js'
import feedbackRoutes from './routes/feedbackRoutes.js'
import exportRoutes from './routes/exportRoutes.js'
import researchJobRoutes from './routes/researchJobRoutes.js'
import intentRoutes from './routes/intentRoutes.js'
import { AIAgentController } from './controllers/aiAgentController.js'
import { AIInsightController } from './controllers/aiInsightController.js'
import { TeamController } from './controllers/teamController.js'
import { ResearchJobController } from './controllers/researchJobController.js'
import { ragService } from './services/ragService.js'
import { UnifiedRuleEngine } from './ai/autonomous/unifiedRuleEngine.js'

const app = express()

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      // enable HTTP calls tracing
      Sentry.httpIntegration(),
      // enable Express.js middleware tracing
      Sentry.expressIntegration(),
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of the transactions
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
  })
  console.log('✅ Sentry initialized')
}

const server = createServer(app)

// Track background workers
let embeddingWorker: Worker | null = null

// Allow multiple frontend origins for development
const configuredOrigins = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const allowedOrigins: string[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL || '',
  ...configuredOrigins,
].filter((origin): origin is string => Boolean(origin))

const privateLanOriginRegex = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)[^:]+(?::\d+)?$/

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true

  if (process.env.NODE_ENV !== 'production') {
    if (privateLanOriginRegex.test(origin)) return true
    if (/^https?:\/\/localhost(?::\d+)?$/.test(origin)) return true
    if (/^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin)) return true
  }

  return false
}

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }

      console.warn('[CORS] Blocked Socket.IO origin:', origin)
      callback(new Error(`Origin not allowed: ${origin}`))
    },
    methods: ['GET', 'POST'],
  },
})

// Middleware
// Sentry request/tracing handlers are automatically handled by expressIntegration in v8

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true)
      return
    }

    console.warn('[CORS] Blocked HTTP origin:', origin)
    callback(new Error(`Origin not allowed: ${origin}`))
  },
}))
app.use(express.json())

// Health check endpoint
app.get('/health', async (req, res) => {
  const redisHealthy = await checkRedisHealth()
  res.json({ 
    status: redisHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    redis: redisHealthy ? 'connected' : 'disconnected'
  })
})

// Embedding usage stats endpoint
app.get('/api/stats/embeddings', (req, res) => {
  const stats = embeddingService.getUsageStats()
  res.json({
    ...stats,
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    provider: process.env.OPENAI_API_KEY ? 'OpenAI' : 'GitHub Models',
    costNote: process.env.OPENAI_API_KEY 
      ? `Estimated cost (may vary)` 
      : 'Free tier via GitHub Models',
  })
})

// Deferred embedding backlog stats
app.get('/api/stats/embeddings/deferred', async (req, res) => {
  try {
    const deferredMessages = await prisma.message.findMany({
      where: {
        embeddingId: null,
        contentType: 'text',
        metadata: {
          contains: 'deferred_rate_limit',
        },
      },
      select: {
        id: true,
        metadata: true,
        createdAt: true,
      },
      take: 5000,
      orderBy: { createdAt: 'asc' },
    })

    const nowMs = Date.now()
    let deferredCount = 0
    let dueNowCount = 0
    let nextRetryAtMs: number | null = null

    for (const message of deferredMessages) {
      if (!message.metadata) continue

      try {
        const parsed = JSON.parse(message.metadata) as any
        const embedding = parsed?.embedding
        if (!embedding || embedding.status !== 'deferred_rate_limit') continue

        deferredCount += 1

        const deferredUntil = embedding.deferredUntil
        const deferredUntilMs = deferredUntil ? new Date(deferredUntil).getTime() : NaN

        if (!Number.isNaN(deferredUntilMs)) {
          if (deferredUntilMs <= nowMs) {
            dueNowCount += 1
          } else if (nextRetryAtMs === null || deferredUntilMs < nextRetryAtMs) {
            nextRetryAtMs = deferredUntilMs
          }
        } else {
          dueNowCount += 1
        }
      } catch {
        // Ignore malformed metadata rows.
      }
    }

    res.json({
      deferredCount,
      dueNowCount,
      nextRetryAt: nextRetryAtMs ? new Date(nextRetryAtMs).toISOString() : null,
      schedulerEnabled: process.env.ENABLE_EMBEDDING_BACKFILL_SCHEDULER !== 'false',
      schedulerIntervalMs: Math.max(15000, parseInt(process.env.EMBEDDING_BACKFILL_INTERVAL_MS || '300000', 10)),
      scanLimit: deferredMessages.length,
    })
  } catch (error) {
    console.error('[Stats] Deferred embedding stats failed:', error)
    res.status(500).json({ error: 'Failed to read deferred embedding stats' })
  }
})

// Study matrix preflight endpoint
app.get('/api/study/preflight', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      select: { id: true, name: true, isChimeEnabled: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })

    const deferredRows = await prisma.message.findMany({
      where: {
        embeddingId: null,
        contentType: 'text',
        metadata: {
          contains: 'deferred_rate_limit',
        },
      },
      select: { metadata: true },
      take: 5000,
    })

    const nowMs = Date.now()
    let deferredCount = 0
    let dueNowCount = 0
    let nextRetryAtMs: number | null = null

    for (const row of deferredRows) {
      if (!row.metadata) continue

      try {
        const parsed = JSON.parse(row.metadata) as any
        const embedding = parsed?.embedding
        if (!embedding || embedding.status !== 'deferred_rate_limit') continue

        deferredCount += 1

        const deferredUntilMs = embedding.deferredUntil
          ? new Date(embedding.deferredUntil).getTime()
          : NaN

        if (!Number.isNaN(deferredUntilMs)) {
          if (deferredUntilMs <= nowMs) {
            dueNowCount += 1
          } else if (nextRetryAtMs === null || deferredUntilMs < nextRetryAtMs) {
            nextRetryAtMs = deferredUntilMs
          }
        } else {
          dueNowCount += 1
        }
      } catch {
        // Ignore malformed rows.
      }
    }

    const settings = {
      aiLightBackendEnforcement: true,
      enableChimeRuleMutations: process.env.ENABLE_CHIME_RULE_MUTATIONS === 'true',
      embeddingBatchSize: Math.max(1, parseInt(process.env.EMBEDDING_BATCH_SIZE || '20', 10)),
      embeddingFlushTimeoutMs: Math.max(1000, parseInt(process.env.EMBEDDING_FLUSH_TIMEOUT_MS || '60000', 10)),
      enableEmbeddingBackfillScheduler: process.env.ENABLE_EMBEDDING_BACKFILL_SCHEDULER !== 'false',
      embeddingBackfillIntervalMs: Math.max(15000, parseInt(process.env.EMBEDDING_BACKFILL_INTERVAL_MS || '300000', 10)),
      embeddingBackfillBatchSize: Math.max(1, parseInt(process.env.EMBEDDING_BACKFILL_BATCH_SIZE || '100', 10)),
      recentInsightsContextLimit: Math.max(1, parseInt(process.env.AI_RECENT_INSIGHTS_CONTEXT_LIMIT || '6', 10)),
      continuationMinConfidence: Math.min(
        1,
        Math.max(0, parseFloat(process.env.CONTINUATION_MIN_CONFIDENCE || '0.6')),
      ),
    }

    const checks = {
      chimeMutationsLocked: !settings.enableChimeRuleMutations,
      backfillSchedulerEnabled: settings.enableEmbeddingBackfillScheduler,
      aiLightEnforcementExpected: settings.aiLightBackendEnforcement,
      embeddingBacklogManageable: deferredCount < 5000,
      deferredReadyToRequeue: dueNowCount > 0,
    }

    const violations: string[] = []
    if (!checks.chimeMutationsLocked) {
      violations.push('ENABLE_CHIME_RULE_MUTATIONS is true; participant-facing rule mutation API is unlocked.')
    }
    if (!checks.backfillSchedulerEnabled) {
      violations.push('Deferred embedding backfill scheduler is disabled.')
    }
    if (!checks.embeddingBacklogManageable) {
      violations.push('Deferred embedding backlog is high (>= 5000 sampled rows).')
    }

    const ready = violations.length === 0

    res.json({
      ready,
      timestamp: new Date().toISOString(),
      settings,
      checks,
      violations,
      teams: {
        total: teams.length,
        aiOn: teams.filter((team) => team.isChimeEnabled).length,
        aiLight: teams.filter((team) => !team.isChimeEnabled).length,
      },
      embeddingDeferred: {
        deferredCount,
        dueNowCount,
        nextRetryAt: nextRetryAtMs ? new Date(nextRetryAtMs).toISOString() : null,
      },
    })
  } catch (error) {
    console.error('[StudyPreflight] Failed:', error)
    res.status(500).json({ error: 'Failed to compute study preflight status' })
  }
})

// Debug RAG endpoint
app.post('/api/debug/rag-search', async (req, res) => {
  const { query, teamId, topK = 5, minScore = 0.7 } = req.body;
  
  if (!query || !teamId) {
    return res.status(400).json({ error: 'query and teamId are required' });
  }

  try {
    const result = await ragService.getRelevantContext(query, teamId, topK, minScore);
    res.json(result);
  } catch (error) {
    console.error('RAG Debug Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Setup WebSocket handlers first
setupSocketHandlers(io)

// Pass io instance to message routes, AI agent, and AI insight controllers for broadcasting
setMessageSocketIO(io)
AIAgentController.setSocketIO(io)
AIInsightController.setSocketIO(io)
UnifiedRuleEngine.setSocketIO(io)
TeamController.setSocketIO(io)
ResearchJobController.setSocketIO(io)

// Mark AI agent as online immediately
io.emit('presence:update', { userId: 'agent', online: true })
console.log('[Server] 🤖 AI agent marked as online')

// API routes
app.use('/api/teams', teamRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/users', userRoutes)
app.use('/api/insights', aiInsightRoutes)
app.use('/api/chime', chimeRuleRoutes)
app.use('/api', agentPreferenceRoutes)
app.use('/api', feedbackRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/research', researchJobRoutes)
app.use('/api/intent', intentRoutes)

// Error handler (must be last)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app)
}
app.use(errorHandler)

// Start server
const PORT = process.env.PORT || 5000

server.listen(PORT, async () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`✅ Socket.IO ready for connections`)
  console.log(`✅ Database: ${process.env.DATABASE_URL}`)
  
  // Test database connection
  try {
    await prisma.$connect()
    console.log('✅ Database connected')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
  }
  
  // Initialize Redis connection
  try {
    getRedisClient() // Lazy initialization
    const redisHealthy = await checkRedisHealth()
    if (redisHealthy) {
      console.log('✅ Redis connected')
    } else {
      console.warn('⚠️  Redis connection failed - caching disabled')
    }
  } catch (error) {
    console.warn('⚠️  Redis not available - running without cache:', error)
  }

  // Initialize Pinecone vector database
  try {
    await pineconeService.initialize()
    console.log('✅ Pinecone initialized')
  } catch (error) {
    console.warn('⚠️  Pinecone initialization failed - RAG disabled:', error)
  }

  // Start embedding worker
  try {
    embeddingWorker = createEmbeddingWorker()
    console.log('✅ Embedding worker started (concurrency: 3)')
  } catch (error) {
    console.error('❌ Embedding worker failed to start:', error)
  }

  // Start deferred embedding backfill scheduler
  startEmbeddingBackfillScheduler()
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  stopEmbeddingBackfillScheduler()
  if (embeddingWorker) {
    await shutdownEmbeddingWorker(embeddingWorker)
  }
  await prisma.$disconnect()
  await disconnectRedis()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})