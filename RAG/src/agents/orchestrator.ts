/**
 * Orchestrator Agent - Coordena simulação multi-stakeholder (AGENTIC VERSION L4)
 * Integra SmartRouter (Multi-LLM), CriticAgent (Self-Reflection) e MetricsService
 */

import type {
    PersonaProfile,
    SimulationConfig,
    OrchestratorOutput,
    QueryClassification,
    SimulationStep,
    SimulationState
} from '../types/index.js';
import { PersonaAgent } from './personaAgent.js';
import { ROICalculatorAgent } from './roiCalculator.js';
import { VectorStoreService } from '../services/vectorStore.js';
import { QueryRouter } from '../services/queryRouter.js';
import { SmartRouter, IntentType } from '../services/SmartRouter.js';
import { CriticAgent } from './CriticAgent.js';
import { MetricsService } from '../services/MetricsService.js';
import { GoalAgent } from './GoalAgent.js';

const ORCHESTRATOR_PROMPT = `
Você é o Orquestrador da simulação de engenharia de software "Frame-sim".
Seu objetivo é analisar as respostas dos stakeholders e consolidar o resultado do turno.

CONTEXTO:
- Scratchpad (Memória de Curto Prazo): {scratchpad}
- Estado Atual: Moral={moral}%, Velocidade={velocidade}%, Confiança={confianca}%
- Turno: {turno}

RESPOSTAS DOS STAKEHOLDERS:
{respostas}

TAREFAS:
1. Analise o impacto das respostas no projeto.
2. Atualize o Scratchpad com o foco para o próximo turno.
3. Determine os deltas para Moral, Velocidade e Confiança.
4. Gere um resumo do turno.
5. Identifique eventos disparados (se houver).

SAÍDA ESPERADA (JSON):
{
  "moral_time_delta": number,
  "velocidade_delta": number,
  "confianca_delta": number,
  "scratchpad_update": "string (novo foco ou atualização do atual)",
  "resumo_turno": "string",
  "eventos_disparados": ["string"]
}
`;

export class OrchestratorAgent {
    private vectorStore?: VectorStoreService;
    private roiCalculator: ROICalculatorAgent;
    private queryRouter: QueryRouter;
    private smartRouter: SmartRouter;
    private metricsService: MetricsService;
    private personaAgent: PersonaAgent;
    private goalAgent: GoalAgent;
    private state!: SimulationState;

    constructor(apiKey?: string, vectorStore?: VectorStoreService) {
        this.vectorStore = vectorStore;
        this.roiCalculator = new ROICalculatorAgent();
        if (vectorStore) {
            this.roiCalculator.setVectorStore(vectorStore);
        }
        this.queryRouter = new QueryRouter(apiKey);
        this.smartRouter = new SmartRouter();
        this.metricsService = new MetricsService();
        this.personaAgent = new PersonaAgent(apiKey);
        this.goalAgent = new GoalAgent();

        this.resetState();
    }

    setVectorStore(store: VectorStoreService): void {
        this.vectorStore = store;
        this.roiCalculator.setVectorStore(store);
    }

    /**
     * Processa uma query decidindo automaticamente o modo de RAG
     */
    async processQuery(
        query: string,
        stakeholders: PersonaProfile[],
        config?: SimulationConfig
    ): Promise<{
        classification: QueryClassification;
        responses: OrchestratorOutput[];
        ragResults?: unknown[];
    }> {
        // Start Metrics Cycle
        this.metricsService.startCycle();

        // 1. Classificar a query
        const classification = await this.queryRouter.classify(query);
        console.log(`\n🎯 Query classificada como: ${classification.mode}`);

        let ragResults: unknown[] = [];

        // 2. Executar RAG se necessário
        if (this.vectorStore && this.queryRouter.shouldUseRAG(classification)) {
            console.log(`📚 Executando RAG nas collections: ${classification.filters.collections.join(', ')}`);
            ragResults = await this.vectorStore.hybridSearch({
                query: classification.refinedQuery,
                collections: classification.filters.collections,
                topK: 5
            });
        }

        // 3. Executar simulação com stakeholders (Agentic Loop inside)
        const responses = await this.runTurn({ query, stakeholders, config });

        return { classification, responses, ragResults };
    }

    /**
     * Executa um turno de simulação com múltiplos stakeholders
     */
    async runTurn(step: SimulationStep): Promise<OrchestratorOutput[]> {
        const { query, stakeholders, config } = step;
        this.state.turno++;

        console.log(`\n🎲 Iniciando turno ${this.state.turno} com ${stakeholders.length} stakeholders`);

        const outputs: OrchestratorOutput[] = [];

        // Coletar respostas de cada stakeholder
        for (const stakeholder of stakeholders) {
            console.log(`  → Simulando ${stakeholder.informacoes_basicas.nome} (${stakeholder.informacoes_basicas.cargo})`);

            const response = await this.personaAgent.simulateResponse(
                stakeholder,
                query,
                config
            );

            outputs.push({
                turno: this.state.turno,
                stakeholder: stakeholder.informacoes_basicas.nome,
                resposta: response,
                metricas_atualizadas: {
                    moral_time: this.state.moral_time,
                    velocidade_sprint: this.state.velocidade_sprint,
                    confianca_stakeholders: this.state.confianca_stakeholders
                },
                eventos_disparados: []
            });
        }

        // Consolidar e atualizar estado global (Agentic Loop: Act -> Critique -> Replan)
        await this.consolidateTurn(outputs);

        // 6. GOAL EVALUATION (Every 3 turns)
        if (this.state.turno % 3 === 0) {
            const goal = this.goalAgent.evaluate(this.state);
            this.state.difficulty_scalar = goal.difficulty_scalar;

            if (goal.new_directive) {
                console.log(`\n🎯 NOVA DIRETIVA (GoalAgent): ${goal.new_directive}`);
                this.state.current_objective = goal.new_directive;
                this.state.scratchpad += ` [DIRETIVA: ${goal.new_directive}]`;
            }
        }

        // Attach metrics to the last output of the turn
        if (outputs.length > 0) {
            const metrics = this.metricsService.calculateMetrics();
            outputs[outputs.length - 1].metricas_agenticas = metrics;
            console.log(`📊 Agent Metrics: QPC=${metrics.quality_per_cycle}%, TTS=${metrics.time_to_solve_ms}ms`);
        }

        // Adicionar ao histórico
        this.state.historico.push(...outputs);

        return outputs;
    }

