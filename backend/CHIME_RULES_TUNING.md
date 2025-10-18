# 🎛️ Chime Rules Tuning - Anti-Spam Updates

## Problem
Chime rules were too aggressive, causing:
1. **Multiple consecutive agent messages** on a single user message
2. **Both reactive (@agent) and autonomous (chime) responses** triggering simultaneously
3. **Multiple insights generated** for one message
4. **Infinite loops** when agent's own messages triggered more chimes
5. **Overly sensitive patterns** (e.g., single word "urgent" or "stuck")

---

## ✅ Fixes Applied

### 1. **Prevent Infinite Loops**
**File: `backend/src/controllers/aiAgentController.ts`**

Added guard to skip agent's own messages:
```typescript
// 🚨 CRITICAL: Skip AI agent messages to prevent infinite loops
if (message.authorId === 'agent') {
  console.log(`[AI Agent] Skipping agent's own message to prevent loops`);
  return;
}
```

**Impact:** Agent no longer evaluates its own responses, preventing cascade effects.

---

### 2. **Separate Reactive and Autonomous Modes**
**File: `backend/src/controllers/aiAgentController.ts`**

Changed logic to be mutually exclusive:
- **If `@agent` mentioned** → Reactive mode ONLY (skip chime evaluation)
- **If NOT `@agent` mentioned** → Chime evaluation ONLY

```typescript
if (hasAgentMention) {
  // Handle @agent mention (reactive mode)
  // ... generate response, post message
  
  // ⚠️ IMPORTANT: Skip chime evaluation
  console.log(`[AI Agent] Skipping chime evaluation due to @agent mention`);
  return;
}

// Only evaluate chimes if NOT an @agent mention
await this.evaluateChimeRules(message, messages);
```

**Impact:** User won't get spammed with both a chat response AND an insight for the same message.

---

### 3. **Execute Only Highest Priority Rule**
**File: `backend/src/controllers/aiAgentController.ts`**

Changed from executing ALL triggered rules to ONLY the top one:

```typescript
// 🚨 ANTI-SPAM: Only execute the HIGHEST PRIORITY rule
const topDecision = decisions[0];

if (decisions.length > 1) {
  console.log(`[AI Agent] ⚠️  Multiple rules triggered, executing only highest priority: ${topDecision.rule.name}`);
  console.log(`[AI Agent] 🔕 Skipped rules: ${decisions.slice(1).map(d => d.rule.name).join(', ')}`);
}

