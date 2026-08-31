# Relatório de mudanças — Frame-sim

**Data:** 31/08/2026<br>
**Snapshot de implementação:** 77ca3cc — feat: harden agentic simulation and personas<br>
**Branch publicada:** main → origin/main<br>
**Escopo do snapshot:** 72 arquivos, 6.644 linhas adicionadas e 5.870 removidas

## 1. Resumo executivo

O Frame-sim foi evoluído de uma simulação baseada principalmente em texto para uma aplicação agentic com estado individual por funcionário, regras determinísticas, grafo LangGraph explícito, memória controlada, métricas observáveis e fallback seguro para indisponibilidade de serviços externos.

O princípio central é: **o LLM narra; a matemática decide**. Valores de estado humano, moral, velocidade, ROI, incidentes e métricas não são aceitos diretamente da narrativa do modelo; são calculados, limitados e auditáveis no código.

As entregas cobrem:

- personas reais e distintas, hidratadas a partir do catálogo de 350 perfis;
- EmployeeBrain determinístico por funcionário, com estado emocional, memória e decisões humanas;
- orquestração por StateGraph com crítica, replan limitado, checkpoint e cancelamento;
- RAG e memória de longo prazo com adaptadores diretos, limites de tamanho e comportamento fail-open;
- cenários econômicos, regras de plausibilidade, frameworks configuráveis e ferramenta externa offline;
- gateway server-side de providers com rotação, fallback, timeout, sanitização e telemetria;
- dashboard com sinais (sirens), proveniência, métricas agentic, avisos de hipótese e hash de replay;
- execução standard offline, modo agentic, batch concorrente e racing com seleção determinística;
- suíte de testes, smoke browser, health-check de chaves, builds e auditorias de dependências.

## 2. Evolução por fases

### 2.1 Arquitetura e documentação

- ARCHITECTURE.md foi reescrito com a arquitetura atual, fluxos, integração do backend, modelo matemático, EmployeeBrain, variáveis de ambiente e diagramas Mermaid.
- DIAGRAMAS.md consolida os diagramas de arquitetura e sequência.
- README.md foi atualizado para a estrutura real, quickstart dos modos standard/agentic, variáveis de ambiente, operação do servidor e changelog.
- progress.md registra a evolução da reforma v8.
- next_steps/completion_audit.md consolida os itens históricos de next_steps/, sua evidência verificável e seus limites explícitos.
- A configuração de TypeScript passou a excluir dist, node_modules e legacy_v1 do typecheck.

### 2.2 Personas e EmployeeBrain

- O catálogo backend usa as 350 personas de RAG/profiles.json.
- scripts/build_profiles_compact.mjs mantém data/profiles_compact.json gerado a partir da fonte de verdade; a geração é idempotente.
- O viés cognitivo é derivado deterministicamente dos dados comportamentais do perfil.
- RAG/src/core/employeeBrainCore.ts concentra a lógica pura compartilhada entre Node e browser, sem dependências externas.
- Cada brain mantém estresse, humor, energia, engajamento, status, streaks, memória FIFO de eventos e reflexão resumida.
- Traços como resiliência, adaptabilidade e influência são derivados do perfil individual.
- A atualização por turno considera pressão efetiva, clima global, impacto pessoal, drenagem/recuperação de energia e clamps de segurança.
- O catálogo de decisões humanas inclui pedido de demissão, burnout/licença, resistência passiva, confronto com liderança, fofoca com contágio, champion da mudança e pedido de ajuda.
- O RNG é seedado por persona e turno; o mesmo cenário e seed reproduzem o estado numérico comparável.
- A moral e a velocidade globais vêm de aggregate() dos brains, não de um delta inventado pelo LLM.
- No caminho agentic, stakeholders e uma amostra de equipe recebem brains persistentes entre turnos.
- No caminho standard, simulateTeamOffline() roda antes do LLM, sem chamadas adicionais, e seus eventos entram no prompt como fatos.
- keyPersonas.sentiment passa a ser derivado do humor determinístico.
- Eventos graves e eventos de RH chegam ao frontend como emergentEvents.

### 2.3 Grafo agentic e execução LangGraph

