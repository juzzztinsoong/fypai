/**
 * Services Index
 * 
 * Central export point for all service modules
 * 
 * Usage:
 *   import { teamService, messageService, socketService } from '@/services'
 *   // or
 *   import { getTeamsForUser } from '@/services'
 */

// Base API client
export { api, getErrorMessage } from './api'

// Team service
export {
  getTeamsForUser,
  getTeamById,
  createTeam,
  addMemberToTeam,
  removeMemberFromTeam,
} from './teamService'

export { default as teamService } from './teamService'

// Message service
export {
  getMessages,
  createMessage,
  updateMessage,
  deleteMessage,
} from './messageService'

export { default as messageService } from './messageService'

// AI Insight service
export {
  getInsights,
  createInsight,
  deleteInsight,
  generateSummary,
  generateReport,
} from './insightService'

export { default as insightService } from './insightService'

// User service
export {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from './userService'

export { default as userService } from './userService'

// WebSocket service
export { socketService } from './socketService'
export { default as socket } from './socketService'
