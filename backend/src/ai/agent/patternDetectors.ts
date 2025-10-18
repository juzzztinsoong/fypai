/**
 * Pattern Detectors
 * 
 * Utility functions for detecting specific conversation patterns
 * that should trigger AI chime responses.
 */

export interface MessageContent {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
}

/**
 * Decision Detection
 * 
 * Detects when team makes a decision in conversation.
 * Patterns: "let's go with", "we decided", "agreed on", "final decision"
 */
export function detectDecision(messages: MessageContent[]): {
  detected: boolean;
  matchingMessages: string[];
  confidence: number;
} {
  const decisionPatterns = [
    /let'?s\s+go\s+with/i,
    /we\s+(decided|agreed|chose)/i,
    /final\s+decision/i,
    /settled\s+on/i,
    /moving\s+forward\s+with/i,
    /decision\s+is\s+to/i,
    /consensus\s+(is|was)/i
  ];

  const matchingMessages: string[] = [];
  let totalMatches = 0;

  for (const message of messages) {
    for (const pattern of decisionPatterns) {
      if (pattern.test(message.content)) {
        matchingMessages.push(message.id);
        totalMatches++;
        break; // Count each message only once
      }
    }
  }

  const detected = matchingMessages.length > 0;
  const confidence = detected ? Math.min(totalMatches / 2, 1.0) : 0;

  return { detected, matchingMessages, confidence };
}

/**
 * Action Commitment Detection
 * 
 * Detects when someone commits to doing a task by a deadline.
 * Patterns: "I'll do X by Y", "deadline", "will finish"
 */
