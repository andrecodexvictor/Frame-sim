# Auditoria de conclusão dos próximos passos

Data da auditoria: 2026-08-31

Esta matriz consolida os requisitos repetidos nos documentos históricos de `next_steps/`. “Concluído” significa que existe implementação integrada e uma evidência verificável; não transforma a simulação em previsão do mundo real nem promete disponibilidade de provedores externos.

## Fase 1 — arquitetura, roteamento e autocrítica

| ID | Status | Evidência atual | Limite explícito |
|---|---|---|---|
| 1.1 Configuração de APIs | Concluído | `RAG/src/services/ProviderGateway.ts`, `RAG/.env.example`, `scripts/api_key_health_check.mjs` | Segredos ficam no processo Node; o browser recebe apenas `VITE_API_URL`. |
| 1.2 Smart Router | Concluído | `RAG/src/services/SmartRouter.ts`, `RAG/src/tests/router.test.ts` | A intenção é classificada localmente; Ollama é opcional e cada cadeia faz fallback por capacidade. |
| 1.3 Interface unificada de providers | Concluído | `LLMProvider.ts` e `services/providerClient.ts` | Falha total vira erro sanitizado ou fixture explicitamente marcada. |
| 1.4 Roteamento por agente | Concluído | Narrativa e Critic usam `SmartRouter`; Persona, ROI qualitativo e DocumentAgent usam o pool rotativo `GeminiProvider` | Embeddings opcionais usam a chave Google principal e degradam sem Chroma. |
| 1.5 Orquestrador via router | Concluído | `orchestrator.ts` escolhe a cadeia narrativa por prompt e registra a rota nas métricas | A dinâmica humana/financeira continua local e determinística. |
| 2.1 CriticAgent | Concluído | `RAG/src/agents/CriticAgent.ts` retorna score, justificativa e sugestão validada | Indisponibilidade do crítico é fail-open, mas deixa proveniência degradada. |
| 2.2 Regras configuráveis | Concluído | `RAG/simulation_rules.json`, `simulationRulesLoader.ts`, teste de cap de plausibilidade para ROI extremo | O schema atual suporta regras determinísticas sobre `roi_final`; novas métricas exigem extensão validada. |
| 2.3 Ciclo de crítica | Concluído | StateGraph executa `turn → roi → critique`; um replan executa novo `turn → roi → critique` | A crítica recebe o ROI calculado, não um ROI inventado pelo LLM. |
| 2.4 Replan/ajuste | Concluído | Replan limitado a uma iteração; segunda reprovação gera `aspirational_adjustment` auditável | O limite evita loop/custo sem fim; não é aprendizado autônomo contínuo. |
| 3.1 TTS | Concluído | `MetricsService.time_to_solve_ms`; exibido no Dashboard | Mede a execução observada, não garante latência de rede futura. |
| 3.2 QPC | Concluído | Score real do Critic alimenta `quality_per_cycle` | É plausibilidade interna, não acurácia estatística certificada. |
| 3.3 TIR | Concluído | Incidentes/ciclos geram `tir`, com teste offline | “Incidente” é risco operacional da simulação. |
| 3.4 Dashboard | Concluído | `components/Dashboard.tsx` mostra QPC, TTS, TIR, custo, tokens, replan e degradação | Campos só aparecem quando a execução os fornece. |

## Fase 2 — personas, variabilidade e memória

