# Documento de Especificação de Arquitetura Agêntica - Completo (Fases 1, 2 e 3)

**Projeto:** Frame-sim-main (Simulador Agêntico de Frameworks)
**Foco:** Transformação para Sistema Agêntico de Nível 4 (ACE)
**Data:** 07 de Dezembro de 2025
**Desenvolvedor Alvo:** Agente de Desenvolvimento

## 1. Fase 1: Base Arquitetural e Auto-Crítica (Concluída/Em Andamento)

**Objetivo:** Implementar a arquitetura Multi-LLM e o padrão Self-Reflection, elevando o sistema ao Nível de Maturidade 2-3.

*(Conteúdo da Fase 1, incluindo Smart Router, CriticAgent e Métricas Agênticas, conforme o documento anterior, será mantido aqui para a versão final.)*

---

## 2. Fase 2: Realismo, Memória e Complexidade Emergente

**Objetivo:** Injetar variabilidade, vieses cognitivos e memória de longo prazo para aumentar o realismo da simulação e gerar complexidade emergente.

### 2.1. Aprimoramento do Realismo (Persona e Stochasticity)

| ID | Componente | Descrição da Tarefa | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **4.1** | **Persona com Vieses** | Modificar o `PersonaAgent` para incluir um "Estado Emocional" ou "Vieses Cognitivos" (e.g., Aversão a Risco, Excesso de Confiança) que influenciam o prompt de decisão. O viés deve ser um parâmetro de entrada da simulação. | `RAG/src/agents/personaAgent.ts`, `RAG/src/types/index.ts` (Adicionar `CognitiveBias`) |
| **4.2** | **RAG com Variabilidade** | Aumentar a base de conhecimento do RAG com documentos que introduzam incerteza (e.g., "Relatórios de Crise de Mercado", "Estudos de Caso de Falha de Projeto"). O `queryRouter.ts` deve ser aprimorado para buscar **múltiplos** contextos, alguns contraditórios. | `RAG/src/services/documentLoader.ts`, Novos Documentos de Contexto |
| **4.3** | **Cálculo com Estocasticidade** | Modificar o `roiCalculator.ts` para que, além dos dados do LLM, ele incorpore uma **variável aleatória** (e.g., um fator de ruído gaussiano) que simule a imprevisibilidade do mundo real. | `services/metricsCalculator.ts` ou `RAG/src/agents/roiCalculator.ts` |

### 2.2. Implementação de Memória de Longo Prazo (ACE)

| ID | Componente | Descrição da Tarefa | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **5.1** | **Memória de Curto Prazo** | Implementar um JSON *scratchpad* (memória de curto prazo) no `orchestrator` para que as decisões de um ciclo influenciem o prompt do ciclo seguinte. | `RAG/src/agents/orchestrator.ts`, `RAG/src/types/index.ts` |
| **5.2** | **Memória de Longo Prazo** | Configurar o Vector Store (`vectorStore.ts`) para armazenar o **histórico de simulações passadas** (decisões, resultados e críticas) como contexto para novas simulações. Isso simula o "aprendizado" do sistema. | `RAG/src/services/vectorStore.ts`, `RAG/src/agents/orchestrator.ts` |
| **5.3** | **Integração da Memória** | Modificar o `orchestrator` para que ele recupere o contexto da memória de longo prazo **antes** de iniciar uma nova simulação, injetando-o no prompt inicial. | `RAG/src/agents/orchestrator.ts` |

---

## 3. Fase 3: Autonomia, Escala e Generalização

**Objetivo:** Alcançar a plena autonomia (ACE Nível 4) e preparar o simulador para cenários de alta escala e generalização.

### 3.1. Autonomia e Cognitive Control Avançado

