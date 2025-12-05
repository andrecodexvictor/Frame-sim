# Sistema RAG Otimizado - Documentação Técnica

## Visão Geral

Este sistema implementa **RAG (Retrieval-Augmented Generation) otimizado** com LangChain.js para simulação de cenários empresariais, incluindo:

- **Self-RAG**: Query Router que decide automaticamente quando usar/ignorar retrieval
- **Hierarchical Retrieval**: Índices separados por tipo de documento
- **Multi-Agent**: Personas, cálculo de ROI e orquestração de stakeholders

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER QUERY                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      QUERY ROUTER (Self-RAG)                     │
│  Classifica queries em 5 modos:                                  │
│  • PERSONA_PURA → Skip RAG (usa few-shot direto)                │
│  • CALCULO_ROI → RAG só em métricas                             │
│  • CENARIO_COMPARATIVO → RAG full (playbooks + métricas)        │
│  • EVENTO_SIMULACAO → RAG só em eventos                         │
│  • HIBRIDO → Múltiplas collections                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ PersonaAgent│   │ROICalculator│   │Orchestrator │
│ (Few-shot)  │   │ (Curva J)   │   │(Multi-agent)│
└─────────────┘   └─────────────┘   └─────────────┘
```

## Estrutura de Arquivos

```
RAG implement/
├── src/
│   ├── types/
│   │   └── index.ts          # Tipos centrais (PersonaProfile, ROIResult, etc.)
│   ├── services/
│   │   ├── queryRouter.ts    # Self-RAG - classificador de queries
│   │   ├── documentLoader.ts # Chunking hierárquico por tipo
│   │   └── vectorStore.ts    # ChromaDB com collections separadas
│   ├── agents/
│   │   ├── personaAgent.ts   # Simula stakeholders com few-shot examples
│   │   ├── roiCalculator.ts  # Cálculos financeiros (Curva J, dívida técnica)
│   │   └── orchestrator.ts   # Coordena simulação multi-stakeholder
│   ├── index.ts              # Barrel exports
│   └── main.ts               # CLI entry point
├── profiles.json             # 350+ personas geradas
├── business_metrics_model.md # Fórmulas de ROI e métricas
├── framework_playbooks.json  # Scrum, Kanban, SAFe
├── simulation_events.json    # Eventos com gatilhos
└── simulation_config.json    # Configuração do cenário
```

## Componentes Principais

### 1. Query Router (Self-RAG)

**Arquivo**: `src/services/queryRouter.ts`

Classifica queries automaticamente para decidir se deve usar RAG:

| Tipo Query | Ação RAG | Exemplo |
|------------|----------|---------|
| PERSONA_PURA | ❌ Skip | "Como o CEO cético reagiria?" |
| CALCULO_ROI | ✅ Metrics only | "Qual o break-even?" |
| CENARIO_COMPARATIVO | ✅ Full | "Scrum vs Kanban?" |
| EVENTO_SIMULACAO | ✅ Events only | "O que causa incidente?" |

```typescript
import { QueryRouter } from './services/queryRouter';

const router = new QueryRouter();
const classification = await router.classify("Como o CFO reagiria ao Scrum?");
// { mode: 'PERSONA_PURA', confidence: 0.9, filters: { collections: [] } }
```

### 2. Persona Agent

**Arquivo**: `src/agents/personaAgent.ts`

Simula comportamento de stakeholders usando **few-shot examples por arquétipo**:

- CEO_CETICO
- CFO_PRAGMATICO
- CTO_ENTUSIASTA
- TECH_LEAD_CETICO
- DEV_SENIOR_AUTONOMO

```typescript
import { PersonaAgent } from './agents/personaAgent';

const agent = new PersonaAgent();
const response = await agent.simulateResponse(
  persona,  // PersonaProfile do profiles.json
  "Proposta de migração para Scrum",
  config    // SimulationConfig
);
// { resposta_persona: "Já tentamos isso...", emocao_detectada: "ceticismo", impacto_moral: -3 }
```

### 3. ROI Calculator

**Arquivo**: `src/agents/roiCalculator.ts`

Cálculos financeiros determinísticos com:

- **Curva J**: Produtividade cai nos primeiros 4 meses
- **Juros Compostos de Dívida Técnica**: Taxa de 1-15% ao mês
- **Lei de Brooks**: Contratar gente atrasa mais

```typescript
import { ROICalculatorAgent } from './agents/roiCalculator';

const calculator = new ROICalculatorAgent();
const result = await calculator.calculateROI(config);
// { roi_final: 45.2, break_even_mes: 8, projecao_mensal: [...] }
```

### 4. Orchestrator

**Arquivo**: `src/agents/orchestrator.ts`

Coordena simulação com múltiplos stakeholders:

```typescript
import { createOrchestrator } from './agents/orchestrator';

const orchestrator = createOrchestrator();
const result = await orchestrator.runSimulation(
  ["Proposta de Daily Standup", "Sprint falhou 60%"],
  stakeholders,
  config
);
```

## Integração com geminiService.ts

O sistema RAG pode ser integrado ao `geminiService.ts` existente substituindo a lógica inline de playbooks/perfis:

```typescript
// Antes (inline)
const playbookLogic = `CONHECIMENTO DE PLAYBOOKS...`;

// Depois (com RAG)
import { QueryRouter, VectorStoreService } from './RAG implement/src';

const router = new QueryRouter();
const vectorStore = await createVectorStore();

// Buscar playbooks relevantes para o framework específico
const playbooks = await vectorStore.searchCollection(
  'playbooks',
  config.frameworkName,
  3
);
```

## Variáveis de Ambiente

```bash
# .env
GOOGLE_API_KEY=sua_api_key_gemini
CHROMA_DB_PATH=./chroma_db  # Opcional, para ChromaDB
```

## Uso via CLI (pasta RAG/)

```bash
# Instalar dependências
cd RAG
npm install

# Query com Self-RAG automático
npm run dev -- --query "Como o CEO cético reagiria ao Scrum?"

# Cálculo de ROI
npm run dev -- --query "Qual o ROI em 12 meses para PME?"

# Simulação multi-stakeholder
npm run dev -- --simulate
```

## Changelog

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

| Métrica | Antes | Depois |
|---------|-------|--------|
| ROI Típico | 116-407% | -25 a +85% |
| Consistência | ~40% | ~80% |
| Curva J | Às vezes | Sempre |