| ID | Status | Evidência atual | Limite explícito |
|---|---|---|---|
| 4.1 Personas com vieses | Concluído | `employeeBrainCore.ts`, `personaAgent.ts`, `personaEnricher.ts`; traços, história, memória, estilo e viés por indivíduo | O LLM dá voz; estado, eventos e clamps vêm do modelo seedado. |
| 4.2 RAG com variabilidade | Concluído | QueryRouter local, busca híbrida multi-collection e teste com duas fontes contraditórias | O prompt identifica fontes como incompletas/conflitantes; não as apresenta como verdade. |
| 4.3 Estocasticidade controlada | Concluído | RNG seedado em EmployeeBrain, ROI backend, métricas frontend e self-improvement; testes de replay | Texto de provedores pode variar; o estado numérico comparável é reproduzível. |
| 5.1 Memória curta | Concluído | `scratchpad` e `reasoning_log` limitados/sanitizados por turno | O log contém decisões resumidas, não raciocínio privado do modelo. |
| 5.2 Memória longa | Concluído | `directVectorStore.ts`, recall máximo de três itens e uma persistência final | Chroma é opcional e fail-open. |
| 5.3 Integração da memória | Concluído | Recall antes dos turnos, injeção limitada e persistência com crítica/metadados | Falhas aparecem em `degraded_reasons` sem apagar a resposta. |
| 5.4 Cenário econômico | Concluído | `cost_profiles.md`, loader validado, seletor seedado, UI e multiplicadores no ROI | São hipóteses recession/base/expansion, nunca previsões macroeconômicas. |

## Fase 3 — autonomia delimitada, escala e generalização

| ID | Status | Evidência atual | Limite explícito |
|---|---|---|---|
| 6.1 Ajuste de objetivo | Concluído | Segunda crítica baixa registra objetivo aspiracional e sugestão limitada | Sugestão precisa de validação humana. |
| 6.2 Padrão ReAct | Concluído | `reasoning_log` registra motivo resumido, ação e observação para router, RAG, personas, crítica, ROI, memória, stub e saúde | Não expõe cadeia de pensamento privada nem executa ferramentas fora do contrato. |
| 6.3 Monitoramento de saúde | Concluído | `HealthMonitor` avalia custo, tokens, duração, incidentes, risco e fallback; alertas implicam `degraded` | Monitor local por execução, sem paging/telemetria externa. |
| 7.1 Paralelismo | Concluído | Batch com concorrência máxima 3; racing paralelo, timeout, AbortSignal, ensemble e seleção determinística | Callback externo precisa respeitar AbortSignal; o serviço não pode interromper código JS arbitrário. |
| 7.2 Ferramenta externa | Concluído | `ExternalToolStub` versionado, offline, seedado e integrado aos cenários/riscos | A UI e o estado dizem explicitamente que não é dado externo real. |
| 7.3 Frameworks genéricos | Concluído | Catálogo validado para Scrum/Kanban e adapter para qualquer framework enviado; teste usa “Flow Lattice 9” fora do catálogo | Entrada arbitrária precisa fornecer nome/texto; não há descoberta automática na internet. |

## Cobertura transversal solicitada

| Requisito | Evidência |
|---|---|
| “Sirens”/sinais explicativos | Timeline de sinais e alertas no Dashboard, textos “Como a simulação reage”, proveniência live/degraded/fixture e avisos de hipótese econômica. |
| Personas distintas | Seleção seedada de perfis reais, traços psicológicos, histórias, vocabulário, vieses e estado individual persistente. |
| Grafo LangGraph | StateGraph real com checkpoint por request, loop explícito, ROI antes da crítica, replan limitado, cancelamento propagado e limpeza de checkpoints. |
| Simulação encadeada | Estado agentic é concluído primeiro e injetado na geração visual; timeout/cancelamento atravessam a cadeia. |
| Simulação concorrente | Testes cobrem isolamento entre orquestradores, bloqueio de sobreposição na mesma instância, batch 2–3 workers e racing paralelo. |
| Aplicação leve | SDKs de provider removidos do browser; UI lazy; `@langchain/community` e wrappers amplos removidos; adaptadores Chroma diretos; auditorias sem vulnerabilidades. |
| Chaves do router | `health:keys` descobre, deduplica e testa todas as entradas configuradas sem imprimir valores. Substituição só é necessária se o resultado final não for `reachable`. |

## Gates finais

Os comandos autoritativos são:

```bash
npm run typecheck
npm test
npm run build:all
npm run audit:all
npm run health:keys
```

O resultado exato da rodada final e a verificação HTTP/browser devem constar da entrega; testes offline não provam disponibilidade futura de Google, OpenAI, DeepSeek, Chroma ou rede.
