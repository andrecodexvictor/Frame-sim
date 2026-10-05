# FrameSIM Credible Evals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar métricas individuais com evidências, comparação pareada reproduzível e exportação nativa LaTeX em todos os modos.

**Architecture:** Traço canônico com IDs estáveis e manifesto por execução alimenta cálculo determinístico, avaliação semântica e validação externa. Um ReportData único alimenta os dashboards e serializers científicos. O gateway global Jev conserva sua credencial; o simulador usa a chave específica server-side.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Express 5, LangGraph 0.2.74, Recharts 3, HTTP TypeSafe/Google/NVIDIA; TikZ, PGFPlots e booktabs no artefato exportado.

Especificação canônica: [credible_evals_spec.md](../../next_steps/credible_evals_spec.md). Pesquisa: [credible_evals_research.md](../../next_steps/credible_evals_research.md). Tracker: [.scratch/credible-evals](../../.scratch/credible-evals/map.md). Estado inicial e chamadas: [provider_probe_results.json](../../next_steps/provider_probe_results.json). Especificação e plano são propostas para revisão; iniciar o `/goal` confirma a direção e autoriza as tarefas locais.

## Método de execução

Para cada mudança comportamental: (1) escrever teste de contrato que falha; (2) executar e confirmar falha correta; (3) implementar mínimo; (4) executar suite pertinente e typecheck; (5) revisar diff e registrar checkpoint. Usar @test-driven-development e @verification-before-completion do Superpowers instalado em escopo global. Não adicionar biblioteca sem necessidade comprovada; se necessária, fixar versão e documentar motivo. Não fazer push/publicação como efeito colateral.

Os testes usam os asserts e entrypoints tsx existentes. Comandos por arquivo: `node RAG/node_modules/tsx/dist/cli.mjs RAG/src/tests/<nome>.test.ts` ou `node node_modules/tsx/dist/cli.mjs scripts/<nome>.test.ts`. Cada nova suite entra no runner correspondente depois de passar isoladamente. Não executar online no gate offline.

## Preparação já realizada

Consulta npm: gateway instalado e latest = 0.5.0. Configuração global preservada e Jev global/FrameSIM retornaram avaliação tipada HTTP 200. Novas credenciais em `RAG/.env` ignorado; antigas preservadas. Catálogo confirmou IDs exatos. GLM/Kimi geraram; segunda Gemini gerou; primeira teve 503 no retry; DeepSeek teve timeouts. Integração inicial DeepSeek no pacote existente tem especificação e testes próprios; consultar relatório de handoff para os gates efetivamente executados.

## Tarefas em ordem de dependência

### 1. Consolidar transporte NVIDIA DeepSeek

Files: Modify `RAG/src/services/LLMProvider.ts`, `RAG/src/services/ProviderGateway.ts`, `RAG/.env.example`, `RAG/src/tests/index.test.ts`; Test `RAG/src/tests/nvidia_deepseek.test.ts` e suite gateway existente.

Contrato red: `LLMFactory.hasDeepSeek()` deve aceitar NVIDIA_DEEPSEEK_API_KEY; request deve ir a `https://integrate.api.nvidia.com/v1/chat/completions`, com modelo `deepseek-ai/deepseek-v4.1-flash`. Sem NVIDIA, preservar caminho DeepSeek direto. Nunca enviar nvapi ao endpoint direto.

Aceitação: teste de transporte, erro sanitizado/cancelamento preservados e saúde de geração diferenciada do catálogo. Verify: suites específicas, backend typecheck. Esta fatia é a integração inicial autorizada no handoff; revalidar, não duplicar a implementação.

### 2. Registrar os demais provedores e orçamentos por requisição

Dependencies: 1. Files: Create `RAG/src/services/ProviderRegistry.ts`; Modify gateway, LLMFactory, `.env.example`; Test `RAG/src/tests/provider_registry.test.ts`.

Red: selecionar GLM/Kimi por preferência explícita, manter três credenciais NVIDIA distintas, respeitar cancelamento e limite agregado de tentativas/tempo; retorno inválido nunca é sucesso.

