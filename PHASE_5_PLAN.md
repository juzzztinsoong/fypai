# Phase 5: RAG Enhancement & Validation

**Status:** Planned  
**Prerequisites:** Phase 4 (RAG Infrastructure) - Complete  
**Goal:** Verify, enhance, and productionize the RAG system

---

## Overview

Phase 4 built the RAG infrastructure (embeddings, vector search, basic integration). Phase 5 focuses on **verification, optimization, and advanced features** to make RAG production-ready and highly effective.

---

## 1. RAG Context Enhancement (HIGH PRIORITY)

### Current Issues:
- RAG-retrieved messages are appended as plain text
- Not clearly marked as important context for LLM
- LLM may ignore or deprioritize retrieved context
- No prominence indicators (relevance scores, timestamps)

### Implementation Tasks:

#### 1.1 Inject RAG as System Message
**File:** `backend/src/controllers/aiAgentController.ts`

**Current:**
```typescript
messages: [
  { role: 'system', content: systemPrompt },
  ...conversationHistory,
  ...(ragContext ? [{ role: 'user', content: ragContext }] : []),
]
```

**Change to:**
```typescript
messages: [
  { role: 'system', content: systemPrompt },
  ...(ragContext ? [{ 
    role: 'system', 
    content: `IMPORTANT CONTEXT FROM PAST DISCUSSIONS:\n\n${ragContext}\n\nUse this context to provide accurate, informed responses.` 
  }] : []),
  ...conversationHistory,
]
```

**Rationale:** System messages have higher weight than user messages. Placing RAG context as system message before conversation history signals importance.

---

#### 1.2 Add Relevance Scores to Context
**File:** `backend/src/ai/llm/prompts.ts`

**Current:**
```typescript
export function buildRAGContext(relevantMessages: MessageDTO[]): string {
  const contextLines = relevantMessages.map((msg) => {
    const timestamp = new Date(msg.createdAt).toLocaleString();
    const authorName = msg.author?.name || 'User';
    return `[${timestamp}] ${authorName}: ${msg.content}`;
  });
  // ...
}
```

**Change to:**
```typescript
export function buildRAGContext(
  relevantMessages: MessageDTO[], 
  scores: number[]
): string {
  const contextLines = relevantMessages.map((msg, idx) => {
    const timestamp = new Date(msg.createdAt).toLocaleString();
    const authorName = msg.author?.name || 'User';
    const relevance = Math.round(scores[idx] * 100);
    const relativeTime = getRelativeTime(msg.createdAt);
    
    return `[${relativeTime}, ${relevance}% relevant] ${authorName}: ${msg.content}`;
  });
  // ...
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
```

**Update `aiAgentController.ts` to pass scores:**
```typescript
const { relevantMessages, totalResults } = await ragService.getRelevantContext(...);
const scores = relevantMessages.map(m => m.score || 0); // Add score to MessageDTO
ragContext = buildRAGContext(relevantMessages, scores);
```

**Rationale:** Showing relevance % and relative time helps LLM understand context importance and recency.

---

#### 1.3 Add Citation Support
**File:** `backend/src/ai/llm/prompts.ts`

**Add to system prompt:**
```typescript
assistantWithRAG: `You are an AI collaboration assistant with access to team conversation history.

When referencing past discussions in your response:
- Cite the source: "As discussed 2 days ago..."
- Mention the author if helpful: "As Alice mentioned..."
- Indicate confidence: "Based on a highly relevant past discussion (95% match)..."

Your role:
- Help teams by recalling past decisions and context
- Provide informed responses using conversation history
- Be transparent about what comes from past vs current conversation
...
`
```

**Rationale:** Encourages LLM to explicitly reference retrieved context, making responses more trustworthy.

---

## 2. RAG Verification & Testing (HIGH PRIORITY)

### Current Issues:
- No end-to-end test confirming @agent uses RAG context
- Backend logs show "🔍 Retrieved X relevant messages" not appearing
- Unknown if RAG actually improves responses

### Implementation Tasks:

#### 2.1 Create Comprehensive RAG Test Suite
**File:** `backend/test-rag-verification.js` (NEW)

**Test Cases:**
1. **Basic Retrieval Test**
   - Send message about topic A (e.g., "JWT authentication")
   - Wait for embedding
   - Ask @agent about topic A
   - Verify: Backend logs show RAG retrieval
   - Verify: Agent response mentions topic A details