| ID | Componente | Descrição da Tarefa | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **6.1** | **Ajuste de Goal (Aspirational Layer)** | Implementar a lógica no `orchestrator` para que, após múltiplas falhas de *replan* (TIR alto), o sistema possa gerar um prompt para o LLM principal sugerindo um **ajuste no objetivo de alto nível** da simulação. | `RAG/src/agents/orchestrator.ts` |
| **6.2** | **Implementação do Padrão ReAct** | Formalizar o ciclo **Reason-Act-Observe-Repeat** no `orchestrator` e nos agentes, garantindo que o agente sempre justifique o uso de uma ferramenta (RAG, Calculator) antes de invocá-la. | `RAG/src/agents/orchestrator.ts`, `RAG/src/types/index.ts` (Adicionar `ReasoningLog`) |
| **6.3** | **Monitoramento de Saúde** | Implementar um agente de monitoramento que rastreie o uso de tokens e o custo por inferência em tempo real, alertando o `orchestrator` sobre desvios orçamentários. | `RAG/src/agents/healthMonitor.ts` (Novo) |

### 3.2. Escala e Generalização

| ID | Componente | Descrição da Tarefa | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **7.1** | **Processamento Paralelo** | Otimizar o `BatchSimulationPanel.tsx` e o `batchService.ts` para executar múltiplas simulações em paralelo, aproveitando a arquitetura Multi-LLM. | `components/BatchSimulationPanel.tsx`, `services/batchService.ts` |
| **7.2** | **Integração de Ferramentas Externas** | Criar um *stub* (simulação) de uma API externa (e.g., "API de Dados de Mercado") e ensinar o `orchestrator` a usar essa ferramenta. | `RAG/src/services/externalToolStub.ts` (Novo), `RAG/src/agents/orchestrator.ts` |
| **7.3** | **Generalização de Frameworks** | Refatorar o `orchestrator` para que ele possa carregar e simular **qualquer** framework de gestão, lendo as regras e os agentes necessários de um arquivo de configuração (e.g., `framework_config.json`). | `RAG/framework_config.json` (Novo), `RAG/src/agents/orchestrator.ts` |

---

## 4. Análise Final: Manipulação vs. Simulação Realista

### 4.1. O Estado Atual: Simulação Controlada

A percepção de que você está "manipulando os resultados" é uma observação perspicaz e, de certa forma, correta para o estágio atual do seu simulador.

**O sistema não está manipulando resultados, mas sim produzindo resultados previsíveis.**

O seu simulador está operando em um nível de **Simulação Controlada (Maturidade Nível 1-2)**. O resultado é uma consequência direta e linear dos *prompts* e dos dados de RAG fornecidos.

| Característica | Simulação Controlada (Atual) | Simulação Realista (Objetivo) |
| :--- | :--- | :--- |
| **Comportamento** | Linear e Determinístico. | Não-linear e Emergente. |
| **Causa do Resultado** | O resultado é uma paráfrase inteligente do *prompt* e do contexto RAG. | O resultado é a consequência de uma **interação complexa** entre agentes com vieses, memória e incerteza. |
| **Feedback Loop** | Ausente ou Manual (você ajusta o prompt). | Automático (o `CriticAgent` ajusta o ciclo). |
| **Variabilidade** | Baixa. | Alta (Incerteza e Vieses). |

### 4.2. A Solução: Injetar Complexidade Emergente

A sensação de "manipulação" desaparecerá quando o sistema começar a exibir **Comportamento Emergente**. Isso significa que o resultado final não será óbvio a partir das entradas, mas sim o produto de interações complexas e imprevisíveis.

**A chave é a implementação das Fases 1 e 2:**

1.  **Self-Reflection (Fase 1):** Introduz o primeiro loop de feedback automático. O agente começa a se criticar, quebrando a linearidade.
2.  **Vieses e Estocasticidade (Fase 2):** Injeta a imprevisibilidade do mundo real. O `PersonaAgent` pode tomar uma decisão "ruim" devido ao seu viés, e o `roiCalculator` pode ser afetado por um "ruído de mercado" aleatório.

Ao implementar essas fases, você passará de um sistema que **calcula** um resultado para um sistema que **simula** um processo caótico e realista de tomada de decisão. A partir desse ponto, você não estará mais manipulando, mas sim **observando** o comportamento emergente do seu minimundo agêntico.

Este documento completo fornece o mapa para essa transição.
