# Handoff de preparação FrameSIM

Data: 4 de outubro de 2026, horário de São Paulo.

## Entregue nesta etapa

- Gateway global Jev: pacote instalado 0.5.0, igual ao latest consultado no registry npm. Não havia versão mais recente a instalar. Configuração global e chave em uso preservadas byte a byte (hash SHA-256 verificado antes/depois, sem imprimir o hash).
- Gateway local em 127.0.0.1:8790: health HTTP 200; `/router/decide` retornou passthrough HTTP 200. Isso comprova funcionamento do endpoint, não ganho de roteamento. Nenhuma configuração de login do Codex foi alterada.
- Jev global e chave FrameSIM: requisições tipadas de Score/Noul HTTP 200, modelo retornado jev-1.13.0.
- Credenciais do backend existente copiadas para esta worktree quando não havia RAG/.env; novas credenciais adicionadas com nomes próprios. `git check-ignore RAG/.env` confirmou que o arquivo é ignorado. O arquivo global Jev não recebeu a chave específica do projeto.
- DeepSeek NVIDIA integrado em `LLMFactory`/`OpenAICompatibleProvider` e fallback `ProviderGateway`. Havendo NVIDIA_DEEPSEEK_API_KEY, usa endpoint fixo NVIDIA e o modelo configurável NVIDIA_DEEPSEEK_MODEL (default deepseek-ai/deepseek-v4.1-flash). Sem chave NVIDIA, mantém o transporte DeepSeek direto anterior.
- As duas chaves Google novas já entram no pool existente como GOOGLE_API_KEY_4 e GOOGLE_API_KEY_5. Jev do simulador, GLM e Kimi tiveram credenciais/probes preparados; seu uso no pipeline completo está especificado para a implementação seguinte.

## Conectividade real

[Relatório JSON](provider_probe_results.json) contém resultados e tentativas anteriores, sem segredos. Todas as entradas são chamadas sintéticas mínimas.

| Alvo | Evidência |
|---|---|
| Jev global / FrameSIM | Avaliações tipadas HTTP 200 |
| GLM 5.3 NVIDIA | Modelo exato no catálogo; geração HTTP 200 |
| Kimi K3 NVIDIA | Modelo exato no catálogo; geração HTTP 200 |
| Segunda chave Gemini | Geração HTTP 200; alias gemini-flash-latest resolveu gemini-3.8-flash |
| Primeira chave Gemini | HTTP 200 sem texto válido em budget pequeno; retry HTTP 503 |
| DeepSeek v4.1 Flash NVIDIA | Modelo exato no catálogo; geração teve timeouts de 30 e 55 segundos |

Catálogo não prova inferência; HTTP 200 sem conteúdo também não. Os tempos destes probes não são benchmark comparável nem resultados de desempenho do simulador.

## Verificações executadas

- RED: teste novo do adaptador falhou porque NVIDIA não era reconhecida; teste gateway falhou por destino api.deepseek.com em vez de NVIDIA.
- GREEN: ambos os testes passaram depois da implementação. Regressão mantém destino/chave DeepSeek direto quando NVIDIA está ausente.
- `node RAG/node_modules/tsx/dist/cli.mjs RAG/src/tests/nvidia_deepseek.test.ts`: exit 0.
- `node RAG/node_modules/tsx/dist/cli.mjs RAG/src/tests/provider_gateway.test.ts`: exit 0.
- `node node_modules/tsx/dist/cli.mjs src/tests/index.test.ts`, cwd RAG: suite completa backend exit 0.
- `node RAG/node_modules/typescript/bin/tsc --noEmit --pretty false -p RAG/tsconfig.json`: exit 0.
- `node RAG/node_modules/typescript/bin/tsc -p RAG/tsconfig.json`: build backend exit 0.
- `node --check scripts/provider_probe.mjs`: exit 0; health checker tests existentes: exit 0; `git diff --check`: exit 0.
- Nenhuma mudança de UI foi implementada nesta preparação; os gates globais de frontend/audit/navegador fazem parte do plano seguinte e não são alegados como executados aqui.

## Fluxograma e implementação seguinte

[Spec](credible_evals_spec.md), [plano em 15 tarefas](../docs/plans/2026-10-04-credible-evals.md), [mapa Wayfinder](../.scratch/credible-evals/map.md), [pesquisa](credible_evals_research.md), [goal copiável](goal_credible_evals.md).

Fluxograma: [Mermaid](framesim_flowchart.mmd) e [LaTeX/TikZ + PGFPlots](framesim_flowchart.tex). O documento LaTeX foi enviado ao editor integrado. A compilação retornou `compile-failed` com `Unable to find standard directories for platform`; é uma limitação de ambiente, e a compilação/layout não foram verificados. O fonte está preservado. Os gráficos/tabela do exemplo são sintéticos.

Exportações nativas do app, métricas individuais, evals e comparação pareada estão especificados; ainda serão implementados pelo goal. Sem dataset observado independente, validação empírica segue pendente mesmo quando a entrega técnica estiver pronta. Nenhum goal ativo, commit, push ou publicação foi criado por esta preparação.
