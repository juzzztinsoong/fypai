/**
 * Default Chime Rules
 * 
 * Pre-configured chime rules for common conversation patterns.
 * These can be enabled/disabled or customized per team.
 */

import { ChimeRule } from './chimeRulesEngine.js';

/**
 * Rule 1: Decision Detector
 * Triggers when team makes a decision
 */
export const DECISION_DETECTOR: ChimeRule = {
  id: 'decision-001',
  name: 'Decision Detected',
  type: 'pattern',
  enabled: true,
  priority: 'medium', // Changed from 'high' to avoid overriding critical/high priority rules
  cooldownMinutes: 60, // Increased from 30 to reduce spam
  conditions: {
    patterns: [
      'let\\\'?s\\s+go\\s+with',
      'we\\s+(decided|agreed|chose)',
      'final\\s+decision',
      'settled\\s+on',
      'moving\\s+forward\\s+with',
      'decision\\s+is\\s+to'
    ],
    messageCount: 1
  },
  action: {
    type: 'insight',
    insightType: 'action',
    template: `A decision was just made in the conversation. Please extract and summarize:

1. **What was decided**: The specific decision or choice made
2. **Who decided**: Team members involved in the decision
3. **Rationale**: Why this decision was made (context, pros/cons discussed)
4. **Next steps**: Immediate action items resulting from this decision

Format as clear, actionable bullet points that the team can reference later.`
  }
};

/**
 * Rule 2: Action Commitment Tracker
 * Triggers when someone commits to doing a task
 */
export const ACTION_COMMITMENT_TRACKER: ChimeRule = {
  id: 'action-002',
  name: 'Action Commitment Detected',
  type: 'pattern',
  enabled: true,
  priority: 'high',
  cooldownMinutes: 30, // Increased from 15 to reduce spam
  conditions: {
    patterns: [
      '(I\'ll|I\\s+will)\\s+.+\\s+by\\s+(tomorrow|friday|monday|tuesday|wednesday|thursday|next\\s+week|\\d{4}-\\d{2}-\\d{2})',
      '(my|the)\\s+deadline\\s+(is|will\\s+be)\\s+(tomorrow|friday|monday|\\d)',
      'will\\s+(finish|complete|deliver)\\s+.+\\s+by\\s+(tomorrow|friday|monday|\\d)',
      'I\'ll\\s+take\\s+(care\\s+of|on)\\s+.+\\s+by\\s+(tomorrow|friday|\\d)'
    ],
    messageCount: 1
  },
  action: {
    type: 'insight',
    insightType: 'action',
    template: `Someone just committed to an action item. Please extract and format:

1. **Owner**: Who is responsible for this task
2. **Task**: What needs to be done (be specific)
3. **Deadline**: When it needs to be completed
4. **Dependencies**: Any blockers or things needed to complete this
5. **Context**: Why this task is important

Create a trackable action item that can be followed up on later.`
  }
};

/**
 * Rule 3: Confusion Intervention
 * Triggers when team members express confusion
 */
export const CONFUSION_INTERVENTION: ChimeRule = {
  id: 'confusion-003',
  name: 'Confusion Detected',
  type: 'hybrid',
  enabled: true,
  priority: 'medium',
  cooldownMinutes: 20, // Increased from 10 to reduce spam
  conditions: {
    patterns: [
      '(I\'m|I\\s+am)\\s+(confused|lost|not\\s+sure)',
      'what\\s+(do\\s+you|does\\s+that)\\s+mean',
      '(can\\s+you|could\\s+you)\\s+(explain|clarify)',
      'don\'t\\s+understand',
      'what\'s\\s+the\\s+difference'
    ],
    messageCount: 3, // Increased from 2 - need more evidence of confusion
    timeWindow: 10 // Within 10 minutes
  },
  action: {
    type: 'chat_message',
    template: `The team seems confused about a topic. Please:

1. Identify what specific topic is causing confusion
2. Provide a clear, concise explanation addressing the confusion
3. Use simple language and examples if helpful
4. Reference the specific messages that showed confusion

Keep your explanation brief but comprehensive. Help the team get unstuck.`
  }
};

/**
 * Rule 4: Knowledge Gap Detector
 * Triggers when team repeatedly asks about unfamiliar concepts
 */
export const KNOWLEDGE_GAP_DETECTOR: ChimeRule = {
  id: 'knowledge-004',
  name: 'Knowledge Gap Detected',
  type: 'pattern',
  enabled: false, // Disabled by default - too noisy
  priority: 'low',
  cooldownMinutes: 120, // Increased from 60
  conditions: {
    keywords: [
      'what is',
      'explain',
      'define',
      'how does',
      'unfamiliar with',
      'never heard of'
    ],
    messageCount: 3, // Increased from 2 - need more evidence
    timeWindow: 20 // Increased from 15
  },
  action: {
    type: 'insight',
    insightType: 'suggestion',
    template: `The team is asking about a concept they're unfamiliar with. Please provide:

1. **Clear Definition**: What is this concept in simple terms
2. **Context**: Why is it relevant to their discussion
3. **Examples**: 1-2 practical examples to illustrate
4. **Resources**: Links or suggestions for learning more (if applicable)

Format as an educational insight that helps fill the knowledge gap.`
  }
};

/**
 * Rule 5: Problem/Blocker Detector
 * Triggers when team is stuck on a technical issue
 */
