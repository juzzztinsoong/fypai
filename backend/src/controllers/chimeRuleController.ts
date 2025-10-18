/**
 * Chime Rule Controller
 * 
 * Handles CRUD operations for chime rules and provides methods for
 * retrieving rules for evaluation.
 */

import { Request, Response } from 'express';
import { prisma } from '../db.js';
import type { ChimeRule } from '../ai/agent/chimeRulesEngine.js';
import { DEFAULT_RULES, getDefaultEnabledRules } from '../ai/agent/defaultRules.js';

export class ChimeRuleController {
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

      // Parse JSON fields
      const parsedRules: ChimeRule[] = rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        type: rule.type as any,
        enabled: rule.enabled,
        priority: rule.priority as any,
        cooldownMinutes: rule.cooldownMinutes,
        conditions: JSON.parse(rule.conditions),
        action: JSON.parse(rule.action),
        teamId: rule.teamId || undefined,
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

      const parsedRule: ChimeRule = {
        id: rule.id,
        name: rule.name,
        type: rule.type as any,
        enabled: rule.enabled,
        priority: rule.priority as any,
        cooldownMinutes: rule.cooldownMinutes,
        conditions: JSON.parse(rule.conditions),
        action: JSON.parse(rule.action),
        teamId: rule.teamId || undefined,
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
      const ruleData: ChimeRule = req.body;

      const rule = await prisma.chimeRule.create({
        data: {
          name: ruleData.name,
          type: ruleData.type,
          enabled: ruleData.enabled ?? true,
          priority: ruleData.priority,
          cooldownMinutes: ruleData.cooldownMinutes,
          conditions: JSON.stringify(ruleData.conditions),
          action: JSON.stringify(ruleData.action),
          teamId: ruleData.teamId || null,
        },
      });

      const parsedRule: ChimeRule = {
        id: rule.id,
        name: rule.name,
        type: rule.type as any,
        enabled: rule.enabled,
        priority: rule.priority as any,
        cooldownMinutes: rule.cooldownMinutes,
        conditions: JSON.parse(rule.conditions),
        action: JSON.parse(rule.action),
        teamId: rule.teamId || undefined,
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
      const updates: Partial<ChimeRule> = req.body;

      const rule = await prisma.chimeRule.update({
        where: { id: ruleId },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.type && { type: updates.type }),
          ...(updates.enabled !== undefined && { enabled: updates.enabled }),
          ...(updates.priority && { priority: updates.priority }),
          ...(updates.cooldownMinutes !== undefined && { cooldownMinutes: updates.cooldownMinutes }),
          ...(updates.conditions && { conditions: JSON.stringify(updates.conditions) }),
          ...(updates.action && { action: JSON.stringify(updates.action) }),
          ...(updates.teamId !== undefined && { teamId: updates.teamId || null }),
        },
      });

      const parsedRule: ChimeRule = {
        id: rule.id,
        name: rule.name,
        type: rule.type as any,
        enabled: rule.enabled,
        priority: rule.priority as any,
        cooldownMinutes: rule.cooldownMinutes,
        conditions: JSON.parse(rule.conditions),
        action: JSON.parse(rule.action),
        teamId: rule.teamId || undefined,
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
      const { enabled } = req.body;

      const rule = await prisma.chimeRule.update({
        where: { id: ruleId },
        data: { enabled },
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
  static async getActiveRules(teamId: string): Promise<ChimeRule[]> {
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
      type: rule.type as any,
      enabled: rule.enabled,
      priority: rule.priority as any,
      cooldownMinutes: rule.cooldownMinutes,
      conditions: JSON.parse(rule.conditions),
      action: JSON.parse(rule.action),
      teamId: rule.teamId || undefined,
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
}
