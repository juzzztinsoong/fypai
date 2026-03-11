/**
 * Chime Rule Controller
 * 
 * Handles CRUD operations for chime rules and provides methods for
 * retrieving rules for evaluation.
 */

import { Request, Response } from 'express';
import { prisma } from '../db.js';
import type { RuleDefinition } from '../ai/rules/ruleDefinitions.js';
import { DEFAULT_RULES } from '../ai/rules/ruleDefinitions.js';

type RulePresetId = 'conservative' | 'balanced' | 'proactive';

interface RulePresetConfig {
  id: RulePresetId;
  name: string;
  description: string;
  cooldownMultiplier: number;
  minPriorityEnabled: number;
  maxTriggersPerHour: number;
}

const RULE_PRESETS: Record<RulePresetId, RulePresetConfig> = {
  conservative: {
    id: 'conservative',
    name: 'Conservative',
    description: 'Fewer autonomous triggers, longer cooldowns, high-priority rules only.',
    cooldownMultiplier: 1.6,
    minPriorityEnabled: 80,
    maxTriggersPerHour: 2,
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default balance of helpfulness and interruption control.',
    cooldownMultiplier: 1,
    minPriorityEnabled: 65,
    maxTriggersPerHour: 4,
  },
  proactive: {
    id: 'proactive',
    name: 'Proactive',
    description: 'More frequent proactive support with shorter cooldowns.',
    cooldownMultiplier: 0.75,
    minPriorityEnabled: 40,
    maxTriggersPerHour: 8,
  },
};

export class ChimeRuleController {
  private static readonly VALID_RULE_TYPES = new Set(['pattern', 'semantic', 'intent', 'schedule']);
  private static readonly VALID_EXECUTION_TYPES = new Set(['sync', 'async']);
  private static readonly VALID_ACTION_TYPES = new Set(['chat_message', 'insight']);
  private static readonly VALID_INSIGHT_TYPES = new Set(['action', 'suggestion', 'summary', 'document']);

  private static validateRulePayload(payload: Partial<RuleDefinition>, mode: 'create' | 'update'): string[] {
    const errors: string[] = [];

    if (mode === 'create') {
      if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length === 0) {
        errors.push('name is required');
      }
      if (!payload.type || typeof payload.type !== 'string') {
        errors.push('type is required');
      }
      if (payload.priority === undefined || payload.priority === null) {
        errors.push('priority is required');
      }
      if (payload.cooldownMinutes === undefined || payload.cooldownMinutes === null) {
        errors.push('cooldownMinutes is required');
      }
      if (!payload.conditions || typeof payload.conditions !== 'object') {
        errors.push('conditions object is required');
      }
      if (!payload.action || typeof payload.action !== 'object') {
        errors.push('action object is required');
      }
    }

