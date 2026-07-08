# Módulo: RAG Backend (`RAG/`)

## Propósito

Backend Express (porta 3002) do modo agentic: orquestração multi-agente,
RAG real via ChromaDB, cálculo determinístico de ROI, ingestão de documentos.

## Arquivos-chave

### Servidor
- `RAG/src/server.ts` — endpoints:
  - `GET /api/status` — health check (usado por `checkAgenticStatus` no
    frontend).
  - `POST /api/simulate` — body `{query, stakeholders, config, teamSample}`
    → resposta `{state, roi}`. Hidrata `stakeholders` (aceita `[{id}]` novo,
    `string[]` antigo) e `teamSample` (ids) contra as 350 personas reais de
    `RAG/profiles.json` carregadas na subida; fallback sintético só quando o
    id não existe. `state` inclui `funcionarios[]` (brains) e `eventos_rh[]`.
    Conecta o ChromaDB em fail-open (`initVectorStore`, timeout 3s).
  - `POST /api/ingest` — body `{rawText|documents[]}` → `{digest}`.
- `RAG/src/main.ts` — CLI de simulação (`npm run dev` dentro de `RAG/`).

### Core (`RAG/src/core/`)
- `employeeBrainCore.ts` — EmployeeBrain: estado determinístico por
  funcionário (puro, zero imports). Ver
  [simulation-model.md](./simulation-model.md). Testes em
  `RAG/src/tests/brain.test.ts` (6 testes).

### Agentes (`RAG/src/agents/`)
- `orchestrator.ts` — `OrchestratorAgent`. Loop de turnos
  Act → Critique → Replan. Cria brains para stakeholders + teamSample
  (`ensureBrains`); `consolidateTurn` commita moral/velocidade via
  `aggregate(brains)` ANTES do LLM (LLM só narra + confiança ±5);
  `runSimulation` chama o `CriticAgent` 1x por simulação e grava
  `state.plausibility_score`. God node do grafo (18 arestas).
- `personaAgent.ts` — gera reações/decisões de personas individuais; recebe
  o estado interno do brain no prompt e usa o viés cognitivo do perfil (não
  mais aleatório quando há brain). Modelo via `geminiModel()`.
- `CriticAgent.ts` — checa plausibilidade da narrativa via GPT-4;
  **fail-open** (erro na checagem não bloqueia o turno). Chamado 1x por
  simulação pelo `orchestrator.runSimulation`; a `plausibility_score` chega
  ao frontend como `quality_per_cycle` (antes hardcoded 100).
- `GoalAgent.ts` — aumenta dificuldade da simulação a cada 3 turnos.
- `roiCalculator.ts` — `ROICalculatorAgent`, cálculo determinístico do ROI
  (nunca delega ao LLM). God node (15 arestas).
- `DocumentAgent.ts` — processa documentos ingeridos para contexto RAG.

### Serviços (`RAG/src/services/`)
- `LLMProvider.ts` — factory multi-LLM (Gemini/GPT-4/DeepSeek/Ollama).
  Round-robin em `GOOGLE_API_KEY` .. `GOOGLE_API_KEY_3`. Exporta
  `geminiModel()`: modelo Gemini de env `GEMINI_MODEL`, default
  `gemini-2.5-flash` (os `gemini-1.5-*` foram aposentados pela API — 404).
- `SmartRouter.ts` — usa Ollama para classificar a query e rotear para o
  provedor/estratégia certa.
- `vectorStore.ts` — `VectorStoreService`, cliente ChromaDB (porta 8000).
  Coleções: `profiles`, `metrics`, `events`, `playbooks`, `history`. God
  node do grafo inteiro (24 arestas — mais conectado de todos).
- `UserFrameworkStore.ts` — coleção `user_frameworks` no Chroma (frameworks
  de gestão enviados/definidos pelo usuário).
- `SmartChunker.ts` — chunking de documentos para indexação (cópia separada
  da versão do frontend em `services/SmartChunker.ts`).
- `queryRouter.ts` — Self-RAG (decide se/quando buscar contexto adicional).
- `AgentRacingService.ts` — corrida entre agentes/estratégias (usado pelo
  modo batch "Racing").
- `SelfImprovementService.ts` — ciclo de auto-melhoria (feedback loop).
- `MetricsService.ts` — agregação de métricas de execução.
- `documentLoader.ts` — `DocumentLoader`, carga de documentos para RAG. God
  node (13 arestas).

## Pontos de entrada

- `RAG/src/server.ts` é o único ponto de entrada HTTP; qualquer novo
  endpoint entra ali.
- `OrchestratorAgent` é o hub de coordenação — qualquer novo agente se
  registra/é chamado a partir dele.

## Invariantes

- ROI **nunca** vem do LLM — sempre de `roiCalculator.ts`
  (`ROICalculatorAgent`). Ver [simulation-model.md](./simulation-model.md).
- `CriticAgent` é fail-open: uma falha na chamada ao GPT-4 não deve travar
  a simulação.
- ChromaDB é opcional/degradável: se offline, os serviços de RAG devem
  degradar (menos contexto), não lançar exceção fatal para o cliente.

## O que NÃO tocar

- Não fundir `services/SmartChunker.ts` (frontend) com
  `RAG/src/services/SmartChunker.ts` (backend) sem avaliar o impacto —
  hoje são independentes por design (a exceção deliberada é
  `RAG/src/core/employeeBrainCore.ts`, módulo puro sem imports que o
  frontend importa diretamente em `services/geminiService.ts`).
- Não adicionar imports em `employeeBrainCore.ts` — a pureza (zero imports)
  é o que permite o compartilhamento backend/frontend acima.