export function detectActionCommitment(messages: MessageContent[]): {
  detected: boolean;
  matchingMessages: string[];
  confidence: number;
} {
  const actionPatterns = [
    /(I'?ll|I\s+will)\s+.+\s+by\s+(tomorrow|friday|monday|tuesday|wednesday|thursday|saturday|sunday|next\s+week|\d{1,2}\/\d{1,2})/i,
    /deadline\s+(is|set\s+for|on)/i,
    /will\s+(finish|complete|deliver|submit)/i,
    /due\s+(date|on)/i,
    /commit\s+to\s+(finishing|completing)/i,
    /responsible\s+for/i,
    /I'?ll\s+take\s+(care\s+of|on)/i
  ];

  const matchingMessages: string[] = [];
  let totalMatches = 0;

  for (const message of messages) {
    for (const pattern of actionPatterns) {
      if (pattern.test(message.content)) {
        matchingMessages.push(message.id);
        totalMatches++;
        break;
      }
    }
  }

  const detected = matchingMessages.length > 0;
  const confidence = detected ? Math.min(totalMatches / 1.5, 1.0) : 0;

  return { detected, matchingMessages, confidence };
}

/**
 * Confusion Detection
 * 
 * Detects when team members are confused about a topic.
 * Patterns: "I'm confused", "not sure", "what do you mean"
 */
export function detectConfusion(messages: MessageContent[]): {
  detected: boolean;
  matchingMessages: string[];
  confidence: number;
} {
  const confusionPatterns = [
    /(I'?m|I\s+am)\s+(confused|lost|not\s+sure|unclear)/i,
    /what\s+(do\s+you|does\s+that)\s+mean/i,
    /(can\s+you|could\s+you)\s+(explain|clarify)/i,
    /don'?t\s+understand/i,
    /confused\s+about/i,
    /what'?s\s+the\s+difference/i,
    /how\s+(do|does)\s+(that|this)\s+work/i,
    /can\s+someone\s+explain/i
  ];

  const matchingMessages: string[] = [];
  let totalMatches = 0;

  for (const message of messages) {
    for (const pattern of confusionPatterns) {
      if (pattern.test(message.content)) {
        matchingMessages.push(message.id);
        totalMatches++;
        break;
      }
    }
  }

  // Require at least 2 confusion signals to avoid false positives
  const detected = matchingMessages.length >= 2;
  const confidence = detected ? Math.min(totalMatches / 3, 1.0) : 0;

  return { detected, matchingMessages, confidence };
}

/**
 * Topic Drift Detection
 * 
 * Detects when conversation strays from original topic.
 * Uses keyword frequency analysis.
 */
export function detectTopicDrift(
  messages: MessageContent[], 
  originalTopic: string
): {
  detected: boolean;
  driftScore: number;
} {
  if (messages.length < 5) {
    return { detected: false, driftScore: 0 };
  }

  const topicKeywords = originalTopic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const recentMessages = messages.slice(-5);
  
  let topicMentions = 0;
  let totalWords = 0;

  for (const message of recentMessages) {
    const words = message.content.toLowerCase().split(/\s+/);
    totalWords += words.length;

    for (const keyword of topicKeywords) {
      if (words.includes(keyword)) {
        topicMentions++;
      }
    }
  }

  // Calculate drift score (lower mentions = higher drift)
  const mentionRate = totalWords > 0 ? topicMentions / totalWords : 0;
  const driftScore = 1 - Math.min(mentionRate * 10, 1.0);
  
  // Detected if drift score > 0.7 (less than 10% topic mentions)
  const detected = driftScore > 0.7;

  return { detected, driftScore };
}

/**
 * Knowledge Gap Detection
 * 
 * Detects repeated questions about unfamiliar concepts.
 * Patterns: "what is", "define", "explain", "never heard of"
 */
export function detectKnowledgeGap(messages: MessageContent[]): {
  detected: boolean;
  matchingMessages: string[];
  confidence: number;
  topic?: string;
} {
  const knowledgeGapPatterns = [
    /what\s+(is|are)\s+(\w+)/i,
    /(define|explain)\s+(\w+)/i,
    /never\s+heard\s+of/i,
    /unfamiliar\s+with/i,
    /don'?t\s+know\s+(what|how)/i,
    /what'?s\s+(\w+)\s+mean/i
  ];

  const matchingMessages: string[] = [];
  const topics: string[] = [];

  for (const message of messages) {
    for (const pattern of knowledgeGapPatterns) {
      const match = message.content.match(pattern);
      if (match) {
        matchingMessages.push(message.id);
        
        // Extract potential topic (2nd capture group if exists)
        if (match[2]) {
          topics.push(match[2].toLowerCase());
        }
        break;
      }
    }
  }

  // Detect if same topic is asked about multiple times
  const topicCounts = topics.reduce((acc, topic) => {
    acc[topic] = (acc[topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const maxCount = Math.max(...Object.values(topicCounts), 0);
  const mostCommonTopic = Object.keys(topicCounts).find(t => topicCounts[t] === maxCount);

  const detected = matchingMessages.length >= 2 && maxCount >= 2;
  const confidence = detected ? Math.min(maxCount / 3, 1.0) : 0;

  return { 
    detected, 
    matchingMessages, 
    confidence,
    topic: mostCommonTopic 
  };
}

/**
 * Problem/Blocker Detection
 * 
 * Detects when team is stuck on a problem.
 * Patterns: "stuck", "blocked", "issue", "error", "not working"
 */
export function detectProblem(messages: MessageContent[]): {
  detected: boolean;
  matchingMessages: string[];
  confidence: number;
} {
  const problemPatterns = [
    /(stuck|blocked)\s+on/i,
    /(issue|problem)\s+with/i,
    /(error|bug|crash)/i,
    /not\s+working/i,
    /can'?t\s+get\s+.+\s+to\s+work/i,
    /keep\s+getting\s+(error|issue)/i,
    /doesn'?t\s+work/i,
    /hitting\s+a\s+wall/i
  ];

  const matchingMessages: string[] = [];
  let totalMatches = 0;

  for (const message of messages) {
    for (const pattern of problemPatterns) {
      if (pattern.test(message.content)) {
        matchingMessages.push(message.id);
        totalMatches++;
        break;
      }
    }
  }

  const detected = matchingMessages.length >= 2;
  const confidence = detected ? Math.min(totalMatches / 2.5, 1.0) : 0;

  return { detected, matchingMessages, confidence };
}

/**
 * Deadline/Urgency Detection
 * 
 * Detects mentions of urgent deadlines or time pressure.
 * Patterns: "urgent", "ASAP", "deadline", "by EOD"
 */
export function detectUrgency(messages: MessageContent[]): {
  detected: boolean;
  matchingMessages: string[];
  confidence: number;
} {
  const urgencyPatterns = [
    /urgent/i,
    /ASAP/i,
    /as\s+soon\s+as\s+possible/i,
    /by\s+(EOD|end\s+of\s+(day|week))/i,
    /deadline\s+(today|tomorrow)/i,
    /need\s+(this|it)\s+(now|today|immediately)/i,
    /time\s+(critical|sensitive)/i,
    /running\s+out\s+of\s+time/i
  ];

  const matchingMessages: string[] = [];
  let totalMatches = 0;

  for (const message of messages) {
    for (const pattern of urgencyPatterns) {
      if (pattern.test(message.content)) {
        matchingMessages.push(message.id);
        totalMatches++;
        break;
      }
    }
  }

  const detected = matchingMessages.length > 0;
  const confidence = detected ? Math.min(totalMatches / 1.5, 1.0) : 0;

  return { detected, matchingMessages, confidence };
}

/**
 * Question Overload Detection
 * 
 * Detects when too many questions are asked without answers.
 */
export function detectQuestionOverload(messages: MessageContent[]): {
  detected: boolean;
  questionCount: number;
  confidence: number;
} {
  const questionPattern = /\?$/;
  let questionCount = 0;

  const recentMessages = messages.slice(-10); // Check last 10 messages

  for (const message of recentMessages) {
    if (questionPattern.test(message.content.trim())) {
      questionCount++;
    }
  }

  // Detected if > 50% of recent messages are questions
  const questionRate = questionCount / recentMessages.length;
  const detected = questionRate > 0.5 && questionCount >= 3;
  const confidence = detected ? Math.min(questionRate * 1.5, 1.0) : 0;

  return { detected, questionCount, confidence };
}

/**
 * Silence Detection
 * 
 * Detects when there's been a long period of inactivity.
 */
export function detectSilence(
  lastMessageTime: Date, 
  currentTime: Date, 
  thresholdMinutes: number = 30
): {
  detected: boolean;
  silenceDuration: number; // in minutes
} {
  const silenceDuration = (currentTime.getTime() - lastMessageTime.getTime()) / (1000 * 60);
  const detected = silenceDuration >= thresholdMinutes;

  return { detected, silenceDuration };
}
