# 🐛 Debugging Chime Rules - Step-by-Step Guide

## Issue
Messages sent to the chat don't trigger chime rules. No chime logs are created.

## Root Cause Found ✅
**The AI agent was never being called when messages were created!**

The message routes were missing the critical line to invoke the AI agent after creating a message.

## Fix Applied ✅

**File: `backend/src/routes/messageRoutes.ts`**

Added this code after message creation:

```typescript
// 🚨 CRITICAL: Trigger AI agent evaluation (reactive + chime rules)
AIAgentController.handleNewMessage(message).catch(error => {
  console.error('[MessageRoutes] Error in AI agent handling:', error)
})
```

This ensures every new message triggers:
1. **Reactive mode**: @agent mention detection
2. **Chime rules evaluation**: Pattern/threshold/hybrid rule checking

---

## How to Test

### Step 1: Ensure Server is Running

```powershell
cd backend
npm run dev
```

You should see:
```
✅ Server running on http://localhost:5000
✅ Socket.IO ready for connections
✅ Database connected
[MessageRoutes] ✅ Socket.IO instance configured
[AIAgentController] ✅ Socket.IO instance configured
```

### Step 2: Start Frontend (Optional)

```powershell
cd frontend
npm run dev
```

### Step 3: Send a Test Message

**Option A: Use the test script**
```powershell
cd backend
node testChime.js
```

**Option B: Use the frontend**
1. Open http://localhost:3000
2. Type: `Let's go with option A for the database design`
3. Send the message

**Option C: Use curl/Postman**
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/messages" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"teamId":"team1","authorId":"user1","content":"Let'\''s go with option A","contentType":"text"}'
```

### Step 4: Watch Backend Terminal Logs

You should see this sequence:

```
[MessageRoutes] 📤 Broadcasted message:new to team: team1
[AI Agent] Evaluating message <id> from user1
[AI Agent] 📝 Message content: "Let's go with option A for the database design"
[AI Agent] 📚 Total messages in context: X
[ChimeRuleController] 🔍 Fetching active rules for team: team1
[ChimeRuleController] 📊 Found 7 enabled rules from database
[ChimeRuleController] Rules breakdown:
  1. Decision Detector (pattern)
     - Patterns: 7
     - Keywords: 0
  2. Action Commitment Tracker (pattern)
     ...
[AI Agent] 📋 Found 7 active chime rules for team team1
[ChimeEvaluator] ✅ Rule triggered: Decision Detector (confidence: 0.XX)
[AI Agent] ✅ 1 chime rule(s) triggered
[AI Agent] 🎯 Executing chime: Decision Detector (confidence: 0.XX)
```

If you see chime rules triggered, the AI will then:
- Call the LLM with the rule's prompt
- Create an insight or message based on the rule action
- Log the execution to ChimeLog table

---

## Debug Checklist

If chime rules still don't trigger, check these in order:

### ✅ 1. Are Rules Seeded?

```powershell
# Check database
cd backend
npx prisma studio
# Navigate to ChimeRule table - should see 7 rules
```

Or via API:
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/chime/teams/team1/rules"
```

**Expected:** 7 rules (Decision Detector, Action Commitment, Confusion, etc.)

If no rules, seed them:
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/chime/rules/seed" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"teamId":"team1"}'
```

### ✅ 2. Is AI Agent Handler Called?

**Look for this log:**
```
[AI Agent] Evaluating message <id> from user1
```

If you DON'T see this, the fix wasn't applied. Check:
- `backend/src/routes/messageRoutes.ts` line ~60
- Should contain: `AIAgentController.handleNewMessage(message)`
- Restart server: `npm run dev`

### ✅ 3. Are Rules Being Fetched?

**Look for this log:**
```
[ChimeRuleController] 🔍 Fetching active rules for team: team1
[ChimeRuleController] 📊 Found X enabled rules from database
```

If you see "Found 0 enabled rules":
- Rules weren't seeded OR
- Rules are disabled OR
- Wrong teamId

### ✅ 4. Is Pattern Matching Working?

**Look for this log:**
```
[ChimeEvaluator] ✅ Rule triggered: <RuleName> (confidence: X.XX)
```

If rules are found but never triggered:
- Message content doesn't match any patterns
- Try exact test messages from the test suite
- Check rule conditions in database (Prisma Studio)

### ✅ 5. Is LLM Being Called?

**Look for this log:**
```
[AI Agent] 🎯 Executing chime: <RuleName> (confidence: X.XX)
[GitHubModelsClient] Generating with model: gpt-4o
```

If triggered but LLM not called:
- Check GitHub Models API key in `.env`
- `GITHUB_TOKEN=your_token_here`

### ✅ 6. Are Logs Being Created?

Check ChimeLog table:
```powershell
npx prisma studio
# Navigate to ChimeLog table
```

Or via API:
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/chime/teams/team1/chime-logs?limit=10"
```

