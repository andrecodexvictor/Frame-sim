# Plano de entrega — Frame-sim v9 com Jev nas personas

Prazo-alvo: sexta-feira, 2026-09-25.

## Resultado da decisão

Para colocar simulações melhores em execução ainda nesta semana, a v9 usará **Jev somente nos julgamentos comportamentais estreitos das personas-chave**. O EmployeeBrain continuará responsável pelo estado numérico e pelas decisões graves; o modelo financeiro e o ROI não mudam; o LLM continua responsável apenas pela narrativa.

Invokta e `small-brain` ficam fora do caminho crítico. A publicação futura do Frame-sim como Invokta Action Engine permanece no backlog após a estabilização da v9.

## Escopo fechado da v9.0

### Jev decide

- reação comportamental: `apoiar`, `neutro`, `resistir`, `confrontar` ou `pedir_ajuda`;
- intensidade semântica: `baixa`, `média`, `alta` ou `crítica`;
- probabilidade de a reação influenciar colegas;
- faixa de impacto moral, posteriormente convertida em número pelo código.

### O código continua decidindo

- burnout, licença e pedido de demissão;
- atualização de estresse, humor, energia e engajamento;
- contágio e deltas exatos;
- ROI, custos, curvas, contagens, datas e limites;
- aplicação de thresholds e fallback;
- seed, auditoria e replay.

### Fora do escopo desta semana

- Invokta/MCP;
- substituição do CriticAgent ou QueryRouter;
- JEV para as 30 personas de fundo;
- alteração do modelo financeiro;
- retreinamento ou calibração estatística definitiva;
- remoção do caminho determinístico atual.

## Desenho do módulo

Criar um módulo profundo chamado `PersonaJudgmentModule`. Sua interface externa deve conter uma única operação:

```ts
evaluateTurn(input: PersonaTurnInput, signal?: AbortSignal): Promise<PersonaTurnJudgment>
```

O caller informa somente situação, configuração, turno, personas-chave e seus estados atuais. A implementação esconde:

- transformação de números em categorias semânticas;
- construção das perguntas Jev;
- batching;
- validação da resposta;
- confidence gating;
- conversão das faixas em efeitos exatos;
- timeout, retry, fallback, métricas e trilha de auditoria.

Essa interface é a superfície de teste. Tipos do Jev, payload HTTP e detalhes de perguntas não atravessam a seam.

### Seam externa

Definir internamente uma port mínima para o serviço externo:

```ts
interface SemanticJudgePort {
  evaluate(request: SemanticJudgeRequest, signal?: AbortSignal): Promise<SemanticJudgeResponse>;
}
```

Adapters:

- `JevHttpAdapter`: produção, usando `POST https://api.typesafe.ai/v1/systemone`;
- `FixtureSemanticJudgeAdapter`: testes determinísticos, sem rede.

Dois adapters tornam a seam real. O fallback comportamental não será outro adapter: ele reutilizará as funções puras do EmployeeBrain dentro da implementação do módulo.

## Fluxo por turno

```text
1. EmployeeBrain fornece o estado anterior
2. PersonaJudgmentModule avalia somente stakeholders-chave
3. Confiança suficiente?
   ├─ sim: código converte julgamento em efeitos
   └─ não: caminho determinístico atual
4. PersonaAgent recebe a decisão como fato e gera apenas a fala
5. EmployeeBrain aplica impacto, decisões graves e contágio
6. Agregação, CriticAgent e ROI seguem inalterados
```

As personas de fundo continuam 100% determinísticas. Isso mantém o payload pequeno, reduz contexto irrelevante para o Jev e limita a uma chamada remota por turno.

## Alterações planejadas por arquivo

### Novos módulos

- `RAG/src/services/PersonaJudgmentModule.ts`
  - interface externa;
  - compactação do estado;
  - confidence gating;
  - mapeamento de efeitos;
  - fallback e auditoria.
- `RAG/src/services/JevHttpAdapter.ts`
  - cliente REST sem SDK novo;
  - autenticação server-side;
  - timeout, aborto e retry apenas para `429`/`529`;
  - validação estrutural da resposta.
- `RAG/src/tests/persona_judgment.test.ts`
  - fixtures, malformed responses, baixa confiança, timeout e fallback.

### Módulos existentes

- `RAG/src/core/employeeBrainCore.ts`
  - separar decisões graves das decisões comportamentais suaves;
  - preservar `evaluateDecisions` como composição compatível para modo offline.
- `RAG/src/agents/orchestrator.ts`
  - chamar o módulo uma vez antes do loop de stakeholders;
  - usar julgamento na atualização e narrativa;
  - manter personas de fundo e decisões graves no caminho puro.
- `RAG/src/agents/personaAgent.ts`
  - aceitar julgamento comportamental opcional;
  - parar de tratar `impacto_moral` livre do LLM como fonte de verdade quando houver julgamento validado;
  - continuar gerando fala e emoção.
- `RAG/src/types/index.ts`
  - adicionar tipos de julgamento, origem da decisão e auditoria;
  - adicionar métricas Jev como campos opcionais.
