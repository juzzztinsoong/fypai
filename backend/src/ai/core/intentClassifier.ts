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

export interface ReplyNeedContext {
  previousMessage?: MessageDTO;
  previousAgentMessage?: MessageDTO;
  routeConfidence?: number;
}

export interface ReplyNeedAssessment {
  requiresResponse: boolean;
  isContinuation: boolean;
  intent: IntentType;
  urgency: UrgencyLevel;
  confidence: number;
  reason: string;
}

const ACK_ONLY_PATTERN = /^(ok(?:ay)?|k|kk|thanks|thank you|thx|got it|noted|sounds good|cool|great|understood|makes sense|roger|yep|yeah|nope|nah|lol|haha|all good)[.!\s]*$/i;
const CONTINUATION_CUE_PATTERN = /^(also|and|but|so|then|because|actually|about that|for that|on that|regarding that|what about|can you|could you|should we|do we)\b/i;
const FOLLOW_UP_INVITE_PATTERN = /(let me know|which (one|area|part)|where (to|you) (want|wanna)|want to dive deeper|what should we explore|pick one|choose one)/i;
const TOPIC_PHRASE_PATTERN = /^[a-z0-9][a-z0-9\s\-_/+.#]{1,60}$/i;

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

Strict intent rules:
- Label action_commitment ONLY when the speaker explicitly commits to doing a concrete task.
- action_commitment usually includes a clear owner signal (e.g., "I'll", "I will", "we will", "let me") and a concrete action.
- Do NOT label action_commitment for acknowledgements, gratitude, social closure, or vague discussion (e.g., "thanks", "sounds good", "what do you think", "we should discuss this").
- If uncertain between casual_chat and action_commitment, choose casual_chat.
- Prefer conservative classification over false positives.

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

  /**
   * Lightweight Tier 1 gate: should the assistant reply now?
   * Uses short context windows and strict JSON output to keep latency/cost low.
   */
  async assessReplyNeed(
    message: MessageDTO,
    context: ReplyNeedContext = {},
  ): Promise<ReplyNeedAssessment> {
    const trimmedContent = message.content.trim();

    if (!trimmedContent) {
      return {
        requiresResponse: false,
        isContinuation: false,
        intent: 'none',
        urgency: 'low',
        confidence: 0,
        reason: 'empty-message',
      };
    }

    if (trimmedContent.toLowerCase().includes('@agent')) {
      return {
        requiresResponse: true,
        isContinuation: true,
        intent: 'direct_mention',
        urgency: 'low',
        confidence: 1,
        reason: 'direct-mention',
      };
    }

    if (ACK_ONLY_PATTERN.test(trimmedContent) && !trimmedContent.includes('?')) {
      return {
        requiresResponse: false,
        isContinuation: false,
        intent: 'casual_chat',
        urgency: 'low',
        confidence: 0.93,
        reason: 'acknowledgement-only',
      };
    }

    const sync = this.classifySync(message);
    const previousMessageContent = context.previousMessage?.content || '';
    const previousAgentContent = context.previousAgentMessage?.content || '';
    const previousAgentAskedQuestion = /\?/.test(previousAgentContent);
    const previousAgentInvitedFollowup =
      previousAgentAskedQuestion || FOLLOW_UP_INVITE_PATTERN.test(previousAgentContent.toLowerCase());
    const hasContinuationCue = CONTINUATION_CUE_PATTERN.test(trimmedContent);
    const wordCount = trimmedContent.split(/\s+/).filter(Boolean).length;
    const isShortTopicReply =
      wordCount >= 1 &&
      wordCount <= 5 &&
      !trimmedContent.includes('?') &&
      !ACK_ONLY_PATTERN.test(trimmedContent) &&
      TOPIC_PHRASE_PATTERN.test(trimmedContent);
    const lowSignalNoQuestion =
      sync.intent === 'none' &&
      trimmedContent.length < 28 &&
      !trimmedContent.includes('?') &&
      !hasContinuationCue;

    if (isShortTopicReply && previousAgentInvitedFollowup) {
      return {
        requiresResponse: true,
        isContinuation: true,
        intent: 'question',
        urgency: 'low',
        confidence: 0.9,
        reason: 'short-topic-followup-to-agent-prompt',
      };
    }

    if (lowSignalNoQuestion && previousAgentAskedQuestion !== true && (context.routeConfidence || 0) < 0.55) {
      return {
        requiresResponse: false,
        isContinuation: false,
        intent: 'none',
        urgency: 'low',
        confidence: 0.72,
        reason: 'low-signal-short-message',
      };
    }

    const compactLatest = trimmedContent.slice(0, 320);
    const compactPrevious = previousMessageContent.slice(0, 220) || '[none]';
    const compactPreviousAgent = previousAgentContent.slice(0, 220) || '[none]';
    const compactRouteConfidence = (context.routeConfidence ?? 0).toFixed(2);

    const prompt = `Decide if the assistant should reply to the latest team message now.

Latest message:
"${compactLatest}"

Previous team message:
"${compactPrevious}"

Most recent assistant message:
"${compactPreviousAgent}"

Hints:
- routeConfidence=${compactRouteConfidence}
- previousAssistantAskedQuestion=${previousAgentAskedQuestion}

Rules:
- requiresResponse=true when there is a clear ask, blocker, confusion, or meaningful continuation.
- requiresResponse=false for pure acknowledgements/closures without a new ask.
- isContinuation=true if latest message logically continues the prior thread even without @agent.
- For short or vague replies (<= 6 words) without a question mark or continuation cue, prefer requiresResponse=false.
- Do NOT infer continuation from politeness, agreement, or social filler alone.
- If uncertain, choose requiresResponse=false and isContinuation=false.
- Keep reason short (max 12 words).

Return JSON only:
{
  "requiresResponse": true,
  "isContinuation": true,
  "intent": "one of: direct_mention, question, code_request, summary_request, casual_chat, decision_detected, confusion, action_commitment, blocker, none",
  "urgency": "one of: low, medium, high, critical",
  "confidence": 0.0,
  "reason": "short reason"
}`;

    try {
      const response = await this.llm.generate({
        messages: [
          {
            role: 'system' as const,
            content: 'You are a strict routing classifier. Output ONLY valid JSON, no markdown.',
          },
          { role: 'user' as const, content: prompt },
        ],
        model: process.env.LLM_MODEL_TIER_1,
        temperature: 0.1,
        maxTokens: 130,
      });

      const cleanedContent = response.content.trim().replace(/```json\n?|\n?```/g, '');
      const parsed = JSON.parse(cleanedContent) as Partial<ReplyNeedAssessment>;
      const parsedRequiresResponse = Boolean(parsed.requiresResponse);
      const parsedIsContinuation = Boolean(parsed.isContinuation);

      const conservativeLowSignalBlock =
        sync.intent === 'none' &&
        wordCount <= 6 &&
        !hasContinuationCue &&
        !trimmedContent.includes('?') &&
        !previousAgentInvitedFollowup &&
        (context.routeConfidence || 0) < 0.65;

      if (conservativeLowSignalBlock && (parsedRequiresResponse || parsedIsContinuation)) {
        return {
          requiresResponse: false,
          isContinuation: false,
          intent: 'none',
          urgency: 'low',
          confidence: Math.min(1, Math.max(0.6, Number(parsed.confidence ?? 0.6))),
          reason: 'conservative-low-signal-block',
        };
      }

      if (!parsedRequiresResponse && isShortTopicReply && previousAgentInvitedFollowup) {
        return {
          requiresResponse: true,
          isContinuation: true,
          intent: 'question',
          urgency: 'low',
          confidence: Math.min(1, Math.max(0.82, Number(parsed.confidence ?? 0.82))),
          reason: 'topic-followup-overrode-llm-no-reply',
        };
      }

      return {
        requiresResponse: parsedRequiresResponse,
        isContinuation: parsedIsContinuation,
        intent: this.validateIntent(String(parsed.intent || 'none')),
        urgency: this.validateUrgency(String(parsed.urgency || 'low')),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? sync.confidence ?? 0.5))),
        reason: typeof parsed.reason === 'string' && parsed.reason.trim()
          ? parsed.reason.trim().slice(0, 120)
          : 'tier1-reply-need-analysis',
      };
    } catch (error) {
      console.warn('[IntentClassifier] Reply-need analysis failed, using heuristic fallback:', error);

      const fallbackRequiresResponse =
        (sync.intent !== 'none' &&
          (sync.intent === 'question' ||
            sync.intent === 'code_request' ||
            sync.intent === 'summary_request' ||
            sync.intent === 'confusion' ||
            sync.intent === 'blocker' ||
            hasContinuationCue)) ||
        (previousAgentInvitedFollowup && !ACK_ONLY_PATTERN.test(trimmedContent)) ||
        (isShortTopicReply && previousAgentInvitedFollowup);

      const fallbackContinuation =
        hasContinuationCue ||
        previousAgentInvitedFollowup ||
        (isShortTopicReply && previousAgentInvitedFollowup) ||
        Boolean(context.previousMessage && context.previousMessage.authorId === 'agent');

      return {
        requiresResponse: fallbackRequiresResponse,
        isContinuation: fallbackContinuation,
        intent: sync.intent,
        urgency: sync.intent === 'blocker' ? 'medium' : 'low',
        confidence: Math.min(1, Math.max(0.4, sync.confidence)),
        reason: 'heuristic-fallback',
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
