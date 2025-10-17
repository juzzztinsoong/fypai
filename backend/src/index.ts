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

import { prisma } from './db.js'
import { errorHandler } from './middleware/errorHandler.js'
import { setupSocketHandlers } from './socket/socketHandlers.js'

// Import routes
import teamRoutes from './routes/teamRoutes.js'
import messageRoutes, { setSocketIO as setMessageSocketIO } from './routes/messageRoutes.js'
import userRoutes from './routes/userRoutes.js'
import aiInsightRoutes from './routes/aiInsightRoutes.js'
import { AIAgentController } from './controllers/aiAgentController.js'
import { AIInsightController } from './controllers/aiInsightController.js'

const app = express()
const server = createServer(app)

// Allow multiple frontend origins for development
const allowedOrigins: string[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL || ''
].filter((origin): origin is string => Boolean(origin))

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
})

// Middleware
app.use(cors({
  origin: allowedOrigins,
}))
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Setup WebSocket handlers first
setupSocketHandlers(io)

// Pass io instance to message routes, AI agent, and AI insight controllers for broadcasting
setMessageSocketIO(io)
AIAgentController.setSocketIO(io)
AIInsightController.setSocketIO(io)

// API routes
app.use('/api/teams', teamRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/users', userRoutes)
app.use('/api/insights', aiInsightRoutes)

// Error handler (must be last)
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
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await prisma.$disconnect()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})