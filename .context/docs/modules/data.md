# Módulo: Dados

## Propósito

Fontes de dados estáticas que alimentam personas, custos, playbooks e
eventos de simulação.

## Arquivos-chave

- `RAG/profiles.json` — **FONTE DA VERDADE**. 350 personas ricas, cada uma
  com `psicologia_comportamento`. Usado pelo backend (indexado no Chroma via
  `npm run index`).
- `data/profiles_compact.json` — projeção **GERADA** a partir de
  `RAG/profiles.json` (cobre as 350 personas), usada pelo frontend
  (`personaEnricher.ts`). Regenerar com `npm run build:profiles`
  (`scripts/build_profiles_compact.mjs`) — o viés cognitivo de cada persona
  é derivado deterministicamente do perfil no build. Nunca editar à mão.
- `data/archetype_examples.json` — few-shot examples por arquétipo, fonte
  única compartilhada entre `RAG/src/agents/personaAgent.ts` e
  `services/ragService.ts` (deduplicados nesta unificação).
- `data/cost_profiles.json` — perfis econômicos regionais, usado por
  `components/CostBreakdownPanel.tsx` / services de custo.
- `RAG/framework_playbooks.json` — playbooks por framework de gestão,
  indexados na coleção `playbooks` do Chroma.
- `RAG/simulation_events.json` — eventos possíveis durante a simulação,
  indexados na coleção `events`.
- `RAG/business_metrics_model.md` — documentação do modelo de métricas de
  negócio (referência para `metricsCalculator.ts` / `roiCalculator.ts`).
- `RAG/simulation_config.json` — configuração de simulação usada pelo CLI
  (`RAG/src/main.ts`).

## Invariantes

- `RAG/profiles.json` é a única fonte de verdade para dados de persona —
  `data/profiles_compact.json` deve ser derivado dele, nunca editado
  manualmente em paralelo (senão diverge).
- Qualquer novo campo em persona entra primeiro em `RAG/profiles.json`.

## O que NÃO tocar

- Não editar `data/profiles_compact.json` manualmente esperando que
  propague para `RAG/profiles.json` — o fluxo é unidirecional
  (profiles.json → compact).
- Não indexar `RAG/profiles.json` no Chroma sem rodar `npm run index`
  dentro de `RAG/` (o vectorStore não se atualiza sozinho).