await this.executeChime(topDecision, messages);
```

**Impact:** Maximum of ONE insight/message per user message (not 3-4 like before).

---

### 4. **Increased Cooldown Periods**
**File: `backend/src/ai/agent/defaultRules.ts`**

Adjusted all rule cooldowns to be more conservative:

| Rule | Old Cooldown | New Cooldown | Change |
|------|--------------|--------------|--------|
| Decision Detector | 30 min | **60 min** | +100% |
| Action Commitment | 15 min | **30 min** | +100% |
| Confusion | 10 min | **20 min** | +100% |
| Knowledge Gap | 60 min | **120 min** | +100% |
| Problem Detector | 20 min | **45 min** | +125% |
| Urgency Alert | 60 min | **120 min** | +100% |
| Question Overload | 30 min | **60 min** | +100% |

**Impact:** Rules can't spam the same insight type repeatedly.

---

### 5. **Tightened Pattern Matching**
**File: `backend/src/ai/agent/defaultRules.ts`**

Made patterns more specific to reduce false positives:

#### Decision Detector
✅ **No changes** - already specific

#### Action Commitment
**Before:**
```typescript
patterns: [
  '(I\'ll|I\\s+will)\\s+.+\\s+by\\s+(tomorrow|friday|monday|next\\s+week)',
  'deadline\\s+(is|set\\s+for)',
  'will\\s+(finish|complete|deliver)',  // ❌ Too broad!
  'responsible\\s+for'  // ❌ Too broad!
]
```

**After:**
```typescript
patterns: [
  '(I\'ll|I\\s+will)\\s+.+\\s+by\\s+(tomorrow|friday|monday|tuesday|wednesday|thursday|next\\s+week|\\d{4}-\\d{2}-\\d{2})',
  'deadline\\s+(is|set\\s+for|on)',
  'will\\s+(finish|complete|deliver).+by',  // ✅ Requires "by" (deadline)
  'I\'ll\\s+take\\s+(care\\s+of|on).+by'  // ✅ Requires "by"
]
// Removed: 'responsible\\s+for' (too generic)
```

#### Confusion Intervention
**Before:** `messageCount: 2` (2 confusion signals)
**After:** `messageCount: 3` (need more evidence)
**Before:** `timeWindow: 5` (5 minutes)
**After:** `timeWindow: 10` (10 minutes)

#### Problem Detector
**Before:**
```typescript
patterns: [
  '(stuck|blocked)\\s+on',
  '(issue|problem)\\s+with',  // ❌ Too broad!
  '(error|bug|crash)',  // ❌ Single word triggers
  'not\\s+working',  // ❌ Very common phrase
]
```

**After:**
```typescript
patterns: [
  '(stuck|blocked)\\s+on',
  '(serious|critical)\\s+(issue|problem|bug)',  // ✅ Requires severity
  'keep\\s+getting\\s+(error|bug)',  // ✅ Requires repeated issue
  'can\'t\\s+get\\s+.+\\s+to\\s+work',  // ✅ More specific
  'nothing\\s+(works|is\\s+working)'  // ✅ Strong signal
]
// Removed: Generic 'error', 'bug', 'not working'
```
**Also:** `messageCount: 2` and `timeWindow: 15` (need multiple messages about same problem)

#### Urgency Alert
**Before:**
```typescript
patterns: [
  'urgent',  // ❌ Single word!
  'ASAP',
  'deadline\\s+(today|tomorrow)',  // ❌ Too common
  'time\\s+critical'
]
```

**After:**
```typescript
patterns: [
  'urgent.+(deadline|task|issue)',  // ✅ Requires context
  'ASAP',  // ✅ Kept - strong signal
  'as\\s+soon\\s+as\\s+possible',
  'by\\s+(EOD|end\\s+of\\s+day|end\\s+of\\s+week)',  // ✅ More specific
  'critical.+(deadline|task)',  // ✅ Requires context
  'emergency'  // ✅ Strong signal
]
// Removed: Generic 'urgent', 'deadline today/tomorrow'
```

---

### 6. **Disabled Noisy Rules**
**File: `backend/src/ai/agent/defaultRules.ts`**

Disabled rules that triggered too often:

1. **Knowledge Gap Detector** (`enabled: false`)
   - Reason: Keywords like "what is", "explain" are very common in normal chat
   - Can be re-enabled if team wants educational insights

2. **Question Overload** (`enabled: false`)
   - Reason: Threshold-based rule (8 messages in 15min) triggers on normal conversations
   - Needs better question detection (counting '?') before enabling

**Current Active Rules:** 5 out of 8
- ✅ Decision Detector
- ✅ Action Commitment Tracker
- ✅ Confusion Intervention
- ❌ Knowledge Gap (disabled)
- ✅ Problem Detector
- ❌ Daily Summary (disabled - needs cron)
- ✅ Urgency Alert
- ❌ Question Overload (disabled)

---

## 📊 Before vs After Behavior

### Scenario 1: User sends "I'm stuck on this bug"

**Before:**
1. ❌ Chime evaluates → Problem Detector triggers
2. ❌ Creates insight: "Problem/Blocker Detected"
3. ❌ If user also said "@agent", reactive mode also triggers
4. ❌ Agent posts chat message too
5. ❌ Result: 2 responses (insight + message)

**After:**
1. ✅ Pattern check: "stuck on" matches BUT needs 2 messages in 15min
2. ✅ No trigger (only 1 message so far)
3. ✅ If user says "@agent stuck on bug":
   - Reactive mode handles it
   - Chime evaluation skipped
4. ✅ Result: 1 response only

---

### Scenario 2: User sends "Let's go with option A" and "I'll implement it by Friday"

**Before:**
1. ❌ Message 1 triggers Decision Detector
2. ❌ Message 2 triggers Action Commitment Tracker
3. ❌ Both execute → 2 insights created
4. ❌ If cooldown expired, can trigger again in 15-30 min

**After:**
1. ✅ Message 1 triggers Decision Detector
2. ✅ Message 2 triggers Action Commitment Tracker
3. ✅ Both decisions sorted by priority (both 'high')
4. ✅ Only first one executes → 1 insight created
5. ✅ Second insight skipped (logged but not created)
6. ✅ Cooldown now 60min minimum

---

### Scenario 3: Agent responds, user asks follow-up

**Before:**
1. ❌ Agent posts response message
2. ❌ Agent message triggers chime evaluation
3. ❌ If agent said "this is urgent", Urgency rule triggers
4. ❌ Agent creates insight about its own message
5. ❌ Infinite loop risk!

**After:**
1. ✅ Agent posts response message
2. ✅ Agent message skipped: `authorId === 'agent'`
3. ✅ No chime evaluation on agent messages
4. ✅ No infinite loops

---

## 🧪 Testing the Changes

### Test 1: @agent Mention (Should NOT trigger chimes)
```
User: "@agent explain how chime rules work"
```
**Expected:**
- ✅ Agent responds in chat (reactive mode)
- ✅ No insight created
- ✅ Log: "Skipping chime evaluation due to @agent mention"

---

### Test 2: Decision Pattern (Should trigger ONCE with longer cooldown)
```
User: "Let's go with PostgreSQL for the database"
```
**Expected:**
- ✅ Decision Detector triggers
- ✅ Creates ONE insight
- ✅ Cooldown: 60 minutes (not 30)

---

### Test 3: Multiple Rules Match (Should execute highest priority only)
```
User: "This is urgent! I'm stuck on a critical bug with the API"
```
**Triggers:**
- Urgency Alert (critical priority)
- Problem Detector (high priority)

**Expected:**
- ✅ Only Urgency Alert executes (higher priority)
- ✅ Log: "Skipped rules: Problem/Blocker Detected"
- ✅ ONE insight created (not two)

---

### Test 4: Agent Message (Should be ignored)
```
Agent: "Based on the error log, try updating your dependencies"
```
**Expected:**
- ✅ Message saved to database
- ✅ Broadcasted to chat
- ✅ Chime evaluation skipped
- ✅ Log: "Skipping agent's own message to prevent loops"

---

### Test 5: Weak Signal (Should NOT trigger)
```
User: "I got an error earlier but I fixed it"
```
**Before:** Would trigger Problem Detector (pattern: 'error')
**After:**
- ✅ Pattern doesn't match (needs 'keep getting error' or 'stuck on')
- ✅ No chime triggered
- ✅ No spam

---

## 🔧 Fine-Tuning Rules (How To)

### Via Database (Prisma Studio)
```powershell
cd backend
npx prisma studio
```
Navigate to `ChimeRule` table and edit:
- `enabled`: true/false to toggle rules
- `cooldownMinutes`: Adjust spam prevention
- `conditions`: Edit JSON patterns
- `priority`: Change execution order

### Via API
```powershell
# Disable a rule
Invoke-WebRequest -Uri "http://localhost:5000/api/chime/rules/<ruleId>/toggle" `
  -Method PATCH `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"enabled": false}'

