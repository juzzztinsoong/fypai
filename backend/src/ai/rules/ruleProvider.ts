import { prisma } from '../../db.js';
import { ChimeRule } from '../autonomous/chimeEngine.js';
import { DEFAULT_RULES } from './systemRules.js';

export class RuleProvider {
  /**
   * Get effective rules for a team
   * Merges system default rules with team-specific overrides from the database
   */
  static async getRulesForTeam(teamId: string): Promise<ChimeRule[]> {
    // 1. Start with system defaults
    const rulesMap = new Map<string, ChimeRule>();
    
    DEFAULT_RULES.forEach(rule => {
      rulesMap.set(rule.id, { ...rule }); // Clone to avoid mutation
    });

    // 2. Fetch team overrides and custom rules from DB
    const dbRules = await prisma.chimeRule.findMany({
      where: {
        OR: [
          { teamId: teamId },
          { teamId: null } // Global DB rules (if any)
        ]
      }
    });

    // 3. Merge DB rules (overwriting system defaults by ID)
    dbRules.forEach(dbRule => {
      try {
        const rule: ChimeRule = {
          id: dbRule.id,
          name: dbRule.name,
          type: dbRule.type as any,
          enabled: dbRule.enabled,
          priority: dbRule.priority as any,
          cooldownMinutes: dbRule.cooldownMinutes,
          conditions: JSON.parse(dbRule.conditions),
          action: JSON.parse(dbRule.action),
          teamId: dbRule.teamId || undefined,
          createdAt: dbRule.createdAt,
          updatedAt: dbRule.updatedAt
        };

        rulesMap.set(rule.id, rule);
      } catch (error) {
        console.error(`[RuleProvider] Failed to parse rule ${dbRule.id}:`, error);
      }
    });

    // 4. Return only enabled rules
    return Array.from(rulesMap.values()).filter(r => r.enabled);
  }
}
