# FrameSIM — relatório de validação

Data: 2026-10-05. Entrega local encerrada por autorização do usuário, com compilação/revisão PDF LaTeX não verificadas. Escopo e critérios: [especificação](credible_evals_spec.md), [plano](../docs/plans/2026-10-04-credible-evals.md) e [mapa Wayfinder](../.scratch/credible-evals/map.md).

## Fechamento autorizado e fluxogramas

Após a divulgação da indisponibilidade do compilador, o usuário autorizou expressamente o encerramento: “PODE CONCLUIR A GOAL”. A ressalva permanece registrada; não há aprovação de PDF, alegação de desempenho observado ou benchmark pago novo.

Os três modos agora exibem o fluxograma em seção expansível: início/fim arredondados, processos retangulares, decisões em losangos, setas ortogonais e ramos Sim/Não. O caminho sem evidência pula o julgamento e leva à abstenção. SVG, Mermaid e TikZ derivam do mesmo grafo estático; ele descreve o protocolo, não uma execução live. Em 390px, o diagrama mantém texto legível e rolagem local acessível por teclado, sem alargar a página. Exportações incluem os três formatos vetoriais/editáveis.

A regressão do identificador reservado `end` no Mermaid falhou antes da correção e passou após sua troca por `finish`. `npm run test:export` passou após a correção final; `npm run export:flowchart` e as fixtures dos três modos foram regenerados. Typecheck final: sessão 8031, exit 0. Build frontend final: sessão 55656, exit 0; `artifacts/qa/credible-evals-frontend-build.log`. Testes completos do checkpoint de fluxogramas: sessão 96302, exit 0; builds frontend/backend: sessão 15391, exit 0. Navegador: sessão 89671, exit 0, dois losangos/dois terminais por modo, sem textos fora das formas e zero inferência; capturas desktop/mobile inspecionadas. A mudança final do identificador não altera geometria ou texto. O gate de geração de artigos continua retornando status **unavailable** para compilação: exit 0 da geração não é prova de PDF.

Checagens de fechamento: `npm --prefix RAG run eval:online -- --dry-run` regenerou o manifesto com o snapshot local, 18 trials e zero chamadas/reservas; exit 0. `node scripts/credential_scan.mjs` passou após o build final: 233 arquivos, zero padrões reconhecidos; `artifacts/qa/credential-scan.json`. Nenhuma credencial foi alterada, nenhum commit/push/publicação foi realizado e não houve nova inferência paga.

## Evidências por tarefa do plano

