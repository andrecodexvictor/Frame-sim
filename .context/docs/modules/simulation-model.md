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

## Em implementação: EmployeeBrain

`RAG/src/core/employeeBrainCore.ts` — **ainda não existe no repo** (pasta
`RAG/src/core/` não existe hoje). Quando implementado, será:

- Puro, determinístico, RNG semeado (mesmo seed → mesmo resultado).
- Estado individual por persona: estresse, humor, energia, engajamento,
  status, memória.
- Catálogo de decisões humanas com triggers (condições que disparam
  decisões).
- Contágio social entre personas (estado de uma persona influencia
  vizinhas).
- O LLM só dá voz ao estado calculado — **zero chamadas extras de LLM** para
  o cálculo em si.

## Invariantes

- Nenhuma função de cálculo de ROI/métrica deve depender de output textual
  não estruturado do LLM — sempre de campos numéricos/estruturados
  (`rawData`) que a matemática processa.
- Estados clamped 0–100 (ver [conventions.md](../conventions.md)).
- Qualquer novo modelo de cálculo (ex.: EmployeeBrain) deve permanecer puro
  e testável sem chamar LLM.

## O que NÃO tocar

- Não deixar o LLM "sugerir" um ROI final que é aceito sem passar por
  `metricsCalculator.ts` / `roiCalculator.ts`.
- Não adicionar chamadas de LLM dentro do cálculo do EmployeeBrain quando
  ele for implementado — a regra é zero chamadas extras.
