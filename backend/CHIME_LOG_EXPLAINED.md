# 📊 ChimeLog Explained - Purpose & Usage

## What is ChimeLog?

**ChimeLog** is a database table that tracks **every time a chime rule is evaluated and executed**. It's the audit trail and analytics system for autonomous AI behavior.

---

## 🎯 Purpose

### 1. **Audit Trail**
Track when and why the AI autonomously intervened:
- Which rule triggered
- What confidence level
- Which messages triggered it
- What insight/message was created
- Whether it succeeded or failed

### 2. **Debugging**
When chime rules misbehave:
- See which rules are triggering too often (spam)
- See which rules never trigger (dead rules)
- Identify false positives (low confidence triggers)
- Debug cooldown issues

### 3. **Analytics**
Understand AI agent behavior:
- Most frequently triggered rules
- Average confidence scores per rule
- Success vs error rate
- Time patterns (when rules trigger most)

### 4. **Cooldown Enforcement**
ChimeLog entries are used to:
- Check if a rule was recently triggered
- Enforce cooldown periods
- Prevent spam from same rule

---

## 📋 ChimeLog Schema

```prisma
model ChimeLog {
  id          String   @id @default(uuid())
  ruleId      String                           // Which rule triggered
  teamId      String                           // Which team
  triggeredAt DateTime @default(now())         // When it triggered
  outcome     String                           // 'success' | 'cooldown' | 'error'
  messageId   String?                          // If created a chat message
  insightId   String?                          // If created an insight
  confidence  Float?                           // Confidence score (0-1)
  errorMsg    String?                          // Error message if failed
  
  rule        ChimeRule @relation(...)         // Link to rule definition
}
```

---

## 🔍 What Gets Logged

### On Success
```typescript
{
  ruleId: 'decision-001',
  teamId: 'team1',
  outcome: 'success',
  confidence: 0.85,
  insightId: 'insight-abc123',  // Created insight
  messageId: null,
  errorMsg: null
}
```

### On Cooldown Skip
```typescript
{
  ruleId: 'problem-005',
  teamId: 'team1',
  outcome: 'cooldown',
  confidence: 0.72,
  insightId: null,
  messageId: null,
  errorMsg: 'Rule in cooldown period (last triggered 15min ago)'
}
```

### On Error
```typescript
{
  ruleId: 'urgency-007',
  teamId: 'team1',
  outcome: 'error',
  confidence: 0.91,
  insightId: null,
  messageId: null,
  errorMsg: 'LLM API rate limit exceeded'
}
```

---

## 📊 Real-World Example

### Scenario: User sends "Let's go with PostgreSQL"

**1. Rule Evaluation:**
```
[ChimeEvaluator] Rule triggered: Decision Detected (confidence: 0.85)
```

**2. Execution:**
```
[AI Agent] Executing chime: Decision Detected
[LLM] Generating response...
[AIInsightController] Created insight: insight-abc123
```

**3. ChimeLog Entry Created:**
```typescript
await ChimeRuleController.logChimeExecution({
  ruleId: 'decision-001',
  teamId: 'team1',
  outcome: 'success',
  confidence: 0.85,
  insightId: 'insight-abc123'
});
```

**4. Database Record:**
```
| id    | ruleId       | teamId | triggeredAt         | outcome | confidence | insightId     |
|-------|--------------|--------|---------------------|---------|------------|---------------|
| log-1 | decision-001 | team1  | 2025-10-19 10:30:00 | success | 0.85       | insight-abc123|
```

---

## 🔧 How It's Used in Code

### 1. Logging Execution (aiAgentController.ts)
```typescript
private static async executeChime(decision: ChimeDecision): Promise<void> {
  try {
    // ... generate LLM response, create insight/message
    
    // ✅ Log success
    await ChimeRuleController.logChimeExecution({
      ruleId: rule.id,
      teamId: teamId,
      outcome: 'success',
      confidence: confidence,
      insightId: createdInsight?.id,
      messageId: createdMessage?.id
    });
    
  } catch (error) {
    // ❌ Log failure
    await ChimeRuleController.logChimeExecution({
      ruleId: rule.id,
      teamId: teamId,
      outcome: 'error',
      confidence: confidence,
      errorMsg: error.message
    });
  }
}
```

### 2. Checking Cooldown (chimeRulesEngine.ts)
```typescript
private isInCooldown(rule: ChimeRule): boolean {
  const lastTrigger = this.lastChimeTimes.get(rule.id);
  if (!lastTrigger) return false;

  const cooldownMs = rule.cooldownMinutes * 60 * 1000;
  const timeSinceTrigger = Date.now() - lastTrigger.getTime();
  
  return timeSinceTrigger < cooldownMs;
}
```

