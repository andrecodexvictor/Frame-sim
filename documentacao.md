# Sistema RAG Otimizado - Documentação Técnica v7.0

## Visão Geral

Este sistema implementa **RAG (Retrieval-Augmented Generation) otimizado** com LangChain.js para simulação de cenários empresariais, incluindo:

- **Self-RAG**: Query Router que decide automaticamente quando usar/ignorar retrieval
- **Hierarchical Retrieval**: Índices separados por tipo de documento
- **Multi-Agent (Agentic L4)**: Personas, CriticAgent, SmartRouter, cálculo de ROI e orquestração
- **Memória de Agente**: Scratchpad (curto prazo) + Vector History (longo prazo)
- **Self-Improvement (v7.0)**: Fase de warmup para auto-calibração de parâmetros
- **Agent Racing (v7.0)**: Concorrência de agentes com seleção de vencedor/ensemble

## Arquitetura Agentic v7.0

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER QUERY / BATCH                          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         ▼ (Batch Mode)                        ▼ (Single)
┌─────────────────────────┐           ┌─────────────────────────┐
│   SELF-IMPROVEMENT      │           │     AGENT RACING        │
│   (Warmup Phase)        │           │   (Parallel Agents)     │
│   - Test Params         │           │   ┌───┐ ┌───┐ ┌───┐     │
│   - CriticAgent Score   │           │   │A1 │ │A2 │ │A3 │     │
│   - Converge to Optimal │           │   └─┬─┘ └─┬─┘ └─┬─┘     │
└───────────┬─────────────┘           │     └──┬──┘──┬──┘       │
            │                         │        ▼     ▼          │
            │                         │   Winner / Ensemble     │
            │                         └───────────┬─────────────┘
┌───────────▼─────────────┐                       │
│   QUERY ROUTER (Self-RAG)│◄──────────────────────┘
│   Classifica queries:   │
│   • PERSONA_PURA → Skip │
│   • CALCULO_ROI         │
│   • CENARIO_COMPARATIVO │
│   • EVENTO_SIMULACAO    │
│   • HIBRIDO             │
└───────────┬─────────────┘
            ▼
┌─────────────────────────────────────────┐
│             ORCHESTRATOR                 │
│  - Manages SimulationState               │
│  - Scratchpad (short-term memory)        │
│  - Calls PersonaAgent, ROICalculator     │
│  - Agentic Loop: Thought → Act → Observe │
└───────────┬─────────────────────────────┘
            ▼
┌─────────────────────┐    ┌─────────────────────┐
│    CriticAgent      │◄───│    MetricsService   │
│  (Self-Reflection)  │    │    (QPC, TTS, Cost) │
└─────────────────────┘    └─────────────────────┘
```

## Estrutura de Arquivos (Atualizada v7.0)

```
RAG/
├── src/
│   ├── types/
│   │   └── index.ts              # Tipos (+ WarmupConfig, RacingConfig)
│   ├── services/
│   │   ├── queryRouter.ts        # Self-RAG - classificador de queries
│   │   ├── documentLoader.ts     # Chunking hierárquico por tipo
│   │   ├── vectorStore.ts        # ChromaDB (+history collection)
│   │   ├── SmartRouter.ts        # Multi-LLM routing
│   │   ├── LLMProvider.ts        # Unified LLM interface
│   │   ├── MetricsService.ts     # Agentic Metrics
│   │   ├── SelfImprovementService.ts  # 🆕 Warmup Phase
│   │   └── AgentRacingService.ts      # 🆕 Parallel Agents
│   ├── agents/
│   │   ├── personaAgent.ts       # Stakeholders + Cognitive Bias
│   │   ├── roiCalculator.ts      # ROI + Stochastic Noise
│   │   ├── CriticAgent.ts        # Self-Reflection
│   │   ├── DocumentAgent.ts      # 🆕 Document Ingestion
│   │   └── orchestrator.ts       # Agentic Loop + Scratchpad
│   └── server.ts                 # API: /simulate, /ingest (🆕)
services/ (Frontend)
├── batchService.ts               # runEnhancedBatchSimulation (🆕)
└── ...
```

## Novos Componentes v7.0

### 5. DocumentAgent

**Arquivo**: `RAG/src/agents/DocumentAgent.ts`

Extrai "Manifesto Estruturado Denso" de documentos brutos:

```typescript
import { DocumentAgent } from './agents/DocumentAgent';

const agent = new DocumentAgent();
const digest = await agent.digest(rawPDFText);
// { manifesto: "...", coreValues: [...], roles: [...], ... }
```

### 6. SelfImprovementService

**Arquivo**: `RAG/src/services/SelfImprovementService.ts`

Warmup iterativo para encontrar parâmetros ótimos:

```typescript
const service = new SelfImprovementService();
const warmupResult = await service.runWarmup(testFn, config);
// { optimalParams: { temperature: 0.5, topK: 5 }, finalScore: 87 }
```

### 7. AgentRacingService

**Arquivo**: `RAG/src/services/AgentRacingService.ts`

Executa múltiplos agentes em paralelo:

```typescript
const racing = new AgentRacingService();
racing.setupAgents({ numAgents: 3, diversityMode: 'persona' });
const result = await racing.race(simulationFn, config);
// { winner: { agentId: 'agent_2', critiqueScore: 85 }, allResults: [...] }
```

### 8. SmartChunker

**Arquivo**: `RAG/src/services/SmartChunker.ts`

Chunking inteligente para documentos grandes (COBIT, SAFe full, etc.):

```typescript
import { SmartChunker } from './services/SmartChunker';

