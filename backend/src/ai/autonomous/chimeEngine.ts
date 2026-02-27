/**
 * Chime Rules Engine
 * 
 * Core engine for evaluating and executing autonomous AI chime rules.
 * Monitors conversation flow and triggers AI responses based on patterns,
 * thresholds, schedules, or semantic signals.
 * 
 * Types imported from ruleDefinitions.ts (single source of truth).
 */

import type { RuleDefinition, RuleConditions, RuleAction, RuleType, RuleExecution } from '../rules/ruleDefinitions.js';

// Re-export the canonical types for backward compatibility
export type { RuleDefinition as ChimeRule, RuleConditions as ChimeRuleConditions, RuleAction as ChimeRuleAction, RuleType as ChimeRuleType, RuleExecution as ChimeRuleExecution };

// Local alias for use within this file
type ChimeRule = RuleDefinition;

export interface ChimeDecision {
  rule: RuleDefinition;
  teamId: string;
  triggeringMessageIds: string[];
  confidence: number;         // 0-1 score for rule match strength
  timestamp: Date;
}

export interface ChimeEvaluationContext {
  teamId: string;
  recentMessages: any[];      // MessageDTO[]
  newMessageId?: string;      // ID of the new message that triggered evaluation
  recentInsights: any[];      // AIInsightDTO[]
  currentTime: Date;
}

/**
 * ChimeEvaluator
 * 
 * Evaluates messages and insights against chime rules to determine
 * when AI should proactively respond.
 */
export class ChimeEvaluator {
  private rules: RuleDefinition[];
  private lastChimeTimes: Map<string, Date>; // ruleId -> last trigger time

  constructor(rules: RuleDefinition[] = []) {
    this.rules = rules.filter(r => r.enabled);
    this.lastChimeTimes = new Map();
  }

  /**
   * Evaluate a new message against all active chime rules
   * Returns list of triggered rules, sorted by priority
   */
  async evaluate(context: ChimeEvaluationContext): Promise<ChimeDecision[]> {
    const decisions: ChimeDecision[] = [];

    for (const rule of this.rules) {
      // Skip if rule is in cooldown period
      if (this.isInCooldown(rule)) {
        console.log(`[ChimeEvaluator] Rule ${rule.name} is in cooldown, skipping`);
        continue;
      }

      // Skip team-specific rules for wrong team
      if (rule.teamId && rule.teamId !== context.teamId) {
        continue;
      }

      // Evaluate rule based on type
      const matchResult = await this.evaluateRule(rule, context);
      
      if (matchResult.triggered) {
        console.log(`[ChimeEvaluator] ✅ Rule triggered: ${rule.name} (confidence: ${matchResult.confidence})`);
        
        decisions.push({
          rule,
          teamId: context.teamId,
          triggeringMessageIds: matchResult.messageIds,
          confidence: matchResult.confidence,
          timestamp: context.currentTime
        });

        // Record trigger time for cooldown
        this.lastChimeTimes.set(rule.id, context.currentTime);
      }
    }

    // Sort by priority (higher number = higher priority)
    decisions.sort((a, b) => {
      const priorityA = typeof a.rule.priority === 'number' ? a.rule.priority : 0;
      const priorityB = typeof b.rule.priority === 'number' ? b.rule.priority : 0;
      return priorityB - priorityA;
    });

    return decisions;
  }

  /**
   * Check if rule is in cooldown period
   */
  private isInCooldown(rule: ChimeRule): boolean {
    const lastTrigger = this.lastChimeTimes.get(rule.id);
    if (!lastTrigger) return false;

    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    const timeSinceTrigger = Date.now() - lastTrigger.getTime();
    
    return timeSinceTrigger < cooldownMs;
  }