| Tarefa | Evidência no checkout | Resultado e limite |
|---|---|---|
| 1. Transporte DeepSeek NVIDIA | `LLMProvider.ts`, `ProviderGateway.ts`, `nvidia_deepseek.test.ts`, [probes](provider_probe_results.json) | Transporte offline verificado; catálogo confirmado. Geração inicial teve timeout, nunca registrada como sucesso. |
| 2. Provedores, seleção e orçamento | `ProviderRegistry.ts`, `provider_registry.test.ts`, `provider_gateway.test.ts`, `online_budget.test.ts` | Google/DeepSeek/GLM/Kimi separados; Jev tipado. Preferências, cancelamento, retries e reservas testados. Não escolher melhor modelo sem benchmark. |
| 3. Manifesto e identidade | `RunManifest.ts`, `CodeSnapshot.ts`, `clientRunManifest.ts`, testes correspondentes | run/persona/turn/event IDs, aliases/modelos efetivos, hashes de config/dataset/rubrica e fontes locais. Credenciais excluídas. HEAD não substitui snapshot local. |
| 4. Traços e tarefas | `TraceRecorder.ts`, `syntheticWork.ts`, `persona_trace.test.ts`, `synthetic_work.test.ts` | Histórico além do FIFO; tarefas e colaboração útil atribuídas. Política sintética comum entre frameworks, capacidade limitada, incidentes e censura documentados. |
| 5. Apresentação canônica | `agenticPresentation.ts`, `persona_identity.test.ts`, `agentic_duration.test.ts` | Sem segunda simulação factual; dimensões não medidas ficam null. Tempo agêntico é turno. |
| 6. Avaliação individual | `IndividualMetrics.ts`, `IndividualEvaluationPanel.tsx`, testes de métricas/painel | Numeradores, denominadores, cobertura, evidências, fonte mista e amostras de duração por classe. Censurados excluídos da mediana; adaptação sem baseline continua indisponível. |
| 7. Jev e abstenção | `JevEvaluator.ts`, `individual-v1.json`, `jev_evaluator.test.ts` | Score/Noul/Choice com distribuições e legenda. Sem evidência não chama modelo. Política sem calibração não aceita uma nota como validada. |
| 8. Pareamento causal | `experimentProtocol.ts`, `paired_protocol.test.ts`, `paired_orchestrator.test.ts`, `standard_trace.test.ts` | Mesma equipe/agenda por réplica; RNG endereçado e memória/retrieval isolados. Incidentes atingem ambos os motores. |
| 9. Estatística | `comparisonStatistics.ts`, `experimentResults.ts`, testes de comparação/lote | Réplicas completas como unidades, IC indisponível n=1, negativos preservados, falhas e snapshots incompatíveis excluídos; sem vencedor composto. |
| 10. Harness offline | `dataset.ts`, `runner.ts`, `clusterBootstrap.ts`, `evals.test.ts`, [fixture de replay](../RAG/evals/fixtures/trace-replay-v1.json) | Splits/coortes, cegamento de labels, proveniência importada, baseline de desenvolvimento, política congelada, métricas/curva binária e IC clusterizado. Replay é contrato sintético. |
| 11. Harness online | `onlineRunner.ts`, `onlineAnalysis.ts`, `onlinePricing.ts`, `online_budget.test.ts`, [template de preço](../RAG/evals/pricing-template.json) | Matriz cruzada, ordem aleatória, candidatos congelados, ablações e baseline extrativo. Dry-run 18 trials sem chamadas. Preço/template não verificado bloqueia execução remota. |
| 12. ReportData | `reportData.ts`, `report_data.test.ts`, `report_ui.test.tsx` | Dados canônicos nos três modos, unidades, falhas/protocolo, gráficos complementares e distribuições. Categóricos/narrativa permanecem no snapshot do relatório. |
| 13. LaTeX nativo | `articleExport.ts`, `latexEscape.ts`, `article_template.ts`, `article_export.test.ts` | Valores integrais, null, negativos, IC assimétrico, booktabs/PGFPlots/TikZ, escaping e paths fixos. Índices categóricos não colapsam turnos repetidos; linhas mantêm o tempo registrado e snippets identificam a origem. Amostras censuradas permanecem nos dados; figuras de fluxo usam apenas aceitas. |
| 14. Download | `ArticleExportControls.tsx`, `article_download.test.tsx`, `browser_report_smoke.mjs` | Individual/comparação/lote exportam ZIP, fonte única TeX, snippets e dados; downloads sem inferência. |
| 15. Gates e entrega | Comandos e artefatos abaixo | Compilação LaTeX unavailable. Fontes entregues, PDF/layout sem aprovação. Nenhuma publicação/commit automático. |

## Gates

Gates encerrados após a auditoria de origem, distribuições, snapshot de código e índices das figuras. Nenhum processo de verificação está pendente. Os testes da correção de índices e legendas falharam antes da implementação e passaram depois dela. O gate LaTeX continua indisponível: o exit 0 do comando de geração de fontes não significa compilação aprovada.

