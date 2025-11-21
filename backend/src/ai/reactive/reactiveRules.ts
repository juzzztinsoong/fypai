/**
 * AI Agent "Chime" Rules
 * 
 * Following copilot-instructions.md: Agent subscribes to message streams
 * and responds based on configurable rules
 */

import { MessageDTO } from '@fypai/types';

export interface ChimeRule {
  name: string;
  description: string;
  shouldRespond: (message: MessageDTO, context: ChimeContext) => boolean;
  priority: number; // Higher = more important
}

export interface ChimeContext {
  recentMessages: MessageDTO[];
  agentLastResponseTime?: Date;
  teamSettings?: {
    autoRespond: boolean;
    cooldownMinutes: number;
  };
}

/**
 * Rule Set: When should the AI agent respond?
 * Add new rules here to extend agent behavior
 */
export const CHIME_RULES: ChimeRule[] = [
  {
    name: 'direct_mention',
    description: 'User explicitly mentions the agent (no cooldown)',
    priority: 100,
    shouldRespond: (msg, context) => {
      const mentionPatterns = [
        /@agent/i,
        /hey ai/i,
        /ai help/i,
        /can you help/i,
      ];
      const hasMention = mentionPatterns.some((pattern) => pattern.test(msg.content));
      
      // Direct mentions bypass cooldown - always respond
      if (hasMention) {
        // Override cooldown for this specific message
        if (context.teamSettings) {
          context.teamSettings.cooldownMinutes = 0;
        }
        return true;
      }
      return false;
    },
  },
  {
    name: 'question_asked',
    description: 'Message contains a question',
    priority: 80,
    shouldRespond: (msg) => {
      // Check for question marks or question words at start
      const hasQuestionMark = msg.content.includes('?');
      const startsWithQuestion = /^(what|how|why|when|where|who|can|should|would|could|is|are|do|does)/i.test(msg.content);
      return hasQuestionMark || startsWithQuestion;
    },
  },
  {
    name: 'code_request',
    description: 'User requests code generation',
    priority: 90,
    shouldRespond: (msg) => {
      const codePatterns = [
        /write.*code/i,
        /create.*function/i,
        /implement/i,
        /show me.*example/i,
        /generate.*code/i,
      ];
      return codePatterns.some((pattern) => pattern.test(msg.content));
    },
  },
  {
    name: 'summary_request',
    description: 'User asks for summary',
    priority: 95,
    shouldRespond: (msg) => {
      const summaryPatterns = [
        /summarize/i,
        /summary/i,
        /recap/i,
        /what have we discussed/i,
      ];
      return summaryPatterns.some((pattern) => pattern.test(msg.content));
    },
  },
  {
    name: 'cooldown_check',
    description: 'Prevent spam - wait between responses',
    priority: 10,
    shouldRespond: (msg, context) => {
      if (!context.agentLastResponseTime) return true;
      
      const cooldownMs = (context.teamSettings?.cooldownMinutes || 0.5) * 60 * 1000; // Changed to 30 seconds for testing
      const timeSinceLastResponse = Date.now() - context.agentLastResponseTime.getTime();
      
      return timeSinceLastResponse > cooldownMs;
    },
  },
];

/**
 * Evaluate all rules and decide if agent should respond
 */
export function shouldAgentRespond(
  message: MessageDTO,
  context: ChimeContext
): { should: boolean; reason?: string; triggeredRules: string[] } {
  // Never respond to own messages
  if (message.authorId === 'agent') {
    return { should: false, reason: 'self_message', triggeredRules: [] };
  }

  // Check all rules in priority order
  const triggeredRules = CHIME_RULES
    .filter((rule) => rule.shouldRespond(message, context))
    .sort((a, b) => b.priority - a.priority);

  if (triggeredRules.length === 0) {
    return { should: false, reason: 'no_rules_triggered', triggeredRules: [] };
  }

  // Check cooldown rule specifically
  const cooldownRule = triggeredRules.find(r => r.name === 'cooldown_check');
  if (!cooldownRule) {
    return { 
      should: false, 
      reason: 'cooldown_active',
      triggeredRules: triggeredRules.map(r => r.name),
    };
  }

  return { 
    should: true, 
    reason: triggeredRules[0].name,
    triggeredRules: triggeredRules.map(r => r.name),
  };
}
