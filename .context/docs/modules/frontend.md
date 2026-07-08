# Módulo: Frontend

## Propósito

UI React da aplicação: fluxo de upload de documento/config → escolha de
arquétipo corporativo → simulação → dashboard de resultados (single ou
batch/Monte Carlo).

## Arquivos-chave

- `App.tsx` — ponto de entrada. Máquina de estados:
  `upload → config → simulating → results | batch`. Decide modo
  standard vs agentic via `checkAgenticStatus()` (chama o backend RAG/;
  se offline, cai para standard automaticamente).
- `types.ts` — tipos centrais: `SimulationConfig`, `SimulationOutput`,
  `CorporateArchetype` (17 arquétipos disponíveis).
- `components/ConfigForm.tsx` — formulário de configuração da simulação,
  seleção de arquétipo corporativo (17 opções de `CorporateArchetype`).
- `components/Dashboard.tsx` — renderiza resultado da simulação, incluindo
  `keyPersonas` (personas-chave que reagiram no cenário).
- `components/BatchSimulationPanel.tsx` / `BatchResultsChart.tsx` — UI do
  modo batch (Monte Carlo / Warmup / Racing, ver `services/batchService.ts`).
- `components/ComparisonDashboard.tsx` — comparação entre frameworks/rodadas.
- `components/CostBreakdownPanel.tsx` — detalhamento de custo (usa
  `data/cost_profiles.json` via services).
- `components/AuthScreen.tsx`, `LandingPage.tsx`, `SimulationLoader.tsx`,
  `UploadSection.tsx`, `components/ui/` — telas de suporte / UI kit.

## Pontos de entrada

- `index.tsx` → monta `App.tsx`.
- `App.tsx` é o único lugar que decide standard vs agentic — qualquer
  mudança de roteamento de modo passa por ali.

## Invariantes

- Estado da simulação vem sempre de `SimulationOutput` (tipado em
  `types.ts`); não inventar shape novo de resultado sem atualizar o tipo.
- `CorporateArchetype` tem 17 valores fixos — usado tanto no form quanto no
  `personaEnricher.ts` (backend de serviços) para mapear arquétipo → personas.

## O que NÃO tocar

- Não duplicar a lógica de decisão standard/agentic fora de `App.tsx`.
- Não alterar `types.ts` (`SimulationConfig`/`SimulationOutput`) sem
  verificar todos os consumidores em `services/` e `RAG/src/` — é um god
  node do grafo (`SimulationConfig`, 18 arestas).
