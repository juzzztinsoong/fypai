/**
 * AI Prompt Templates
 * 
 * Following copilot-instructions.md: Centralized prompt engineering
 * for AI agent behavior in collaborative chat context
 * 
 * Phase 6.5.2: Supports per-team personality, response length, and
 * proactivity customization via AgentPreferences.
 */

import { MessageDTO, TeamWithMembersDTO, AgentPreferencesDTO } from '@fypai/types';

export const SYSTEM_PROMPTS = {
  assistant: `You are an AI collaboration assistant embedded in a team productivity app.

Your role:
- Help teams brainstorm, plan, and execute projects
- Analyze conversations and extract action items
- Generate summaries and insights
- Write code snippets and documentation
- Answer technical questions

Guidelines:
- Be concise but thorough (aim for 2-4 paragraphs unless asked for more)
- Use markdown formatting for structure
- When suggesting code, use proper syntax highlighting with language tags
- Ask clarifying questions when context is unclear
- Proactively identify action items and decisions made
- Reference previous messages when relevant ("As Alice mentioned...")

Style: Friendly, professional, helpful. Think of yourself as a smart team member.`,

  assistantWithRAG: `You are an AI collaboration assistant embedded in a team productivity app with access to the team's conversation history.

Your role:
- Help teams brainstorm, plan, and execute projects
- Analyze conversations and extract action items
- Generate summaries and insights
- Write code snippets and documentation
- Answer technical questions
- Reference relevant past discussions to provide context-aware responses

Guidelines:
- Be concise but thorough (aim for 2-4 paragraphs unless asked for more)
- Use markdown formatting for structure
- When suggesting code, use proper syntax highlighting with language tags
- Ask clarifying questions when context is unclear
- Proactively identify action items and decisions made
- Reference previous messages when relevant ("As Alice mentioned...")
- Use retrieved context to provide more informed responses
- Mention if you're drawing on past discussions ("I see from earlier conversations that...")
- Cite the source: "As discussed 2 days ago..."
- Indicate confidence: "Based on a highly relevant past discussion (95% match)..."

Style: Friendly, professional, helpful. Think of yourself as a smart team member with perfect memory.`,

  summarizer: `You are a conversation summarizer for team chats.

Analyze the conversation and provide a structured summary with:

## Key Discussion Points
- Bullet list of main topics discussed

## Decisions Made
- Clear statements of what was decided

## Open Questions
- Questions that need follow-up

Do NOT create task lists, owners, deadlines, or action checkboxes in this output.
Keep it concise. Use markdown formatting.`,

  reporter: `You are a discussion report writer for team chats.

Generate a structured report that focuses on:

## Context and Objective
- Briefly restate the team's working context

## Discussion Highlights
- Key themes, tradeoffs, and notable points raised

## Decisions and Rationale
- What was decided and why

## Risks and Open Questions
- Unknowns, blockers, and follow-up questions

Do NOT include task lists, assignees, deadlines, or execution checklists.
Use markdown formatting and keep the report practical and scannable.`,

  codeGenerator: `You are an expert code generator for team projects.

When generating code:
- Use TypeScript for backend/frontend code
- Follow clean code principles and project conventions
- Include error handling and validation
- Add JSDoc comments for complex functions
- Suggest tests when appropriate
- Explain your implementation choices briefly

Always wrap code in markdown code blocks with language tags.`,

  chimeAgent: `You are an autonomous AI assistant in a team chat app.
You are responding to a specific conversation pattern that was detected.

Critical Rules:
- Be BRIEF: 1-3 sentences max for chat messages.
- Be NATURAL: Write like a helpful teammate, not a template.
- Be SPECIFIC: Reference the actual message content, don't give generic advice.
- Do NOT use headers (##), numbered lists, or bold text in chat messages.
- Do NOT repeat responses you've already given in the conversation history.
- Do NOT start with "Acknowledgment:" or "Clarifying Question:" labels.
- If the conversation already addressed the issue, say nothing new.
- Focus ONLY on the most recent triggering message, not old context.`,
};

/**
 * Build conversation context for LLM from recent messages
 * Follows message schema from copilot-instructions.md
 */
export function buildConversationContext(
  messages: MessageDTO[],
  team: TeamWithMembersDTO,
  maxMessages: number = 20
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const recentMessages = messages.slice(-maxMessages);

  return recentMessages.map((msg) => {
    const author = team.members.find((m) => m.userId === msg.authorId);
    const authorName = author?.name || 'User';

    // Agent messages are 'assistant', others are 'user'
    if (msg.authorId === 'agent') {
      return {
        role: 'assistant' as const,
        content: msg.content,
      };
    }

    // Format user messages with name for context
    return {
      role: 'user' as const,
      content: `${authorName}: ${msg.content}`,
    };
  });
}

