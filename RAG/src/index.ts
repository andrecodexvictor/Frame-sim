/**
 * RAG Simulation System - Main Exports
 */

// Types
export * from './types/index.js';

// Services
export { QueryRouter, classifyQuery } from './services/queryRouter.js';
export { DocumentLoader, documentLoader, type LoadedDocuments } from './services/documentLoader.js';
export { VectorStoreService, createVectorStore, type SearchResult, type HybridSearchOptions } from './services/vectorStore.js';

// Agents
export { PersonaAgent } from './agents/personaAgent.js';
export { GoalAgent } from './agents/GoalAgent.js';
export { ROICalculatorAgent } from './agents/roiCalculator.js';
export { OrchestratorAgent, createOrchestrator } from './agents/orchestrator.js';

