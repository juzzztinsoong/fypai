/**
 * Rule Definitions
 * 
 * SINGLE SOURCE OF TRUTH for all system rules.
 * These are templates that get copied to each team.
 * Teams can then customize their copy independently.
 * 
 * This is the canonical type system for chime rules.
 * All other files should import these types.
 */

export interface RuleConditions {
  // Pattern-based (sync) - fast regex/keyword matching
  patterns?: string[];
  keywords?: string[];
  checkExpectsReply?: boolean;
  
  // Intent-based (async) - requires LLM classification
  requiredIntents?: string[];
  minUrgency?: 'low' | 'medium' | 'high' | 'critical';
  triggerSentiments?: string[];
  
  // Semantic-based (async) - requires vector similarity
  semanticQuery?: string;
  threshold?: number;
}

export interface RuleAction {
  type: 'chat_message' | 'insight';
  template: string;
  insightType?: 'action' | 'suggestion' | 'analysis' | 'summary';
}

export type RuleType = 'pattern' | 'semantic' | 'intent' | 'schedule';
export type RuleExecution = 'sync' | 'async';

export interface RuleDefinition {
  id: string;           // Stable ID for tracking origin
  name: string;
  description: string;
  execution: RuleExecution;
  type: RuleType;
  enabled: boolean;
  priority: number;     // 0-100, higher = more important
  cooldownMinutes: number;
  conditions: RuleConditions;
  action: RuleAction;
  teamId?: string;
  sourceRuleId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * @deprecated Use RuleDefinition instead. Kept as alias for migration.
 */
export type ChimeRule = RuleDefinition;

// ═══════════════════════════════════════════════════════════════
// SYNC RULES - Execute immediately in request loop (<50ms)
// These use only regex/pattern matching, no LLM calls
// ═══════════════════════════════════════════════════════════════

export const SYNC_RULES: RuleDefinition[] = [
  {
    id: 'SYNC_AGENT_MENTION',
    name: 'Agent Mention Response',
    description: 'Respond when user mentions @agent',
    execution: 'sync',
    type: 'pattern',
    enabled: true,
    priority: 100,  // Highest - always respond to direct mentions
    cooldownMinutes: 0,
    conditions: {
      patterns: ['@agent'],
    },
    action: {
      type: 'chat_message',
      template: 'REACTIVE_AGENT',
    },
  },
  {
    id: 'SYNC_EXPECTS_REPLY',
    name: 'Conversation Continuation',
    description: 'Continue conversation when agent asked a question and user replies',
    execution: 'sync',
    type: 'pattern',
    enabled: true,
    priority: 90,
    cooldownMinutes: 0,
    conditions: {
      checkExpectsReply: true,
    },
    action: {
      type: 'chat_message',
      template: 'REACTIVE_AGENT',
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// ASYNC RULES - Execute in background worker (100ms-2s)
// These can use LLM classification, vector similarity, etc.
// ═══════════════════════════════════════════════════════════════

export const ASYNC_RULES: RuleDefinition[] = [
  // High Priority - Important team events
  {
    id: 'ASYNC_BLOCKER_ALERT',
    name: 'Blocker Alert',
    description: 'Alert when someone mentions they are blocked',
    execution: 'async',
    type: 'intent',
    enabled: true,
    priority: 85,
    cooldownMinutes: 15,
    conditions: {
      requiredIntents: ['blocker'],
      minUrgency: 'medium',
    },
    action: {
      type: 'chat_message',
      template: `A team member mentioned they are blocked. Based ONLY on the specific blocking message (not older conversation), respond naturally in 1-2 sentences:
- Briefly acknowledge what's blocking them
- Either suggest a concrete workaround OR ask what help they need

Do NOT repeat yourself if you've already responded about this blocker. Do NOT use bullet point lists or headers. Write as a natural chat message.`,
    },
  },
  {
    id: 'ASYNC_DECISION_CAPTURE',
    name: 'Decision Capture',
    description: 'Capture team decisions as action items',
    execution: 'async',
    type: 'intent',
    enabled: true,
    priority: 80,
    cooldownMinutes: 30,
    conditions: {
      requiredIntents: ['decision_detected'],
      minUrgency: 'medium',
    },
    action: {
      type: 'insight',
      insightType: 'action',
      template: `A decision was made in the conversation. Look at only the most recent messages to extract:
- **Decision**: What was decided (one sentence)
- **Made by**: Who decided
- **Next steps**: 1-2 concrete action items

Be specific. Quote the actual decision from the message.`,
    },
  },

  // Medium Priority - Action tracking
  {
    id: 'ASYNC_COMMITMENT_TRACKER',
    name: 'Commitment Tracker',
    description: 'Track action commitments made by team members',
    execution: 'async',
    type: 'intent',
    enabled: true,
    priority: 65,
    cooldownMinutes: 10,
    conditions: {
      requiredIntents: ['action_commitment'],
    },
    action: {
      type: 'insight',
      insightType: 'action',
      template: `An action commitment was detected. From the most recent message, extract:
- **Owner**: Who committed
- **Task**: What they will do (one sentence)
- **Deadline**: When, if mentioned

Keep it short — this becomes a trackable action item.`,
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// COMBINED EXPORTS
// ═══════════════════════════════════════════════════════════════

/** All system rules - sync first, then async */
export const ALL_SYSTEM_RULES: RuleDefinition[] = [...SYNC_RULES, ...ASYNC_RULES];

/** 
 * Backward-compatible alias for ALL_SYSTEM_RULES.
 * Used by chimeRuleController.ts and ruleProvider.ts.
 */
export const DEFAULT_RULES: RuleDefinition[] = ALL_SYSTEM_RULES;

/** Get only enabled default rules */
export function getDefaultEnabledRules(): RuleDefinition[] {
  return ALL_SYSTEM_RULES.filter(r => r.enabled);
}

/** Get rules by execution type */
export function getSystemRulesByExecution(execution: 'sync' | 'async'): RuleDefinition[] {
  return ALL_SYSTEM_RULES.filter(r => r.execution === execution);
}

/** Get rule by ID */
export function getSystemRuleById(id: string): RuleDefinition | undefined {
  return ALL_SYSTEM_RULES.find(r => r.id === id);
}

/**
 * @deprecated Use getSystemRuleById instead
 */
export function getRuleById(ruleId: string): RuleDefinition | undefined {
  return getSystemRuleById(ruleId);
}
