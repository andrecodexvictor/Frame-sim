# Documento de Especificação de Arquitetura Agêntica - Fase 1

**Projeto:** Frame-sim-main (Simulador Agêntico de Frameworks)
**Fase:** 1 - Implementação de Multi-LLM, Self-Reflection e Métricas Agênticas
**Data:** 07 de Dezembro de 2025
**Desenvolvedor Alvo:** Agente de Desenvolvimento

## 1. Objetivo da Fase 1

A Fase 1 visa transformar o simulador de um sistema Multi-Agent básico para um sistema de **Maturidade Nível 3 (Multi-Agent Crew com Crítica)**, conforme a taxonomia de sistemas agênticos. O foco é aumentar a eficiência operacional (custo/velocidade) e a qualidade da saída através da auto-crítica.

## 2. Especificação Técnica Detalhada

### 2.1. Implementação do Smart Router (Multi-LLM)

O objetivo é criar um ponto central de decisão para rotear requisições de LLM para o modelo mais adequado (Gemini, DeepSeek, GPT), otimizando a relação Qualidade-Custo.

| ID | Componente | Descrição da Tarefa | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **1.1** | **Configuração de APIs** | Adicionar variáveis de ambiente para as chaves de API de Gemini, DeepSeek e GPT no arquivo `.env.example` e garantir que o sistema de configuração as carregue. | `.env.example`, Arquivo de Configuração do Projeto |
| **1.2** | **Criação do Serviço `SmartRouter`** | Criar um novo serviço que centralize todas as chamadas de LLM. Este serviço deve ter um método principal (e.g., `routeAndCall(prompt: string, context: any, agentType: string): Promise<string>`) que decide qual LLM usar. | `services/smartRouter.ts` (Novo) |
| **1.3** | **Adaptação dos Serviços LLM** | Criar ou adaptar serviços de baixo nível (e.g., `services/deepSeekService.ts`, `services/gptService.ts`) para garantir que todos tenham uma interface de chamada unificada, facilitando o roteamento. | `services/geminiService.ts` (Refatorar), `services/gptService.ts` (Novo), `services/deepSeekService.ts` (Novo) |
| **1.4** | **Lógica de Roteamento Estático** | Implementar a lógica inicial de roteamento no `SmartRouter` baseada no tipo de agente (`agentType`):<br>- **`ROICalculator`:** Roteamento para **DeepSeek** (prioridade de custo).<br>- **`CriticAgent` (Novo):** Roteamento para **GPT-4** (prioridade de raciocínio).<br>- **`PersonaAgent`:** Roteamento para **Gemini** (prioridade de contexto e geração de texto). | `services/smartRouter.ts` |
| **1.5** | **Refatoração do `Orchestrator`** | Remover chamadas diretas a qualquer serviço LLM dentro do `orchestrator.ts` e dos agentes. Todas as chamadas devem ser substituídas por uma chamada ao `SmartRouter`. | `RAG/src/agents/orchestrator.ts`, `RAG/src/agents/personaAgent.ts`, `RAG/src/agents/roiCalculator.ts` |

### 2.2. Implementação do Padrão Self-Reflection (Cognitive Control)

O objetivo é introduzir um ciclo de auto-crítica que valide a saída dos agentes e, se necessário, solicite um *replan* ou ajuste de parâmetros, simulando a camada **Cognitive Control** do ACE.

| ID | Componente | Descrição da Tarefa | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **2.1** | **Criação do `CriticAgent`** | Criar um novo agente especializado em validação. Seu *prompt* deve instruí-lo a retornar uma pontuação de plausibilidade (0-100) e uma justificativa. | `RAG/src/agents/criticAgent.ts` (Novo) |
| **2.2** | **Definição de Regras de Crítica** | Criar um arquivo de configuração para as regras de validação. Exemplo de regra: "Se o ROI for > 500% em um único ciclo, a plausibilidade é < 20%". | `RAG/simulation_rules.json` (Novo) |
| **2.3** | **Integração do Ciclo de Crítica** | Modificar o `orchestrator.ts` para que, após a execução do `ROICalculator`, ele invoque o `CriticAgent` (via `SmartRouter`). | `RAG/src/agents/orchestrator.ts` |
| **2.4** | **Lógica de Replan/Ajuste** | Se a pontuação de plausibilidade do `CriticAgent` for inferior a um limite (e.g., 70), o `orchestrator` deve:<br>a) Registrar o erro.<br>b) Gerar um novo prompt de ajuste (e.g., "Ajuste os parâmetros de risco para a próxima simulação, pois o ROI foi irrealista").<br>c) Reiniciar o ciclo de simulação com o novo prompt. | `RAG/src/agents/orchestrator.ts` |

### 2.3. Implementação das Métricas Agênticas

O objetivo é capturar métricas de desempenho operacional que validam a robustez do framework, além do resultado final (ROI).