/**
 * Build RAG context section from retrieved messages
 * Formats relevant past messages for LLM prompt
 */
export function buildRAGContext(
  relevantMessages: MessageDTO[],
  scores: number[] = []
): string {
  if (relevantMessages.length === 0) {
    return '';
  }

  const contextLines = relevantMessages.map((msg, idx) => {
    const timestamp = new Date(msg.createdAt).toLocaleString();
    const relativeTime = getRelativeTime(msg.createdAt);
    const authorName = msg.author?.name || 'User';
    const relevance = scores[idx] ? Math.round(scores[idx] * 100) : 0;
    
    return `[${relativeTime}, ${relevance}% relevant] ${authorName}: ${msg.content}`;
  });

  return `IMPORTANT CONTEXT FROM PAST DISCUSSIONS:

${contextLines.join('\n\n')}

Use this context to provide accurate, informed responses.`;
}

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

// ─── Phase 6.5.2: Preference-aware Prompt Modifiers ─────────

const PERSONALITY_MODIFIERS: Record<string, string> = {
  formal: `
Tone: Professional and formal. Use complete sentences, avoid contractions, maintain a respectful and structured communication style. Address team members by name where possible.`,
  balanced: `
Tone: Friendly but professional. Balance clarity with warmth. Use a natural conversational style while maintaining professionalism.`,
  casual: `
Tone: Casual and approachable. Use contractions, be conversational, add occasional emoji where appropriate. Think of yourself as a friendly teammate, not a formal assistant.`,
}

const RESPONSE_LENGTH_MODIFIERS: Record<string, string> = {
  concise: `
Response Length: Keep responses SHORT and focused. Use bullet points. Aim for 1-2 short paragraphs maximum. Avoid unnecessary elaboration. Get straight to the point.`,
  balanced: `
Response Length: Aim for 2-4 paragraphs. Provide enough detail for clarity but don't over-explain. Use formatting (bullets, headers) for longer responses.`,
  detailed: `
Response Length: Provide thorough, comprehensive responses. Include examples, explanations, and context. Use headers, bullet points, and code blocks liberally. Aim for 4-8 paragraphs when the topic warrants it.`,
}

const PROACTIVITY_MODIFIERS: Record<string, string> = {
  silent: `
Proactivity: Only respond when directly asked. Do NOT volunteer suggestions, action items, or follow-up questions. Answer what was asked, nothing more.`,
  helpful: `
Proactivity: Respond when asked and occasionally offer helpful suggestions. If you notice important action items or decisions, mention them briefly. Ask follow-up questions when context is unclear.`,
  proactive: `
Proactivity: Be highly proactive. Volunteer suggestions, identify risks, propose next steps, and ask follow-up questions. Act as an engaged team member who anticipates needs.`,
}

/**
 * Apply team preferences to a base system prompt.
 * Returns a modified prompt string that includes personality, length, and proactivity directives.
 * 
 * @param basePrompt - The base system prompt (e.g., SYSTEM_PROMPTS.assistant)
 * @param preferences - The team's agent preferences (or null for defaults)
 */
export function applyPreferences(
  basePrompt: string,
  preferences?: AgentPreferencesDTO | null
): string {
  if (!preferences) return basePrompt

  const personalityMod = PERSONALITY_MODIFIERS[preferences.personality] || ''
  const lengthMod = RESPONSE_LENGTH_MODIFIERS[preferences.responseLength] || ''
  const proactivityMod = PROACTIVITY_MODIFIERS[preferences.proactivity] || ''

  // Only append modifiers if they differ from the default "balanced" behaviors
  const modifiers = [personalityMod, lengthMod, proactivityMod]
    .filter(Boolean)
    .join('\n')

  if (!modifiers.trim()) return basePrompt

  return `${basePrompt}\n\n--- Team Preferences ---${modifiers}`
}

/**
 * Determine which LLM model to use based on team preferences.
 * Returns the model environment variable name or undefined for default.
 */
export function getModelForPreferences(
  preferences?: AgentPreferencesDTO | null,
  defaultTier: 'tier1' | 'tier2' = 'tier2'
): string | undefined {
  if (!preferences || preferences.modelTierOverride === 'auto') {
    return defaultTier === 'tier1' 
      ? process.env.LLM_MODEL_TIER_1 
      : process.env.LLM_MODEL_TIER_2
  }

  if (preferences.modelTierOverride === 'tier1') {
    return process.env.LLM_MODEL_TIER_1
  }
  
  return process.env.LLM_MODEL_TIER_2
}

