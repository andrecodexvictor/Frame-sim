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

### 6b. `calculateSurpriseFactor()` — Exceptional Adaptation Detector

**Arquivo:** `services/metricsCalculator.ts`

```typescript
export function calculateSurpriseFactor(
  rawData: SimulationRawData,
  config: SimulationConfig
): { multiplier: number; triggered: boolean; reason?: string }
```

**O que faz:**
- Detecta sinais de adaptação excepcional da equipe
- Calcula probabilidade de "surpresa" (5-20%)
- Aplica boost de 15-50% no valor entregue quando ativado

**Sinais de adaptação:**
| Sinal | Bônus Probabilidade |
|-------|---------------------|
| `learningCurveFactor ≥ 1.1` | +5% |
| Bugs < 30% das features | +3% |
| Efficiency ≥ 85% | +4% |
| Equipe ≤ 50 pessoas | +3% |

---

### 6c. `calculateFrameworkFit()` — Framework-Organization Compatibility

**Arquivo:** `services/metricsCalculator.ts`

```typescript
export function calculateFrameworkFit(
  frameworkName: string,
  companySize: number,
  budgetLevel: string,
  category: string
): { multiplier: number; fitLevel: string; reason: string }
```

**O que faz:**
- Classifica framework por complexidade (lightweight/medium/enterprise)
- Avalia compatibilidade com tamanho e orçamento da organização
- Retorna multiplicador de valor (+35% a -40%)

**Classificação de Frameworks:**
```typescript
const FRAMEWORK_COMPLEXITY = {
  // Leves - ideais para pequenas
  'scrum': 'lightweight',
  'kanban': 'lightweight',
  'xp': 'lightweight',
  
  // Enterprise - requerem estrutura
  'safe': 'enterprise',
  'cobit': 'enterprise',
  'itil': 'enterprise',
};
```

---

### 7. `PersonaAgent.simulateResponse()` — Behavioral Simulation

**Arquivo:** `RAG/src/agents/personaAgent.ts`

```typescript
async simulateResponse(
  persona: PersonaProfile,
  situacao: string,
  config?: SimulationConfig,
  brain?: EmployeeBrainState
): Promise<PersonaResponse>
```

**O que faz:**
- Injeta **viés cognitivo** derivado do perfil (`brain.viesCognitivo`); aleatório só na ausência de brain
- Injeta o **estado interno do EmployeeBrain** no prompt (estresse, humor, energia, engajamento, memórias, reflexão) — os números guiam o tom, nunca são revelados
- Usa **few-shot examples** por arquétipo (fonte única: `data/archetype_examples.json`, deduplicada com o frontend)
- Gera resposta em primeira pessoa com emoção detectada
- Retorna impacto na moral do time (-10 a +10)

---

### 8. `OrchestratorAgent.runTurn()` — Agentic Loop

**Arquivo:** `RAG/src/agents/orchestrator.ts`

```typescript
async runTurn(step: SimulationStep): Promise<OrchestratorOutput[]>
```

**O que faz:**
- Garante 1 EmployeeBrain por persona (`ensureBrains`, idempotente) e roda `updateBrain()` para stakeholders (com o `impacto_moral` da resposta LLM) e para as personas de fundo
- Roda `evaluateDecisions()` por brain ativo (RNG semeado por persona+turno) e `applyContagion()` quando há contágio; acumula `state.eventos_rh` e as decisões graves em `state.eventos_disparados`
- Consolida via `consolidateTurn()` (ver 8b)
- Avalia **GoalAgent** e roda `reflect()` nos brains a cada 3 turnos

**Agentic Loop:**
```
Thought → Route → Act → Observe → Critique → Commit → Save Memory
```

---

### 8b. `OrchestratorAgent.consolidateTurn()` — Deltas Determinísticos

**Arquivo:** `RAG/src/agents/orchestrator.ts`

**O que faz:**
- **Commit determinístico primeiro**: `moral_time` e `velocidade_sprint` vêm de `aggregate(brains)` + efeitos das decisões do turno — não do LLM
- O LLM só narra (`scratchpad_update`, `resumo_turno`, `eventos_disparados`) e ajusta `confianca_delta`, clampado em ±5
- Sem fallback catastrófico: se a chamada LLM falhar, o estado numérico já foi aplicado (o antigo "moral -= 5" foi removido)
- Persiste o resumo do turno no Vector Store quando conectado

---

### 8c. `OrchestratorAgent.runSimulation()` — Critique 1x por simulação

**Arquivo:** `RAG/src/agents/orchestrator.ts`

**O que faz:**
- Inicializa brains de stakeholders + `teamProfiles` (time de fundo hidratado de `RAG/profiles.json`), roda os turnos
- Chama `CriticAgent.critique()` **1 vez por simulação** (não por turno) sobre o resumo final; grava `state.plausibility_score`/`state.replan_triggered` — o frontend usa como `quality_per_cycle` (antes hardcoded 100)
- Replan barato: se `replanRequired`, anexa a crítica ao scratchpad (sem re-rodar turnos nem LLM extra); CriticAgent é fail-open (score 100 em erro)
- Fecha com `ROICalculatorAgent.calculateROI()`

---

### 8d. EmployeeBrain — `updateBrain` / `evaluateDecisions` / `aggregate` / `simulateTeamOffline`

**Arquivo:** `RAG/src/core/employeeBrainCore.ts` — módulo puro, zero imports, usado pelo backend e pelo frontend. Testes: `RAG/src/tests/brain.test.ts` (6 testes; `npx tsx src/tests/brain.test.ts` em `RAG/`).

```typescript
function updateBrain(brain: EmployeeBrainState, ctx: TurnContext): EmployeeBrainState
function evaluateDecisions(brain, ctx, rng): { brain; decisions: DecisionResult[] }
function aggregate(brains: EmployeeBrainState[]): AggregateResult
function simulateTeamOffline(profiles, meses, seedBase, pressaoPorMes?): { brains; emergentEvents }
```

**O que fazem:**
- `updateBrain` — avança 1 turno de estado (estresse, humor, energia, engajamento, memória FIFO de 12), pura/imutável; retorno de licença recupera humor (+40) e zera o streak de estresse alto; coage entradas externas (um NaN vindo do JSON do LLM não envenena o estado)
- `evaluateDecisions` — catálogo de decisões humanas em ordem fixa, máx. 1 grave por turno: `pedido_demissao` (streak>=2 + humor<-40, sorteio 35%), `burnout`→licença, `resistencia_passiva`, `confronto_lideranca` (avaliado ANTES de `fofoca` porque seu gatilho é subconjunto estrito), `fofoca` com contágio social; `apoiar_mudanca`/`pedir_ajuda` são independentes
- `aggregate` — deriva `moral` (média de humor dos não-desistentes), `velocidadeMod` (penaliza baixas e falta de engajamento dos ativos) e `sentimentPorPersona` — as métricas que o LLM inventava antes
- `simulateTeamOffline` — modo standard: roda o time inteiro por N meses com **zero chamadas LLM** (RNG semeado, reflexão a cada 3 meses); os `emergentEvents` entram no prompt do Gemini como fatos já ocorridos e `keyPersonas[].sentiment` é sobrescrito pelo humor determinístico (`SimulationOutput.emergentEvents?`)

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

*Última atualização: Julho 2026 (v8.0 — EmployeeBrain, CriticAgent no loop principal, personas reais ponta a ponta)*
