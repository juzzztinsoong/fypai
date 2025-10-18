/**
 * Chime Rules Engine
 * 
 * Core engine for evaluating and executing autonomous AI chime rules.
 * Monitors conversation flow and triggers AI responses based on patterns,
 * thresholds, schedules, or semantic signals.
 */

export type ChimeRuleType = 'pattern' | 'threshold' | 'semantic' | 'schedule' | 'hybrid';
export type ChimeRulePriority = 'low' | 'medium' | 'high' | 'critical';
export type ChimeActionType = 'chat_message' | 'insight' | 'both';
export type InsightType = 'action' | 'suggestion' | 'analysis' | 'summary';

export interface ChimeRuleConditions {
  patterns?: string[];        // Regex patterns to match
  keywords?: string[];        // Keywords to detect
  messageCount?: number;      // Trigger after N messages
  timeWindow?: number;        // Within X minutes
  semanticQuery?: string;     // Vector similarity search query
  schedule?: string;          // Cron expression for scheduled triggers
}

export interface ChimeRuleAction {
  type: ChimeActionType;
  insightType?: InsightType;  // Required if type includes 'insight'
  template: string;           // Prompt template for LLM
}

export interface ChimeRule {
  id: string;
  name: string;
  type: ChimeRuleType;
  enabled: boolean;
  priority: ChimeRulePriority;
  cooldownMinutes: number;    // Minimum time between rule triggers
  conditions: ChimeRuleConditions;
  action: ChimeRuleAction;
  teamId?: string;            // Optional: team-specific rule
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChimeDecision {
  rule: ChimeRule;
  teamId: string;
  triggeringMessageIds: string[];
  confidence: number;         // 0-1 score for rule match strength
  timestamp: Date;
}

export interface ChimeEvaluationContext {
  teamId: string;
  recentMessages: any[];      // MessageDTO[] - will import from types
  newMessageId?: string;      // ID of the new message that triggered evaluation
  recentInsights: any[];      // AIInsightDTO[] - will import from types
  currentTime: Date;
}

/**
 * ChimeEvaluator
 * 
 * Evaluates messages and insights against chime rules to determine
 * when AI should proactively respond.
 */
export class ChimeEvaluator {
  private rules: ChimeRule[];
  private lastChimeTimes: Map<string, Date>; // ruleId -> last trigger time

  constructor(rules: ChimeRule[] = []) {
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

    // Sort by priority (critical > high > medium > low)
    const priorityOrder: ChimeRulePriority[] = ['critical', 'high', 'medium', 'low'];
    decisions.sort((a, b) => {
      return priorityOrder.indexOf(a.rule.priority) - priorityOrder.indexOf(b.rule.priority);
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
        return this.evaluatePatternRule(rule, context);
      
      case 'threshold':
        return this.evaluateThresholdRule(rule, context);
      
      case 'semantic':
        return this.evaluateSemanticRule(rule, context);
      
      case 'schedule':
        return this.evaluateScheduleRule(rule, context);
      
      case 'hybrid':
        return this.evaluateHybridRule(rule, context);
      
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
    
    const { patterns, keywords, messageCount = 1 } = rule.conditions;
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
   * Evaluate threshold-based rule (message count, time window)
   */
  private evaluateThresholdRule(
    rule: ChimeRule,
    context: ChimeEvaluationContext
  ): { triggered: boolean; confidence: number; messageIds: string[] } {
    
    const { messageCount = 10, timeWindow } = rule.conditions;
    
    // Filter messages within time window if specified
    let relevantMessages = context.recentMessages;
    if (timeWindow) {
      const cutoffTime = new Date(context.currentTime.getTime() - (timeWindow * 60 * 1000));
      relevantMessages = relevantMessages.filter(m => {
        const msgTime = new Date(m.createdAt);
        return msgTime >= cutoffTime;
      });
    }

    const triggered = relevantMessages.length >= messageCount;
    const confidence = triggered ? Math.min(relevantMessages.length / (messageCount * 1.5), 1.0) : 0;
    const messageIds = relevantMessages.map(m => m.id);

    return { triggered, confidence, messageIds };
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
   * Evaluate schedule-based rule (cron expression)
   * TODO: Implement cron parsing and scheduling
   */
  private evaluateScheduleRule(
    rule: ChimeRule,
    context: ChimeEvaluationContext
  ): { triggered: boolean; confidence: number; messageIds: string[] } {
    
    console.warn('[ChimeEvaluator] Schedule rules not yet implemented (requires cron parser)');
    
    // Simple time-based check as placeholder
    const { messageCount = 1 } = rule.conditions;
    const hasEnoughActivity = context.recentMessages.length >= messageCount;

    return { 
      triggered: hasEnoughActivity, 
      confidence: hasEnoughActivity ? 0.5 : 0, 
      messageIds: context.recentMessages.map(m => m.id) 
    };
  }

  /**
   * Evaluate hybrid rule (multiple conditions must all match)
   */
  private async evaluateHybridRule(
    rule: ChimeRule,
    context: ChimeEvaluationContext
  ): Promise<{ triggered: boolean; confidence: number; messageIds: string[] }> {
    
    // Evaluate as pattern rule first
    const patternResult = this.evaluatePatternRule(rule, context);
    if (!patternResult.triggered) {
      return patternResult;
    }

    // Then check threshold requirements
    const thresholdResult = this.evaluateThresholdRule(rule, context);
    if (!thresholdResult.triggered) {
      return thresholdResult;
    }

    // Both conditions met
    const combinedConfidence = (patternResult.confidence + thresholdResult.confidence) / 2;
    const allMessageIds = [...new Set([...patternResult.messageIds, ...thresholdResult.messageIds])];

    return { 
      triggered: true, 
      confidence: combinedConfidence, 
      messageIds: allMessageIds 
    };
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
