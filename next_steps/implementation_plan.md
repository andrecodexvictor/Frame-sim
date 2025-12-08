# Implementation Plan - Agentic Transformation

## Goal Description
Transform `Frame-sim-main` into a robust Agentic Application (Maturity Lvl 3-4) by implementing Multi-LLM routing, the ACE framework structure, and operational metrics.

## User Review Required
> [!IMPORTANT]
> **API Keys**: Access to OpenAI (GPT-4) and DeepSeek API keys will be required for the Multi-LLM strategy.

## Proposed Changes

### RAG Backend (`Frame-sim/RAG/src`)

#### [MODIFY] `RAG/src/main.ts` (or existing orchestrator)
- Refactor to integrate `SmartRouter`.

#### [NEW] `RAG/src/services/SmartRouter.ts`
- Logic to route prompts to Gemini, GPT, or DeepSeek based on complexity/cost.

#### [NEW] `RAG/src/agents/CriticAgent.ts`
- Implements ACE "Cognitive Control" layer.
- Reviews outputs from `PersonaAgent` and `ROICalculator`.

#### [NEW] `RAG/src/services/LLMProvider.ts`
- Abstract interface for different LLM vendors.

### Frontend (`Frame-sim`)

#### [MODIFY] `App.tsx` / `components`
- Update UI to show "Agentic Reasoning" (e.g., "Thinking...", "Critiquing...").
- Display new metrics (Quality, Latency, Cost).

## Verification Plan

### Automated Tests
- Unit tests for `SmartRouter` logic.
- Mock LLM responses to test failure/retry loops (Self-Correction).

### Manual Verification
- Run a simulation and observe the logs for "Switching to GPT-4 for complex reasoning" or "Critic rejected output".