    if (payload.name !== undefined) {
      if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
        errors.push('name must be a non-empty string');
      } else if (payload.name.trim().length > 120) {
        errors.push('name must be 120 characters or less');
      }
    }

    if (payload.type !== undefined) {
      if (typeof payload.type !== 'string' || !this.VALID_RULE_TYPES.has(payload.type)) {
        errors.push('type must be one of: pattern, semantic, intent, schedule');
      }
    }

    if (payload.execution !== undefined) {
      if (typeof payload.execution !== 'string' || !this.VALID_EXECUTION_TYPES.has(payload.execution)) {
        errors.push('execution must be one of: sync, async');
      }
    }

    if (payload.priority !== undefined) {
      if (!Number.isInteger(payload.priority) || payload.priority < 0 || payload.priority > 100) {
        errors.push('priority must be an integer between 0 and 100');
      }
    }

    if (payload.cooldownMinutes !== undefined) {
      if (!Number.isInteger(payload.cooldownMinutes) || payload.cooldownMinutes < 0 || payload.cooldownMinutes > 1440) {
        errors.push('cooldownMinutes must be an integer between 0 and 1440');
      }
    }

    if (payload.conditions !== undefined) {
      if (!payload.conditions || typeof payload.conditions !== 'object' || Array.isArray(payload.conditions)) {
        errors.push('conditions must be an object');
      } else {
        const conditions = payload.conditions as Record<string, unknown>;

        if (conditions.patterns !== undefined) {
          if (!Array.isArray(conditions.patterns)) {
            errors.push('conditions.patterns must be an array');
          } else {
            for (const pattern of conditions.patterns) {
              if (typeof pattern !== 'string' || pattern.trim().length === 0) {
                errors.push('conditions.patterns must contain non-empty strings');
                break;
              }

              try {
                new RegExp(pattern, 'i');
              } catch {
                errors.push(`Invalid regex pattern: ${pattern}`);
                break;
              }
            }
          }
        }

        if (conditions.keywords !== undefined) {
          if (!Array.isArray(conditions.keywords)) {
            errors.push('conditions.keywords must be an array');
          } else if (conditions.keywords.some((keyword) => typeof keyword !== 'string' || keyword.trim().length === 0)) {
            errors.push('conditions.keywords must contain non-empty strings');
          }
        }

        if (conditions.threshold !== undefined) {
          const threshold = Number(conditions.threshold);
          if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
            errors.push('conditions.threshold must be between 0 and 1');
          }
        }
      }
    }

    if (payload.action !== undefined) {
      if (!payload.action || typeof payload.action !== 'object' || Array.isArray(payload.action)) {
        errors.push('action must be an object');
      } else {
        const action = payload.action as unknown as Record<string, unknown>;

        if (typeof action.type !== 'string' || !this.VALID_ACTION_TYPES.has(action.type)) {
          errors.push('action.type must be one of: chat_message, insight');
        }

        if (typeof action.template !== 'string' || action.template.trim().length === 0) {
          errors.push('action.template must be a non-empty string');
        } else if (action.template.length > 4000) {
          errors.push('action.template must be 4000 characters or less');
        }

        if (action.type === 'insight') {
          if (typeof action.insightType !== 'string' || !this.VALID_INSIGHT_TYPES.has(action.insightType)) {
            errors.push('action.insightType must be one of: action, suggestion, summary, document when action.type=insight');
          }
        }
      }
    }

    return errors;
  }

  private static sanitizeRulePayload(payload: Partial<RuleDefinition>): Partial<RuleDefinition> {
    const sanitized: Partial<RuleDefinition> = { ...payload };

    if (typeof sanitized.name === 'string') sanitized.name = sanitized.name.trim();
    if (typeof sanitized.description === 'string') sanitized.description = sanitized.description.trim();

    return sanitized;
  }

  private static getPresetFromRequest(req: Request): RulePresetConfig | null {
    const presetId = req.body?.presetId as RulePresetId | undefined;
    if (!presetId || !RULE_PRESETS[presetId]) {
      return null;
    }
    return RULE_PRESETS[presetId];
  }

  private static estimateRuleMatches(
    rule: { conditions: string; priority: number; cooldownMinutes: number; enabled: boolean; name: string; id: string },
    recentMessages: string[],
  ): number {
    let parsedConditions: any = {};
    try {
      parsedConditions = JSON.parse(rule.conditions || '{}');
    } catch {
      parsedConditions = {};
    }

    const patterns: string[] = Array.isArray(parsedConditions.patterns) ? parsedConditions.patterns : [];
    const keywords: string[] = Array.isArray(parsedConditions.keywords) ? parsedConditions.keywords : [];
    const checkExpectsReply = Boolean(parsedConditions.checkExpectsReply);

    let matches = 0;
    for (const content of recentMessages) {
      const lower = content.toLowerCase();

      const keywordHit = keywords.some((keyword) => lower.includes(String(keyword).toLowerCase()));
      const patternHit = patterns.some((pattern) => {
        try {
          return new RegExp(pattern, 'i').test(content);
        } catch {
          return false;
        }
      });
      const expectsReplyHit = checkExpectsReply && content.includes('?');

      if (keywordHit || patternHit || expectsReplyHit) {
        matches += 1;
      }
    }

    if (matches === 0 && (parsedConditions.requiredIntents || parsedConditions.semanticQuery)) {
      matches = Math.max(1, Math.round(recentMessages.length * 0.08));
    }

    return matches;
  }

  static async getRulePresets(req: Request, res: Response) {
    res.json({
      presets: Object.values(RULE_PRESETS),
    });
  }

  static async previewPreset(req: Request, res: Response) {
    try {
      const { teamId } = req.params;
      const preset = this.getPresetFromRequest(req);

      if (!preset) {
        return res.status(400).json({ error: 'Valid presetId is required' });
      }

      const [rules, recentMessages] = await Promise.all([
        prisma.chimeRule.findMany({
          where: {
            OR: [{ teamId }, { teamId: null }],
          },
          orderBy: { priority: 'desc' },
        }),
        prisma.message.findMany({
          where: { teamId, contentType: 'text' },
          orderBy: { createdAt: 'desc' },
          take: 120,
          select: { content: true },
        }),
      ]);

      const messageContents = recentMessages.map((m) => m.content);

      const ruleEstimates = rules.map((rule) => {
        const baselineMatches = this.estimateRuleMatches(rule, messageContents);
        const projectedMatchesRaw = Math.round(baselineMatches * (1 / preset.cooldownMultiplier));
        const projectedMatches = Math.min(projectedMatchesRaw, preset.maxTriggersPerHour);
        const wouldDisable = rule.priority < preset.minPriorityEnabled;

        return {
          ruleId: rule.id,
          ruleName: rule.name,
          currentEnabled: rule.enabled,
          currentPriority: rule.priority,
          currentCooldownMinutes: rule.cooldownMinutes,
          projectedEnabled: wouldDisable ? false : rule.enabled,
          projectedCooldownMinutes: Math.max(1, Math.round(rule.cooldownMinutes * preset.cooldownMultiplier)),
          baselineEstimatedTriggersPerHour: baselineMatches,
          projectedEstimatedTriggersPerHour: wouldDisable ? 0 : projectedMatches,
        };
      });

      const projectedTotalTriggersPerHour = ruleEstimates.reduce(
        (sum, r) => sum + r.projectedEstimatedTriggersPerHour,
        0,
      );

      res.json({
        teamId,
        preset,
        windowMessagesAnalyzed: messageContents.length,
        projectedTotalTriggersPerHour,
        cappedAtPresetMaxPerRule: preset.maxTriggersPerHour,
        ruleEstimates,
      });
    } catch (error) {
      console.error('[ChimeRuleController] Error previewing preset:', error);
      res.status(500).json({ error: 'Failed to preview preset' });
    }
  }

  static async applyPreset(req: Request, res: Response) {
    try {
      const { teamId } = req.params;
      const preset = this.getPresetFromRequest(req);

      if (!preset) {
        return res.status(400).json({ error: 'Valid presetId is required' });
      }

      const teamRules = await prisma.chimeRule.findMany({
        where: { teamId },
      });

      if (teamRules.length === 0) {
        return res.status(404).json({ error: 'No team-scoped rules found to apply preset' });
      }

      let updatedCount = 0;
      for (const rule of teamRules) {
        const nextCooldown = Math.max(1, Math.round(rule.cooldownMinutes * preset.cooldownMultiplier));
        const nextEnabled = rule.priority < preset.minPriorityEnabled ? false : rule.enabled;

        await prisma.chimeRule.update({
          where: { id: rule.id },
          data: {
            cooldownMinutes: nextCooldown,
            enabled: nextEnabled,
          },
        });
        updatedCount += 1;
      }

      res.json({
        message: `Applied ${preset.name} preset to ${updatedCount} team rules`,
        teamId,
        preset,
        updatedCount,
      });
    } catch (error) {
      console.error('[ChimeRuleController] Error applying preset:', error);
      res.status(500).json({ error: 'Failed to apply preset' });
    }
  }

  static async resetPreset(req: Request, res: Response) {
    try {
      const { teamId } = req.params;

      const teamRules = await prisma.chimeRule.findMany({
        where: { teamId },
      });

      if (teamRules.length === 0) {
        return res.status(404).json({ error: 'No team-scoped rules found to reset' });
      }

      let resetCount = 0;
      for (const rule of teamRules) {
        const fallbackKey = rule.sourceRuleId || rule.id;
        const defaultRule = DEFAULT_RULES.find((candidate) => candidate.id === fallbackKey || candidate.name === rule.name);
        if (!defaultRule) continue;

        await prisma.chimeRule.update({
          where: { id: rule.id },
          data: {
            cooldownMinutes: defaultRule.cooldownMinutes,
            enabled: defaultRule.enabled,
            priority: defaultRule.priority,
          },
        });
        resetCount += 1;
      }

      res.json({
        message: `Reset ${resetCount} team rules to default preset behavior`,
        teamId,
        resetCount,
      });
    } catch (error) {
      console.error('[ChimeRuleController] Error resetting preset:', error);
      res.status(500).json({ error: 'Failed to reset preset' });
    }
  }

  /**
   * Get all chime rules for a team (or global rules)
   */
  static async getRules(req: Request, res: Response) {
    try {
      const { teamId } = req.params;

      const rules = await prisma.chimeRule.findMany({
        where: {
          OR: [
            { teamId: teamId },
            { teamId: null }, // Global rules
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      // Parse JSON fields and include all fields the frontend needs
      const parsedRules = rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description || null,
        type: rule.type,
        execution: rule.execution || 'sync',
        enabled: rule.enabled,
        priority: rule.priority,           // numeric 0-100
        cooldownMinutes: rule.cooldownMinutes,
        conditions: JSON.parse(rule.conditions),
        action: JSON.parse(rule.action),
        teamId: rule.teamId || undefined,
        sourceRuleId: rule.sourceRuleId || undefined,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      }));

      res.json(parsedRules);
    } catch (error) {
      console.error('[ChimeRuleController] Error getting rules:', error);
      res.status(500).json({ error: 'Failed to get chime rules' });
    }
  }

  /**
   * Get a single chime rule by ID
   */
  static async getRuleById(req: Request, res: Response) {
    try {
      const { ruleId } = req.params;

      const rule = await prisma.chimeRule.findUnique({
        where: { id: ruleId },
      });

      if (!rule) {
        return res.status(404).json({ error: 'Chime rule not found' });
      }

      const parsedRule = {
        id: rule.id,
        name: rule.name,
        description: rule.description || null,
        type: rule.type,
        execution: rule.execution || 'sync',
        enabled: rule.enabled,
        priority: rule.priority,
        cooldownMinutes: rule.cooldownMinutes,
        conditions: JSON.parse(rule.conditions),
        action: JSON.parse(rule.action),
        teamId: rule.teamId || undefined,
        sourceRuleId: rule.sourceRuleId || undefined,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      };

      res.json(parsedRule);
    } catch (error) {
      console.error('[ChimeRuleController] Error getting rule:', error);
      res.status(500).json({ error: 'Failed to get chime rule' });
    }
  }

  /**
   * Create a new chime rule
   */
  static async createRule(req: Request, res: Response) {
    try {
      const ruleData: RuleDefinition = req.body;
      const validationErrors = this.validateRulePayload(ruleData, 'create');
      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Invalid chime rule payload',
          details: validationErrors,
        });
      }

      const sanitized = this.sanitizeRulePayload(ruleData);

      const rule = await prisma.chimeRule.create({
        data: {
          name: sanitized.name!,
          description: (sanitized.description as string | undefined) || null,
          type: sanitized.type!,
          execution: sanitized.execution || 'sync',
          enabled: sanitized.enabled ?? true,
          priority: sanitized.priority!,
          cooldownMinutes: sanitized.cooldownMinutes!,
          conditions: JSON.stringify(sanitized.conditions),
          action: JSON.stringify(sanitized.action),
          teamId: sanitized.teamId || null,
          sourceRuleId: sanitized.sourceRuleId || null,
        },
      });

      const parsedRule = {
        id: rule.id,
        name: rule.name,
        description: rule.description || null,
        type: rule.type,
        execution: rule.execution || 'sync',
        enabled: rule.enabled,
        priority: rule.priority,
        cooldownMinutes: rule.cooldownMinutes,
        conditions: JSON.parse(rule.conditions),
        action: JSON.parse(rule.action),
        teamId: rule.teamId || undefined,
        sourceRuleId: rule.sourceRuleId || undefined,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      };

      res.status(201).json(parsedRule);
    } catch (error) {
      console.error('[ChimeRuleController] Error creating rule:', error);
      res.status(500).json({ error: 'Failed to create chime rule' });
    }
  }

  /**
   * Update an existing chime rule
   */
  static async updateRule(req: Request, res: Response) {
    try {
      const { ruleId } = req.params;
      const updates: Partial<RuleDefinition> = req.body;
      const validationErrors = this.validateRulePayload(updates, 'update');
      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Invalid chime rule update payload',
          details: validationErrors,
        });
      }

      const sanitized = this.sanitizeRulePayload(updates);

      const rule = await prisma.chimeRule.update({
        where: { id: ruleId },
        data: {
          ...(sanitized.name !== undefined && { name: sanitized.name }),
          ...(sanitized.description !== undefined && { description: sanitized.description || null }),
          ...(sanitized.type !== undefined && { type: sanitized.type }),
          ...(sanitized.execution !== undefined && { execution: sanitized.execution }),
          ...(sanitized.enabled !== undefined && { enabled: sanitized.enabled }),
          ...(sanitized.priority !== undefined && { priority: sanitized.priority }),
          ...(sanitized.cooldownMinutes !== undefined && { cooldownMinutes: sanitized.cooldownMinutes }),
          ...(sanitized.conditions !== undefined && { conditions: JSON.stringify(sanitized.conditions) }),
          ...(sanitized.action !== undefined && { action: JSON.stringify(sanitized.action) }),
          ...(sanitized.teamId !== undefined && { teamId: sanitized.teamId || null }),
          ...(sanitized.sourceRuleId !== undefined && { sourceRuleId: sanitized.sourceRuleId || null }),
        },
      });

      const parsedRule = {
        id: rule.id,
        name: rule.name,
        description: rule.description || null,
        type: rule.type,
        execution: rule.execution || 'sync',
        enabled: rule.enabled,
        priority: rule.priority,
        cooldownMinutes: rule.cooldownMinutes,
        conditions: JSON.parse(rule.conditions),
        action: JSON.parse(rule.action),
        teamId: rule.teamId || undefined,
        sourceRuleId: rule.sourceRuleId || undefined,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      };

      res.json(parsedRule);
    } catch (error) {
      console.error('[ChimeRuleController] Error updating rule:', error);
      res.status(500).json({ error: 'Failed to update chime rule' });
    }
  }

  /**
   * Delete a chime rule
   */
  static async deleteRule(req: Request, res: Response) {
    try {
      const { ruleId } = req.params;

      await prisma.chimeRule.delete({
        where: { id: ruleId },
      });

      res.status(204).send();
    } catch (error) {
      console.error('[ChimeRuleController] Error deleting rule:', error);
      res.status(500).json({ error: 'Failed to delete chime rule' });
    }
  }

  /**
   * Toggle a rule on/off
   */
  static async toggleRule(req: Request, res: Response) {
    try {
      const { ruleId } = req.params;

      // If body has explicit enabled value use it, otherwise invert current state
      let newEnabled: boolean;
      if (req.body && typeof req.body.enabled === 'boolean') {
        newEnabled = req.body.enabled;
      } else {
        const current = await prisma.chimeRule.findUnique({ where: { id: ruleId } });
        if (!current) {
          return res.status(404).json({ error: 'Rule not found' });
        }
        newEnabled = !current.enabled;
      }

      const rule = await prisma.chimeRule.update({
        where: { id: ruleId },
        data: { enabled: newEnabled },
      });

      res.json({ id: rule.id, enabled: rule.enabled });
    } catch (error) {
      console.error('[ChimeRuleController] Error toggling rule:', error);
      res.status(500).json({ error: 'Failed to toggle chime rule' });
    }
  }

  /**
   * Seed default rules for a team (or global)
   */
  static async seedDefaultRules(req: Request, res: Response) {
    try {
      const { teamId } = req.body; // Optional

      // Use DEFAULT_RULES to get ALL rules (including disabled ones)
      const defaultRules = DEFAULT_RULES;
      const createdRules = [];

      for (const rule of defaultRules) {
        const created = await prisma.chimeRule.create({
          data: {
            id: rule.id, // Include the ID so rules are consistent
            name: rule.name,
            type: rule.type,
            enabled: rule.enabled,
            priority: rule.priority,
            cooldownMinutes: rule.cooldownMinutes,
            conditions: JSON.stringify(rule.conditions),
            action: JSON.stringify(rule.action),
            execution: rule.execution || 'sync', // Phase 6.2: Include execution mode
            teamId: teamId || null,
          },
        });

        createdRules.push(created);
      }

      res.status(201).json({
        message: `Seeded ${createdRules.length} default rules`,
        rules: createdRules,
      });
    } catch (error) {
      console.error('[ChimeRuleController] Error seeding rules:', error);
      res.status(500).json({ error: 'Failed to seed default rules' });
    }
  }

  /**
   * Get chime execution logs for a team
   */
  static async getChimeLogs(req: Request, res: Response) {
    try {
      const { teamId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const logs = await prisma.chimeLog.findMany({
        where: { teamId },
        orderBy: { triggeredAt: 'desc' },
        take: limit,
        include: {
          rule: {
            select: {
              name: true,
              priority: true,
            },
          },
        },
      });

      res.json(logs);
    } catch (error) {
      console.error('[ChimeRuleController] Error getting logs:', error);
      res.status(500).json({ error: 'Failed to get chime logs' });
    }
  }

  /**
   * Get active rules for chime evaluation (internal use)
   */
  static async getActiveRules(teamId: string): Promise<RuleDefinition[]> {
    console.log(`[ChimeRuleController] 🔍 Fetching active rules for team: ${teamId}`);
    
    const rules = await prisma.chimeRule.findMany({
      where: {
        enabled: true,
        OR: [
          { teamId: teamId },
          { teamId: null }, // Global rules
        ],
      },
    });

    console.log(`[ChimeRuleController] 📊 Found ${rules.length} enabled rules from database`);
    
    if (rules.length > 0) {
      console.log(`[ChimeRuleController] Rules breakdown:`);
      rules.forEach((rule, i) => {
        const conditions = JSON.parse(rule.conditions);
        console.log(`  ${i + 1}. ${rule.name} (${rule.type})`);
        console.log(`     - Patterns: ${conditions.patterns?.length || 0}`);
        console.log(`     - Keywords: ${conditions.keywords?.length || 0}`);
        console.log(`     - Message count threshold: ${conditions.messageCount || 'N/A'}`);
      });
    }

    return rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description || '',
      type: rule.type as RuleDefinition['type'],
      execution: (rule.execution || 'sync') as RuleDefinition['execution'],
      enabled: rule.enabled,
      priority: rule.priority,
      cooldownMinutes: rule.cooldownMinutes,
      conditions: JSON.parse(rule.conditions),
      action: JSON.parse(rule.action),
      teamId: rule.teamId || undefined,
      sourceRuleId: rule.sourceRuleId || undefined,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }));
  }

  /**
   * Log a chime execution
   */
  static async logChimeExecution(data: {
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
      },
    });
  }

  /**
   * Update async rules to have correct execution mode (Phase 6.2 migration helper)
   * This updates rules that have requiredIntents, minUrgency, or triggerSentiments
   * to use execution: 'async'
   */
  static async migrateAsyncRules(req: Request, res: Response) {
    try {
      // Phase 6.2: Intent-based async rules
      const asyncRuleIds = ['async-015', 'async-016', 'async-017', 'async-018'];
      
      const result1 = await prisma.chimeRule.updateMany({
        where: {
          id: { in: asyncRuleIds }
        },
        data: {
          execution: 'async'
        }
      });

      // Also update semantic rules (type: 'semantic') to use async execution
      // These rules use vector similarity and benefit from the async pipeline
      const result2 = await prisma.chimeRule.updateMany({
        where: {
          type: 'semantic',
          execution: 'sync' // Only update those still on sync
        },
        data: {
          execution: 'async'
        }
      });

      const totalUpdated = result1.count + result2.count;
      console.log(`[ChimeRuleController] ✅ Migrated ${totalUpdated} rules to execution: 'async' (${result1.count} intent-based, ${result2.count} semantic)`);

      res.json({
        message: `Updated ${totalUpdated} rules to use async execution`,
        intentBasedUpdated: result1.count,
        semanticUpdated: result2.count
      });
    } catch (error) {
      console.error('[ChimeRuleController] Error migrating async rules:', error);
      res.status(500).json({ error: 'Failed to migrate async rules' });
    }
  }
}