const chunker = new SmartChunker({ chunkSize: 2000, chunkOverlap: 200 });
const result = chunker.chunk(cobitFullText);
// { documentId: 'doc_123', chunks: [{id, content, metadata}...], structure: {...} }
```

**Parâmetros de Chunking:**
| Parâmetro | Valor Default | Descrição |
|-----------|---------------|-----------|
| `chunkSize` | 2000 chars | Tamanho máximo de cada chunk |
| `chunkOverlap` | 200 chars | Overlap para manter contexto |
| `minChunkSize` | 500 chars | Tamanho mínimo (evita fragmentos) |

### 9. UserFrameworkStore

**Arquivo**: `RAG/src/services/UserFrameworkStore.ts`

Vector Store para documentos do usuário com busca por similaridade:

```typescript
const store = new UserFrameworkStore('user_frameworks');
await store.indexDocument(chunkingResult);
const context = await store.generateContext("implementar controles BAI");
// Retorna Top-5 chunks relevantes formatados para injeção no prompt
```

## Changelog

### v7.1 (2026-01-11) - Calibração Responsiva de ROI
- ✅ **Viés Responsivo**: `maintenanceBaseRate` dinâmico (0.55-0.75) baseado no cenário
- ✅ **Surprise Factor**: 5-20% chance de boost (+15-50%) para adaptação excepcional
- ✅ **Framework-Organization Fit**: Avaliação de compatibilidade framework vs tamanho da org
  - Frameworks leves (Scrum, Kanban): +20-35% em orgs pequenas
  - Frameworks enterprise (SAFe, COBIT): -30-40% em orgs pequenas sem budget
- ✅ **J-Curve Suavizada**: Fatores iniciais 0.75 (era 0.6)
- ✅ **Tech Debt Modifiers**: Calibrados para permitir cenários positivos
- ✅ **Prompt LLM Responsivo**: PROTOCOLO DE REALISMO RESPONSIVO
- ✅ **ROI Range**: -40% a +35% (era apenas negativo)

### v7.0 (2025-12-28) - Advanced Agentic Workflow
- ✅ **Self-Improvement (Warmup)**: Fase de auto-calibração antes de batches.
- ✅ **Agent Racing (Concorrência)**: Múltiplos agentes competem em paralelo.
- ✅ **DocumentAgent Desacoplado**: Ingestão de documentos via `/api/ingest`.
- ✅ **Smart Chunking**: Processamento de documentos grandes (COBIT, SAFe) com chunking semântico.
- ✅ **UserFrameworkStore**: Indexação de chunks no Vector Store para RAG dinâmico.
- ✅ **Intervalos de Confiança (IC 95%)**: Sumário estatístico robusto.
- ✅ **runEnhancedBatchSimulation**: Nova função no frontend para workflow avançado.

### v6.0 (2025-12-07) - Economic & Persona Realism
- ✅ **Dynamic Cost Profiles**: 8 cenários econômicos (PME, Startup, Enterprise, FAANG, etc.) afetando custos e ROI.
- ✅ **Persona Enrichment**: Mapeamento de arquétipos para stakeholders reais com nomes e histórias de `profiles.json`.
- ✅ **Team Distribution**: Geração realista de time (estagiário a tech lead) baseada no tamanho da empresa.
- ✅ **New Business Metrics**: Eficiência, Retrabalho, Agilidade e Evolução do Time.

### v4.0 (2025-12-07) - Agentic Transformation
- ✅ **SmartRouter (Multi-LLM)**: Integração de GPT-4, Gemini, DeepSeek e Ollama.
- ✅ **CriticAgent (Self-Reflection)**: Validação de resultados com pontuação de plausibilidade.
- ✅ **Memória de Curto Prazo (Scratchpad)**: Foco dinâmico a cada turno.
- ✅ **Memória de Longo Prazo (History Collection)**: Persistência de turnos em ChromaDB.
- ✅ **Viés Cognitivo**: PersonaAgent agora aplica viéses (Confirmação, Status Quo, Aversão).
- ✅ **Ruído Estocástico**: ROICalculator injeta variações de ±10%.
- ✅ **MetricsService**: Métricas agenticas (QPC, TTS, Cost).

### v3.3 (2025-12-05) - Simulação Longo Prazo
- ✅ **Modo 5 Anos**: Nova opção no formulário para simular 60 meses.
- ✅ **Tooltips**: Ajuste de cores para fundo escuro (texto branco).
- ✅ **Correção de Charts**: Dashboard restaurado com suporte a longas séries temporais.

### v3.2 (2025-12-05)
- ✅ **ROI Realista**: Corrigido cálculo (era 380%+, agora -25% a +85%)
  - `teamScaleFactor`: De linear para logarítmico
  - `maintenanceValue`: Reduzido de 90% para 50% do OpEx
- ✅ **Análise de ROI**: Nova seção explicando fatores positivos/negativos
- ✅ **Tooltips**: Cor branca no dark mode para legibilidade
- ✅ **Faixas Numéricas**: LLM agora recebe limites para `featuresDelivered`

### v3.1 (Anterior)
- Integração RAG com `ragService.ts`
- Few-shot examples por arquétipo
- Self-RAG (query router)

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `services/ragService.ts` | Contexto RAG otimizado com faixas numéricas |
| `services/geminiService.ts` | Usa ragService + schema roiAnalysis |
| `services/metricsCalculator.ts` | Cálculo ROI corrigido |
| `components/Dashboard.tsx` | Seção ROI Analysis + Tooltips brancos |

## Métricas de Performance

| Métrica | v3.2 | v7.0 | v7.1 |
|---------|------|------|------|
| ROI Típico | 116-407% | -25 a +85% | -40 a +35% |
| Consistência | ~40% | ~80% | ~95% |
| Curva J | Às vezes | Sempre | Responsiva |
| Variabilidade | Baixa | Média | Alta |
| Framework Fit | Ignorado | Ignorado | Avaliado |