**Note:** Currently cooldown is in-memory (Map). Could be enhanced to use ChimeLog:
```typescript
// Future: Check last successful log entry from database
const lastLog = await prisma.chimeLog.findFirst({
  where: { ruleId: rule.id, outcome: 'success' },
  orderBy: { triggeredAt: 'desc' }
});
```

### 3. Viewing Logs (API Endpoint)
```typescript
// GET /api/chime/teams/:teamId/chime-logs?limit=50
static async getChimeLogs(req, res) {
  const logs = await prisma.chimeLog.findMany({
    where: { teamId },
    orderBy: { triggeredAt: 'desc' },
    include: {
      rule: { select: { name: true, priority: true } }
    }
  });
  
  res.json(logs);
}
```

---

## 📈 Analytics Use Cases

### 1. Rule Performance Dashboard
```typescript
// Get rule trigger counts
SELECT ruleId, COUNT(*) as triggerCount
FROM ChimeLog
WHERE outcome = 'success'
GROUP BY ruleId
ORDER BY triggerCount DESC;

// Result:
// decision-001: 47 triggers
// urgency-007: 23 triggers
// problem-005: 12 triggers
```

### 2. False Positive Rate
```typescript
// Rules with low confidence but high trigger count
SELECT ruleId, AVG(confidence) as avgConfidence, COUNT(*) as triggers
FROM ChimeLog
WHERE outcome = 'success'
GROUP BY ruleId
HAVING avgConfidence < 0.6 AND triggers > 10;

// Result: Rules triggering often with low confidence (needs tuning)
```

### 3. Error Rate Monitoring
```typescript
// Check which rules are failing
SELECT ruleId, COUNT(*) as errorCount, 
       GROUP_CONCAT(DISTINCT errorMsg) as errors
FROM ChimeLog
WHERE outcome = 'error'
GROUP BY ruleId;

// Result: Rules with LLM errors, rate limits, etc.
```

### 4. Time Pattern Analysis
```typescript
// When do rules trigger most?
SELECT HOUR(triggeredAt) as hour, COUNT(*) as triggers
FROM ChimeLog
WHERE outcome = 'success'
GROUP BY hour
ORDER BY triggers DESC;

// Result: Peak hours for AI intervention
// 14:00 (2pm): 34 triggers
// 10:00 (10am): 28 triggers
// 16:00 (4pm): 21 triggers
```

---

## 🛠️ Admin Features (Future)

### ChimeLog Dashboard (Frontend)
```typescript
// components/Admin/ChimeLogsDashboard.tsx

// Show:
// - Live feed of chime triggers
// - Rule performance metrics
// - Confidence distribution charts
// - Error rate alerts
// - Cooldown timeline
```

### Rule Tuning Based on Logs
```typescript
// If Decision Detector has low confidence average:
// → Tighten patterns, increase threshold
// → Update rule in database

// If Urgency Alert never triggers:
// → Patterns too strict
// → Relax patterns or add more keywords
```

---

## 🚨 Current Bug in chimeRuleController.ts

The TypeScript errors you're seeing are **compilation errors**, not runtime bugs:

```
Property 'chimeLog' does not exist on type 'PrismaClient'
```

**Root Cause:** Prisma client hasn't been regenerated after adding ChimeLog model to schema.

**Fix:**
1. Stop backend server
2. Run: `npx prisma generate`
3. Restart server

The code itself is correct - TypeScript just doesn't know about the new models yet.

---

## ✅ Summary

**ChimeLog = Audit Trail for AI Autonomy**

| Aspect | Purpose |
|--------|---------|
| **What** | Records every chime rule execution |
| **Why** | Debugging, analytics, accountability |
| **When** | Every time a rule evaluates (success/cooldown/error) |
| **Where** | Database table, accessed via API |
| **Who** | Used by admins, developers, analytics |
| **How** | Logged via `ChimeRuleController.logChimeExecution()` |

**Key Benefits:**
- ✅ Transparency: See exactly when/why AI acted autonomously
- ✅ Debugging: Identify spam, dead rules, false positives
- ✅ Analytics: Understand AI behavior patterns
- ✅ Accountability: Audit trail of AI decisions

**Without ChimeLog:**
- ❌ Black box AI behavior
- ❌ No way to debug spam issues
- ❌ Can't tune rules based on data
- ❌ No audit trail for compliance

---

**Last Updated:** October 19, 2025