- `RAG/src/services/MetricsService.ts`
  - registrar chamadas, latência, input tokens, fallbacks e baixa confiança.
- `RAG/src/tests/brain.test.ts`
  - provar que decisões graves e invariantes continuam determinísticos.
- `RAG/src/tests/orchestrator.test.ts`
  - provar integração, cancelamento e fallback sem rede.
- `RAG/.env.example` e `README.md`
  - documentar configuração e modos.

## Contrato Jev inicial

Enviar somente dados relevantes e categorizados. Não pedir matemática ao modelo.

Para cada stakeholder-chave:

- `reaction_<id>`: Choice entre cinco reações fechadas;
- `intensity_<id>`: Score com quatro níveis descritivos;
- `social_influence_<id>`: Noul para probabilidade de contagiar colegas;
- `moral_direction_<id>`: Choice entre `negative`, `neutral` e `positive`.

O código combina as respostas e aplica efeitos tabelados. Um Choice só é aceito inicialmente com `confidence >= 0.75`. Um Noul só aciona contágio com probabilidade `>= 0.80`. Esses valores são conservadores e devem permanecer configuráveis até existirem dados rotulados.

## Configuração operacional

```env
TYPESAFE_API_KEY=
JEV_MODE=off
JEV_MODEL=jev-1.13.0
JEV_TIMEOUT_MS=3000
```

Modos:

- `off`: comportamento v8 atual;
- `shadow`: chama Jev e registra comparação, sem alterar resultado;
- `active`: aplica somente respostas acima dos gates; todo o restante usa fallback.

Sem chave, com timeout, resposta inválida ou rate limit esgotado, a simulação termina pelo caminho determinístico. A chave nunca chega ao frontend.

## Auditoria e reprodutibilidade

Cada turno registra, de forma limitada:

- versão exata do modelo;
- hash do request normalizado;
- respostas tipadas e confiança;
- origem efetiva (`jev` ou `deterministic_fallback`);
- latência e uso de tokens;
- motivo de fallback.

Não registrar a chave nem prompts completos nos logs. O resultado persistido deve conter informação suficiente para replay de uma decisão já obtida.

## Cronograma desta semana

### Segunda, 21/09 — contrato e baseline

- congelar este escopo;
- criar fixtures de três casos: favorável, ambíguo e crítico;
- registrar outputs atuais com seeds fixas;
- definir tipos e testes da interface.

Saída: baseline reproduzível e testes inicialmente falhando para o novo módulo.

### Terça, 22/09 — implementação isolada

- implementar `PersonaJudgmentModule` com adapter de fixture;
- separar decisões graves/suaves sem alterar o resultado do modo `off`;
- implementar `JevHttpAdapter` e validação de resposta.

Saída: módulo testado sem rede; modo `off` idêntico ao baseline.

### Quarta, 23/09 — integração em shadow

- integrar uma chamada por turno no orquestrador;
- acrescentar auditoria e métricas;
- rodar `shadow` nos casos com seed fixa;
- ajustar prompts em português se houver baixa confiança sistemática.

Gate: se não houver `TYPESAFE_API_KEY`, continuar com fixtures e manter `active` bloqueado; as simulações continuam disponíveis em `off`.

### Quinta, 24/09 — active conservador

- ativar somente para stakeholders-chave e confiança alta;
- verificar coerência entre julgamento, fala e estado;
- executar cenários com falha, timeout e resposta malformada;
- comparar v8, shadow e active nas mesmas seeds.

Saída: release candidate com kill switch imediato.

### Sexta, 25/09 — validação e entrega

- executar `npm run quality`;
- executar smoke test browser e backend;
- revisar métricas, custos e fallbacks;
- documentar como iniciar `off`, `shadow` e `active`;
- marcar v9.0 experimental somente se todos os gates passarem.

## Gates de aceitação

1. `JEV_MODE=off` preserva os resultados determinísticos existentes para seeds fixas.
2. Ausência de chave, timeout, `429`, `529`, JSON inválido ou baixa confiança nunca interrompe a simulação.
3. No máximo uma chamada Jev por turno e somente para stakeholders-chave.
4. Burnout, licença, demissão e ROI continuam sob código determinístico.
5. `impacto_moral` efetivo não vem de número livre gerado pelo LLM quando Jev é aceito.
6. Toda decisão externa informa modelo, confiança, origem e motivo de fallback.
7. Cancelamento do request aborta também a chamada Jev.
8. Nenhuma credencial aparece no bundle do frontend ou nos logs.
9. Testes frontend/backend, builds e auditorias do comando `npm run quality` passam.
10. É possível rodar uma simulação completa em `off` mesmo que Jev esteja totalmente indisponível.

## Critério de abortar a ativação

Se até quinta-feira houver instabilidade de schema, latência incompatível, baixa confiança predominante em português ou falta de chave válida, entregar a v9 com `off` e `shadow`, mantendo `active` desabilitado. Isso preserva o prazo sem esconder risco. O trabalho ainda terá valor: seam, testes, métricas e comparação estarão prontos para ativação posterior.

