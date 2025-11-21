/**
 * AI Prompt Templates
 * 
 * Following copilot-instructions.md: Centralized prompt engineering
 * for AI agent behavior in collaborative chat context
 */

import { MessageDTO, TeamWithMembersDTO } from '@fypai/types';

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

## Action Items
- [ ] Task with owner if mentioned

## Open Questions
- Questions that need follow-up

Keep it concise. Use markdown formatting.`,

  codeGenerator: `You are an expert code generator for team projects.

When generating code:
- Use TypeScript for backend/frontend code
- Follow clean code principles and project conventions
- Include error handling and validation
- Add JSDoc comments for complex functions
- Suggest tests when appropriate
- Explain your implementation choices briefly

Always wrap code in markdown code blocks with language tags.`,
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

