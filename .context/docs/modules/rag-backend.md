# Módulo: RAG Backend (`RAG/`)

## Propósito

Backend Express (porta 3002) do modo agentic: orquestração multi-agente,
RAG real via ChromaDB, cálculo determinístico de ROI, ingestão de documentos.

## Arquivos-chave

### Servidor
- `RAG/src/server.ts` — endpoints:
  - `GET /api/status` — health check (usado por `checkAgenticStatus` no
    frontend).
  - `POST /api/simulate` — body `{query, stakeholders, config}` → resposta
    `{state, roi}`.
  - `POST /api/ingest` — body `{rawText|documents[]}` → `{digest}`.
- `RAG/src/main.ts` — CLI de simulação (`npm run dev` dentro de `RAG/`).

### Agentes (`RAG/src/agents/`)
- `orchestrator.ts` — `OrchestratorAgent`. Loop de turnos
  Act → Critique → Replan. God node do grafo (18 arestas).
- `personaAgent.ts` — gera reações/decisões de personas individuais.
- `CriticAgent.ts` — checa plausibilidade da narrativa via GPT-4;
  **fail-open** (erro na checagem não bloqueia o turno).
- `GoalAgent.ts` — aumenta dificuldade da simulação a cada 3 turnos.
- `roiCalculator.ts` — `ROICalculatorAgent`, cálculo determinístico do ROI
  (nunca delega ao LLM). God node (15 arestas).
- `DocumentAgent.ts` — processa documentos ingeridos para contexto RAG.

### Serviços (`RAG/src/services/`)
- `LLMProvider.ts` — factory multi-LLM (Gemini/GPT-4/DeepSeek/Ollama).
  Round-robin em `GOOGLE_API_KEY` .. `GOOGLE_API_KEY_3`.
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
  hoje são independentes por design (frontend não importa código do RAG/).
- `EmployeeBrain` (`RAG/src/core/employeeBrainCore.ts`) ainda **não existe**
  no repo — está em implementação. Ver
  [simulation-model.md](./simulation-model.md) antes de assumir que já
  existe.
