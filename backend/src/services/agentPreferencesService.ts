/**
 * Agent Preferences Service
 * 
 * Phase 6.5.2: Per-team AI agent behavior customization
 * 
 * Manages TeamAgentPreference records - each team can configure:
 *   - personality: formal | balanced | casual
 *   - proactivity: silent | helpful | proactive
 *   - responseLength: concise | balanced | detailed
 *   - modelTierOverride: auto | tier1 | tier2
 * 
 * Uses getOrCreate pattern: first access auto-creates defaults.
 */

import { prisma } from '../db.js'
import type { AgentPreferencesDTO, UpdateAgentPreferencesRequest } from '@fypai/types'

// ─── DTO Transformer ────────────────────────────────────────

function toDTO(record: {
  id: string
  teamId: string
  personality: string
  proactivity: string
  responseLength: string
  modelTierOverride: string
  createdAt: Date
  updatedAt: Date
}): AgentPreferencesDTO {
  return {
    id: record.id,
    teamId: record.teamId,
    personality: record.personality as AgentPreferencesDTO['personality'],
    proactivity: record.proactivity as AgentPreferencesDTO['proactivity'],
    responseLength: record.responseLength as AgentPreferencesDTO['responseLength'],
    modelTierOverride: record.modelTierOverride as AgentPreferencesDTO['modelTierOverride'],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

// ─── Validation ─────────────────────────────────────────────

const VALID_PERSONALITY = ['formal', 'balanced', 'casual'] as const
const VALID_PROACTIVITY = ['silent', 'helpful', 'proactive'] as const
const VALID_RESPONSE_LENGTH = ['concise', 'balanced', 'detailed'] as const
const VALID_MODEL_TIER = ['auto', 'tier1', 'tier2'] as const

function validate(data: UpdateAgentPreferencesRequest): string | null {
  if (data.personality && !VALID_PERSONALITY.includes(data.personality)) {
    return `Invalid personality: ${data.personality}. Must be one of: ${VALID_PERSONALITY.join(', ')}`
  }
  if (data.proactivity && !VALID_PROACTIVITY.includes(data.proactivity)) {
    return `Invalid proactivity: ${data.proactivity}. Must be one of: ${VALID_PROACTIVITY.join(', ')}`
  }
  if (data.responseLength && !VALID_RESPONSE_LENGTH.includes(data.responseLength)) {
    return `Invalid responseLength: ${data.responseLength}. Must be one of: ${VALID_RESPONSE_LENGTH.join(', ')}`
  }
  if (data.modelTierOverride && !VALID_MODEL_TIER.includes(data.modelTierOverride)) {
    return `Invalid modelTierOverride: ${data.modelTierOverride}. Must be one of: ${VALID_MODEL_TIER.join(', ')}`
  }
  return null
}

// ─── Service ────────────────────────────────────────────────

export class AgentPreferencesService {
  /**
   * Get preferences for a team, creating defaults if none exist.
   * This is the primary read method - always returns a valid DTO.
   */
  static async getOrCreate(teamId: string): Promise<AgentPreferencesDTO> {
    let record = await prisma.teamAgentPreference.findUnique({
      where: { teamId },
    })

    if (!record) {
      console.log(`[AgentPreferences] Creating defaults for team: ${teamId}`)
      record = await prisma.teamAgentPreference.create({
        data: { teamId },
      })
    }

    return toDTO(record)
  }

  /**
   * Update preferences for a team. Creates record if it doesn't exist.
   * Returns the updated preferences.
   */
  static async update(
    teamId: string,
    updates: UpdateAgentPreferencesRequest
  ): Promise<AgentPreferencesDTO> {
    // Validate input
    const error = validate(updates)
    if (error) {
      throw new Error(error)
    }

    const record = await prisma.teamAgentPreference.upsert({
      where: { teamId },
      create: {
        teamId,
        ...updates,
      },
      update: updates,
    })

    console.log(`[AgentPreferences] Updated for team ${teamId}:`, updates)
    return toDTO(record)
  }

  /**
   * Delete preferences for a team (resets to defaults on next access).
   */
  static async reset(teamId: string): Promise<void> {
    await prisma.teamAgentPreference.deleteMany({
      where: { teamId },
    })
    console.log(`[AgentPreferences] Reset to defaults for team: ${teamId}`)
  }
}
