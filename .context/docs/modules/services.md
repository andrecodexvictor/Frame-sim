# Módulo: Services (frontend, `services/`)

## Propósito

Camada de serviços do modo standard (browser-only) e clientes/utilitários
compartilhados com o modo agentic (batch, persona enrichment).

## Arquivos-chave

- `services/geminiService.ts` — engine principal do modo standard. Modelo
  `gemini-2.5-flash`. Rotaciona 7 chaves (`VITE_API_KEY` .. `VITE_API_KEY7`).
  Fallback Gemini → GPT-4 → DeepSeek → mock (`mockData.ts`). Pós-processa o
  ROI de forma determinística (nunca aceita ROI vindo direto do LLM).
- `services/metricsCalculator.ts` — cálculo determinístico de OpEx, Value,
  CoNQ, ROI, SurpriseFactor, FrameworkFit. Núcleo do modelo matemático no
  frontend; ver [simulation-model.md](./simulation-model.md).
- `services/ragService.ts` — pseudo-RAG local: few-shot + classificador +
  ROI determinístico. NÃO é RAG real (isso só existe no backend `RAG/`).
- `services/personaEnricher.ts` — mapeia `CorporateArchetype` → personas
  usando `data/profiles_compact.json`; calcula `teamResistance`.
- `services/agenticService.ts` — cliente HTTP do modo agentic, fala com
  `RAG/src/server.ts` na porta 3002.
- `services/batchService.ts` — orquestra execuções em lote no frontend
  (Monte Carlo, Warmup, Racing) chamando os serviços acima repetidamente.
- `services/mockData.ts` — dados mock usados como último fallback quando
  todos os LLMs falham.
- `services/SmartChunker.ts` — chunking de texto no frontend. Existe uma
  segunda implementação em `RAG/src/services/SmartChunker.ts` (backend) —
  são cópias separadas, não módulo compartilhado.

## Pontos de entrada

- `App.tsx` chama `geminiService.ts` (modo standard) ou
  `agenticService.ts` (modo agentic).
- `batchService.ts` é chamado por `components/BatchSimulationPanel.tsx`.

## Invariantes

- ROI final sempre passa por `metricsCalculator.ts` — nunca retornar ROI cru
  do texto do LLM para a UI.
- Fallback de chave/provedor sempre em cadeia (nunca falhar silenciosamente
  sem tentar o próximo provedor).

## O que NÃO tocar

- Não remover a rotação de chaves em `geminiService.ts` (mitigação de rate
  limit — são 7 chaves de propósito).
- Não confundir `services/ragService.ts` (pseudo-RAG, frontend) com o RAG
  real do backend — são conceitos e arquivos diferentes apesar do nome.
