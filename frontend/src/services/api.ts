// API service for REST endpoints

// API service for REST endpoints
// Specification-first: All methods use explicit types from apiTypes
import axios from 'axios'
import type { Team, User, Message, ApiResponse } from '../types/apiTypes'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

// Teams
/**
 * Fetch all teams the user can access
 * GET /api/teams
 */
export const fetchTeams = async (): Promise<ApiResponse<Team[]>> =>
  api.get('/api/teams').then((res: { data: ApiResponse<Team[]> }) => res.data)

/**
 * Create a new team
 * POST /api/teams
 */
export const createTeam = async (team: Omit<Team, 'id'>): Promise<ApiResponse<Team>> =>
  api.post('/api/teams', team).then((res: { data: ApiResponse<Team> }) => res.data)

/**
 * Update a team
 * PUT /api/teams/:id
 */
export const updateTeam = async (id: string, updates: Partial<Team>): Promise<ApiResponse<Team>> =>
  api.put(`/api/teams/${id}`, updates).then((res: { data: ApiResponse<Team> }) => res.data)

/**
 * Delete a team
 * DELETE /api/teams/:id
 */
export const deleteTeam = async (id: string): Promise<ApiResponse<{ id: string }>> =>
  api.delete(`/api/teams/${id}`).then((res: { data: ApiResponse<{ id: string }> }) => res.data)

// Users
/**
 * Fetch all users
 * GET /api/users
 */
export const fetchUsers = async (): Promise<ApiResponse<User[]>> =>
  api.get('/api/users').then((res: { data: ApiResponse<User[]> }) => res.data)

/**
 * Create a new user
 * POST /api/users
 */
export const createUser = async (user: Omit<User, 'id'>): Promise<ApiResponse<User>> =>
  api.post('/api/users', user).then((res: { data: ApiResponse<User> }) => res.data)

// Messages
/**
 * Fetch messages for a team
 * GET /api/messages?teamId=:teamId
 */
export const fetchMessages = async (teamId: string): Promise<ApiResponse<Message[]>> =>
  api.get(`/api/messages?teamId=${teamId}`).then((res: { data: ApiResponse<Message[]> }) => res.data)

/**
 * Send a message
 * POST /api/messages
 */
export const sendMessage = async (message: Omit<Message, 'id' | 'createdAt'>): Promise<ApiResponse<Message>> =>
  api.post('/api/messages', message).then((res: { data: ApiResponse<Message> }) => res.data)
