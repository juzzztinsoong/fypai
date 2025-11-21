# AI Architecture

This directory contains the core logic for the AI agent system.

## Structure

### `core/`
Shared utilities and infrastructure.
- `llm.ts`: Client for GitHub Models (Azure).
- `prompts.ts`: System prompts and context builders (RAG).

### `reactive/`
Logic for direct user interactions (e.g., `@agent` mentions).
- `reactiveRules.ts`: Rules for when the agent *must* respond to a user.

### `autonomous/`
Logic for proactive AI behavior (Chime).
- `chimeEngine.ts`: The evaluator that checks rules against conversation history.
- `detectors.ts`: Pattern matching utilities (regex, keywords).

### `rules/`
Rule definitions and management.
- `systemRules.ts`: Hardcoded default rules (e.g., Decision Detector).
- `ruleProvider.ts`: Service to fetch and merge system rules with team-specific DB overrides.

## Key Concepts

- **Reactive Mode**: Triggered by `@agent`. Bypasses most checks.
- **Autonomous Mode**: Triggered by message flow. Evaluated by `ChimeEvaluator`.
- **Rule Overriding**: Team rules in the database (same ID) override system defaults.
