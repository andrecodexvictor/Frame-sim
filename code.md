# Frame-sim: Código & Arquitetura



---

## 🎯 Visão Geral

Frame-sim é um **simulador empresarial multi-agente** que utiliza LLMs (Gemini, GPT-4, DeepSeek) para simular a implementação de frameworks de gestão (Scrum, SAFe, etc.) em organizações reais.

**Destaques Técnicos:**
- Arquitetura Multi-Agente com orquestração hierárquica
- Self-RAG (Retrieval-Augmented Generation seletivo)
- Auto-calibração de parâmetros via warmup
- Concorrência de agentes com seleção por plausibilidade

---

## 🧠 Funções-Chave

### 1. `runSimulation()` — Core Simulation Engine

**Arquivo:** `services/geminiService.ts`

```typescript
export const runSimulation = async (
  config: SingleSimulationConfig, 
  retryCount = 0
): Promise<SimulationOutput>
```

**O que faz:**
- Gera contexto RAG dinâmico baseado na configuração
- Enriquece arquétipos com personas reais (nomes, histórias, viés cognitivo)
- Chama Gemini com schema estruturado para output JSON
- Aplica cálculo determinístico de ROI sobre os dados brutos do LLM
- Implementa fallback multi-provider (Gemini → OpenAI → DeepSeek → Mock)

**Padrões utilizados:**
- **Retry with Rotation**: Rotaciona entre 7 API keys em caso de rate limit
- **Hybrid AI/Math**: LLM gera dados qualitativos, matemática calcula métricas financeiras

---

### 2. `runEnhancedBatchSimulation()` — Advanced Workflow Orchestrator

**Arquivo:** `services/batchService.ts`

```typescript
export const runEnhancedBatchSimulation = async (
  config: SimulationConfig,
  batchConfig: EnhancedBatchConfig,
  onProgress: (status: BatchProgress) => void
): Promise<BatchResult>
```

**O que faz:**
- **Fase 0 (Warmup):** Testa combinações de parâmetros e converge para o ótimo
- **Fase 1 (Racing):** Executa N agentes em paralelo, seleciona o melhor
- **Fase 2 (Batch):** Roda simulações sequenciais com parâmetros otimizados
- **Fase 3 (Consolidação):** Calcula estatísticas (média, desvio, IC 95%)

**Padrões utilizados:**
- **Strategy Pattern**: Warmup e Racing são estratégias intercambiáveis
- **Observer Pattern**: Callback `onProgress` para UI reativa

---

### 3. `DocumentAgent.digest()` — Intelligent Document Ingestion

**Arquivo:** `RAG/src/agents/DocumentAgent.ts`

```typescript
async digest(rawText: string): Promise<DocumentDigest>
```

**O que faz:**
- Recebe texto bruto de PDF/DOCX/MD
- Usa Gemini Flash para extrair "Manifesto Estruturado"
- Retorna objeto com `coreValues`, `roles`, `ceremonies`, `artifacts`
- Calcula taxa de compressão (ex: 500k chars → 4k chars)

**Padrões utilizados:**
- **Adapter Pattern**: Interface unificada para diferentes formatos
- **Chain of Responsibility**: Fallback para texto bruto em caso de erro

---

### 4. `SelfImprovementService.runWarmup()` — Auto-Calibration

**Arquivo:** `RAG/src/services/SelfImprovementService.ts`

```typescript
async runWarmup(
  testFn: (params: OptimizedParameters) => Promise<any>,
  warmupConfig: WarmupConfig,
  onProgress?: (iteration: number, score: number, params: OptimizedParameters) => void
): Promise<WarmupResult>
```

**O que faz:**
- Explora espaço de parâmetros (temperature, topK, ragMode)
- Usa `CriticAgent` para pontuar resultados (0-100)
- Converge quando atinge `targetPlausibility`
- Retorna `OptimizedParameters` para uso no batch

**Algoritmo:**
```
Para cada iteração:
  1. SAMPLE: Escolher params (exploration → exploitation)
  2. EXECUTE: Mini-simulação com params
  3. CRITIQUE: CriticAgent avalia plausibilidade
  4. UPDATE: Se score > best, best = score
  5. CONVERGE: Se best >= target, parar
```

---

### 5. `AgentRacingService.race()` — Competitive Multi-Agent

**Arquivo:** `RAG/src/services/AgentRacingService.ts`

```typescript
async race(
  simulationFn: (agent: AgentConfig, optimalParams?: OptimizedParameters) => Promise<any>,
  racingConfig: RacingConfig,
  optimalParams?: OptimizedParameters
): Promise<RaceResult>
```

**O que faz:**
- Configura N agentes com diversidade (CFO, CTO, COO, etc.)
- Executa todos em paralelo com `Promise.all`
- `CriticAgent` avalia cada resultado
- Seleciona vencedor por score ou gera ensemble ponderado

**Estratégias de seleção:**
| Estratégia | Descrição |
|------------|-----------|
| `best` | Maior score de plausibilidade |
| `weighted` | Seleção probabilística proporcional ao score |
| `ensemble` | Média ponderada dos resultados |

---