| Gate | Resultado inspecionado | Evidência |
|---|---|---|
| `npm run typecheck` | exit 0, após correção da tipagem da regressão de figuras | Sessão 67067 |
| `npm test` | exit 0; frontend, saúde de chaves por mocks e backend completos | Sessão 98248; `artifacts/qa/credible-evals-tests.log` |
| `npm run build:all` | exit 0; Vite e TypeScript backend | Sessão 95989; build posterior à correção de figuras |
| `npm run audit:all` | exit 0; zero vulnerabilidades nos dois pacotes | Sessão 44235; `artifacts/qa/credible-evals-audit.log` |
| `npm run test:export` | exit 0; valores, escaping, índices repetidos, origem das legendas, ZIP e fonte standalone | Resultado do comando após a correção |
| `npm run test:browser` | exit 0; ZIPs dos três modos, desktop/390px, classe/censura visíveis, zero tentativas de inferência | Sessão 88282; `artifacts/qa/report-browser/results.json` e imagens |
| `node scripts/credential_scan.mjs` | exit 0; 228 arquivos versionáveis/bundle, zero padrões reconhecidos | `artifacts/qa/credential-scan.json`; repetido após o build |
| Evals offline de contrato e replay | exit 0; `empirical_validation_pending` em ambos | `RAG/evals/results/offline-contract-v1.json` e `trace-replay-v1.json` |
| Eval online `--dry-run` | exit 0; 18 trials, zero chamadas, zero reservas; `codeStateHash` presente | Sessão 18242; `RAG/evals/results/online-dry-run-v1.json` |
| `npm run test:article-compile` | Fontes/ZIPs gerados; status **unavailable**, engine null, nenhum PDF compilado | Sessão 75809; `artifacts/qa/article-fixtures/compilation.json` |

Imagens de desktop/mobile e da distribuição individual foram inspecionadas. O smoke usa fixtures offline e metadados parciais de manifesto para exercitar a apresentação; não prova uma execução remota live. A largura da página em 390px foi 390px, e o seletor de exportação mediu 206px.

Comandos reproduzíveis:

```text
npm run typecheck
npm test
npm run build:all
npm run audit:all
npm run test:export
npm run test:browser
npm run test:article-compile
node scripts/credential_scan.mjs
npm --prefix RAG run eval:offline
npm --prefix RAG run eval:offline -- --dataset evals/fixtures/trace-replay-v1.json --output evals/results/trace-replay-v1.json
npm --prefix RAG run eval:online -- --dry-run
```

Artefatos locais ignorados: `artifacts/qa/credible-evals-tests.log`, `credible-evals-build.log` (build do checkpoint anterior), `credible-evals-audit.log`, `credential-scan.json`, `report-browser/results.json`, `article-fixtures/compilation.json`. IDs de sessão identificam resultados inspecionados neste chat; não substituem os comandos reproduzíveis. Não usar `test:browser:live` no gate offline. O scanner verifica formatos conhecidos de credenciais, não prova ausência de todo formato possível de segredo.

## Auditoria dos critérios de aceitação