---

## Test Messages That Should Trigger Rules

### Decision Detector (High Priority, 30min cooldown)
```
"Let's go with option A for the database design"
"We decided to use PostgreSQL instead"
"Final decision is to deploy on AWS"
```

### Action Commitment (High Priority, 15min cooldown)
```
"I'll finish the authentication module by Friday"
"Will complete the API endpoints by tomorrow"
"I'll take care of the deployment by next week"
```

### Confusion Intervention (Medium Priority, 10min cooldown)
**Requires 2+ messages:**
```
"I'm confused about how socket rooms work"
"What do you mean by team rooms?"
```

### Problem Solver (High Priority, 20min cooldown)
```
"I'm stuck on this TypeScript error"
"Keep getting a CORS issue and can't figure it out"
"This API endpoint is not working"
```

### Urgency Detector (Critical Priority, 5min cooldown)
**Requires 2+ messages in 3 minutes:**
```
"We need this feature ASAP!"
"This is urgent, the demo is tomorrow!"
```

### Question Clusterer (Medium Priority, 30min cooldown)
**Requires 3+ questions in 10 minutes:**
```
"What is a chime rule?"
"How do pattern detectors work?"
"What are the different rule types?"
```

---

## Expected Behavior

### When a Rule Triggers:

1. **Backend Logs:**
   - ✅ Rule triggered message
   - 🎯 Executing chime message
   - LLM generation logs
   - Insight/message creation logs
   - Socket broadcast logs

2. **Database Changes:**
   - New entry in `ChimeLog` table
   - New entry in `AIInsight` table (if action type is 'insight')
   - New entry in `Message` table (if action type is 'chat_message')

3. **Frontend Updates:**
   - New AI insight appears in right panel (if insight)
   - New agent message appears in chat (if chat_message)
   - Both appear (if action type is 'both')

### Cooldown System:

If you trigger the same rule twice quickly, second trigger is blocked:
```
[ChimeEvaluator] Rule Decision Detector is in cooldown, skipping
```

To test again, either:
- Wait for cooldown period (varies by rule: 5-60 minutes)
- Restart server (clears in-memory cooldown state)

---

## Common Issues & Solutions

### Issue: "No active chime rules for this team"
**Solution:** Seed rules with POST to `/api/chime/rules/seed`

### Issue: "AI Agent not responding"
**Solution:** Check `.env` has `GITHUB_TOKEN=...`

### Issue: "Rules triggered but no AI response"
**Solution:** Check GitHub Models API quota/status

### Issue: "Cannot read property 'chimeRule' of undefined"
**Solution:** Run `npx prisma generate` to regenerate Prisma client

### Issue: Rules trigger but wrong insight type
**Solution:** Check rule's `action.insightType` in database - should match one of: 'action', 'suggestion', 'analysis', 'summary'

---

## Advanced Debugging

### Enable Verbose Prisma Logging

Add to `backend/src/db.ts`:
```typescript
export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})
```

### Check Rule Conditions in Database

```sql
-- In Prisma Studio SQL console
SELECT id, name, type, enabled, conditions, action FROM ChimeRule WHERE enabled = 1;
```

### Manually Trigger Chime Evaluation

In backend console (Node REPL):
```javascript
const { AIAgentController } = await import('./dist/controllers/aiAgentController.js');
const { MessageController } = await import('./dist/controllers/messageController.js');

const messages = await MessageController.getMessages('team1');
const lastMessage = messages[messages.length - 1];

await AIAgentController.handleNewMessage(lastMessage);
```

---

## Success Indicators

✅ **Chime rules are working if you see:**

1. In terminal:
   ```
   [ChimeEvaluator] ✅ Rule triggered: Decision Detector (confidence: 0.75)
   [AI Agent] 🎯 Executing chime: Decision Detector
   ```

2. In database:
   - ChimeLog entries with `outcome: 'success'`
   - AIInsight entries with `tags` containing rule name

3. In frontend:
   - New insights appear in right panel
   - Agent messages appear in chat

---

## Next Steps After Debugging

Once chime rules work:

1. **Customize Rules:** Edit rules via API or Prisma Studio
2. **Add New Rules:** POST to `/api/chime/rules`
3. **Build Admin UI:** Create frontend for rule management
4. **Monitor Performance:** Check ChimeLog for false positives
5. **Adjust Patterns:** Fine-tune regex patterns in defaultRules.ts

---

**Last Updated:** October 19, 2025  
**Fix Applied:** Added `AIAgentController.handleNewMessage()` call to message routes
