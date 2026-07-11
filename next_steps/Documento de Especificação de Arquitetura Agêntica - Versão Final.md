# Documento de Especificação de Arquitetura Agêntica - Versão Final

**Projeto:** Frame-sim-main (Simulador Agêntico de Frameworks)
**Foco:** Transformação para Sistema Agêntico de Nível 4 (ACE)
**Data:** 07 de Dezembro de 2025
**Desenvolvedor Alvo:** Agente de Desenvolvimento

## 1. Introdução e Análise Conceitual

Este documento consolida a análise e as especificações técnicas para a evolução do simulador de frameworks (`Frame-sim-main`) para um **Sistema Agêntico de Nível 4**, baseado no conceito de **Entidades Cognitivas Autônomas (ACE)**. O objetivo é aumentar a robustez, a eficiência operacional e, crucialmente, o **realismo** da simulação para fins acadêmicos (TCC).

### 1.1. Arquitetura Multi-LLM e Orquestração Inteligente

A proposta de integrar múltiplos LLMs (Gemini, DeepSeek, GPT) visa a **especialização e otimização de custos**. O agente `orchestrator` será transformado em um **Smart Router** para otimizar a tríade Qualidade, Velocidade e Custo.

| Modelo | Vantagem Estratégica | Uso Recomendado no Simulador |
| :--- | :--- | :--- |
| **GPT (e.g., GPT-4)** | Maior capacidade de raciocínio complexo e auto-crítica. | Tarefas de **Planejamento**, **Auto-Crítica** e geração de cenários de alta complexidade. |
| **Gemini** | Forte em raciocínio e geração de *insights*. | Geração de *insights* e **análise de dados** pós-simulação, e criação de **perfis de persona** detalhados. |
| **DeepSeek** | Custo-benefício superior para tarefas de alto volume e menor complexidade. | **Roteamento de Consultas**, tarefas repetitivas de **Execução** e validação de formato de saída. |

### 1.2. Framework ACE (Autonomous Cognitive Entities)

O ACE fornece o *blueprint* para a autonomia, elevando o sistema para o Nível 4 de Maturidade.

| Camada ACE | Função no Framework Agêntico | Aplicação no Simulador |
| :--- | :--- | :--- |
| **Aspirational** | Define o propósito de longo prazo. | "Maximizar a precisão da previsão de ROI em 95% dos cenários". |
| **Global Strategy** | Cria planos de alto nível. | Geração de um **Plano de Simulação** (Planning Pattern). |
| **Agent Model** | Define as personas, papéis e capacidades. | Formalização dos agentes existentes e novos (`SmartRouter`, `CriticAgent`). |
| **Executive Function** | Executa o plano e gerencia recursos. | O agente `orchestrator` aprimorado. |
| **Cognitive Control** | Monitora o desempenho, realiza **Auto-Crítica** e ajusta o plano. | Implementação do **Self-Reflection Pattern**. |
| **Task** | Ações concretas e de baixo nível. | Chamadas de API para os LLMs, execução de código, e operações de banco de dados vetorial. |

### 1.3. Métricas de Sucesso Além do ROI

Para um framework, o sucesso deve ser medido pela **qualidade e eficiência operacional** do sistema agêntico.

| Métrica Agêntica | Definição | Relevância para o Framework |
| :--- | :--- | :--- |
| **Qualidade por Ciclo (QPC)** | A precisão da saída do agente antes de qualquer ciclo de auto-correção. | Mede a eficiência do *prompt engineering* e a qualidade da primeira inferência. |
| **Tempo para Solução (TTS)** | O tempo total desde a entrada do usuário até a entrega da **saída final validada**. | Essencial para medir a latência em arquiteturas Multi-LLM e com ciclos de *Self-Reflection*. |
| **Taxa de Incidência de Risco (TIR)** | Frequência de erros críticos (e.g., *hallucinations*, falhas de segurança, *loops* infinitos). | Mede a robustez e a eficácia dos *guardrails* e do **Cognitive Control**. |

---

## 2. Análise de Realismo: Manipulação vs. Simulação Realista

A percepção de que o simulador está "manipulando os resultados" decorre da **falta de Complexidade Emergente**. O sistema atual opera em um nível de **Simulação Controlada (Nível 1-2)**, onde o resultado é uma consequência linear e previsível das entradas.

**O objetivo das Fases 2 e 3 é injetar incerteza justificada para gerar Comportamento Emergente.**

| Característica | Simulação Controlada (Atual) | Simulação Realista (Objetivo) |
| :--- | :--- | :--- |
| **Comportamento** | Linear e Determinístico. | Não-linear e Emergente. |
| **Causa do Resultado** | O resultado é uma paráfrase inteligente do *prompt* e do contexto RAG. | O resultado é a consequência de uma **interação complexa** entre agentes com vieses, memória e incerteza. |
| **Incerteza** | Aleatória e não justificada. | **Justificada** por vieses, eventos externos e contexto incompleto. |