| ID | Componente | Descrição da Tarefa | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **3.1** | **Captura de Tempo (TTS)** | Implementar um mecanismo de *logging* para registrar o tempo de início e fim de cada ciclo de simulação e o tempo total até a saída final validada (após a crítica). | `RAG/src/index.ts`, `RAG/src/agents/orchestrator.ts` |
| **3.2** | **Captura de Qualidade (QPC)** | Registrar a pontuação de plausibilidade do `CriticAgent` como a métrica **Qualidade por Ciclo (QPC)**. | `RAG/src/agents/orchestrator.ts`, Arquivo de Log |
| **3.3** | **Captura de Risco (TIR)** | Contabilizar o número de vezes que o `CriticAgent` forçou um *replan* ou que uma chamada de API falhou, registrando a **Taxa de Incidência de Risco (TIR)**. | `RAG/src/agents/orchestrator.ts`, Arquivo de Log |
| **3.4** | **Atualização do Dashboard** | Criar uma nova seção no dashboard para exibir as métricas agênticas (TTS, QPC, TIR) em tempo real ou após a conclusão da simulação. | `components/Dashboard.tsx`, `components/BatchResultsChart.tsx` |

***

## 3. Análise de Realismo e Proposta de Solução

Você mencionou que sente que está "manipulando os resultados" em vez de obter "simulações realistas". Isso é um desafio comum em simuladores baseados em LLM.

A causa mais provável para essa percepção é a **falta de complexidade e variabilidade** nas entradas e no processo de tomada de decisão dos agentes.

### 3.1. Análise do Problema (Causas Prováveis)

1.  **Limitação do RAG (Retrieval-Augmented Generation):** O RAG é a fonte de "realidade" do seu simulador. Se os documentos de contexto (`business_metrics_model.md`, `framework_playbooks.json`) forem muito genéricos ou limitados, o LLM não terá dados ricos para gerar resultados variados.
2.  **Persona Simples:** O `PersonaAgent` provavelmente está agindo de forma muito racional e previsível. A realidade é caótica; as decisões são influenciadas por vieses, emoções e informações incompletas.
3.  **Cálculo Determinístico:** O `roiCalculator` pode estar sendo muito direto, sem incorporar elementos de incerteza ou variáveis externas (e.g., volatilidade de mercado, falha de projeto).

### 3.2. Proposta de Soluções para Aumentar o Realismo

A solução é injetar **variabilidade e incerteza** nas camadas de **Informação (RAG)** e **Decisão (Persona)**.

| ID | Solução Proposta | Descrição da Implementação | Arquivos Afetados |
| :--- | :--- | :--- | :--- |
| **4.1** | **RAG com Variabilidade (Incerteza)** | **Aumentar a base de conhecimento do RAG** com documentos que introduzam incerteza (e.g., "Relatórios de Crise de Mercado", "Estudos de Caso de Falha de Projeto"). O `queryRouter.ts` deve ser aprimorado para buscar **múltiplos** contextos, alguns contraditórios. | `RAG/src/services/documentLoader.ts`, `RAG/src/services/vectorStore.ts`, Novos Documentos de Contexto |
| **4.2** | **Persona com Vieses e Memória** | **Aprimorar o `PersonaAgent`** para incluir um "Estado Emocional" ou "Vieses Cognitivos" (e.g., "Aversão a Risco", "Excesso de Confiança"). O agente deve ter uma **Memória de Curto Prazo** (JSON *scratchpad*) para que decisões anteriores influenciem as atuais. | `RAG/src/agents/personaAgent.ts`, `RAG/src/types/index.ts` (Adicionar `CognitiveBias` e `ShortTermMemory`) |
| **4.3** | **Cálculo com Estocasticidade** | Modificar o `roiCalculator.ts` para que, além dos dados do LLM, ele incorpore uma **variável aleatória** (e.g., um fator de ruído gaussiano) que simule a imprevisibilidade do mundo real. | `services/metricsCalculator.ts` ou `RAG/src/agents/roiCalculator.ts` |

A implementação dessas soluções garantirá que as simulações não sejam apenas o resultado de um *prompt* bem escrito, mas sim a **interação complexa entre agentes com vieses, informações incompletas e um ambiente estocástico (imprevisível)**, o que é a essência de uma simulação realista.

***

## 4. Próximos Passos (Resumo)

O agente de desenvolvimento deve focar na implementação das tarefas da **Seção 2 (Fase 1)**, pois elas fornecem a base arquitetural (Multi-LLM e Self-Reflection) necessária para aprimorar o realismo na **Seção 3**.

**Prioridade de Implementação:**

1.  **Smart Router (Multi-LLM):** Base para otimização de custo e qualidade.
2.  **Self-Reflection:** Base para a autonomia e validação da saída.
3.  **Aprimoramento do Realismo (Persona e RAG):** Aumenta a validade da simulação.

Este documento serve como um guia completo para a próxima fase de desenvolvimento.