| Requisito explícito | Prova inspecionada | Estado |
|---|---|---|
| IDs homônimos, traços além do FIFO, medidas sem zero inventado | `run_manifest.test.ts`, `persona_trace.test.ts`, `individual_metrics.test.ts`, painel e runner completo | Aprovado em fixtures de contrato |
| Filtrar persona, papel e turno; escolher condição/réplica nos modos de comparação e lote | Seletores em `IndividualEvaluationPanel.tsx`, `ComparisonDashboard.tsx`, `BatchSimulationPanel.tsx`; smoke dos painéis | Implementado; o smoke não cobre toda combinação de filtros |
| Mesma equipe/choques, memória/RAG isolados e independência dos draws | `paired_protocol.test.ts`, `paired_orchestrator.test.ts`, `standard_trace.test.ts` e testes de incidentes em ambos os kernels | Aprovado offline |
| n independente, n=1 sem IC, ROI negativo, pares incompletos e snapshots incompatíveis | Testes de estatística, comparação, registros de lote/interativos e ReportData; runner completo | Aprovado offline |
| Jev Score/Noul/Choice, evidência ausente, saída malformada, timeout e calibração pendente | `jev_evaluator.test.ts`, `online_budget.test.ts`, código da política e runner completo | Aprovado em mocks; sem aprovação empírica da rubrica |
| Desenvolvimento/calibração/holdout sem cruzamento de pessoas/coortes; predictor sem target | `dataset.ts`, `runner.ts`, `evals.test.ts`, resultados dos dois CLIs offline | Aprovado em contratos; observações humanas externas não fornecidas |
| Mesma tarefa para geradores, juiz externo distinto, ablações, mascaramento, ordem e orçamento | `protocol.ts`, `onlineRunner.ts`, `onlineAnalysis.ts`, `online_budget.test.ts`, dry-run persistido | Harness verificado; benchmark remoto não executado sem orçamento |
| ReportData alimenta UI/CSV/TeX com precisão, negativos, null e ICs | `report_data.test.ts`, `report_ui.test.tsx`, `article_export.test.ts`, código dos serializers | Aprovado em fixtures conhecidas |
| ZIP de cada modo, article.tex, booktabs, PGFPlots/TikZ, CSV, manifesto, metodologia, limitações e BibTeX | Testes de export/download, arquivos de `article-fixtures`, smoke dos três ZIPs | Fontes e downloads aprovados |
| Artigo e snippets compilados, gráficos/tabelas/legendas revisados no PDF | `compilation.json`, ausência de engine e de ferramenta integrada nesta sessão | **Não verificado; ressalva aceita no encerramento pelo usuário** |
| Preservar credencial global e manter credenciais do projeto server-side | Gateway global 0.5.0 verificado no checkpoint; nenhum arquivo de credenciais alterado nestas revisões; scanner e exports sanitizados | Mantido; scanner é limitado aos formatos reconhecidos |
| Documentação, fluxogramas, goal e entrega local sem publicar | Spec, plano, mapa, checkpoint, Mermaid/TikZ e fontes no checkout; status Git com alterações locais | Entregue localmente; sem commit/push/publicação |

O gate de compilação/revisão PDF permanece não verificado e foi aceito como ressalva no encerramento autorizado pelo usuário. Fontes geradas não são consideradas artigos compilados. Para verificar esse gate futuramente, é necessário disponibilizar o compilador integrado ou um engine já instalado; nenhum TeX/plugin foi instalado como contorno.

## Limitações que permanecem

- Sem observações independentes/rótulos humanos: status empirical_validation_pending. MAE zero do replay resulta de contagem contratual e não estabelece fidelidade. Não publicar alegações de desempenho real de empregados/frameworks.
- Parâmetros do bloco sintético não são calibrados: amostra de horas por turno, oportunidades sorteadas, revisões reservadas potencialmente não usadas, rejeições/pendências sem carryover e mediana condicional ao aceite. Diferenças entre profissões não têm normalização validada.
- Rubrica Jev permanece exploratória enquanto sua política de aceitação não tiver calibração independente; a concentração de probabilidades não mede probabilidade de acerto.
- Sem orçamento explícito, não houve benchmark pago novo. Probes iniciais sustentam apenas conectividade; DeepSeek segue sem geração confirmada. O template de preço é deliberadamente inválido até revisão do operador. Reserva não é cobrança medida.
- Nenhum compilador LuaLaTeX/pdfLaTeX foi encontrado no PATH ou locais usuais. O compilador integrado havia falhado na inicialização e não está exposto nesta sessão; nenhum editor conectado foi encontrado. Fonte única e snippets foram gerados, mas compilação e layout PDF permanecem não verificados. Não instalar TeX/plugin como contorno.

## Entregáveis

- Código e testes no checkout atual; credenciais somente nos arquivos backend ignorados, gateway Jev global preservado em 0.5.0.
- [Fluxograma SVG](framesim_flowchart.svg), [Mermaid](framesim_flowchart.mmd) e [fonte TikZ](framesim_flowchart.tex), além da visualização no app e dos arquivos em cada pacote exportado.
- Artigos/ZIPs editáveis dos três modos em `artifacts/qa/article-fixtures`; sem PDF alegado como compilado.
- [Goal de origem](goal_credible_evals.md), especificação, plano, mapa e este relatório. Encerramento autorizado no chat; não iniciar um segundo goal para esta entrega.
