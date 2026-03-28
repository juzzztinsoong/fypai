/**
 * Conversational Routing Guardrails
 *
 * Goal:
 * Validate that conversational prompts stay in chat pathway,
 * while explicit long-form requests route to insight pathway.
 *
 * Run with:
 *   npx tsx tests/test-conversational-routing-guardrails.ts
 */

import { IntentController } from '../src/controllers/intentController.js'

let passed = 0
let failed = 0

function assert(condition: boolean, name: string, details?: string): void {
  if (condition) {
    console.log(`PASS ${name}`)
    passed += 1
    return
  }

  console.log(`FAIL ${name}${details ? ` - ${details}` : ''}`)
  failed += 1
}

function assertEqual<T>(actual: T, expected: T, name: string): void {
  assert(actual === expected, name, `expected=${String(expected)} actual=${String(actual)}`)
}

async function run(): Promise<void> {
  console.log('\n=== Conversational Routing Guardrails ===')

  // 1) Plain conversational ask -> chat_message
  {
    const route = await IntentController.decideAgentRoute('can you explain this simply?')
    assertEqual(route.channel, 'chat_message', 'Conversational ask stays in chat channel')
  }

  // 2) Code request (current policy) -> chat_message
  // This guards the behavior seen in UI where code prompts can stay conversational.
  {
    const route = await IntentController.decideAgentRoute('could you come up with the code for a stock trading app?')
    assertEqual(route.channel, 'chat_message', 'Code request stays in chat channel by default')
  }

  // 3) Generic research mention -> chat_message (avoid over-routing)
  {
    const route = await IntentController.decideAgentRoute('do we need some research before proceeding?')
    assertEqual(route.channel, 'chat_message', 'Generic research mention remains conversational')
  }

  // 4) Explicit slash research command -> insight
  {
    const route = await IntentController.decideAgentRoute('/research compare market trend indicators and macro signals')
    assertEqual(route.channel, 'insight', 'Slash research command routes to insight')
    assertEqual(route.insightType, 'document', 'Slash research maps to document insight')
    assert(route.explicit, 'Slash command is explicit')
  }

  // 5) Explicit @agent research request with enough context -> insight
  {
    const route = await IntentController.decideAgentRoute(
      '@agent please research stock market changes over the last decade, compare major drivers, and propose practical options for forecasting decisions'
    )
    assertEqual(route.channel, 'insight', 'Explicit @agent long-form research routes to insight')
    assertEqual(route.insightType, 'document', 'Explicit long-form research maps to document insight')
    assert(route.explicit, '@agent long-form research is explicit')
  }

  // 6) Classifier mode check: code request should not force research mode by itself
  {
    const mode = await IntentController.classify('could you come up with the code for a stock trading app?')
    assertEqual(mode.mode, 'ask', 'Code request classification defaults to ask mode')
  }

  // 7) Conversational @agent help should stay chat, not explicit insight command
  {
    const route = await IntentController.decideAgentRoute('@agent help me out')
    assertEqual(route.channel, 'chat_message', 'Conversational @agent help remains chat')
    assert(!route.explicit, 'Conversational @agent help is not treated as explicit insight command')
  }

  console.log('\n=== Results ===')
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch((error) => {
  console.error('Fatal routing guardrail test failure:', error)
  process.exit(1)
})