RAG/src/agents/orchestrator.ts usa um StateGraph real com os nós:

    initialize → turn → roi → critique → (replan → turn) → finalize

Garantias implementadas:

- ROI é calculado antes da crítica e nunca é inventado pelo crítico;
- a crítica roda no loop principal e alimenta quality_per_cycle;
- no máximo um replan é permitido por execução;
- uma segunda reprovação produz aspirational_adjustment auditável;
- MemorySaver usa thread por request e libera checkpoints ao terminar ou abortar;
- uma instância de orquestrador não aceita duas execuções simultâneas;
- snapshots de estado são clonados para impedir mutação cruzada;
- AbortSignal é propagado pela narrativa, crítica, memória e persistência;
- cancelamento é exposto como AbortError estável para HTTP e frontend;
- OrchestratorDependencies permite injeção de doubles nos testes;
- reasoning_log registra motivo, ação e observação resumidos, sem expor raciocínio privado.

### 2.4 RAG, memória e configuração

- SmartRouter/QueryRouter classificam intenção localmente e selecionam coleções e cadeia de provider adequadas.
- Busca híbrida e evidências contraditórias ficam marcadas como incompletas/conflitantes.
- directVectorStore.ts e directUserFrameworkStore.ts substituem wrappers amplos por adaptadores diretos.
- Chroma é inicializado com timeout e fail-open; indisponibilidade vira motivo de degradação explícito.
- Recall de memória é limitado a três itens; consulta, entradas e escrita final têm limites e sanitização.
- Apenas o resumo final é persistido, com metadados de run, turno, métricas e crítica.
- framework_config.json define um catálogo validado de Scrum e Kanban, com papéis, rituais, artefatos, métricas e regras de risco.
- Frameworks enviados pelo usuário continuam aceitos fora do catálogo, desde que tenham nome e texto.
- economicScenarioLoader.ts valida cost_profiles.md e seleciona de forma seedada os cenários recession, base e expansion.
- simulationRulesLoader.ts lê simulation_rules.json, com threshold de plausibilidade e clamps para ROI extremo positivo/negativo.
- externalToolStub.ts fornece um contrato offline, versionado e seedado para riscos.
- HealthMonitor.ts avalia custo, tokens, duração, incidentes, risco e uso de fallback, emitindo alertas e estado degradado.

### 2.5 Providers, API e segurança

- RAG/src/services/ProviderGateway.ts centraliza chamadas de geração no processo Node.
- Chaves Google, OpenAI e DeepSeek são deduplicadas, rotacionadas e tentadas em fallback; valores nunca são enviados ao bundle do browser.
- O Google usa GEMINI_MODEL, com default gemini-2.5-flash; call sites aposentados gemini-1.5-* foram removidos.
- Requests têm timeout, AbortSignal, limite de tokens e tratamento de falha sanitizado.
- A configuração Gemini reduz o orçamento de raciocínio quando necessário para respostas estruturadas.
- ProviderGatewayError carrega códigos de falha seguros para diagnóstico.
- services/providerClient.ts é o cliente frontend do gateway; o browser recebe apenas a URL da API.
- vite.config.ts deixou de injetar API_KEY/GEMINI_API_KEY em process.env durante o build.
- .env.example e RAG/.env.example enumeram as variáveis realmente lidas, sem valores reais.
- RAG/src/server.ts expõe:
  - GET /api/status para disponibilidade e modo;
  - POST /api/generate para geração server-side;
  - POST /api/simulate para a execução agentic;
  - POST /api/ingest para ingestão validada.
- CORS é restrito às origens configuradas, o JSON tem limite de 2 MB e respostas de erro não vazam detalhes internos.
- O endpoint de simulação aceita ids de personas reais, formato legado de strings e teamSample limitado.

### 2.6 Frontend e experiência de uso