Implementar descritores de provedor, modelo efetivo, chave server-side, papéis permitidos e disponibilidade `configured/catalog_verified/generation_verified/unavailable`. Preservar preferência explícita no benchmark e registrar failover separado. Google pool existente mais novas chaves, cooldown/Retry-After sem contornar quotas.

Verify: transportes offline, resposta truncada, 401/403 sem retry inútil, 429/backoff limitado, cancellation; `npm --prefix RAG exec tsc -- --noEmit --pretty false`.

### 3. Introduzir manifesto e identificadores persistentes

Dependencies: 2. Files: Modify `RAG/src/types/index.ts`, `types.ts`, `RAG/src/server.ts`, `RAG/src/agents/orchestrator.ts`; Test `RAG/src/tests/run_manifest.test.ts`.

Red: duas personas com o mesmo nome mantêm identidades distintas; alias solicitado e modelo efetivo coexistem no manifest; execução degradada não diz live.

Implementar RunManifest conforme spec e preservar schema legado com campos opcionais durante migração. Não exportar chaves/headers. Verify: chamada simulate fixture retorna manifesto; testes server/orchestrator e typecheck completo.

Checkpoint: transportes, IDs e proveniência atravessam API sem regressão de modos existentes.

### 4. Persistir evidências por turno

Dependencies: 3. Files: Modify `RAG/src/core/employeeBrainCore.ts`, `RAG/src/agents/orchestrator.ts`, `RAG/src/types/index.ts`; Create `RAG/src/services/TraceRecorder.ts`; Test `RAG/src/tests/persona_trace.test.ts`.

Red: trajetória maior que memória FIFO de 12 eventos continua exportável; evento permanece ligado a personaId/turnId/eventId; ausência de oportunidade não fabrica produtividade.

Registrar estado anterior/posterior, ação, oportunidade, evento e fonte. Collector não muda RNG nem comportamento do kernel. Verify: replay de trace e invariantes com fixture longa e IDs homônimos.

### 5. Remover reconstrução narrativa de fatos individuais

Dependencies: 4. Files: Modify `services/agenticService.ts`, `services/geminiService.ts`, `types.ts`; Test `scripts/persona_identity.test.ts`.

Red: mudança de nome/ordem na narrativa não altera pessoa, mês ou estado exportado. Segundo estágio de texto não cria nova simulação factual invisível.

Consumir traços/IDs backend e produzir rich output como apresentação do mesmo resultado; manter origem identificada no modo standard. Verify: test offline frontend e teste integração sobre output canônico.

### 6. Exibir primeira avaliação individual observável

Dependencies: 5. Files: Create `RAG/src/services/IndividualMetrics.ts`, `components/IndividualEvaluationPanel.tsx`; Modify `components/Dashboard.tsx`, `types.ts`; Test `RAG/src/tests/individual_metrics.test.ts`.

Red: retorno por dimensão contém unidade, evidências e denominador; missing value é null; estresse alto com entrega aceita não recebe penalidade arbitrária de desempenho.

Entrega/qualidade/fluxo só onde o trace tem dados. Painel mostra cobertura, limitações e fonte. Verify: suite de métricas, typecheck e verificação de navegador com pessoa sem dados.

### 7. Avaliação semântica Jev com abstenção

Dependencies: 6. Files: Create `RAG/src/services/JevEvaluator.ts`, `RAG/evals/rubrics/individual-v1.json`; Modify orchestrator/types; Test `RAG/src/tests/jev_evaluator.test.ts`.

Red: evidência ausente resulta em abstenção antes de inferência; respostas Score/Noul/Choice malformadas são rejeitadas; timeout gera unavailable, não score zero.

Usar contrato atual `/v1/systemone`. Perguntas independentes juntas, segmentação limitada por orçamento/janela. Conservar probabilities, legend, confidence e versão efetiva. Pesos no código/rubrica, não no modelo. Verify: mocks HTTP e uma fixture com evidência contraditória. Probe online só por comando explícito.

Checkpoint: uma simulação individual completa mostra medidas e evidências, com avaliação semântica distinta do cálculo.

### 8. Tornar comparação causalmente pareada