### 6. `calculateMonthlyMetrics()` — Deterministic Financial Engine

**Arquivo:** `services/metricsCalculator.ts`

```typescript
export function calculateMonthlyMetrics(
  rawData: SimulationRawData,
  config: SimulationConfig,
  accumulatedValue: number,
  accumulatedOpEx: number,
  accumulatedCoNQ: number
): MonthlyMetrics
```

**O que faz:**
- Calcula ROI mensal usando fórmulas financeiras reais
- Aplica **Curva J** (queda de produtividade nos primeiros meses)
- Calcula **CoNQ** (Cost of Non-Quality): bugs × custo de correção
- Acumula métricas para ROI progressivo

**Fórmula do ROI:**
```
ROI = ((Value - CoNQ - OpEx) / OpEx) × 100
```

---

### 7. `PersonaAgent.simulateResponse()` — Behavioral Simulation

**Arquivo:** `RAG/src/agents/personaAgent.ts`

```typescript
async simulateResponse(
  persona: PersonaProfile,
  situacao: string,
  config?: SimulationConfig
): Promise<PersonaResponse>
```

**O que faz:**
- Injeta **viés cognitivo** aleatório (Confirmação, Status Quo, Aversão à Perda)
- Usa **few-shot examples** por arquétipo para consistência
- Gera resposta em primeira pessoa com emoção detectada
- Retorna impacto na moral do time (-10 a +10)

---

### 8. `OrchestratorAgent.runTurn()` — Agentic Loop

**Arquivo:** `RAG/src/agents/orchestrator.ts`

```typescript
async runTurn(step: SimulationStep): Promise<OrchestratorOutput[]>
```

**O que faz:**
- Coleta respostas de cada stakeholder
- Consolida impactos em `SimulationState`
- Atualiza **Scratchpad** (memória de curto prazo)
- Persiste turno em **Vector Store** (memória de longo prazo)
- Avalia **GoalAgent** a cada 3 turnos

**Agentic Loop:**
```
Thought → Route → Act → Observe → Critique → Commit → Save Memory
```

---

### 9. `SmartChunker.chunk()` — Intelligent Document Chunking

**Arquivo:** `RAG/src/services/SmartChunker.ts`

```typescript
chunk(text: string, documentId?: string): ChunkingResult
```

**O que faz:**
- Detecta estrutura do documento (capítulos, seções, domínios COBIT)
- Divide em chunks de ~2000 chars respeitando limites de sentença
- Gera metadata (seção, keywords, posição) para cada chunk
- Suporta padrões específicos de COBIT, SAFe, Markdown

**Padrões de Estrutura Detectados:**
```typescript
const STRUCTURE_PATTERNS = {
  chapter: /^(Chapter|Capítulo)\s+(\d+)/im,
  cobitDomain: /^(EDM|APO|BAI|DSS|MEA)\d{0,2}/im,
  markdownH1: /^#\s+(.+)$/m,
  numberedSection: /^(\d+(?:\.\d+)*)\s+([A-Z])/m,
};
```

**Padrões utilizados:**
- **Template Method**: Estrutura de chunking configurável
- **Strategy Pattern**: Detecção de estrutura por regex patterns

---

### 10. `UserFrameworkStore.generateContext()` — Dynamic RAG for User Docs

**Arquivo:** `RAG/src/services/UserFrameworkStore.ts`

```typescript
async generateContext(query: string, topK: number = 5): Promise<string>
```

**O que faz:**
- Busca chunks similares à query no Vector Store (ChromaDB)
- Retorna Top-K resultados ordenados por similaridade
- Formata contexto para injeção direta no prompt do LLM

**Padrões utilizados:**
- **Repository Pattern**: Abstração sobre ChromaDB
- **Facade Pattern**: Interface simples para busca complexa

---

## 📊 Métricas de Qualidade

| Aspecto | Implementação |
|---------|---------------|
| **Type Safety** | TypeScript strict com interfaces detalhadas |
| **Error Handling** | Try-catch com fallbacks em toda a stack |
| **Observability** | Logs estruturados em cada fase |
| **Testability** | Serviços desacoplados e injetáveis |

---

## 🏛️ Arquitetura de Alto Nível

```
┌────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React/Vite)                   │
│  UploadSection → ConfigForm → Dashboard → BatchResults         │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                    SERVICES LAYER (TypeScript)                 │
│  geminiService ← batchService ← ragService ← metricsCalculator │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                     AGENTIC BACKEND (Node.js)                  │
│  Orchestrator → PersonaAgent → ROICalculator → CriticAgent     │
│  SmartRouter → SelfImprovement → AgentRacing → DocumentAgent   │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                     EXTERNAL APIs                              │
│  Google Gemini │ OpenAI GPT-4 │ DeepSeek │ Ollama (local)      │
└────────────────────────────────────────────────────────────────┘
```

---

## 📚 Referências Técnicas

- **LangChain.js**: Framework para orquestração de LLMs
- **ChromaDB**: Vector store para RAG
- **Recharts**: Visualização de dados
- **React 19 + Vite**: Frontend moderno

---

*Última atualização: Janeiro 2026*
