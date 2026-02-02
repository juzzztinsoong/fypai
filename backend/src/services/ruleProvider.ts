/**
 * Rule Provider
 * 
 * Runtime rule fetching service.
 * All rule access at runtime goes through here.
 */

import { prisma } from '../db.js';
import type { RuleConditions, RuleAction } from '../ai/rules/ruleDefinitions.js';

export interface LoadedRule {
  dbId: string;           // Database ID (for logging)
  sourceRuleId: string;   // Original system rule ID
  name: string;
  description: string;
  execution: 'sync' | 'async';
  type: 'pattern' | 'semantic' | 'intent' | 'schedule';
  enabled: boolean;
  priority: number;
  cooldownMinutes: number;
  conditions: RuleConditions;
  action: RuleAction;
}

export class RuleProvider {
  
  /**
   * Get all enabled rules for a team, ordered by priority.
   */
  static async getTeamRules(teamId: string): Promise<LoadedRule[]> {
    const dbRules = await prisma.chimeRule.findMany({
      where: { 
        teamId,
        enabled: true,
      },
      orderBy: { priority: 'desc' },
    });

    return dbRules.map(rule => ({
      dbId: rule.id,
      sourceRuleId: rule.sourceRuleId || rule.id,
      name: rule.name,
      description: rule.description || '',
      execution: rule.execution as 'sync' | 'async',
      type: rule.type as 'pattern' | 'semantic' | 'intent' | 'schedule',
      enabled: rule.enabled,
      priority: rule.priority,
      cooldownMinutes: rule.cooldownMinutes,
      conditions: JSON.parse(rule.conditions) as RuleConditions,
      action: JSON.parse(rule.action) as RuleAction,
    }));
  }
  
  /**
   * Get only SYNC rules for immediate evaluation in request loop.
   * These are fast pattern-matching rules that don't need LLM/vector calls.
   */
  static async getSyncRules(teamId: string): Promise<LoadedRule[]> {
    const dbRules = await prisma.chimeRule.findMany({
      where: { 
        teamId,
        enabled: true,
        execution: 'sync',
      },
      orderBy: { priority: 'desc' },
    });

    return dbRules.map(rule => ({
      dbId: rule.id,
      sourceRuleId: rule.sourceRuleId || rule.id,
      name: rule.name,
      description: rule.description || '',
      execution: 'sync' as const,
      type: rule.type as 'pattern' | 'semantic' | 'intent' | 'schedule',
      enabled: rule.enabled,
      priority: rule.priority,
      cooldownMinutes: rule.cooldownMinutes,
      conditions: JSON.parse(rule.conditions) as RuleConditions,
      action: JSON.parse(rule.action) as RuleAction,
    }));
  }
  
  /**
   * Get only ASYNC rules for background worker evaluation.
   * These can use LLM classification, vector similarity, etc.
   */
  static async getAsyncRules(teamId: string): Promise<LoadedRule[]> {
    const dbRules = await prisma.chimeRule.findMany({
      where: { 
        teamId,
        enabled: true,
        execution: 'async',
      },
      orderBy: { priority: 'desc' },
    });

    return dbRules.map(rule => ({
      dbId: rule.id,
      sourceRuleId: rule.sourceRuleId || rule.id,
      name: rule.name,
      description: rule.description || '',
      execution: 'async' as const,
      type: rule.type as 'pattern' | 'semantic' | 'intent' | 'schedule',
      enabled: rule.enabled,
      priority: rule.priority,
      cooldownMinutes: rule.cooldownMinutes,
      conditions: JSON.parse(rule.conditions) as RuleConditions,
      action: JSON.parse(rule.action) as RuleAction,
    }));
  }
  
  /**
   * Get a specific rule by database ID.
   */
  static async getRuleById(ruleId: string): Promise<LoadedRule | null> {
    const rule = await prisma.chimeRule.findUnique({
      where: { id: ruleId }
    });
    
    if (!rule) return null;
    
    return {
      dbId: rule.id,
      sourceRuleId: rule.sourceRuleId || rule.id,
      name: rule.name,
      description: rule.description || '',
      execution: rule.execution as 'sync' | 'async',
      type: rule.type as 'pattern' | 'semantic' | 'intent' | 'schedule',
      enabled: rule.enabled,
      priority: rule.priority,
      cooldownMinutes: rule.cooldownMinutes,
      conditions: JSON.parse(rule.conditions) as RuleConditions,
      action: JSON.parse(rule.action) as RuleAction,
    };
  }
  
  /**
   * Check if a rule is on cooldown (was triggered recently).
   */
  static async isRuleOnCooldown(ruleId: string, teamId: string, cooldownMinutes: number): Promise<boolean> {
    if (cooldownMinutes <= 0) return false;
    
    const cooldownCutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);
    
    const recentLog = await prisma.chimeLog.findFirst({
      where: {
        ruleId,
        teamId,
        outcome: 'success',
        triggeredAt: { gte: cooldownCutoff }
      }
    });
    
    return recentLog !== null;
  }
  
  /**
   * Log a rule execution.
   */
  static async logRuleExecution(data: {
    ruleId: string;
    teamId: string;
    outcome: 'success' | 'cooldown' | 'error';
    confidence?: number;
    messageId?: string;
    insightId?: string;
    errorMsg?: string;
  }): Promise<void> {
    await prisma.chimeLog.create({
      data: {
        ruleId: data.ruleId,
        teamId: data.teamId,
        outcome: data.outcome,
        confidence: data.confidence,
        messageId: data.messageId,
        insightId: data.insightId,
        errorMsg: data.errorMsg,
      }
    });
  }
}