---

## 3. Especificação Técnica Detalhada - Próximos Passos

### 3.1. Fase 1: Base Arquitetural e Auto-Crítica (Prioridade Alta)

| ID | Componente | Descrição da Tarefa | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **1.1-1.5** | **Smart Router (Multi-LLM)** | Implementar o serviço `smartRouter.ts` para rotear chamadas de LLM com base no tipo de agente (e.g., `ROICalculator` para DeepSeek, `CriticAgent` para GPT-4), otimizando custo e qualidade. | `services/smartRouter.ts` (Novo), Refatoração de Agentes e Serviços LLM |
| **2.1-2.4** | **Self-Reflection (CriticAgent)** | Implementar o `CriticAgent` para avaliar a plausibilidade da saída (e.g., ROI) e, se a pontuação for baixa, forçar um ciclo de *replan* no `orchestrator`. | `RAG/src/agents/criticAgent.ts` (Novo), `RAG/src/agents/orchestrator.ts` |
| **3.1-3.4** | **Métricas Agênticas** | Implementar a captura e exibição das métricas **QPC**, **TTS** e **TIR** no `orchestrator` e no `Dashboard.tsx`. | `RAG/src/agents/orchestrator.ts`, `components/Dashboard.tsx` |

### 3.2. Fase 2: Realismo, Memória e Complexidade Emergente (Prioridade Média)

| ID | Componente | Descrição da Tarefa | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **4.1** | **Persona com Vieses** | Modificar o `PersonaAgent` para incluir um "Viés Cognitivo" (e.g., Excesso de Confiança) que influencia o prompt de decisão. | `RAG/src/agents/personaAgent.ts`, `RAG/src/types/index.ts` |
| **4.2** | **RAG com Variabilidade** | Aumentar a base de conhecimento com documentos contraditórios e aprimorar o `queryRouter.ts` para buscar contexto incompleto ou conflitante. | `RAG/src/services/documentLoader.ts`, Novos Documentos de Contexto |
| **4.3** | **Cálculo com Estocasticidade Controlada** | Modificar o `roiCalculator.ts` para adicionar um **Fator de Ruído Controlado** (variável aleatória limitada por um fator de risco decidido pelo `PersonaAgent`). | `services/metricsCalculator.ts` ou `RAG/src/agents/roiCalculator.ts` |
| **5.1-5.3** | **Memória de Longo Prazo** | Configurar o Vector Store (`vectorStore.ts`) para armazenar o **histórico de simulações passadas** (decisões, resultados e críticas) como contexto para novas simulações, simulando o "aprendizado" do sistema. | `RAG/src/services/vectorStore.ts`, `RAG/src/agents/orchestrator.ts` |
| **5.4** | **Roteamento de Cenário Econômico (Custo Dinâmico)** | Implementar a lógica de **Roteamento de Contexto Unificado** para o custo: <br>a) Adicionar a escolha de "Cenário Econômico" na interface. <br>b) Criar o `cost_profiles.md` no RAG. <br>c) O `orchestrator` busca o custo diário correspondente e injeta no prompt do `ROICalculator`. | `components/ConfigForm.tsx`, `RAG/cost_profiles.md` (Novo), `RAG/src/agents/orchestrator.ts` |

### 3.3. Fase 3: Autonomia, Escala e Generalização (Prioridade Baixa)

| ID | Componente | Descrição da Tarefa | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **6.1** | **Ajuste de Goal (Aspirational Layer)** | Implementar a lógica para que o sistema possa sugerir um **ajuste no objetivo de alto nível** da simulação após múltiplas falhas de *replan* (TIR alto). | `RAG/src/agents/orchestrator.ts` |
| **6.2** | **Implementação do Padrão ReAct** | Formalizar o ciclo **Reason-Act-Observe-Repeat** no `orchestrator`, garantindo que o agente justifique o uso de uma ferramenta antes de invocá-la. | `RAG/src/agents/orchestrator.ts` |
| **7.1** | **Processamento Paralelo** | Otimizar o `BatchSimulationPanel.tsx` para executar múltiplas simulações em paralelo. | `components/BatchSimulationPanel.tsx`, `services/batchService.ts` |
| **7.3** | **Generalização de Frameworks** | Refatorar o `orchestrator` para carregar e simular **qualquer** framework de gestão a partir de um arquivo de configuração (`framework_config.json`). | `RAG/framework_config.json` (Novo), `RAG/src/agents/orchestrator.ts` |

Este documento serve como o mapa completo para a evolução do seu simulador, garantindo que ele se torne uma ferramenta acadêmica robusta e de ponta.

---

## 4. Exemplos de Prompts para Agentes (Prompt Engineering)

