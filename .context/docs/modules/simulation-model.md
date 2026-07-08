# Módulo: Modelo de simulação (matemática determinística)

## Propósito

Isolar todo cálculo de negócio (ROI, custo, engajamento) da geração de texto
por LLM. É o invariante mais importante do projeto.

## Invariante central

> **O LLM gera narrativa e dados brutos (`rawData`); a matemática gera os
> números finais. ROI NUNCA vem do LLM.**

Implementado em:
- Frontend: `services/metricsCalculator.ts` (chamado a partir de
  `services/geminiService.ts` / `services/ragService.ts`).
- Backend: `RAG/src/agents/roiCalculator.ts` (`ROICalculatorAgent`, chamado
  pelo `OrchestratorAgent`).

## Componentes do modelo

- **Curva J de aprendizado** — produtividade cai antes de subir ao adotar um
  novo framework.
- **Dívida técnica** — acumula ao longo dos turnos se não tratada.
- **CoNQ (Cost of Non-Quality)** — custo de não-qualidade.
- **SurpriseFactor** — ruído/eventos inesperados, ~15% de peso no resultado.
- **FrameworkFit** — adequação do framework escolhido ao porte da
  organização (arquétipo corporativo).
- **Ruído gaussiano** — aplicado para evitar resultados determinísticos
  demais entre rodadas (mas o cálculo em si é determinístico dado o seed).

## Implementado: EmployeeBrain

`RAG/src/core/employeeBrainCore.ts` — módulo puro (zero imports, importável
por backend e frontend), testado em `RAG/src/tests/brain.test.ts`
(6 testes, `npx tsx src/tests/brain.test.ts` dentro de `RAG/`):

- Puro, determinístico, RNG semeado mulberry32 (mesmo seed → mesmo
  resultado).
- Estado individual por persona: estresse (0-100), humor (-100..100),
  energia, engajamento, status (`ativo|licenca|burnout|pediu_demissao`),
  memória FIFO de 12 eventos, reflexão a cada 3 turnos, traços derivados
  do perfil (resiliencia/adaptabilidade/influencia).
- Catálogo de decisões humanas com triggers (`evaluateDecisions`, máx. 1
  grave por turno, ordem fixa): pedido_demissao, burnout→licença (o retorno
  recupera humor +40 e zera o streak de estresse alto), resistencia_passiva,
  confronto_lideranca (avaliado ANTES de fofoca — gatilho subconjunto
  estrito), fofoca, apoiar_mudanca, pedir_ajuda.
- Contágio social entre personas (`applyContagion` — fofoca/apoio propagam
  humor/estresse a N alvos ativos sorteados, nunca o próprio).
- **moral/velocidade vêm de `aggregate()`; o LLM só narra e ajusta a
  confiança ±5** — `orchestrator.consolidateTurn` commita o estado
  determinístico antes de chamar o LLM (o fallback "moral -= 5" foi
  removido).
- Modo standard: `simulateTeamOffline()` roda o time inteiro pré-LLM com
  **zero chamadas LLM**; os eventos emergentes entram no prompt do Gemini
  como fatos e `keyPersonas[].sentiment` é sobrescrito pelo humor
  determinístico (`SimulationOutput.emergentEvents?`).

## Invariantes

- Nenhuma função de cálculo de ROI/métrica deve depender de output textual
  não estruturado do LLM — sempre de campos numéricos/estruturados
  (`rawData`) que a matemática processa.
- Estados clamped 0–100 (ver [conventions.md](../conventions.md)).
- Qualquer novo modelo de cálculo deve permanecer puro e testável sem chamar
  LLM — o EmployeeBrain é o exemplo canônico (roda os 6 testes sem rede).

## O que NÃO tocar

- Não deixar o LLM "sugerir" um ROI final que é aceito sem passar por
  `metricsCalculator.ts` / `roiCalculator.ts`.
- Não adicionar chamadas de LLM dentro do cálculo do EmployeeBrain
  (`employeeBrainCore.ts` deve continuar com zero imports) — a regra é zero
  chamadas extras.
- Não voltar a deixar o LLM emitir `moral_time_delta`/`velocidade_delta` no
  `consolidateTurn` — esses números agora vêm de `aggregate(brains)`.