Dependencies: 4. Files: Create `services/experimentProtocol.ts`; Modify `services/batchService.ts`, `services/geminiService.ts`, `RAG/src/agents/orchestrator.ts`; Test `scripts/paired_protocol.test.ts`.

Red: A/B compartilham equipe/choques mesmo se um braço consome mais RNG; memória do primeiro braço não altera contexto do segundo.

Streams RNG endereçados por seed/persona/turn/mechanism; snapshot de retrieval/memória. Intervenção conserva ações endógenas próprias. Verify: trace de eventos exógenos idêntico, ordem A/B reversível, suites brain/batch existentes.

### 9. Estatística e exibição de trade-offs

Dependencies: 8. Files: Create `services/comparisonStatistics.ts`; Modify batch, `components/ComparisonDashboard.tsx`, `components/BatchResultsChart.tsx`; Test `scripts/comparison_statistics.test.ts`.

Red: n=1 devolve IC indisponível; ROI negativo é preservado; bootstrap pareado reamostra pares completos; eventos correlacionados não inflam n.

Mostrar deltas/IC/método/n independente/perdas e objetivo primário. Não declarar vencedor por soma oculta de escalas. Verify: fixture analítica com deltas conhecidos, batch offline, UI com empate/inconclusivo.

### 10. Harness offline e validação externa

Dependencies: 7,9. Files: Create `RAG/src/evals/runner.ts`, `RAG/src/evals/dataset.ts`, `RAG/evals/fixtures/contract-v1.json`, `RAG/src/tests/evals.test.ts`; Modify `RAG/package.json`.

Red: splits com duplicata/coorte repetida são rejeitados; fixture não pode gerar status empirical_validated; todas as execuções planejadas têm resultado ou falha registrados.

Implementar desenvolvimento/calibração/holdout, importador com origem e unidade, baseline simples e métricas adequadas ao target. Primeiro dataset é explicitamente sintético. Evidência real permanece pendente sem fonte externa. Verify: `npm --prefix RAG run eval:offline` (novo comando), replay e regressão de contrato.

### 11. Evals online cruzados com orçamento

Dependencies: 2,10. Files: Create `RAG/src/evals/onlineRunner.ts`, `RAG/src/evals/protocol.ts`, `RAG/src/tests/online_budget.test.ts`; Modify `RAG/package.json` e `scripts/provider_probe.mjs`.

Red: orçamento insuficiente recusa nova chamada; gerador não julga sua própria saída no braço externo; ordem aleatória/identidade mascarada é registrada.

Matriz com mesma tarefa/budget, gerador e avaliador identificados, Jev/GLM/Kimi nos papéis propostos, ablações e baseline. Congelar limiares antes do teste. Verify offline de limites e comando online dry-run. Nunca alegar benchmark real sem executar/persistir os trials.

Checkpoint: comparação controlada e eval offline reproduzível, sem dependência de inferência online para o gate.

### 12. Dados canônicos de relatório

Dependencies: 6,9,10. Files: Create `services/reportData.ts`; Modify `types.ts`, Dashboard, ComparisonDashboard e BatchResultsChart; Test `scripts/report_data.test.ts`.

Red: mesmo run/metricId fornece o mesmo valor integral a tabela/UI/export; negativos e null sobrevivem; labels não viram chave de identidade.

ReportData contém unidades, intervalos assimétricos, origem, protocolo e limitações. Verify: fixtures individual/comparação/batch e paridade com resultado anterior.

### 13. Serializer LaTeX e figuras científicas

Dependencies: 12. Files: Create `services/articleExport.ts`, `services/latexEscape.ts`, `scripts/article_export.test.ts`, `data/article_template.ts`; Modify root package para `test:export`.

Red: `% _ & # $ { } ~ ^ \\` e strings maliciosas ficam texto; CSV inclui quoting e IC assimétrico; figura usa ReportData, nunca pixels.

Emitir article.tex, snippets booktabs/PGFPlots/TikZ, CSV, manifest, metodologia/limitações e BibTeX. Names/paths fechados; nenhum shell-escape. Verify: `npm run test:export` (novo), diferenças numéricas zero em fixture conhecida.