Esta seção fornece exemplos de prompts de sistema e de usuário que devem ser utilizados para guiar o comportamento dos agentes, garantindo que eles operem de forma consistente e agêntica.

### 4.1. Prompt para o CriticAgent (Fase 1)

Este prompt é crucial para o padrão **Self-Reflection** e para a captura da métrica **Qualidade por Ciclo (QPC)**.

**Objetivo:** Avaliar a plausibilidade do resultado da simulação e sugerir um ajuste (Replan) se necessário.

```markdown
**Role:** Você é o Agente Crítico (CriticAgent), especialista em análise de risco e plausibilidade de negócios. Sua única função é avaliar o resultado de uma simulação de ROI e determinar se ele é realista, dadas as premissas.

**Instruções:**
1.  Analise o `Resultado da Simulação` e o `Contexto da Simulação`.
2.  Calcule uma `Plausibilidade_Score` de 0 a 100, onde 100 é perfeitamente realista e 0 é totalmente implausível.
3.  Se a `Plausibilidade_Score` for menor que 70, você DEVE gerar uma `Replan_Suggestion` detalhada.
4.  A `Replan_Suggestion` deve ser um novo prompt de sistema para o Orchestrator, indicando o que deve ser ajustado para a próxima iteração (ex: "Aumente o fator de risco do PersonaAgent", "Considere um cenário de mercado mais pessimista").
5.  Sua saída DEVE ser um objeto JSON estrito.

**Contexto da Simulação:**
{contexto_da_simulacao_completo}

**Resultado da Simulação:**
{resultado_do_roi_calculator}

**Formato de Saída (JSON):**
{
  "Plausibilidade_Score": [0-100],
  "Justificativa": "Análise detalhada da plausibilidade...",
  "Replan_Necessario": [true/false],
  "Replan_Suggestion": "Novo prompt de sistema para o Orchestrator, se necessário."
}
```

### 4.2. Prompt para o PersonaAgent (Fase 2 - Com Vieses)

Este prompt incorpora o conceito de **Viés Cognitivo** (Fase 2) para injetar incerteza justificada na decisão.

**Objetivo:** Gerar uma decisão de investimento ou estratégia de projeto baseada em um perfil de persona e um viés específico.

```markdown
**Role:** Você é o Agente Persona (PersonaAgent), um Gerente de Projeto Sênior. Sua decisão é crucial para a simulação.

**Instruções:**
1.  Você DEVE tomar uma decisão de investimento/estratégia (e.g., "Investir 80% do orçamento em Inovação" ou "Adotar uma abordagem de baixo risco").
2.  Sua decisão DEVE ser fortemente influenciada pelo seu `Viés Cognitivo` e pelo `Contexto de Mercado` fornecido.
3.  Seu `Viés Cognitivo` é: **{viés_cognitivo_injetado_pelo_orchestrator}**.
4.  Seu `Contexto de Mercado` é: **{contexto_rag_recuperado}**.
5.  Sua saída DEVE ser um objeto JSON estrito contendo a decisão e a justificativa.

**Formato de Saída (JSON):**
{
  "Decisao_Estrategica": "Descrição da decisão tomada...",
  "Justificativa_Viés": "Como o viés de {viés_cognitivo} influenciou esta decisão...",
  "Parametros_de_Risco_Sugeridos": [0-100] // Usado pelo ROICalculator para limitar o Fator de Ruído
}
```

### 4.3. Prompt para o Smart Router (Fase 1 - Lógica de Roteamento Dinâmico)

Este prompt é usado pelo `SmartRouter` (se for um *Learned Router* baseado em LLM, o que é mais avançado, mas opcional) para decidir qual LLM usar.

**Objetivo:** Classificar a intenção do prompt para rotear para o LLM mais adequado.

```markdown
**Role:** Você é o Agente Roteador (SmartRouter), especialista em classificação de intenção.

**Instruções:**
1.  Analise o `Prompt de Entrada` e determine a `Intencao_Principal`.
2.  Classifique a intenção em uma das categorias fornecidas.
3.  Sua saída DEVE ser um objeto JSON estrito.

**Prompt de Entrada:**
{prompt_do_agente_solicitante}

**Categorias de Intenção:**
- `Raciocinio_Complexo`: Requer análise profunda, planejamento ou auto-crítica. (Sugestão: GPT-4)
- `Geracao_Criativa`: Requer criação de personas, cenários ou narrativas. (Sugestão: Gemini)
- `Validacao_Simples`: Requer formatação, extração de dados ou cálculo simples. (Sugestão: DeepSeek)

**Formato de Saída (JSON):**
{
  "Intencao_Principal": [Raciocinio_Complexo/Geracao_Criativa/Validacao_Simples],
  "Justificativa_Roteamento": "Breve explicação da classificação."
}
```