    /**
     * Consolida resultados do turno e ATIVA O LOOP AGÊNTICO
     */
    private async consolidateTurn(outputs: OrchestratorOutput[]): Promise<void> {
        const respostas = outputs
            .map(o => `${o.stakeholder}: "${o.resposta.resposta_persona}" (${o.resposta.emocao_detectada})`)
            .join('\n');

        const prompt = ORCHESTRATOR_PROMPT
            .replace('{scratchpad}', this.state.scratchpad || 'Focar na eficiência e satisfação.')
            .replace('{moral}', this.state.moral_time.toString())
            .replace('{velocidade}', this.state.velocidade_sprint.toString())
            .replace('{confianca}', this.state.confianca_stakeholders.toString())
            .replace('{turno}', this.state.turno.toString())
            .replace('{respostas}', respostas);

        try {
            const llm = await this.smartRouter.route(prompt);
            const response = await llm.generate(prompt);

            // Basic JSON parsing
            const content = response.content.trim();
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}');
            const jsonStr = content.slice(jsonStart, jsonEnd + 1);
            const result = JSON.parse(jsonStr);

            // 4. COMMIT (Update State)
            this.state.moral_time += result.moral_time_delta || 0;
            this.state.velocidade_sprint += result.velocidade_delta || 0;
            this.state.confianca_stakeholders += result.confianca_delta || 0;

            // Update Scratchpad
            if (result.scratchpad_update) {
                this.state.scratchpad = result.scratchpad_update;
            }

            // Clamp
            this.state.moral_time = Math.max(0, Math.min(100, this.state.moral_time));
            this.state.velocidade_sprint = Math.max(20, Math.min(150, this.state.velocidade_sprint));
            this.state.confianca_stakeholders = Math.max(0, Math.min(100, this.state.confianca_stakeholders));

            if (result.eventos_disparados) {
                this.state.eventos_disparados.push(...result.eventos_disparados);
            }

            console.log(`\n📊 Estado atualizado:
  Moral: ${this.state.moral_time.toFixed(0)}%
  Velocidade: ${this.state.velocidade_sprint.toFixed(0)}%
  Confiança: ${this.state.confianca_stakeholders.toFixed(0)}%
  Scratchpad: ${this.state.scratchpad}`);

            // 5. LONG-TERM MEMORY (Save consolidated turn)
            if (this.vectorStore) {
                await this.vectorStore.saveMemory(
                    `Turno ${this.state.turno}: ${result.resumo_turno || 'Sem resumo'}. Eventos: ${result.eventos_disparados?.join(', ') || 'Nenhum'}`,
                    {
                        turno: this.state.turno,
                        moral: this.state.moral_time,
                        velocidade: this.state.velocidade_sprint,
                        confianca: this.state.confianca_stakeholders,
                        eventos: result.eventos_disparados || []
                    }
                );
            }

        } catch (error) {
            console.error('Erro ao consolidar turno:', error);
            // Fallback: minimal update
            this.state.moral_time -= 5;
        }
    }

    async runSimulation(
        queries: string[],
        stakeholders: PersonaProfile[],
        config?: SimulationConfig
    ): Promise<{
        state: SimulationState;
        roi?: unknown;
    }> {
        console.log(`\n🚀 Iniciando simulação com ${queries.length} situações e ${stakeholders.length} stakeholders\n`);
        this.resetState();

        for (const query of queries) {
            console.log(`\n📢 Situação: "${query}"`);
            await this.runTurn({ query, stakeholders, config });
        }

        let roi;
        if (config) {
            console.log('\n💰 Calculando ROI projetado...');
            roi = await this.roiCalculator.calculateROI(config);
        }

        return { state: this.state, roi };
    }

    getState(): SimulationState {
        return { ...this.state };
    }

    resetState(): void {
        this.state = {
            turno: 0,
            moral_time: 70,
            velocidade_sprint: 100,
            confianca_stakeholders: 50,
            scratchpad: "Início da simulação. Focar na estabilização inicial.",
            eventos_disparados: [],
            historico: [],
            difficulty_scalar: 1.0,
            current_objective: "Estabilizar adoção inicial."
        };
    }
}

export function createOrchestrator(apiKey?: string, vectorStore?: VectorStoreService): OrchestratorAgent {
    return new OrchestratorAgent(apiKey, vectorStore);
}