### 14. Download nativo nos três modos

Dependencies: 13. Files: Modify articleExport, `components/Dashboard.tsx`, `components/ComparisonDashboard.tsx`, `components/BatchSimulationPanel.tsx`; Test `scripts/article_download.test.ts`.

Red: individual/comparação/batch geram pacote consistente e completo, incluindo limitações quando não há labels externos.

ZIP com biblioteca existente, ou dependência fixa justificada se nenhuma disponível; evitar implementar compressão própria. UI permite TeX/snippets/dados e descreve fontes. Verify: descompactar pacote, validar paths/manifest e smoke de navegador dos três downloads.

### 15. Compilação, revisão visual e gate final

Dependencies: 11,14. Files: Create `scripts/article_compile_check.mjs`; Modify `scripts/browser_smoke.mjs`, README e documentação do protocolo; Test fixtures exportadas.

Compilar artigo e snippets standalone em ambiente controlado sem rede/shell-escape; verificar gráficos, tabelas, legendas e dados faltantes visualmente. Compilador integrado apresentou erro de ambiente na preparação, portanto não contar tentativa anterior como aprovação. Se indisponível, preservar fonte e reportar esse gate pendente.

Verify: `npm run typecheck`, `npm test`, `npm run build:all`, `npm run audit:all`, `npm run test:browser`, `npm run test:export`; eval offline; integração online limitada somente com orçamento definido. Verificar segredos ausentes do diff/bundle. Relatar métricas de validação empírica apenas se houver dataset observado válido.

## Riscos que mudam o plano

- Sem dados observados: entrega técnica é possível; validação empírica fica pendente.
- Modelo/alias/quota mudam: registrar versão efetiva, congelar manifest e não misturar trials sem anotação.
- DeepSeek tem timeout: suporte/configuração podem ser entregues; saúde de geração continua pendente até nova chamada bem-sucedida.
- Traço aumenta volume: definir paginação/retenção e budget; não truncar silenciosamente evidência exportada.
- UI/exports podem divergir: ReportData único e teste numérico eliminam esse problema.
- Compilador indisponível: arquivo editável entregue, gate de compilação declarado, sem instalar plugin/TeX como efeito colateral.

## Entrega e handoff

Não criar outra conversa automaticamente. Executar no checkout atual usando o `/goal` preparado. Manter spec/mapa/protocolo atualizados; registrar evidência e limitações por checkpoint. Não solicitar aprovação repetida para trabalho local já coberto pelo objetivo.

## Checkpoint de execução — 2026-10-05

Atualização de encerramento: o usuário autorizou expressamente “PODE CONCLUIR A GOAL” após a divulgação de que a compilação/revisão PDF estava indisponível. O nó final Mermaid foi corrigido com regressão red/green. Fluxogramas visíveis nos três modos e exports SVG/Mermaid/TikZ derivam do mesmo grafo. Exports, typecheck e build finais passaram; o dry-run mantém 18 trials, zero chamadas e reservas. Scanner final: 233 arquivos, zero padrões reconhecidos. A entrega local é encerrada com essa ressalva aceita; PDF continua não verificado, sem instalar TeX/plugin. Validação empírica e benchmark pago mantêm suas condições externas. O parágrafo seguinte preserva o checkpoint anterior à autorização.

Tarefas 1–14 possuem implementação e verificação offline, com limites registrados no [checkpoint](../../.scratch/credible-evals/issues/03-implementation-checkpoint.md) e [relatório de validação](../../next_steps/credible_evals_validation.md). Typecheck, testes completos, builds, audit (zero vulnerabilidades), exports e navegador passaram após a auditoria adicional. Scanner de 228 arquivos/bundle não encontrou padrões reconhecidos de credenciais. Dry-run online: 18 trials, zero chamadas/reservas; replay continua identificado como sintético. A tarefa 15 permanece incompleta exclusivamente na compilação e revisão PDF: engine unavailable. Nenhum processo de verificação continua rodando. Estes resultados não equivalem à conclusão integral nem à validação empírica; preservar fontes e retomar quando um compilador já disponível puder executar o gate, sem instalar TeX/plugin como contorno.
