/**
 * Rule Definitions
 * 
 * SINGLE SOURCE OF TRUTH for all system rules.
 * These are templates that get copied to each team.
 * Teams can then customize their copy independently.
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
  
  // Threshold-based
  messageCount?: number;
  timeWindow?: number;
}

export interface RuleAction {
  type: 'chat_message' | 'insight';
  template: string;
  insightType?: 'action' | 'suggestion' | 'analysis' | 'summary';
}

export interface RuleDefinition {
  id: string;           // Stable ID for tracking origin
  name: string;
  description: string;
  execution: 'sync' | 'async';
  type: 'pattern' | 'semantic' | 'intent' | 'schedule';
  enabled: boolean;
  priority: number;     // 0-100, higher = more important
  cooldownMinutes: number;
  conditions: RuleConditions;
  action: RuleAction;
}

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
      template: `Someone mentioned a blocker. Please:
1. Acknowledge what's blocking them
2. Ask one clarifying question if needed
3. Offer to help brainstorm solutions

Keep response brief (2-3 sentences max).`,
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
      template: `A decision was made in the conversation. Extract and document:
1. **Decision**: What was decided
2. **Made by**: Who made or agreed to this decision
3. **Rationale**: Brief reasoning (if mentioned)
4. **Next steps**: Action items resulting from this decision

Format as clear bullet points.`,
    },
  },

  // Medium Priority - Team dynamics
  {
    id: 'ASYNC_FRUSTRATION_HELPER',
    name: 'Frustration Helper',
    description: 'Offer help when user seems frustrated',
    execution: 'async',
    type: 'intent',
    enabled: true,
    priority: 70,
    cooldownMinutes: 20,
    conditions: {
      triggerSentiments: ['frustrated', 'negative'],
      minUrgency: 'high',
    },
    action: {
      type: 'chat_message',
      template: `The user seems frustrated. Please:
1. Acknowledge their frustration empathetically
2. Ask what specific issue they're facing
3. Offer one concrete suggestion if you can

Keep tone supportive but solution-focused. Max 2-3 sentences.`,
    },
  },
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
      template: `An action commitment was detected. Extract:
1. **Owner**: Who made the commitment
2. **Task**: What they committed to
3. **Deadline**: When (if mentioned)
4. **Context**: Why this task matters

Format as a trackable action item.`,
    },
  },

  // Lower Priority - Nice to have
  {
    id: 'ASYNC_CONFUSION_DETECTOR',
    name: 'Confusion Detector',
    description: 'Detect when team is confused about a topic',
    execution: 'async',
    type: 'semantic',
    enabled: false, // Disabled by default - can be noisy
    priority: 50,
    cooldownMinutes: 30,
    conditions: {
      semanticQuery: 'I am confused and don\'t understand what is happening or what to do next',
      threshold: 0.75,
    },
    action: {
      type: 'chat_message',
      template: `The team seems confused. Please:
1. Identify the source of confusion
2. Provide a clear, concise explanation
3. Offer to clarify further if needed

Keep explanation simple and practical.`,
    },
  },
  {
    id: 'ASYNC_KNOWLEDGE_GAP',
    name: 'Knowledge Gap Detector',
    description: 'Detect when team is asking about unfamiliar concepts',
    execution: 'async',
    type: 'semantic',
    enabled: false, // Disabled by default
    priority: 45,
    cooldownMinutes: 60,
    conditions: {
      semanticQuery: 'What does this mean? Can someone explain? I don\'t understand this concept',
      threshold: 0.7,
    },
    action: {
      type: 'insight',
      insightType: 'suggestion',
      template: `A knowledge gap was detected. Provide:
1. **Concept**: What the team is asking about
2. **Explanation**: Clear, beginner-friendly explanation
3. **Example**: A practical example if helpful
4. **Resources**: Suggestions for learning more`,
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// COMBINED EXPORTS
// ═══════════════════════════════════════════════════════════════

/** All system rules - sync first, then async */
export const ALL_SYSTEM_RULES: RuleDefinition[] = [...SYNC_RULES, ...ASYNC_RULES];

/** Get rules by execution type */
export function getSystemRulesByExecution(execution: 'sync' | 'async'): RuleDefinition[] {
  return ALL_SYSTEM_RULES.filter(r => r.execution === execution);
}

/** Get rule by ID */
export function getSystemRuleById(id: string): RuleDefinition | undefined {
  return ALL_SYSTEM_RULES.find(r => r.id === id);
}