# Update cooldown
Invoke-WebRequest -Uri "http://localhost:5000/api/chime/rules/<ruleId>" `
  -Method PATCH `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"cooldownMinutes": 90}'
```

### Reseed with New Rules
```powershell
# Delete old rules
npx prisma studio
# Delete all ChimeRule entries

# Reseed with updated rules
Invoke-WebRequest -Uri "http://localhost:5000/api/chime/rules/seed" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"teamId": "team1"}'
```

---

## 📋 Recommended Rule Configuration

### For Small Teams (2-5 people)
- **Enable:** Decision, Action Commitment, Urgency
- **Disable:** Confusion, Problem, Knowledge Gap, Question Overload
- **Cooldowns:** 60-120 minutes

### For Active Teams (6-15 people)
- **Enable:** Decision, Action Commitment, Problem, Urgency
- **Disable:** Confusion, Knowledge Gap, Question Overload
- **Cooldowns:** 30-60 minutes

### For Large Teams (15+ people)
- **Enable:** All except Knowledge Gap, Question Overload
- **Disable:** Knowledge Gap (too noisy), Question Overload (needs better logic)
- **Cooldowns:** 45-90 minutes

### For Testing/Demo
- **Enable:** All rules temporarily
- **Cooldowns:** 5-10 minutes (for quick testing)
- **Remember to reset** after demo!

---

## 🎯 Summary of Changes

✅ **No infinite loops** - Agent messages ignored
✅ **No double responses** - Reactive XOR autonomous
✅ **Maximum 1 chime per message** - Highest priority only
✅ **2-4x longer cooldowns** - Less spam
✅ **Tighter patterns** - Fewer false positives
✅ **2 rules disabled** - Noise reduction
✅ **Higher thresholds** - Need more evidence to trigger

**Result:** Chime rules now act as a helpful assistant, not a spammy bot!

---

**Last Updated:** October 19, 2025  
**Config Version:** v2.0 (Anti-Spam)