- App.tsx organiza a máquina upload → configuração → simulação → resultados/batch e verifica disponibilidade agentic.
- UploadSection.tsx aceita texto e arquivos txt, md, json, csv, pdf e docx, com múltiplos frameworks.
- ConfigForm.tsx expõe modo standard/agentic, tamanho da empresa, cenários econômicos, framework e parâmetros.
- SimulationLoader.tsx comunica as etapas da execução.
- Dashboard.tsx foi ampliado com:
  - proveniência live, degraded ou fixture;
  - avisos de que sinais são hipóteses para investigação, não previsões;
  - timeline de sinais e alertas (sirens);
  - moral, velocidade, confiança, ROI, QPC, TTS, TIR, custo e tokens;
  - replan, degradação e razões de fallback;
  - contexto econômico e multiplicadores macro;
  - hash de simulação e exportação JSON.
- ComparisonDashboard.tsx compara frameworks por ROI, adoção, prazo, risco e trajetória.
- BatchSimulationPanel.tsx mostra progresso, resultados e exportação CSV.
- Componentes e tipos foram ajustados para campos opcionais novos sem quebrar resultados antigos.
- index.html recebeu favicon SVG inline e metadados coerentes.
- O bundle não contém SDKs de provider nem credenciais; componentes pesados permanecem lazy quando aplicável.

### 2.7 Batch, racing e leveza

- services/batchService.ts limita concorrência do batch a três workers, preserva seeds e coleta progresso.
- AgentRacingService.ts executa agentes em paralelo, propaga timeout/cancelamento, escolhe vencedor de forma ponderada e produz ensemble determinístico.
- Falhas individuais não derrubam toda a corrida; o resultado identifica agentes concluídos e falhos.
- SmartChunker, vectorStore e UserFrameworkStore foram simplificados para reduzir dependências e caminhos indiretos.
- Dependências não utilizadas e wrappers amplos foram removidos dos manifests/lockfiles do root e do RAG.
- A política de fallback mantém o modo standard funcional quando backend, Chroma ou provider externo estão indisponíveis.

## 3. Observabilidade e sinais explicativos

O resultado agora explicita como a simulação chegou às conclusões:

- reasoning_log bounded registra roteamento, recuperação, persona, ROI, crítica, replan, memória, ferramenta e saúde;
- metricas_agenticas agrega tokens, custo, duração, router, incidentes, TIR, QPC e quantidade de replans;
- degraded_reasons identifica cada contingência relevante;
- failureCodes permite diagnóstico seguro do gateway;
- a UI diferencia execução ao vivo de resultado degradado/fixture;
- sinais emergentes e eventos de RH são apresentados como alertas para validação humana;
- cenários econômicos e ferramenta offline exibem claramente suas hipóteses e limitações.

## 4. Testes adicionados ou ampliados

Foram adicionados testes para:

- integração do StateGraph, topologia, ciclo de crítica, ROI, replan, isolamento profundo e limpeza de checkpoint;
- cancelamento durante narrativa, crítica, recall e persistência;
- memória limitada, sanitizada e fail-open;
- frameworks arbitrários e evidências RAG contraditórias;
- ProviderGateway, rotação de chaves, fallback, timeout, AbortSignal e sanitização;
- SmartRouter/QueryRouter, intenção determinística e fallback entre providers;
- HealthMonitor, regras de plausibilidade, cenários econômicos e ExternalToolStub;
- racing concorrente, seleção determinística, ensemble e timeout;
- validação HTTP dos endpoints e formato de erro seguro;
- testes offline do root, parser/health-check de chaves e replay seedado.

Arquivos de teste incluídos no snapshot:

    RAG/src/tests/config_tools.test.ts
    RAG/src/tests/index.test.ts
    RAG/src/tests/orchestrator.test.ts
    RAG/src/tests/provider_gateway.test.ts
    RAG/src/tests/racing.test.ts
    RAG/src/tests/router.test.ts
    RAG/src/tests/self_improvement.test.ts
    RAG/src/tests/server.test.ts
    scripts/api_key_health_check.test.mjs
    scripts/root_offline.test.ts

## 5. Verificações realizadas

### Gates automatizados

npm run quality foi concluído com sucesso, incluindo:

    npm run typecheck    → aprovado (root + RAG)
    npm test             → aprovado (offline + health-check + testes RAG)
    npm run build:all    → aprovado (Vite + TypeScript do RAG)
    npm run audit:all    → 0 vulnerabilidades (root + RAG)

O build emite apenas um aviso não bloqueante sobre chunks minificados acima de 500 kB.

### Chaves de API

