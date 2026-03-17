/**
 * Rule Seeder Service
 * 
 * UNIFIED seeding service for chime rules.
 * Single entry point for all rule seeding operations.
 */

import { prisma } from '../db.js';
import { ALL_SYSTEM_RULES, RuleDefinition } from '../ai/rules/ruleDefinitions.js';

export class RuleSeederService {
  private static shouldDisableAsyncRuleSeeding(): boolean {
    return process.env.DISABLE_ASYNC_RULE_SEEDING === 'true';
  }

  private static getSeedRules(): RuleDefinition[] {
    if (this.shouldDisableAsyncRuleSeeding()) {
      return ALL_SYSTEM_RULES.filter((rule) => rule.execution !== 'async');
    }

    return ALL_SYSTEM_RULES;
  }
  
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
    
    const seedRules = this.getSeedRules();
    const asyncDisabled = this.shouldDisableAsyncRuleSeeding();
    console.log(
      `[RuleSeeder] Seeding ${seedRules.length} rules for team ${teamId}` +
        (asyncDisabled ? ' (async rules excluded)' : '')
    );
    
    const rules = seedRules.map(rule => ({
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
   * Syncs rules for ALL existing teams with latest system definitions.
   * - Teams without rules get seeded
   * - Teams with rules get synced (add new, update existing, remove obsolete)
   */
  static async syncAllTeams(): Promise<{ seeded: number; synced: number }> {
    const asyncDisabled = this.shouldDisableAsyncRuleSeeding();
    if (asyncDisabled) {
      console.log('[RuleSeeder] Async rule seeding is disabled (DISABLE_ASYNC_RULE_SEEDING=true)');
    }

    const teams = await prisma.team.findMany({
      select: { id: true, name: true }
    });
    
    console.log(`[RuleSeeder] Syncing ${teams.length} teams with system rules`);
    
    let seeded = 0;
    let synced = 0;
    
    for (const team of teams) {
      const existingCount = await prisma.chimeRule.count({
        where: { teamId: team.id }
      });
      
      if (existingCount === 0) {
        await this.seedTeamRules(team.id);
        seeded++;
      } else {
        const result = await this.syncTeamRules(team.id);
        if (result.added > 0 || result.removed > 0) {
          synced++;
        }
      }
    }
    
    console.log(`[RuleSeeder] Sync complete: ${seeded} seeded, ${synced} synced`);
    return { seeded, synced };
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
  static async syncTeamRules(teamId: string): Promise<{ added: number; updated: number; removed: number }> {
    const seedRules = this.getSeedRules();

    const existingRules = await prisma.chimeRule.findMany({
      where: { teamId }
    });
    
    // Check if this is a legacy team (rules without sourceRuleId => pre-Sprint D)
    const hasSourceIds = existingRules.some(r => r.sourceRuleId);
    if (!hasSourceIds && existingRules.length > 0) {
      // Legacy rules from before Sprint D - reset entirely
      console.log(`[RuleSeeder] Legacy rules detected for team ${teamId} (${existingRules.length} rules without sourceRuleId), resetting`);
      return this.resetTeamRules(teamId).then(count => ({ added: count, updated: 0, removed: existingRules.length }));
    }
    
    // Map existing rules by their source ID for quick lookup
    const existingBySourceId = new Map(
      existingRules.filter(r => r.sourceRuleId).map(r => [r.sourceRuleId, r])
    );
    
    let added = 0;
    let removed = 0;
    
    // Build set of current system rule IDs
    const systemRuleIds = new Set(seedRules.map(r => r.id));
    
    // Remove obsolete rules (sourceRuleId no longer in system definitions)
    for (const existing of existingRules) {
      if (existing.sourceRuleId && !systemRuleIds.has(existing.sourceRuleId)) {
        await prisma.chimeRule.delete({ where: { id: existing.id } });
        removed++;
        console.log(`[RuleSeeder] Removed obsolete rule: ${existing.name} (source: ${existing.sourceRuleId})`);
      }
    }
    
    for (const systemRule of seedRules) {
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
        // Rule already exists with this sourceRuleId — leave it alone
        // User may have customized enabled, cooldown, priority, etc.
        console.log(`[RuleSeeder] Skipping existing rule: ${existing.name} (preserving user settings)`);
      }
    }
    
    console.log(`[RuleSeeder] Sync complete for team ${teamId}: ${added} added, ${removed} removed (existing rules preserved)`);
    return { added, updated: 0, removed };
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
