# Relatório Final — Correções do Contrato de API JEV (v9)

Data: 2026-09-21  
Escopo: Correção dos contratos HTTP de produção de acordo com a documentação oficial TypeSafe AI (`https://docs.typesafe.ai/api.md`) e Skill global TypeSafe.

## Correções Implementadas

1. **Schema Oficial nos Adapters HTTP**:
   - Tanto `JevHttpAdapter` (personas) quanto o adapter de chunks em `JevChunkEnricher` foram corrigidos para o formato oficial da API TypeSafe:
     - Corpo da requisição: `{ model, state, questions }`, onde `questions` é um mapa de objetos tipados (`type`, `instructions`, `criteria`).
     - Instruções de personas incluem identidade explícita do stakeholder (`nome`, `cargo`, `id`).
     - `criteria` segue a especificação oficial: mapa de opções para `choice`, array ordenado de níveis para `score`, e mapa `{ true, false }` para `noul`.
     - Resposta da API: `{ model, answers, usage }`, onde `answers` é um mapa indexado exatamente pelos IDs das perguntas.

2. **Decodificação de Respostas e Primitivas Semânticas**:
   - `choice`: decodifica `choice` e `confidence` em `[0, 1]`.
   - `score`: decodifica `score` e `confidence` em `[0, 1]`, convertendo a pontuação contínua 0..3 para a intensidade discreta delimitada (`baixa`, `média`, `alta`, `crítica`).
   - `noul`: decodifica a probabilidade `noul` em `[0, 1]`. Respeita a especificação oficial onde respostas Noul não possuem campo `confidence`; probabilidade agora opera de forma independente de confiança de categorização.
   - Correspondência exata de IDs de perguntas sem realizar split por delimitador, preservando IDs de personas com underscores (ex.: `dev_lead_1`).

3. **Injeção Narrativa Restrita a Origem JEV**:
   - Em `RAG/src/agents/orchestrator.ts`, `narrativeJudgment` exige estritamente `decision?.origin === 'jev'`. Quando ocorre fallback determinístico (baixa confiança, timeout, erro de rede), o sumário narrativo é `undefined`, preservando integralmente o comportamento do `EmployeeBrain`.

4. **Shadow Mode para Enriquecimento de Chunks**:
   - Corrigido `JevChunkEnricher.createConfiguredJudge` para instanciar o adapter também em modo `shadow`, permitindo que a chamada HTTP de observação seja disparada e métricas coletadas sem modificar o conteúdo ou estrutura original dos chunks.

5. **Testes de Contrato e Regressão**:
   - `RAG/src/tests/persona_judgment.test.ts`: adicionado teste de contrato oficial com schema de `questions` e `answers`, IDs com underscore, conversão de score e noul sem confidence.
   - `RAG/src/tests/jev_chunk_enrichment.test.ts`: adicionado teste com mock HTTP demonstrando execução da chamada no modo `shadow` com preservação dos chunks originais.
   - `RAG/src/tests/jev_integration.test.ts`: validada asserção de que `narrativeJudgment` é `undefined` no fallback determinístico.

## Verificação dos Gates

- `npx tsx src/tests/persona_judgment.test.ts`: PASS (8 testes)
- `npx tsx src/tests/jev_chunk_enrichment.test.ts`: PASS (suíte completa)
- `npx tsx src/tests/jev_integration.test.ts`: PASS (5 testes)
- `npm run typecheck`: PASS (0 erros)