2. **Team Scoping Test**
   - Send topic A to team1, topic B to team2
   - Ask @agent in team1 about topic A
   - Verify: Response includes team1 context only
   - Verify: No leakage of team2 context

3. **Recency vs Relevance Test**
   - Send old message (Day 1) about topic X
   - Send 20+ recent messages about other topics
   - Ask about topic X
   - Verify: RAG retrieves old message despite recency bias

4. **Similarity Threshold Test**
   - Ask question with no similar past messages
   - Verify: RAG returns 0 results gracefully
   - Verify: Agent still responds (doesn't crash)

5. **Multi-Message Context Test**
   - Send 3 related messages about same topic
   - Ask compound question requiring all 3
   - Verify: All 3 retrieved and used

**Success Criteria:**
- All tests pass
- Logs show RAG retrieval happening
- Agent responses demonstrably use retrieved context

---

#### 2.2 Add RAG Debugging Endpoint
**File:** `backend/src/index.ts`

**New Endpoint:**
```typescript
app.post('/api/debug/rag-search', async (req, res) => {
  const { query, teamId, topK = 5, minScore = 0.7 } = req.body;
  
  try {
    const { relevantMessages, totalResults, avgSimilarity } = 
      await ragService.getRelevantContext(query, teamId, topK, minScore);
    
    res.json({
      query,
      teamId,
      totalResults,
      avgSimilarity,
      threshold: minScore,
      messages: relevantMessages.map(m => ({
        id: m.id,
        content: m.content.substring(0, 100) + '...',
        author: m.author?.name,
        createdAt: m.createdAt,
        // Include score if available
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Usage:**
```bash
curl -X POST http://localhost:5000/api/debug/rag-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "JWT authentication",
    "teamId": "team1",
    "topK": 5,
    "minScore": 0.7
  }'
```

**Rationale:** Allows manual testing of RAG retrieval without triggering full agent flow.

---

## 3. Semantic Search Quality & Tuning (MEDIUM PRIORITY)

### Current Issues:
- Similarity threshold (0.7) is arbitrary
- No validation of result quality
- Small dataset (4 messages) insufficient for tuning

### Implementation Tasks:

#### 3.1 Backfill Existing Messages
**File:** `backend/backfill-embeddings.js` (EXISTS)

**Action:**
```bash
cd backend
node backfill-embeddings.js
```

**Expected:** Embed all 70+ existing messages for realistic testing.

---

#### 3.2 Implement Threshold Tuning
**File:** `backend/tune-similarity-threshold.js` (NEW)

**Algorithm:**
```javascript
// Test different thresholds: 0.5, 0.6, 0.7, 0.8, 0.9
// For each threshold:
//   - Run 10 test queries
//   - Measure: precision (are results relevant?), recall (did we miss relevant ones?)
// Recommend optimal threshold
```

**Manual Review:**
- Human evaluates whether top-5 results are actually relevant
- Adjust threshold based on false positives vs false negatives

**Outcome:** Data-driven threshold (e.g., 0.75 for balance)

---

#### 3.3 Add Relevance Score to MessageDTO
**File:** `packages/types/src/dtos.ts`

**Add:**
```typescript
export interface MessageDTO {
  // ... existing fields
  relevanceScore?: number; // RAG similarity score (0-1)
}
```

**Update `ragService.ts`:**
```typescript
const messageDTOs: MessageDTO[] = messages.map(msg => {
  const result = results.find(r => r.messageId === msg.id)!;
  return {
    // ... existing mapping
    relevanceScore: result.score,
  };
});
```

**Rationale:** Allows frontend to show relevance indicators, helps with debugging.

---

## 4. Edge Case Handling & Resilience (MEDIUM PRIORITY)

### Current Issues:
- No fallback if Pinecone is down
- Unclear behavior if embedding fails
- No retry logic for transient failures

### Implementation Tasks:

#### 4.1 Add RAG Fallback Logic
**File:** `backend/src/controllers/aiAgentController.ts`

**Current:**
```typescript
try {
  const isRAGReady = await ragService.healthCheck();
  if (isRAGReady) {
    // ... get RAG context
  }
} catch (error) {
  console.warn('[AI Agent] RAG context retrieval failed, continuing without:', error);
}
```

**Enhance:**
```typescript
let ragContext = '';
let ragStatus = 'disabled';

