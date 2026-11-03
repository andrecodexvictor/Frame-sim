# Auditoria v9 — Jev em personas e chunks

Data: 2026-09-21  
Escopo: mudança v9 não commitada no workspace, comparada contra `HEAD` e contra `next_steps/jev_persona_v9_plan.md`. A revisão incluiu os arquivos rastreados modificados e os novos arquivos não rastreados relacionados a Jev. Nenhum arquivo de produção foi editado durante a auditoria.

## Veredito

**Não aprovar a ativação `active`.** Há bloqueadores de comportamento e de controle operacional. O caminho `off` não mostrou regressão nos testes existentes, mas isso não compensa os defeitos no fallback ativo nem a possibilidade de um request alterar o kill switch server-side.

## Achados bloqueadores

### B1 — fallback de baixa confiança não preserva o caminho determinístico completo

**Severidade: bloqueador (código)**  
Arquivo: `RAG/src/agents/orchestrator.ts:360-433`; relacionado a `RAG/src/services/PersonaJudgmentModule.ts:443-466`.

`PersonaJudgmentModule` sempre devolve uma decisão por stakeholder, inclusive quando a resposta Jev está inválida ou abaixo do gate; nesses casos a decisão tem `origin: deterministic_fallback`. O orquestrador testa apenas `Boolean(decision)` em `useAcceptedJudgment`, portanto trata esse fallback como julgamento aceito, injeta a decisão na narrativa, aplica seus efeitos e chama apenas `evaluateGraveDecisions`, pulando as decisões suaves de `evaluateDecisions`. Isso viola o requisito de que baixa confiança/resposta inválida use o caminho determinístico atual e pode alterar estado, contágio e decisões comportamentais. A aceitação deve depender de `decision.origin === 'jev'`, com fallback integral pelo EmployeeBrain.

### B2 — configuração do request pode contornar o kill switch server-side

**Severidade: bloqueador (código/controle operacional)**  
Arquivo: `RAG/src/agents/orchestrator.ts:188-204,305-309`.

O modo efetivo é calculado como `config?.jev?.mode ?? this.jevMode`. Como `config` vem do request de simulação, um cliente pode enviar `jev.mode: "active"` mesmo quando `JEV_MODE=off` no servidor; se houver chave configurada, isso habilita chamadas externas e aplicação de julgamento. O plano define modos operacionais server-side e kill switch imediato; o modo do request deve ser validado/restrito pelo servidor e nunca elevar o modo acima da política do processo.

### B3 — validação aceita confidence e probabilidade fora do intervalo

**Severidade: alta (código; bloqueia segurança do gate)**  
Arquivos: `RAG/src/services/JevHttpAdapter.ts:47-58,72-89`; `RAG/src/services/PersonaJudgmentModule.ts:350-374`.

O adapter exige apenas número finito para `confidence` e `socialInfluence`, e `validAnswer` também aceita qualquer valor finito acima do mínimo, sem máximo `1`. Assim uma resposta malformada com confidence `999` passa o gate; probabilidade social também não é limitada a `[0,1]`. Isso contradiz a validação estrutural/conservadora do contrato e pode aceitar influência/efeitos externos fora dos limites esperados. Os campos devem ser rejeitados ou normalizados explicitamente para `[0,1]`, preferencialmente rejeitando a resposta.

## Achados altos/médios

### A1 — timeout por request é declarado, mas ignorado pelo módulo de personas

**Severidade: alta (código)**  
Arquivos: `RAG/src/agents/orchestrator.ts:189-202,305-309`; `RAG/src/services/PersonaJudgmentModule.ts:412-466`.

`SimulationConfig.jev.timeoutMs` é encaminhado ao módulo, mas `evaluateTurn` chama a port diretamente sem aplicar esse timeout. O adapter de produção usa somente o timeout capturado no construtor a partir de `JEV_TIMEOUT_MS`; portanto um timeout configurado por simulação não tem efeito. Isso enfraquece o gate operacional e a previsibilidade de cancelamento.

### A2 — modo `shadow` não existe para enriquecimento de chunks

**Severidade: média (código/especificação)**  
Arquivos: `RAG/src/services/JevChunkEnricher.ts:42-50,129-148`; `RAG/src/services/documentLoader.ts:31-50`.

`JevChunkEnricher` aceita apenas `off|active`; `DocumentLoader` habilita o enriquecimento somente quando `JEV_MODE === 'active'`. Em `shadow`, chunks não são enviados nem comparados, apesar de a configuração global documentar `off`, `shadow` e `active` e a tarefa exigir auditoria de uso em chunks. Se chunks permanecerem no escopo, shadow precisa registrar comparação sem alterar conteúdo/resultado; caso contrário, a integração de chunks deve ser removida do caminho v9 explicitamente.

### A3 — testes novos de unidade não fazem parte do `npm run quality`

**Severidade: média (qualidade de testes)**  
Arquivo: `RAG/package.json:11`; `RAG/src/tests/index.test.ts:1-13`.

O entrypoint inclui `jev_integration.test.ts`, mas não importa `persona_judgment.test.ts` nem `jev_chunk_enrichment.test.ts`. Os dois suites foram executados manualmente nesta auditoria e passaram; ainda assim, uma execução futura de `npm run quality` pode passar sem executar esses testes críticos.

### A4 — timers de timeout do adapter HTTP não são cancelados após sucesso

**Severidade: baixa/média (código)**  
Arquivo: `RAG/src/services/JevHttpAdapter.ts:210-246`.

`fetchWithTimeout` cria um `setTimeout` dentro de `timeoutPromise` e não mantém o handle para limpá-lo no `finally`. Cada chamada bem-sucedida deixa um timer pendente até o timeout, gerando trabalho e retenção desnecessários sob carga. Não altera o resultado atual, mas deve ser corrigido junto ao endurecimento de timeout/cancelamento.

## Evidências e gates executados

| Comando | Resultado |
|---|---|
| `git diff --check` | PASS; apenas avisos de conversão LF/CRLF do Git |
| `npm run quality` | PASS, exit 0 |
| `npm run typecheck` | PASS para frontend e RAG |
| `npm test` | PASS; offline, health check de chaves e suite RAG existente |
| `npm run build:all` | PASS; Vite e TypeScript RAG compilados; apenas warning de chunks grandes do Vite |
| `npm run audit:all` | PASS; ambos `npm audit` reportaram 0 vulnerabilidades |
| `npx tsx src/tests/persona_judgment.test.ts` | PASS, 5 testes |
| `npx tsx src/tests/jev_chunk_enrichment.test.ts` | PASS, 1 suite |
| `npx tsx src/tests/jev_integration.test.ts` | PASS, 3 testes |

## Segurança, rede e limitações da evidência

Não foi observada falha de rede nem falha de auditoria de dependências: `npm run quality` terminou com sucesso e `npm audit` encontrou zero vulnerabilidades. Os testes Jev usaram fixtures/fetch injetado e não fizeram chamada externa; portanto não há evidência de que o endpoint real, schema real ou latência real estejam funcionais. Não foram registrados segredos no diff revisado; o adapter usa `Authorization` somente no backend, mas B2 deve ser corrigido para preservar o controle server-side.

## Lacunas não bloqueantes

- Não foi executado smoke test de browser nesta auditoria.
- Não há teste end-to-end que combine resposta Jev de baixa confiança com a atualização do `EmployeeBrain`; esse teste é necessário para capturar B1.
- Não há teste que prove que `JEV_MODE=off` server-side rejeita um request com `config.jev.mode=active`; esse teste é necessário para capturar B2.