  /**
   * Evaluate a single rule against context
   */
  private async evaluateRule(
    rule: ChimeRule, 
    context: ChimeEvaluationContext
  ): Promise<{ triggered: boolean; confidence: number; messageIds: string[] }> {
    
    switch (rule.type) {
      case 'pattern':
      case 'intent':
        return this.evaluatePatternRule(rule, context);
      
      case 'semantic':
        return this.evaluateSemanticRule(rule, context);
      
      case 'schedule':
        console.warn('[ChimeEvaluator] Schedule rules not yet implemented');
        return { triggered: false, confidence: 0, messageIds: [] };
      
      default:
        console.warn(`[ChimeEvaluator] Unknown rule type: ${rule.type}`);
        return { triggered: false, confidence: 0, messageIds: [] };
    }
  }

  /**
   * Evaluate pattern-based rule (regex matching)
   */
  private evaluatePatternRule(
    rule: ChimeRule,
    context: ChimeEvaluationContext
  ): { triggered: boolean; confidence: number; messageIds: string[] } {
    
    const { patterns, keywords } = rule.conditions;
    const messageCount = 1; // Minimum matches needed to trigger
    const matchingMessages: string[] = [];
    let totalMatches = 0;
    let newMessageMatches = false;

    // Check recent messages for pattern matches
    for (const message of context.recentMessages) {
      const content = message.content?.toLowerCase() || '';
      let messageMatches = 0;

      // Check regex patterns
      if (patterns) {
        for (const pattern of patterns) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(content)) {
              messageMatches++;
            }
          } catch (error) {
            console.error(`[ChimeEvaluator] Invalid regex pattern: ${pattern}`, error);
          }
        }
      }

      // Check keywords
      if (keywords) {
        for (const keyword of keywords) {
          if (content.includes(keyword.toLowerCase())) {
            messageMatches++;
          }
        }
      }

      if (messageMatches > 0) {
        matchingMessages.push(message.id);
        totalMatches += messageMatches;
        
        // Track if the NEW message matches
        if (context.newMessageId && message.id === context.newMessageId) {
          newMessageMatches = true;
        }
      }
    }

    // Rule triggers if:
    // 1. Enough matching messages (>= messageCount)
    // 2. The NEW message contributes to the pattern (prevents old messages from triggering)
    const hasEnoughMatches = matchingMessages.length >= messageCount;
    const triggered = hasEnoughMatches && (newMessageMatches || !context.newMessageId);
    const confidence = triggered ? Math.min(totalMatches / (messageCount * 2), 1.0) : 0;

    return { triggered, confidence, messageIds: matchingMessages };
  }



  /**
   * Evaluate semantic rule (vector similarity)
   * TODO: Requires vector DB integration (Pinecone/FAISS)
   */
  private async evaluateSemanticRule(
    rule: ChimeRule,
    context: ChimeEvaluationContext
  ): Promise<{ triggered: boolean; confidence: number; messageIds: string[] }> {
    
    console.warn('[ChimeEvaluator] Semantic rules not yet implemented (requires vector DB)');
    
    // Fallback to keyword matching for now
    const { keywords, semanticQuery } = rule.conditions;
    if (keywords) {
      return this.evaluatePatternRule(rule, context);
    }

    return { triggered: false, confidence: 0, messageIds: [] };
  }



  /**
   * Add a new rule to the evaluator
   */
  addRule(rule: ChimeRule): void {
    if (rule.enabled && !this.rules.find(r => r.id === rule.id)) {
      this.rules.push(rule);
      console.log(`[ChimeEvaluator] Added rule: ${rule.name}`);
    }
  }

  /**
   * Remove a rule from the evaluator
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this.lastChimeTimes.delete(ruleId);
    console.log(`[ChimeEvaluator] Removed rule: ${ruleId}`);
  }

  /**
   * Get all active rules
   */
  getRules(): ChimeRule[] {
    return [...this.rules];
  }

  /**
   * Clear cooldown for a rule (for testing)
   */
  clearCooldown(ruleId: string): void {
    this.lastChimeTimes.delete(ruleId);
  }
}
