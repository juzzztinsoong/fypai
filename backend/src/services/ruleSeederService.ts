/**
 * Rule Seeder Service
 * 
 * UNIFIED seeding service for chime rules.
 * Single entry point for all rule seeding operations.
 */

import { prisma } from '../db.js';
import { ALL_SYSTEM_RULES, RuleDefinition } from '../ai/rules/ruleDefinitions.js';

export class RuleSeederService {
  
  /**
   * Seeds default rules for a specific team by copying system rules.
   * Called automatically when a team is created.
   * 
   * @param teamId - The team to seed rules for
   * @returns Number of rules seeded (0 if team already has rules)
   */
  static async seedTeamRules(teamId: string): Promise<number> {
    // Check if team already has rules
    const existingCount = await prisma.chimeRule.count({
      where: { teamId }
    });
    
    if (existingCount > 0) {
      console.log(`[RuleSeeder] Team ${teamId} already has ${existingCount} rules, skipping`);
      return 0;
    }
    
    console.log(`[RuleSeeder] Seeding ${ALL_SYSTEM_RULES.length} rules for team ${teamId}`);
    
    const rules = ALL_SYSTEM_RULES.map(rule => ({
      teamId,
      name: rule.name,
      description: rule.description,
      execution: rule.execution,
      type: rule.type,
      enabled: rule.enabled,
      priority: rule.priority,
      cooldownMinutes: rule.cooldownMinutes,
      conditions: JSON.stringify(rule.conditions),
      action: JSON.stringify(rule.action),
      sourceRuleId: rule.id,
    }));
    
    await prisma.chimeRule.createMany({ data: rules });
    
    console.log(`[RuleSeeder] ✅ Seeded ${rules.length} rules for team ${teamId}`);
    return rules.length;
  }
  
  /**
   * Seeds rules for ALL existing teams that don't have rules yet.
   * Run during startup or as a migration.
   */
  static async seedAllTeams(): Promise<{ seeded: number; skipped: number }> {
    const teams = await prisma.team.findMany({
      select: { id: true, name: true }
    });
    
    console.log(`[RuleSeeder] Found ${teams.length} teams to check`);
    
    let seeded = 0;
    let skipped = 0;
    
    for (const team of teams) {
      const count = await this.seedTeamRules(team.id);
      if (count > 0) {
        seeded++;
      } else {
        skipped++;
      }
    }
    
    console.log(`[RuleSeeder] Complete: ${seeded} teams seeded, ${skipped} teams already had rules`);
    return { seeded, skipped };
  }
  
  /**
   * Syncs a team's rules with latest system rule definitions.
   * - Adds new rules that don't exist
   * - Updates conditions/action (template changes)
   * - Preserves user customizations (enabled, cooldown, priority)
   * 
   * @param teamId - The team to sync
   * @returns Count of added and updated rules
   */
  static async syncTeamRules(teamId: string): Promise<{ added: number; updated: number }> {
    const existingRules = await prisma.chimeRule.findMany({
      where: { teamId }
    });
    
    // Map existing rules by their source ID for quick lookup
    const existingBySourceId = new Map(
      existingRules.filter(r => r.sourceRuleId).map(r => [r.sourceRuleId, r])
    );
    
    let added = 0;
    let updated = 0;
    
    for (const systemRule of ALL_SYSTEM_RULES) {
      const existing = existingBySourceId.get(systemRule.id);
      
      if (!existing) {
        // New rule from system - add it
        await prisma.chimeRule.create({
          data: {
            teamId,
            name: systemRule.name,
            description: systemRule.description,
            execution: systemRule.execution,
            type: systemRule.type,
            enabled: systemRule.enabled,
            priority: systemRule.priority,
            cooldownMinutes: systemRule.cooldownMinutes,
            conditions: JSON.stringify(systemRule.conditions),
            action: JSON.stringify(systemRule.action),
            sourceRuleId: systemRule.id,
          }
        });
        added++;
        console.log(`[RuleSeeder] Added new rule: ${systemRule.name}`);
      } else {
        // Existing rule - update template/conditions but preserve user settings
        await prisma.chimeRule.update({
          where: { id: existing.id },
          data: {
            description: systemRule.description,
            conditions: JSON.stringify(systemRule.conditions),
            action: JSON.stringify(systemRule.action),
            // Preserve user customizations:
            // - enabled (user may have disabled)
            // - priority (user may have changed)
            // - cooldownMinutes (user may have adjusted)
          }
        });
        updated++;
      }
    }
    
    console.log(`[RuleSeeder] Sync complete for team ${teamId}: ${added} added, ${updated} updated`);
    return { added, updated };
  }
  
  /**
   * Resets a team's rules to system defaults.
   * WARNING: Destroys all user customizations!
   * 
   * @param teamId - The team to reset
   * @returns Number of rules after reset
   */
  static async resetTeamRules(teamId: string): Promise<number> {
    console.log(`[RuleSeeder] ⚠️ Resetting rules for team ${teamId}`);
    
    // Delete all existing rules
    const deleteResult = await prisma.chimeRule.deleteMany({ 
      where: { teamId } 
    });
    console.log(`[RuleSeeder] Deleted ${deleteResult.count} existing rules`);
    
    // Re-seed from system defaults
    return this.seedTeamRules(teamId);
  }
  
  /**
   * Gets a summary of rules for a team.
   */
  static async getRuleSummary(teamId: string): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    sync: number;
    async: number;
  }> {
    const rules = await prisma.chimeRule.findMany({
      where: { teamId },
      select: { enabled: true, execution: true }
    });
    
    return {
      total: rules.length,
      enabled: rules.filter(r => r.enabled).length,
      disabled: rules.filter(r => !r.enabled).length,
      sync: rules.filter(r => r.execution === 'sync').length,
      async: rules.filter(r => r.execution === 'async').length,
    };
  }
}