try {
  const isRAGReady = await ragService.healthCheck();
  
  if (isRAGReady) {
    const { relevantMessages, totalResults } = await ragService.getRelevantContext(...);
    
    if (totalResults > 0) {
      ragContext = buildRAGContext(relevantMessages);
      ragStatus = 'active';
      console.log(`[AI Agent] 🔍 Retrieved ${totalResults} relevant messages`);
    } else {
      ragStatus = 'no_results';
      console.log(`[AI Agent] 📭 No relevant context found (threshold: 0.7)`);
    }
  } else {
    ragStatus = 'service_unavailable';
    console.warn('[AI Agent] ⚠️  RAG service unhealthy, continuing without context');
  }
} catch (error) {
  ragStatus = 'error';
  console.error('[AI Agent] ❌ RAG retrieval failed:', error);
  // Continue without RAG - don't fail the entire request
}

// Include status in metadata for debugging
metadata.ragStatus = ragStatus;
```

**Rationale:** Graceful degradation - agent works even if RAG fails.

---

#### 4.2 Add Pinecone Circuit Breaker
**File:** `backend/src/services/pineconeService.ts`

**Add:**
```typescript
class PineconeService {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private circuitOpen: boolean = false;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT = 60000; // 1 minute

  async queryVectors(...): Promise<SearchResult[]> {
    // Check circuit breaker
    if (this.circuitOpen) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure < this.RESET_TIMEOUT) {
        console.warn('[Pinecone] ⚠️  Circuit breaker open, skipping query');
        return [];
      } else {
        // Try to reset
        this.circuitOpen = false;
        this.failureCount = 0;
        console.log('[Pinecone] 🔄 Circuit breaker reset, attempting query');
      }
    }

    try {
      // ... existing query logic
      
      // Reset failure count on success
      this.failureCount = 0;
      return results;
      
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.FAILURE_THRESHOLD) {
        this.circuitOpen = true;
        console.error('[Pinecone] ⚠️  Circuit breaker OPEN (5 failures)');
      }
      
      throw error;
    }
  }
}
```

**Rationale:** Prevents cascading failures if Pinecone is down.

---

#### 4.3 Add Embedding Worker Dead Letter Queue
**File:** `backend/src/workers/embeddingWorker.ts`

**Add:**
```typescript
worker.on('failed', async (job, error) => {
  console.error(`[EmbeddingWorker] ❌ Job ${job?.id} failed:`, error.message);
  
  // If max retries exceeded, log to dead letter queue
  if (job && job.attemptsMade >= 3) {
    await prisma.failedEmbeddingJob.create({
      data: {
        messageId: job.data.messageId,
        error: error.message,
        attempts: job.attemptsMade,
        failedAt: new Date(),
      },
    });
    console.error(`[EmbeddingWorker] 💀 Job moved to dead letter queue: ${job.data.messageId}`);
  }
});
```

**Database Schema:**
```prisma
model FailedEmbeddingJob {
  id        String   @id @default(uuid())
  messageId String
  error     String
  attempts  Int
  failedAt  DateTime @default(now())
  
  @@index([messageId])
}
```

**Rationale:** Track persistent failures for manual investigation.

---

## 5. Semantic Chime Rules (LOW PRIORITY)

### Current Issues:
- `chimeRulesEngine.ts` has placeholder for semantic rules
- Vector similarity detection not implemented
- Autonomous AI interventions based on RAG not working

### Implementation Tasks:

#### 5.1 Implement Semantic Rule Evaluation
**File:** `backend/src/ai/agent/chimeRulesEngine.ts`

**Current (Placeholder):**
```typescript
private async evaluateSemanticRule(rule: ChimeRule, context: EvaluationContext): Promise<boolean> {
  // TODO: Implement semantic similarity check using vector search
  console.log(`[ChimeEvaluator] Semantic rule evaluation not yet implemented: ${rule.name}`);
  return false;
}
```

**Implement:**
```typescript
private async evaluateSemanticRule(rule: ChimeRule, context: EvaluationContext): Promise<boolean> {
  if (!rule.conditions.semanticQuery) {
    return false;
  }

  try {
    // Get recent messages in window
    const recentMessages = context.recentMessages.slice(-rule.conditions.timeWindow || -10);
    
    // Check each recent message for semantic similarity
    for (const msg of recentMessages) {
      const { relevantMessages, avgSimilarity } = await ragService.getRelevantContext(
        rule.conditions.semanticQuery,
        context.teamId,
        3, // Top 3
        rule.conditions.semanticThreshold || 0.85 // Higher threshold for chimes
      );
      
      if (relevantMessages.length > 0 && avgSimilarity > (rule.conditions.semanticThreshold || 0.85)) {
        console.log(`[ChimeEvaluator] ✅ Semantic match for "${rule.name}" (similarity: ${avgSimilarity.toFixed(2)})`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[ChimeEvaluator] Semantic evaluation error:', error);
    return false;
  }
}
```

---

#### 5.2 Add Semantic Chime Rules
**File:** `backend/src/seed-data/chimeRules.json` (or DB seed)

**Example Rules:**
```json
{
  "id": "semantic-001",
  "name": "Repeated Question Detector",
  "type": "semantic",
  "priority": "medium",
  "cooldownMinutes": 30,
  "conditions": {
    "semanticQuery": "How do I...", 
    "semanticThreshold": 0.85,
    "messageCount": 2,
    "timeWindow": 10
  },
  "action": {
    "type": "insight",
    "insightType": "suggestion",
    "template": "It looks like this question has been asked before. Based on past discussions, here's what the team decided..."
  }
}
```

**Rationale:** Proactively surface answers when similar questions are asked.

---

## 6. Performance & Monitoring (LOW PRIORITY)

### Implementation Tasks:

#### 6.1 Add RAG Performance Metrics
**File:** `backend/src/services/ragService.ts`

**Track:**
- Average retrieval time
- Cache hit rate (if caching added)
- Average result count
- Query frequency

**Endpoint:**
```typescript
app.get('/api/stats/rag', (req, res) => {
  res.json({
    totalQueries: ragService.getTotalQueries(),
    avgRetrievalTime: ragService.getAvgRetrievalTime(),
    avgResultCount: ragService.getAvgResultCount(),
    cacheHitRate: ragService.getCacheHitRate(),
  });
});
```

---

#### 6.2 Add Result Caching
**File:** `backend/src/services/ragService.ts`

**Add:**
```typescript
private queryCache = new Map<string, { results: RAGContext; timestamp: number }>();
private readonly CACHE_TTL = 300000; // 5 minutes

async getRelevantContext(...): Promise<RAGContext> {
  const cacheKey = `${query}:${teamId}:${topK}:${minScore}`;
  
  // Check cache
  const cached = this.queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
    console.log('[RAGService] 💾 Cache hit');
    return cached.results;
  }
  
  // Query Pinecone
  const results = await this.performQuery(...);
  
  // Cache results
  this.queryCache.set(cacheKey, { results, timestamp: Date.now() });
  
  return results;
}
```

**Rationale:** Reduce Pinecone API calls for repeated queries.

---

## Summary Checklist

### High Priority (Phase 5 Core):
- [ ] 1.1 Inject RAG as system message
- [ ] 1.2 Add relevance scores to context
- [ ] 1.3 Add citation support to prompts
- [ ] 2.1 Create comprehensive RAG test suite
- [ ] 2.2 Add RAG debugging endpoint
- [ ] 3.1 Backfill existing messages

### Medium Priority (Productionization):
- [ ] 3.2 Implement threshold tuning
- [ ] 3.3 Add relevance score to MessageDTO
- [ ] 4.1 Add RAG fallback logic
- [ ] 4.2 Add Pinecone circuit breaker
- [ ] 4.3 Add dead letter queue for failed embeddings

### Low Priority (Advanced Features):
- [ ] 5.1 Implement semantic rule evaluation
- [ ] 5.2 Add semantic chime rules
- [ ] 6.1 Add RAG performance metrics
- [ ] 6.2 Add result caching

---

## Success Criteria

Phase 5 is complete when:
1. ✅ End-to-end RAG test passes (agent uses retrieved context)
2. ✅ RAG context is clearly marked as important in LLM prompts
3. ✅ Team scoping verified (no cross-team leakage)
4. ✅ Edge cases handled (no crashes when Pinecone down)
5. ✅ Similarity threshold tuned with real data
6. ✅ All 70+ messages embedded and searchable
7. ✅ Semantic chime rules functional (optional)

---

**Estimated Effort:** 2-3 days  
**Assigned To:** AI Coding Agent  
**Next Phase:** Phase 6 (TBD - possibly Authentication or Code Analysis)
