import { MessageDTO } from '@fypai/types';
import { GitHubModelsClient } from './llm.js';
import { prisma } from '../../db.js';

export type IntentType = 'direct_mention' | 'question' | 'code_request' | 'summary_request' | 'casual_chat' | 'decision_detected' | 'confusion' | 'action_commitment' | 'blocker' | 'none';
export type SentimentType = 'positive' | 'negative' | 'neutral' | 'frustrated' | 'confused';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Full classification result from async LLM analysis
 * Used by embedding worker and rule engine for smarter triggering
 */
export interface MessageClassification {
  intent: IntentType;
  sentiment: SentimentType;
  urgency: UrgencyLevel;
  topics: string[]; // e.g., ['project-alpha', 'deadline', 'api-integration']
  confidence: number; // 0-1 score
}

/**
 * Fast sync classification result (regex-based)
 */
export interface SyncClassification {
  intent: IntentType;
  confidence: number;
}

export class IntentClassifier {
  private static instance: IntentClassifier;
  private llm: GitHubModelsClient;

  private constructor() {
    this.llm = new GitHubModelsClient();
  }

  public static getInstance(): IntentClassifier {
    if (!IntentClassifier.instance) {
      IntentClassifier.instance = new IntentClassifier();
    }
    return IntentClassifier.instance;
  }

  /**
   * Fast, synchronous classification using regex/keywords
   * Used in hot path (message receipt) for immediate decisions
   */
  classifySync(message: MessageDTO): SyncClassification {
    const content = message.content.toLowerCase();
    
    // Direct mentions - highest priority
    if (content.includes('@agent')) {
      return { intent: 'direct_mention', confidence: 1.0 };
    }
    
    // Explicit requests
    if (content.includes('summarize') || content.includes('summary')) {
      return { intent: 'summary_request', confidence: 0.9 };
    }
    
    // Decision patterns
    if (/\b(let's go with|we decided|agreed on|final decision|settled on)\b/.test(content)) {
      return { intent: 'decision_detected', confidence: 0.85 };
    }
    
    // Action commitment patterns - check before code_request since "api" might appear in commitments
    if (/\b(i'll|i will|deadline|by (tomorrow|friday|monday|end of)|will (finish|complete|deliver))\b/.test(content)) {
      return { intent: 'action_commitment', confidence: 0.8 };
    }
    
    // Blocker patterns
    if (/\b(blocked|stuck|can't proceed|waiting on|dependency|blocker)\b/.test(content)) {
      return { intent: 'blocker', confidence: 0.85 };
    }
    
    // Confusion patterns
    if (/\b(confused|not sure|don't understand|what do you mean|clarify)\b/.test(content)) {
      return { intent: 'confusion', confidence: 0.8 };
    }
    
    // Code/technical requests - after commitment check
    if (/\b(code|function|implement|debug|fix|error)\b/.test(content)) {
      return { intent: 'code_request', confidence: 0.8 };
    }
    
    // Questions - check before 'none' fallback
    if (content.includes('?')) {
      return { intent: 'question', confidence: 0.7 };
    }
    
    return { intent: 'none', confidence: 0.5 };
  }

  /**
   * Slow, asynchronous classification using Tier 1 LLM
   * Used in background worker for rich classification
   * Returns full analysis: intent, sentiment, urgency, topics
   */
  async classifyAsync(message: MessageDTO): Promise<MessageClassification> {
    const prompt = `Analyze this team chat message and provide classification.

Message: "${message.content}"

Respond in this exact JSON format (no markdown, just JSON):
{
  "intent": "one of: decision_detected, action_commitment, blocker, confusion, question, code_request, casual_chat, none",
  "sentiment": "one of: positive, negative, neutral, frustrated, confused",
  "urgency": "one of: low, medium, high, critical",
  "topics": ["array", "of", "topic", "tags"],
  "confidence": 0.0 to 1.0
}`;

    try {
      let taskContextMessage: { role: 'system'; content: string } | null = null;
      try {
        const teamData = await prisma.team.findUnique({
          where: { id: message.teamId },
          select: { taskContext: true },
        });
        if (teamData?.taskContext) {
          taskContextMessage = {
            role: 'system' as const,
            content: `TEAM TASK CONTEXT (ground truth for this team — align your response to this context first):\n\n${teamData.taskContext}`,
          };
        }
      } catch (error) {
        console.warn('[IntentClassifier] Failed to load task context:', error);
      }

      const response = await this.llm.generate({
        messages: [
          ...(taskContextMessage ? [taskContextMessage] : []),
          { 
            role: 'system' as const, 
            content: 'You are a message classifier for team collaboration. Output ONLY valid JSON, no markdown code blocks.' 
          },
          { role: 'user' as const, content: prompt }
        ],
        model: process.env.LLM_MODEL_TIER_1,
        temperature: 0.1,
        maxTokens: 150
      });

      // Parse JSON response
      const cleanedContent = response.content.trim().replace(/```json\n?|\n?```/g, '');
      const result = JSON.parse(cleanedContent) as MessageClassification;
      
      // Validate and normalize
      return {
        intent: this.validateIntent(result.intent),
        sentiment: this.validateSentiment(result.sentiment),
        urgency: this.validateUrgency(result.urgency),
        topics: Array.isArray(result.topics) ? result.topics.slice(0, 5) : [],
        confidence: Math.min(1, Math.max(0, result.confidence || 0.5))
      };
    } catch (error) {
      console.error('[IntentClassifier] Error in async classification:', error);
      // Fallback to sync classification
      const sync = this.classifySync(message);
      return {
        intent: sync.intent,
        sentiment: 'neutral',
        urgency: 'low',
        topics: [],
        confidence: sync.confidence * 0.5 // Lower confidence for fallback
      };
    }
  }

  private validateIntent(intent: string): IntentType {
    const validIntents: IntentType[] = ['direct_mention', 'question', 'code_request', 'summary_request', 
      'casual_chat', 'decision_detected', 'confusion', 'action_commitment', 'blocker', 'none'];
    return validIntents.includes(intent as IntentType) ? intent as IntentType : 'none';
  }

  private validateSentiment(sentiment: string): SentimentType {
    const validSentiments: SentimentType[] = ['positive', 'negative', 'neutral', 'frustrated', 'confused'];
    return validSentiments.includes(sentiment as SentimentType) ? sentiment as SentimentType : 'neutral';
  }

  private validateUrgency(urgency: string): UrgencyLevel {
    const validUrgency: UrgencyLevel[] = ['low', 'medium', 'high', 'critical'];
    return validUrgency.includes(urgency as UrgencyLevel) ? urgency as UrgencyLevel : 'low';
  }
}