export const PROBLEM_DETECTOR: ChimeRule = {
  id: 'problem-005',
  name: 'Problem/Blocker Detected',
  type: 'pattern',
  enabled: true,
  priority: 'high',
  cooldownMinutes: 45, // Increased from 20 to reduce spam
  conditions: {
    patterns: [
      '(stuck|blocked)\\s+on',
      '(serious|critical)\\s+(issue|problem|bug)',
      'keep\\s+getting\\s+(error|bug)',
      'can\'t\\s+get\\s+.+\\s+to\\s+work',
      'nothing\\s+(works|is\\s+working)'
    ],
    messageCount: 2, // Need multiple messages about same problem
    timeWindow: 15 // Within 15 minutes
  },
  action: {
    type: 'insight',
    insightType: 'suggestion',
    template: `The team appears to be stuck on a problem. Please analyze and provide:

1. **Problem Summary**: What issue are they facing
2. **Troubleshooting Steps**: 3-4 concrete steps to try
3. **Root Causes**: Possible reasons for this issue
4. **Workarounds**: Alternative approaches if main solution doesn't work
5. **Resources**: Relevant documentation or similar issues

Help the team get unstuck with actionable suggestions.`
  }
};

/**
 * Rule 6: Daily Summary Generator
 * Triggers at end of workday if team was active
 */
export const DAILY_SUMMARY: ChimeRule = {
  id: 'schedule-006',
  name: 'Daily Standup Summary',
  type: 'schedule',
  enabled: false, // Disabled by default (requires cron implementation)
  priority: 'medium',
  cooldownMinutes: 1440, // Once per day
  conditions: {
    schedule: '0 17 * * 1-5', // 5pm on weekdays
    messageCount: 5 // Only if team had some activity
  },
  action: {
    type: 'insight',
    insightType: 'summary',
    template: `Generate an end-of-day standup summary covering:

1. **What Was Discussed**: Main topics and conversations today
2. **Decisions Made**: Key decisions and their rationale
3. **Action Items**: Tasks committed to with owners and deadlines
4. **Blockers/Issues**: Problems mentioned that need attention
5. **Tomorrow's Focus**: What the team should prioritize next

Keep it concise but comprehensive - this is for team alignment.`
  }
};

/**
 * Rule 7: Urgency/Deadline Alert
 * Triggers when urgent deadlines are mentioned
 */
export const URGENCY_ALERT: ChimeRule = {
  id: 'urgency-007',
  name: 'Urgency Detected',
  type: 'pattern',
  enabled: true,
  priority: 'critical',
  cooldownMinutes: 120, // Increased from 60 to reduce spam
  conditions: {
    patterns: [
      'urgent.+(deadline|task|issue)',
      'ASAP',
      'as\\s+soon\\s+as\\s+possible',
      'by\\s+(EOD|end\\s+of\\s+day|end\\s+of\\s+week)',
      'critical.+(deadline|task)',
      'emergency'
    ],
    messageCount: 1
  },
  action: {
    type: 'insight',
    insightType: 'action',
    template: `An urgent deadline or time-sensitive task was mentioned. Please extract:

1. **Urgent Item**: What needs immediate attention
2. **Deadline**: When this must be completed
3. **Owner**: Who is responsible (if mentioned)
4. **Impact**: Why this is urgent/what happens if missed
5. **Next Steps**: Immediate actions needed

Highlight this as a time-critical action item that needs tracking.`
  }
};

/**
 * Rule 8: Question Overload
 * Triggers when too many unanswered questions accumulate
 */
export const QUESTION_OVERLOAD: ChimeRule = {
  id: 'threshold-008',
  name: 'Question Overload',
  type: 'threshold',
  enabled: false, // Disabled by default - often triggers on normal conversations
  priority: 'medium',
  cooldownMinutes: 60, // Increased from 30
  conditions: {
    messageCount: 8, // Increased from 5 - need more messages
    timeWindow: 15 // Increased from 10
    // TODO: Add pattern to count questions with '?'
  },
  action: {
    type: 'chat_message',
    template: `I notice several questions have been asked. Let me help address them:

1. Identify all unanswered questions in recent messages
2. For each question, provide a clear, concise answer
3. If you can't answer definitively, suggest where to find the answer
4. Group related questions together

Keep answers practical and actionable.`
  }
};

/**
 * All Default Rules
 */
export const DEFAULT_RULES: ChimeRule[] = [
  DECISION_DETECTOR,
  ACTION_COMMITMENT_TRACKER,
  CONFUSION_INTERVENTION,
  KNOWLEDGE_GAP_DETECTOR,
  PROBLEM_DETECTOR,
  DAILY_SUMMARY,
  URGENCY_ALERT,
  QUESTION_OVERLOAD
];

/**
 * Get rules enabled by default for new teams
 */
export function getDefaultEnabledRules(): ChimeRule[] {
  return DEFAULT_RULES.filter(rule => rule.enabled);
}

/**
 * Get a rule by ID
 */
export function getRuleById(ruleId: string): ChimeRule | undefined {
  return DEFAULT_RULES.find(rule => rule.id === ruleId);
}

/**
 * Get rules by priority level
 */
export function getRulesByPriority(priority: 'low' | 'medium' | 'high' | 'critical'): ChimeRule[] {
  return DEFAULT_RULES.filter(rule => rule.priority === priority);
}
