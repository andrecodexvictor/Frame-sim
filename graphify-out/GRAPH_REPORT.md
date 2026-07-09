# Graph Report - Frame-sim  (2026-07-08)

## Corpus Check
- 85 files · ~336,053 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 806 nodes · 1276 edges · 45 communities (41 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cbbe8234`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `VectorStoreService` - 24 edges
2. `OrchestratorAgent` - 22 edges
3. `SimulationConfig` - 18 edges
4. `compilerOptions` - 16 edges
5. `SimulationConfig` - 16 edges
6. `🧠 Funções-Chave` - 16 edges
7. `ROICalculatorAgent` - 15 edges
8. `PersonaProfile` - 15 edges
9. `compilerOptions` - 15 edges
10. `runSimulation()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `runSimulation()` --calls--> `hashString()`  [INFERRED]
  services/geminiService.ts → RAG/src/core/employeeBrainCore.ts
- `runSimulation()` --calls--> `simulateTeamOffline()`  [INFERRED]
  services/geminiService.ts → RAG/src/core/employeeBrainCore.ts
- `BatchResultsChartProps` --references--> `BatchResult`  [EXTRACTED]
  components/BatchResultsChart.tsx → services/batchService.ts
- `BatchSimulationPanelProps` --references--> `SimulationConfig`  [EXTRACTED]
  components/BatchSimulationPanel.tsx → types.ts
- `UploadSectionProps` --references--> `FrameworkInput`  [EXTRACTED]
  components/UploadSection.tsx → types.ts

## Import Cycles
- None detected.

## Communities (45 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (36): GoalAgent, GRAVE_DECISION_TYPES, OrchestratorAgent, COGNITIVE_BIASES, loadArchetypeExamples(), PersonaAgent, aggregate(), AggregateResult (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (55): Step, BatchResultsChart(), BatchResultsChartProps, BatchSimulationPanel(), BatchSimulationPanelProps, ComparisonDashboard(), ComparisonDashboardProps, ARCHETYPES (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (38): getApiKeys(), getNextApiKey(), runSimulationWithDeepSeek(), runSimulationWithOpenAI(), runSimulation(), SIMULATION_SCHEMA, CalculatedMetrics, calculateFrameworkFit() (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (18): CriticAgent, AgentRacingService, MetricsService, SelfImprovementService, AgentConfig, AgenticMetrics, AgentResult, BatchSummary (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (7): DocumentAgent, DocumentDigest, getDocumentAgent(), LargeDocumentResult, IndexingResult, SearchResult, UserFrameworkStore

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (31): dependencies, chromadb, chromadb-default-embed, cors, dotenv, express, langchain, @langchain/community (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (47): 10. Grafo do Código, 1. Visão Geral, 2. Fluxo Standard (browser-only), 3. Fluxo Agentic (backend Node), 4. Pipeline RAG, 5. Multi-LLM, 6. Modelo Matemático Determinístico, 7. EmployeeBrain (+39 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (10): CritiqueResult, GeminiProvider, LLMFactory, LLMModel, LLMProvider, LLMResponse, OllamaProvider, OpenAICompatibleProvider (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (24): 1. Gemini 2.0 + Deep Research, 2. MCP (Model Context Protocol), 3. Agentes Autônomos (Computer Use), 4. Fine-tuning Domain-Specific, 5. Multimodalidade, 6. Voice Interface, Análise Competitiva, 🎓 Destaques para TCC (+16 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (23): dependencies, @google/genai, lucide-react, mammoth, pdfjs-dist, react, react-dom, react-hook-form (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (20): 5. DocumentAgent, 6. SelfImprovementService, 7. AgentRacingService, 8. SmartChunker, 9. UserFrameworkStore, Arquitetura Agentic v7.0, Arquivos Modificados, Changelog (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (21): 10. `UserFrameworkStore.generateContext()` — Dynamic RAG for User Docs, 1. `runSimulation()` — Core Simulation Engine, 2. `runEnhancedBatchSimulation()` — Advanced Workflow Orchestrator, 3. `DocumentAgent.digest()` — Intelligent Document Ingestion, 4. `SelfImprovementService.runWarmup()` — Auto-Calibration, 5. `AgentRacingService.race()` — Competitive Multi-Agent, 6. `calculateMonthlyMetrics()` — Deterministic Financial Engine, 6b. `calculateSurpriseFactor()` — Exceptional Adaptation Detector (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (7): ChunkingResult, ChunkMetadata, DocumentChunk, DocumentStructure, FRAMEWORK_KEYWORDS, SmartChunker, STRUCTURE_PATTERNS

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (7): ChunkingResult, ChunkMetadata, DocumentChunk, DocumentStructure, FRAMEWORK_KEYWORDS, SmartChunker, STRUCTURE_PATTERNS

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (15): 1. Scenario Validity (Realismo do Cenário), 2. CriticAgent Plausibility Score, 3. Mecanismos de Validação, Agent Racing, 🔬 Componentes de Validação, CriticAgent, 📈 Cálculo Detalhado da Acurácia, 🎯 Estimativa de Acurácia por Modo (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (14): 1.1. Arquitetura Multi-LLM e Orquestração Inteligente, 1.2. Framework ACE (Autonomous Cognitive Entities), 1.3. Métricas de Sucesso Além do ROI, 1. Introdução e Análise Conceitual, 2. Análise de Realismo: Manipulação vs. Simulação Realista, 3.1. Fase 1: Base Arquitetural e Auto-Crítica (Prioridade Alta), 3.2. Fase 2: Realismo, Memória e Complexidade Emergente (Prioridade Média), 3.3. Fase 3: Autonomia, Escala e Generalização (Prioridade Baixa) (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (14): Automated Tests, Frontend (`Frame-sim`), Goal Description, Implementation Plan - Agentic Transformation, Manual Verification, [MODIFY] `App.tsx` / `components`, [MODIFY] `RAG/src/main.ts` (or existing orchestrator), [NEW] `RAG/src/agents/CriticAgent.ts` (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (13): 1. Variáveis Base (Adaptáveis por PME/Enterprise), 2.1. Custo Operacional (OpEx), 2.2. Valor Entregue (Value), 2.3. Custo da Não-Qualidade (CoNQ), 2.4. ROI (Retorno sobre Investimento), 2. Fórmulas de Cálculo, 3. Modificadores de Cenário, 4. Adaptação para PMEs (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (11): 1. Fase 1: Base Arquitetural e Auto-Crítica (Concluída/Em Andamento), 2.1. Aprimoramento do Realismo (Persona e Stochasticity), 2.2. Implementação de Memória de Longo Prazo (ACE), 2. Fase 2: Realismo, Memória e Complexidade Emergente, 3.1. Autonomia e Cognitive Control Avançado, 3.2. Escala e Generalização, 3. Fase 3: Autonomia, Escala e Generalização, 4.1. O Estado Atual: Simulação Controlada (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (10): 1. Objetivo da Fase 1, 2.1. Implementação do Smart Router (Multi-LLM), 2.2. Implementação do Padrão Self-Reflection (Cognitive Control), 2.3. Implementação das Métricas Agênticas, 2. Especificação Técnica Detalhada, 3.1. Análise do Problema (Causas Prováveis), 3.2. Proposta de Soluções para Aumentar o Realismo, 3. Análise de Realismo e Proposta de Solução (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (10): 1.1. Arquitetura Multi-LLM e Orquestração Inteligente, 1.2. Framework ACE (Autonomous Cognitive Entities), 1.3. Métricas de Sucesso Além do ROI, 1. Introdução e Análise Conceitual, 2. Análise de Realismo: Manipulação vs. Simulação Realista, 3.1. Fase 1: Base Arquitetural e Auto-Crítica (Prioridade Alta), 3.2. Fase 2: Realismo, Memória e Complexidade Emergente (Prioridade Média), 3.3. Fase 3: Autonomia, Escala e Generalização (Prioridade Baixa) (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (9): 1.1. Justificativa para o Multi-LLM, 1.2. O Papel do Orquestrador (Smart Router), 1. Arquitetura Multi-LLM e Orquestração Inteligente, 2. Adoção do Framework ACE (Autonomous Cognitive Entities), 3. Métricas de Sucesso Além do ROI, 4. Recomendação de Padrões de Design Agêntico, Análise e Recomendação para a Transformação Agêntica de Frameworks, Introdução (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.28
Nodes (6): SIMULATION_SCHEMA, CorporateArchetype, FrameworkInput, SimulationConfig, SimulationOutput, SingleSimulationConfig

### Community 26 - "Community 26"
Cohesion: 0.24
Nodes (8): BASE_VARIABLES, J_CURVE_FACTORS, ROICalculatorAgent, TECH_DEBT_MODIFIERS, ROIProjection, ROIResult, SimulationConfig, SimulationEvent

### Community 27 - "Community 27"
Cohesion: 0.20
Nodes (6): geminiModel(), classifyQuery(), QueryClassificationSchema, QueryRouter, QueryClassification, QueryMode

### Community 28 - "Community 28"
Cohesion: 0.53
Nodes (5): generate_ace_params(), generate_profile(), get_age_and_exp(), main(), Generates ACE (Attributes, Context, Execution) parameters for RAG optimization.

### Community 29 - "Community 29"
Cohesion: 0.40
Nodes (4): Agentic Engine, Frame-sim Principal examples, Main archteture, ROI calculator

### Community 33 - "Community 33"
Cohesion: 0.29
Nodes (13): createOrchestrator(), CONFIG, findPersonaFromQuery(), indexDocuments(), loadConfig(), loadProfiles(), main(), parseArgs() (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.22
Nodes (10): BIASES, compact, deriveBias(), djb2(), full, OUT, ROOT, RULES (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.20
Nodes (10): Agentes (`RAG/src/agents/`), Arquivos-chave, Core (`RAG/src/core/`), Invariantes, Módulo: RAG Backend (`RAG/`), O que NÃO tocar, Pontos de entrada, Propósito (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (5): createVectorStore(), app, initVectorStore(), orchestrator, realPersonasById

### Community 38 - "Community 38"
Cohesion: 0.33
Nodes (3): Arquitetura — resumo, Diagrama de dependências entre módulos, Convenções do projeto

### Community 39 - "Community 39"
Cohesion: 0.29
Nodes (6): Arquivos-chave, Invariantes, Módulo: Frontend, O que NÃO tocar, Pontos de entrada, Propósito

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (7): Componentes do modelo, Implementado: EmployeeBrain, Invariante central, Invariantes, Módulo: Modelo de simulação (matemática determinística), O que NÃO tocar, Propósito

### Community 41 - "Community 41"
Cohesion: 0.52
Nodes (4): DATA_PATHS, LoadedDocuments, HybridSearchOptions, SearchResult

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (6): Comandos, Dois modos de execução, Frame-sim — índice de contexto, Mapa de módulos, Onde começar a ler, Variáveis de ambiente

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (5): Arquivos-chave, Invariantes, Módulo: Dados, O que NÃO tocar, Propósito

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (6): Arquivos-chave, Invariantes, Módulo: Services (frontend, `services/`), O que NÃO tocar, Pontos de entrada, Propósito

## Knowledge Gaps
- **360 isolated node(s):** `Step`, `name`, `version`, `description`, `type` (+355 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `hashString()` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `VectorStoreService` connect `Community 34` to `Community 0`, `Community 33`, `Community 37`, `Community 41`, `Community 26`, `Community 27`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `SimulationOutput` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `Step`, `Generates ACE (Attributes, Context, Execution) parameters for RAG optimization.`, `name` to the rest of the system?**
  _361 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08813559322033898 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.054414414414414414 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07123034227567067 - nodes in this community are weakly interconnected._