npm run health:keys terminou com exit code 0: 19 entradas configuradas nos .env locais autenticaram/responderam. O comando não imprime valores, fingerprints ou corpos de resposta.

npm run health:keys:generate está disponível para testar geração mínima. Durante a verificação, limitações de quota, billing e modelo foram distinguidas de credenciais inválidas; não há indicação de substituição por chave inválida, mas a geração ao vivo continua sujeita às contas externas.

### Smoke de browser

scripts/browser_smoke.mjs automatiza Edge/Chrome headless, upload, configuração, modo agentic, resultados desktop/mobile e checagem de hash, sinais, proveniência e métricas. O fluxo foi exercitado durante a revisão; quando um provider externo respondeu com quota/503, o caminho degradado fail-open foi observado. Os screenshots de QA ficam em artifacts/qa/, diretório ignorado pelo Git.

### Segurança do commit

- .env e RAG/.env não são rastreados;
- a inspeção staged não encontrou padrões de chaves Google/OpenAI adicionados;
- git diff --cached --check passou;
- a branch local e origin/main apontaram para o mesmo SHA após o push.

## 6. Inventário dos arquivos alterados

### Configuração, documentação e dados

.env.example, .gitignore, ARCHITECTURE.md, DIAGRAMAS.md, README.md, progress.md, next_steps/completion_audit.md, RAG/.env.example, RAG/cost_profiles.md, RAG/framework_config.json, RAG/simulation_rules.json, index.html, package.json, package-lock.json, RAG/package.json, RAG/package-lock.json, tsconfig.json e vite.config.ts.

### Backend, agentes e serviços RAG

RAG/src/agents/CriticAgent.ts, DocumentAgent.ts, orchestrator.ts, personaAgent.ts, roiCalculator.ts, RAG/src/main.ts, RAG/src/server.ts, RAG/src/types/index.ts, RAG/src/services/AgentRacingService.ts, HealthMonitor.ts, LLMProvider.ts, MetricsService.ts, ProviderGateway.ts, SelfImprovementService.ts, SmartChunker.ts, SmartRouter.ts, UserFrameworkStore.ts, directUserFrameworkStore.ts, directVectorStore.ts, economicScenarioLoader.ts, externalToolStub.ts, frameworkConfigLoader.ts, queryRouter.ts, simulationRulesLoader.ts e vectorStore.ts.

### Frontend e serviços compartilhados

App.tsx, components/BatchSimulationPanel.tsx, components/ComparisonDashboard.tsx, components/ConfigForm.tsx, components/Dashboard.tsx, components/SimulationLoader.tsx, components/UploadSection.tsx, components/ui/BrutalButton.tsx, services/SmartChunker.ts, services/agenticService.ts, services/batchService.ts, services/geminiService.ts, services/metricsCalculator.ts, services/personaEnricher.ts, services/providerClient.ts, services/ragService.ts e types.ts.

### Testes e ferramentas operacionais

scripts/api_key_health_check.mjs, scripts/api_key_health_check.test.mjs, scripts/browser_smoke.mjs, scripts/root_offline.test.ts, além dos testes RAG listados na seção anterior.

## 7. Limites conhecidos e próximos passos

- A disponibilidade e o custo de Google, OpenAI, DeepSeek, Chroma e rede não podem ser garantidos por testes locais.
- Quota, billing ou modelo indisponível pode produzir resultado degradado explicitamente sinalizado.
- A simulação é uma ferramenta de exploração de cenários; não é previsão financeira, macroeconômica ou recomendação organizacional.
- O warning de chunks acima de 500 kB pode ser tratado futuramente com code-splitting adicional.
- O painel detalhado de estresse individual e a visualização aprofundada de emergentEvents podem ser expandidos; os dados já chegam no resultado.
- Uma futura otimização pode agrupar chamadas de personas por turno para reduzir consumo de quota em equipes grandes.

## 8. Estado final de entrega

O snapshot de implementação foi commitado e publicado em origin/main com o SHA 77ca3ccd00486972e2f495de91b4a9fe1384f9a5. Este relatório é uma documentação complementar adicionada em um commit subsequente, preservando o histórico e a auditoria reproduzíveis.
