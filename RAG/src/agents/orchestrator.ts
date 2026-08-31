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
    SimulationState,
    ReasoningLogEntry
} from '../types/index.js';
import { PersonaAgent } from './personaAgent.js';
import { ROICalculatorAgent } from './roiCalculator.js';
import { VectorStoreService } from '../services/vectorStore.js';
import { QueryRouter } from '../services/queryRouter.js';
import { SmartRouter } from '../services/SmartRouter.js';
import { CriticAgent } from './CriticAgent.js';
import { MetricsService } from '../services/MetricsService.js';
import { GoalAgent } from './GoalAgent.js';
import {
    deriveInitialBrain,
    updateBrain,
    evaluateDecisions,
    applyContagion,
    reflect,
    aggregate,
    mulberry32,
    hashString,
    clamp
} from '../core/employeeBrainCore.js';
import type { BrainProfileInput, EmployeeBrainState, TurnContext } from '../core/employeeBrainCore.js';
import { randomUUID } from 'node:crypto';
import { Annotation, END, START, StateGraph, MemorySaver } from '@langchain/langgraph';
import { loadFrameworkConfig, type FrameworkConfig } from '../services/frameworkConfigLoader.js';
import { loadEconomicScenarios, selectEconomicScenario, type EconomicScenario } from '../services/economicScenarioLoader.js';
import { ExternalToolStub } from '../services/externalToolStub.js';
import { HealthMonitor } from '../services/HealthMonitor.js';

type NarrativeRouter = {
    route(prompt: string): Promise<{
        name?: () => string;
        generate(prompt: string, systemPrompt?: string, options?: { signal?: AbortSignal }): Promise<{
            content: string;
            usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
            usage_metadata?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
            modelUsed?: string;
        }>;
    }>;
};

type MetricsServiceLike = Pick<MetricsService, 'startCycle' | 'calculateMetrics'> &
    Partial<Pick<MetricsService, 'recordReplan' | 'recordIncident' | 'recordCycle' | 'recordTokens' | 'setRouterChoice' | 'markDegraded'>>;

export interface OrchestratorDependencies {
    personaAgent?: Pick<PersonaAgent, 'simulateResponse'>;
    smartRouter?: NarrativeRouter;
    metricsService?: MetricsServiceLike;
    goalAgent?: Pick<GoalAgent, 'evaluate'>;
    criticAgent?: Pick<CriticAgent, 'critique'>;
    roiCalculator?: Pick<ROICalculatorAgent, 'calculateROI' | 'setVectorStore'>;
}

export const SIMULATION_GRAPH_NODES = [
    'initialize',
    'turn',
    'roi',
    'critique',
    'replan',
    'finalize'
] as const;

// Tipos de decisão do EmployeeBrain considerados "graves" o suficiente para também
// entrar em state.eventos_disparados (visível fora do painel de RH).
const GRAVE_DECISION_TYPES = new Set(['pedido_demissao', 'burnout', 'confronto_lideranca']);
const MAX_MEMORY_QUERY_CHARS = 800;
const MAX_MEMORY_ENTRY_CHARS = 600;
const MAX_MEMORY_WRITE_CHARS = 1400;
const MAX_REASONING_ENTRIES = 50;
const MAX_REASONING_FIELD_CHARS = 240;

const ORCHESTRATOR_PROMPT = `
Você é o Orquestrador da simulação de engenharia de software "Frame-sim".
Moral e Velocidade já foram calculados deterministicamente pelo EmployeeBrain — seu
papel aqui é só narrar o turno com coerência e ajustar a Confiança.

CONTEXTO:
- Scratchpad (Memória de Curto Prazo): {scratchpad}
- Estado Atual: Moral={moral}%, Velocidade={velocidade}%, Confiança={confianca}%
- Turno: {turno}
- Eventos de RH do turno (EmployeeBrain): {eventos_rh}

RESPOSTAS DOS STAKEHOLDERS:
{respostas}

TAREFAS:
1. Analise o impacto das respostas e dos eventos de RH no projeto.
2. Atualize o Scratchpad com o foco para o próximo turno.
3. Determine o delta de Confiança (-5 a +5).
4. Gere um resumo do turno, coerente com os eventos de RH listados.
5. Identifique eventos narrativos adicionais (se houver).

SAÍDA ESPERADA (JSON):
{
  "confianca_delta": number,
  "scratchpad_update": "string (novo foco ou atualização do atual)",
  "resumo_turno": "string",
  "eventos_disparados": ["string"]
}
`;

const SimulationGraphState = Annotation.Root({
    queries: Annotation<string[]>({ reducer: (_left, right) => right, default: () => [] }),
    stakeholders: Annotation<PersonaProfile[]>({ reducer: (_left, right) => right, default: () => [] }),
    config: Annotation<SimulationConfig | null>({ reducer: (_left, right) => right, default: () => null }),
    teamProfiles: Annotation<PersonaProfile[]>({ reducer: (_left, right) => right, default: () => [] }),
    queryIndex: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
    outputs: Annotation<OrchestratorOutput[]>({ reducer: (_left, right) => right, default: () => [] }),
    state: Annotation<SimulationState>({ reducer: (_left, right) => right, default: () => ({} as SimulationState) }),
    roiResult: Annotation<unknown>({ reducer: (_left, right) => right, default: () => undefined }),
    replanRequested: Annotation<boolean>({ reducer: (_left, right) => right, default: () => false }),
    replanCount: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
    runId: Annotation<string>({ reducer: (_left, right) => right, default: () => '' })
});

type SimulationGraphStateType = typeof SimulationGraphState.State;

export class OrchestratorAgent {
    private vectorStore?: VectorStoreService;
    private roiCalculator: Pick<ROICalculatorAgent, 'calculateROI' | 'setVectorStore'>;
    private queryRouter: QueryRouter;
    private smartRouter: NarrativeRouter;
    private metricsService: MetricsServiceLike;
    private personaAgent: Pick<PersonaAgent, 'simulateResponse'>;
    private goalAgent: Pick<GoalAgent, 'evaluate'>;
    private criticAgent: Pick<CriticAgent, 'critique'>;
    private readonly checkpointer = new MemorySaver();
    private readonly simulationGraph: any;
    private state!: SimulationState;
    // EmployeeBrain: array ordenado é a fonte da verdade (applyContagion opera em arrays).
    // state.funcionarios aponta para este mesmo array e serializa junto com o state.
    private brains: EmployeeBrainState[] = [];
    private longTermMemoryContext = '';
    private activeSignal?: AbortSignal;
    private runActive = false;
    private readonly externalTool = new ExternalToolStub();
    private readonly healthMonitor = new HealthMonitor();
    // Moral no início do turno anterior — deriva o impacto pessoal das personas de
    // fundo (que não têm resposta LLM): elas sentem o delta de moral do turno passado.
    private moralPrevTurn = 70;
    // velocidadeBase fixa = velocidade inicial do sprint (100). Aplicar velocidadeMod
    // sobre a velocidade já modificada comporia a penalidade turno a turno; como o LLM
    // não emite mais deltas de velocidade, a base não tem outra fonte de mudança.
    private static readonly VELOCIDADE_BASE = 100;

    constructor(apiKey?: string, vectorStore?: VectorStoreService, dependencies: OrchestratorDependencies = {}) {
        this.vectorStore = vectorStore;
        this.roiCalculator = dependencies.roiCalculator ?? new ROICalculatorAgent();
        if (vectorStore) {
            this.roiCalculator.setVectorStore(vectorStore);
        }
        this.queryRouter = new QueryRouter(apiKey);
        this.smartRouter = dependencies.smartRouter ?? new SmartRouter();
        this.metricsService = dependencies.metricsService ?? new MetricsService();
        this.personaAgent = dependencies.personaAgent ?? new PersonaAgent(apiKey);
        this.goalAgent = dependencies.goalAgent ?? new GoalAgent();
        this.criticAgent = dependencies.criticAgent ?? new CriticAgent();

        this.resetState();
        this.simulationGraph = this.buildSimulationGraph();
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
        this.appendReasoning('escolher o modo de recuperação da consulta', 'rag_router', classification.mode);

        let ragResults: unknown[] = [];

        // 2. Executar RAG se necessário
        if (this.vectorStore && this.queryRouter.shouldUseRAG(classification)) {
            console.log(`📚 Executando RAG nas collections: ${classification.filters.collections.join(', ')}`);
            ragResults = await this.vectorStore.hybridSearch({
                query: classification.refinedQuery,
                collections: classification.filters.collections,
                topK: 5
            });
            this.appendReasoning('enriquecer a resposta com contexto indexado', 'rag_search', `${ragResults.length} resultado(s)`);
        } else {
            this.appendReasoning('enriquecer a resposta com contexto indexado', 'rag_search', 'RAG não aplicado');
        }

        // 3. Executar simulação com stakeholders (Agentic Loop inside)
        const responses = await this.runTurn({ query, stakeholders, config });

        return { classification, responses, ragResults };
    }

    /** Mapeia o PersonaProfile aninhado para o input flat do EmployeeBrain. */
    private toBrainInput(p: PersonaProfile): BrainProfileInput {
        return {
            id: p.id,
            nome: p.informacoes_basicas.nome,
            cargo: p.informacoes_basicas.cargo, // senioridade vem embutida no cargo nos perfis
            gestao_estresse: p.psicologia_comportamento['Gestão de Estresse'],
            abordagem_trabalho: p.psicologia_comportamento['Abordagem ao Trabalho'],
            opiniao_agil: p.contexto.opiniao_agil,
            estilo_comunicacao: p.psicologia_comportamento['Estilo de Comunicação']
            // vies_cognitivo: perfis atuais não têm o campo; personaAgent cai no aleatório
        };
    }

    /** Cria brains para perfis ainda sem brain (idempotente — não duplica ids). */
    private ensureBrains(profiles: PersonaProfile[]): void {
        for (const p of profiles) {
            if (!this.brains.some(b => b.personaId === p.id)) {
                this.brains.push(deriveInitialBrain(this.toBrainInput(p)));
            }
        }
        this.state.funcionarios = this.brains;
    }

    /**
     * Executa um turno de simulação com múltiplos stakeholders
     */
    async runTurn(step: SimulationStep): Promise<OrchestratorOutput[]> {
        this.throwIfAborted();
        const { query, stakeholders, config } = step;
        this.state.turno++;

        console.log(`\n🎲 Iniciando turno ${this.state.turno} com ${stakeholders.length} stakeholders`);

        // Garante brains mesmo em entradas que não passam por runSimulation (processQuery)
        this.ensureBrains(stakeholders);

        // pressaoBase: difficulty_scalar do GoalAgent (0.8 fácil .. 1.2 difícil) normalizado
        // linearmente para 0-1 via (scalar-0.8)/0.4 e clampado em [0.2, 0.9] para nunca
        // zerar a pressão nem saturá-la (1.0 → 0.5 de pressão).
        const pressaoBase = clamp((this.state.difficulty_scalar - 0.8) / 0.4, 0.2, 0.9);

        // Personas de fundo sentem o delta de moral do turno anterior, amortecido.
        const impactoFundo = clamp((this.state.moral_time - this.moralPrevTurn) / 2, -3, 3);
        this.moralPrevTurn = this.state.moral_time;

        const outputs: OrchestratorOutput[] = [];

        // Coletar respostas de cada stakeholder
        for (const stakeholder of stakeholders) {
            this.throwIfAborted();
            console.log(`  → Simulando ${stakeholder.informacoes_basicas.nome} (${stakeholder.informacoes_basicas.cargo})`);

            const brainIdx = this.brains.findIndex(b => b.personaId === stakeholder.id);

            const response = await this.personaAgent.simulateResponse(
                stakeholder,
                query,
                config,
                brainIdx >= 0 ? this.brains[brainIdx] : undefined,
                this.activeSignal
            );
            this.throwIfAborted();
            if (response.degraded) {
                this.markDegraded(`persona indisponível: ${stakeholder.id}`);
                this.metricsService.markDegraded?.();
            }
            this.appendReasoning(
                'obter reação determinística/LLM do stakeholder',
                'persona',
                `${stakeholder.id}: ${response.degraded ? 'fallback degradado' : response.emocao_detectada}`
            );

            if (brainIdx >= 0) {
                this.brains[brainIdx] = updateBrain(this.brains[brainIdx], {
                    turno: this.state.turno,
                    pressaoBase,
                    impactoPessoal: response.impacto_moral,
                    moralGlobal: this.state.moral_time,
                    eventoTurno: `${response.emocao_detectada}: ${query.slice(0, 80)}`
                });
            }

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

        // Personas de fundo (sem resposta LLM neste turno)
        const stakeholderIds = new Set(stakeholders.map(s => s.id));
        for (let i = 0; i < this.brains.length; i++) {
            this.throwIfAborted();
            if (stakeholderIds.has(this.brains[i].personaId)) continue;
            this.brains[i] = updateBrain(this.brains[i], {
                turno: this.state.turno,
                pressaoBase,
                impactoPessoal: impactoFundo,
                moralGlobal: this.state.moral_time
            });
        }

        // Decisões emergentes (determinísticas, RNG semeado por persona+turno)
        let moralGlobalAcc = 0;
        let confiancaAcc = 0;
        const eventosRhTurno: string[] = [];
        for (let i = 0; i < this.brains.length; i++) {
            if (this.brains[i].status !== 'ativo') continue;
            const rng = mulberry32(hashString(`${this.brains[i].personaId}:${this.state.turno}`));
            const ctx: TurnContext = {
                turno: this.state.turno,
                pressaoBase,
                impactoPessoal: 0,
                moralGlobal: this.state.moral_time
            };
            const { brain: decided, decisions } = evaluateDecisions(this.brains[i], ctx, rng);
            this.brains[i] = decided;

            for (const d of decisions) {
                eventosRhTurno.push(d.narrativa);
                if (GRAVE_DECISION_TYPES.has(d.tipo)) {
                    this.state.eventos_disparados.push(d.narrativa);
                }
                if (d.efeitos.moralGlobal) moralGlobalAcc += d.efeitos.moralGlobal;
                if (d.efeitos.confianca) confiancaAcc += d.efeitos.confianca;
                if (d.efeitos.contagio) {
                    const contagiados = applyContagion(this.brains, decided.personaId, d.efeitos.contagio, rng);
                    for (let k = 0; k < this.brains.length; k++) this.brains[k] = contagiados[k];
                }
            }
        }
        if (eventosRhTurno.length > 0) {
            console.log(`🧠 Eventos de RH no turno ${this.state.turno}: ${eventosRhTurno.join(' | ')}`);
        }
        this.state.eventos_rh = [...(this.state.eventos_rh ?? []), ...eventosRhTurno];
        this.metricsService.recordCycle?.();
        this.metricsService.recordIncident?.(eventosRhTurno.length);

        // Consolidar e atualizar estado global (Agentic Loop: Act -> Critique -> Replan)
        await this.consolidateTurn(outputs, eventosRhTurno, moralGlobalAcc, confiancaAcc);

        // 6. GOAL EVALUATION (Every 3 turns)
        if (this.state.turno % 3 === 0) {
            const goal = this.goalAgent.evaluate(this.state);
            this.state.difficulty_scalar = goal.difficulty_scalar;

            if (goal.new_directive) {
                console.log(`\n🎯 NOVA DIRETIVA (GoalAgent): ${goal.new_directive}`);
                this.state.current_objective = goal.new_directive;
                this.state.scratchpad += ` [DIRETIVA: ${goal.new_directive}]`;
            }

            // Reflexão periódica dos brains (mesma cadência do GoalAgent)
            for (let i = 0; i < this.brains.length; i++) {
                this.brains[i] = reflect(this.brains[i]);
            }
        }

        // Attach metrics to the last output of the turn
        if (outputs.length > 0) {
            // The turn's state is committed by consolidateTurn above. Refresh every
            // output so the public trace reflects post-turn values rather than the
            // values observed while each persona was being generated.
            for (const output of outputs) {
                output.metricas_atualizadas = {
                    moral_time: this.state.moral_time,
                    velocidade_sprint: this.state.velocidade_sprint,
                    confianca_stakeholders: this.state.confianca_stakeholders
                };
            }
            const metrics = this.metricsService.calculateMetrics();
            outputs[outputs.length - 1].metricas_agenticas = metrics;
            console.log(`📊 Agent Metrics: QPC=${metrics.quality_per_cycle}%, TTS=${metrics.time_to_solve_ms}ms`);
        }

        // Adicionar ao histórico
        this.state.historico.push(...outputs);

        return outputs;
    }

    /**
     * Consolida resultados do turno e ATIVA O LOOP AGÊNTICO.
     * Moral/velocidade vêm do aggregate determinístico do EmployeeBrain; o LLM só
     * narra (scratchpad/resumo/eventos) e ajusta confiança (±5). Sem fallback
     * catastrófico: se o LLM falhar, o estado determinístico já foi aplicado.
     */
    private async consolidateTurn(
        outputs: OrchestratorOutput[],
        eventosRhTurno: string[] = [],
        moralGlobalAcc = 0,
        confiancaAcc = 0
    ): Promise<void> {
        this.throwIfAborted();
        // COMMIT determinístico (fonte: EmployeeBrain aggregate + efeitos de decisões)
        if (this.brains.length > 0) {
            const agg = aggregate(this.brains);
            this.state.moral_time = clamp(agg.moral + moralGlobalAcc, 0, 100);
            this.state.velocidade_sprint = clamp(
                OrchestratorAgent.VELOCIDADE_BASE * agg.velocidadeMod, 0, 100
            );
        }
        this.state.confianca_stakeholders = clamp(
            this.state.confianca_stakeholders + confiancaAcc, 0, 100
        );

        const respostas = outputs
            .map(o => `${o.stakeholder}: "${o.resposta.resposta_persona}" (${o.resposta.emocao_detectada})`)
            .join('\n');

        const prompt = ORCHESTRATOR_PROMPT
            .replace('{scratchpad}', this.state.scratchpad || 'Focar na eficiência e satisfação.')
            .replace('{moral}', this.state.moral_time.toFixed(0))
            .replace('{velocidade}', this.state.velocidade_sprint.toFixed(0))
            .replace('{confianca}', this.state.confianca_stakeholders.toFixed(0))
            .replace('{turno}', this.state.turno.toString())
            .replace('{eventos_rh}', eventosRhTurno.length > 0 ? eventosRhTurno.join('; ') : 'Nenhum')
            .replace('{respostas}', respostas);

        try {
            const llm = await this.smartRouter.route(prompt);
            const routerChoice = llm.name?.() || 'UNKNOWN';
            this.metricsService.setRouterChoice?.(routerChoice);
            this.appendReasoning('selecionar narrativa para o turno', 'router', routerChoice);
            const response = await llm.generate(prompt, undefined, { signal: this.activeSignal });
            this.throwIfAborted();
            this.metricsService.recordTokens?.(
                response.usage?.promptTokens ?? response.usage_metadata?.input_tokens ?? 0,
                response.usage?.completionTokens ?? response.usage_metadata?.output_tokens ?? 0,
                response.modelUsed || llm.name?.() || ''
            );

            // Basic JSON parsing
            const content = response.content.trim();
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}');
            const jsonStr = content.slice(jsonStart, jsonEnd + 1);
            const result = JSON.parse(jsonStr);

            // LLM só ajusta confiança (clampado em ±5) e narrativa
            const confiancaDelta = clamp(Number(result.confianca_delta) || 0, -5, 5);
            this.state.confianca_stakeholders = clamp(
                this.state.confianca_stakeholders + confiancaDelta, 0, 100
            );

            // Update Scratchpad
            if (result.scratchpad_update) {
                this.state.scratchpad = `${this.sanitizeText(result.scratchpad_update, 1200)}${this.longTermMemoryContext}`.slice(-2000);
            }

            if (result.eventos_disparados) {
                this.state.eventos_disparados.push(...result.eventos_disparados);
            }

        } catch (error) {
            this.rethrowCancellation(error);
            console.error(`Erro ao consolidar turno; narrativa indisponível (${this.safeError(error)}).`);
            // Estado numérico já foi aplicado deterministicamente acima — nada a reverter.
            this.markDegraded('narrativa LLM indisponível');
            this.metricsService.markDegraded?.();
        }

        console.log(`\n📊 Estado atualizado:
  Moral: ${this.state.moral_time.toFixed(0)}%
  Velocidade: ${this.state.velocidade_sprint.toFixed(0)}%
  Confiança: ${this.state.confianca_stakeholders.toFixed(0)}%
  Scratchpad: ${this.state.scratchpad}`);
    }

    async runSimulation(
        queries: string[],
        stakeholders: PersonaProfile[],
        config?: SimulationConfig,
        teamProfiles?: PersonaProfile[],
        options: { signal?: AbortSignal } = {}
    ): Promise<{
        state: SimulationState;
        roi?: unknown;
    }> {
        console.log(`\n🚀 Iniciando simulação com ${queries.length} situações e ${stakeholders.length} stakeholders\n`);
        if (this.runActive) {
            throw new Error('This orchestrator instance is already running. Create one instance per request.');
        }
        this.runActive = true;
        const runId = randomUUID();
        this.activeSignal = options.signal;
        this.throwIfAborted();
        try {
            const isolatedConfig = config ? JSON.parse(JSON.stringify(config)) as SimulationConfig : null;
            let result;
            try {
                result = await this.simulationGraph.invoke({
                    queries: [...queries],
                    stakeholders: [...stakeholders],
                    config: isolatedConfig,
                    teamProfiles: [...(teamProfiles ?? [])],
                    runId
                }, { configurable: { thread_id: runId }, signal: options.signal });
            } catch (error) {
                // LangGraph currently wraps an AbortSignal in a generic `Error:
                // Aborted`. Keep the public service contract stable so HTTP and UI
                // callers can distinguish cancellation from provider/runtime faults.
                if (options.signal?.aborted) {
                    const abortError = new Error('Simulation cancelled.');
                    abortError.name = 'AbortError';
                    throw abortError;
                }
                throw error;
            }

            // Return an isolated snapshot. The graph/checkpointer owns its state and
            // callers must not be able to mutate a future run through shared arrays.
            return { state: this.cloneState(result.state), roi: result.roiResult };
        } finally {
            // MemorySaver 0.0.x has no deleteThread API. Its stores are public;
            // request-scoped threads are released explicitly on success or abort.
            delete this.checkpointer.storage[runId];
            for (const key of Object.keys(this.checkpointer.writes)) {
                try {
                    if (JSON.parse(key)?.[0] === runId) delete this.checkpointer.writes[key];
                } catch {
                    // Ignore malformed internal keys; MemorySaver owns their format.
                }
            }
            // LangGraph can reject the public invocation before an in-flight model
            // promise observes cancellation. Keep an aborted signal attached so a
            // late provider result cannot mutate state after the caller has left.
            // A subsequent run replaces it at the start of runSimulation.
            if (!options.signal?.aborted) {
                this.activeSignal = undefined;
                this.runActive = false;
            }
        }
    }

    getCheckpointThreadCount(): number {
        const ids = new Set(Object.keys(this.checkpointer.storage));
        for (const key of Object.keys(this.checkpointer.writes)) {
            try {
                const threadId = JSON.parse(key)?.[0];
                if (typeof threadId === 'string') ids.add(threadId);
            } catch {
                ids.add(key);
            }
        }
        return ids.size;
    }

    /** The graph is intentionally exposed only as topology metadata for offline tests. */
    getSimulationGraphTopology(): { nodes: readonly string[]; edges: readonly [string, string][] } {
        return {
            nodes: SIMULATION_GRAPH_NODES,
            edges: [
                [START, 'initialize'],
                ['initialize', 'turn'],
                ['initialize', 'roi'],
                ['turn', 'turn'],
                ['turn', 'roi'],
                ['roi', 'critique'],
                ['critique', 'replan'],
                ['critique', 'finalize'],
                ['replan', 'roi'],
                ['finalize', END]
            ]
        };
    }

    private buildSimulationGraph() {
        return new StateGraph(SimulationGraphState)
            .addNode('initialize', async (input: SimulationGraphStateType) => {
                this.throwIfAborted();
                this.resetState();
                this.metricsService.startCycle();
                this.state.run_id = input.runId;
                this.ensureBrains([...input.stakeholders, ...input.teamProfiles]);
                const resolvedConfig = this.prepareRunConfig(input.config ?? undefined);
                await this.loadLongTermMemory(input.queries, resolvedConfig);
                console.log(`🧠 Brains inicializados: ${this.brains.length}`);
                return { queryIndex: 0, outputs: [], config: resolvedConfig ?? null, state: this.cloneState() };
            })
            .addNode('turn', async (input: SimulationGraphStateType) => {
                this.throwIfAborted();
                const query = input.queries[input.queryIndex];
                if (typeof query !== 'string') {
                    return { queryIndex: input.queryIndex + 1, state: this.cloneState() };
                }
                console.log(`\n📢 Situação: "${query}"`);
                const contextualQuery = await this.prepareQueryContext(query);
                const turnOutputs = await this.runTurn({
                    query: contextualQuery,
                    stakeholders: input.stakeholders,
                    config: input.config ?? undefined
                });
                return {
                    queryIndex: input.queryIndex + 1,
                    outputs: [...input.outputs, ...turnOutputs],
                    state: this.cloneState()
                };
            })
            .addNode('critique', async (input: SimulationGraphStateType) => {
                this.throwIfAborted();
                const allowReplan = input.replanCount < 1;
                const replanRequested = await this.runCritique(input.queries, allowReplan, input.roiResult);
                return { replanRequested, state: this.cloneState() };
            })
            .addNode('replan', async (input: SimulationGraphStateType) => {
                this.throwIfAborted();
                const baseQuery = input.queries[Math.max(0, input.queryIndex - 1)] || 'a simulação atual';
                const query = `[REPLAN] Reavalie a situação após a crítica e proponha um ajuste controlado: ${baseQuery}`;
                const turnOutputs = await this.runTurn({
                    query,
                    stakeholders: input.stakeholders,
                    config: input.config ?? undefined
                });
                return {
                    replanCount: input.replanCount + 1,
                    replanRequested: false,
                    outputs: [...input.outputs, ...turnOutputs],
                    state: this.cloneState()
                };
            })
            .addNode('roi', async (input: SimulationGraphStateType) => {
                this.throwIfAborted();
                if (!input.config) return { roiResult: undefined, state: this.cloneState() };
                console.log('\n💰 Calculando ROI projetado...');
                const roi = await this.roiCalculator.calculateROI(
                    input.config,
                    input.config.framework_config?.name || 'Framework personalizado'
                );
                this.throwIfAborted();
                this.appendReasoning('projetar retorno financeiro da configuração', 'roi', 'ROI calculado');
                return { roiResult: roi, state: this.cloneState() };
            })
            .addNode('finalize', async () => {
                this.throwIfAborted();
                // Set a first snapshot so the persisted metadata includes replan count.
                const metricsBeforeMemory = this.metricsService.calculateMetrics();
                this.state.metricas_agenticas = metricsBeforeMemory;
                await this.persistLongTermMemory();
                // Persistence can itself degrade the run; refresh the public metrics
                // after the fail-open write attempt so they are never stale.
                const metrics = this.metricsService.calculateMetrics();
                metrics.degraded = metrics.degraded || Boolean(this.state.degraded);
                this.state.metricas_agenticas = metrics;
                const riskScore = 100 - Number((this.state as SimulationState & { plausibility_score?: number }).plausibility_score ?? 0);
                const health = this.healthMonitor.record({
                    costUsd: metrics.cost_estimate_usd,
                    totalTokens: metrics.total_tokens,
                    durationMs: metrics.time_to_solve_ms,
                    riskIncidents: metrics.risk_incidents,
                    riskScore,
                    degraded: metrics.degraded
                });
                this.state.health = {
                    healthy: health.healthy,
                    degraded: health.degraded,
                    alerts: health.alerts.map(alert => ({ code: alert.code, severity: alert.severity, message: alert.message }))
                };
                this.appendReasoning('verificar custo, latência e risco do ciclo', 'health_monitor', health.healthy ? 'sem alertas' : `${health.alerts.length} alerta(s)`);
                if (this.state.historico.length > 0) {
                    this.state.historico[this.state.historico.length - 1].metricas_agenticas = metrics;
                }
                return { state: this.cloneState() };
            })
            .addConditionalEdges('initialize', (input: SimulationGraphStateType) =>
                input.queries.length > 0 ? 'turn' : 'roi'
            )
            .addConditionalEdges('turn', (input: SimulationGraphStateType) =>
                input.queryIndex < input.queries.length ? 'turn' : 'roi'
            )
            .addConditionalEdges('critique', (input: SimulationGraphStateType) =>
                input.replanRequested && input.replanCount < 1 ? 'replan' : 'finalize'
            )
            .addEdge(START, 'initialize')
            .addEdge('replan', 'roi')
            .addEdge('roi', 'critique')
            .addEdge('finalize', END)
            .compile({ checkpointer: this.checkpointer, name: 'frame-sim-orchestrator' });
    }

    private async runCritique(queries: string[], allowReplan: boolean, roiResult?: unknown): Promise<boolean> {
        this.throwIfAborted();
        // CRITIC: one call per simulation, after all turn nodes complete.
        try {
            const criticSummary = {
                moral_time: this.state.moral_time,
                velocidade_sprint: this.state.velocidade_sprint,
                confianca_stakeholders: this.state.confianca_stakeholders,
                eventos_disparados: this.state.eventos_disparados,
                eventos_rh: this.state.eventos_rh,
                baixas: this.brains.filter(b => b.status !== 'ativo').length,
                roi_result: roiResult
            };
            const critique = await this.criticAgent.critique(
                criticSummary,
                `Query original: ${queries.join(' | ')}`,
                { signal: this.activeSignal }
            );
            this.throwIfAborted();
            (this.state as any).plausibility_score = clamp(Number(critique.plausibilityScore) || 0, 0, 100);
            (this.state as any).replan_triggered = Boolean(critique.replanRequired);
            this.state.critique_summary = this.sanitizeText(critique.justification, 240);
            if (critique.degraded) this.markDegraded('critic indisponível');
            this.appendReasoning(
                'validar plausibilidade do resultado',
                'critique',
                `score ${((this.state as any).plausibility_score as number).toFixed(0)}; ${critique.replanRequired ? 'replan solicitado' : 'sem replan'}`
            );

            if (critique.replanRequired && allowReplan) {
                this.metricsService.recordReplan?.();
                const justification = this.sanitizeText(critique.justification, 240);
                const suggestion = this.sanitizeText(critique.replanSuggestion, 180);
                this.state.scratchpad = `${this.state.scratchpad} [CRÍTICA: ${justification}${suggestion ? ' → ' + suggestion : ''}]`.slice(-2000);
                this.state.eventos_disparados.push('Replan solicitado pelo Critic');
                this.appendReasoning('corrigir resultado abaixo do limiar', 'replan', 'um ciclo de replanejamento autorizado');
                return true;
            }
            if (critique.replanRequired && !allowReplan) {
                const suggestion = this.sanitizeText(
                    critique.replanSuggestion || 'reduzir o escopo e priorizar o objetivo aspiracional',
                    180
                );
                this.state.aspirational_adjustment = suggestion;
                this.state.current_objective = `Ajuste aspiracional sugerido: ${suggestion}`;
                this.state.scratchpad = `${this.state.scratchpad} [AJUSTE ASPIRACIONAL: ${suggestion}]`.slice(-2000);
                this.state.eventos_disparados.push('Ajuste aspiracional sugerido pelo Critic');
                this.appendReasoning('segunda crítica ainda abaixo do limiar', 'ajuste_aspiracional', suggestion);
            }
            return false;
        } catch (error) {
            this.rethrowCancellation(error);
            console.error(`CriticAgent falhou ao montar o resumo final; seguindo em modo degradado (${this.safeError(error)}).`);
            (this.state as any).plausibility_score = 0;
            (this.state as any).replan_triggered = false;
            this.markDegraded('critic indisponível');
            this.metricsService.markDegraded?.();
            this.appendReasoning('validar plausibilidade do resultado', 'critique', 'falha; execução continuou em modo degradado');
            return false;
        }
    }

    getState(): SimulationState {
        return this.cloneState();
    }

    private cloneState(state: SimulationState = this.state): SimulationState {
        return JSON.parse(JSON.stringify(state)) as SimulationState;
    }

    private markDegraded(reason: string): void {
        this.state.degraded = true;
        this.state.degraded_reasons = Array.from(new Set([...(this.state.degraded_reasons ?? []), reason]));
    }

    resetState(): void {
        this.brains = [];
        this.longTermMemoryContext = '';
        this.moralPrevTurn = 70;
        this.state = {
            turno: 0,
            moral_time: 70,
            velocidade_sprint: 100,
            confianca_stakeholders: 50,
            scratchpad: "Início da simulação. Focar na estabilização inicial.",
            eventos_disparados: [],
            historico: [],
            difficulty_scalar: 1.0,
            current_objective: "Estabilizar adoção inicial.",
            funcionarios: this.brains,
            eventos_rh: [],
            degraded: false,
            degraded_reasons: [],
            reasoning_log: []
        };
    }

    private sanitizeText(value: unknown, maxChars: number): string {
        return String(value ?? '')
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxChars);
    }

    private appendReasoning(reason: string, action: string, observation: string): void {
        const entry: ReasoningLogEntry = {
            reason: this.sanitizeText(reason, MAX_REASONING_FIELD_CHARS),
            action: this.sanitizeText(action, MAX_REASONING_FIELD_CHARS),
            observation: this.sanitizeText(observation, MAX_REASONING_FIELD_CHARS)
        };
        const log = this.state.reasoning_log ?? [];
        log.push(entry);
        this.state.reasoning_log = log.slice(-MAX_REASONING_ENTRIES);
    }

    private prepareRunConfig(config?: SimulationConfig): SimulationConfig | undefined {
        if (!config) return undefined;
        const normalized = (value: string) => value
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        try {
            const catalog = loadFrameworkConfig();
            const requestedId = normalized(config.framework_config?.id || config.framework_config?.name || '');
            const requestedName = normalized(config.framework_config?.name || '');
            const matched = catalog.frameworks.find(item =>
                item.id === requestedId || normalized(item.name) === requestedName
            );
            const name = matched?.name || config.framework_config?.name || 'Framework personalizado';
            const source = matched ? 'catalog' : (config.framework_config?.source || 'inferred');
            config.framework_config = {
                ...config.framework_config,
                id: matched?.id || requestedId || 'custom',
                name,
                source
            };
            this.state.framework_context = { id: config.framework_config.id, name, source, matched: Boolean(matched) };
            const frameworkContext = matched
                ? ` Framework ${matched.name}: papéis ${matched.roles.join(', ')}; rituais ${matched.rituals.map(item => item.name).join(', ')}; riscos ${matched.riskRules.map(item => item.trigger).join('; ')}.`
                : ` Framework enviado: ${name}. ${this.sanitizeText(config.framework_config.description, 600)}`;
            this.state.scratchpad = `${this.state.scratchpad}${this.sanitizeText(frameworkContext, 900)}`.slice(-2000);
            this.appendReasoning('carregar regras do framework selecionado', 'framework_config', `${name}; ${matched ? 'catálogo validado' : 'configuração enviada'}`);
        } catch (error) {
            this.markDegraded('configuração de framework indisponível');
            this.metricsService.markDegraded?.();
            this.appendReasoning('carregar regras do framework selecionado', 'framework_config', `falha ${this.safeError(error)}`);
        }

        try {
            const scenarios = loadEconomicScenarios();
            const seed = config.parametros_simulacao.seed ?? config.contexto_economico?.seed ?? 0;
            let scenarioId = config.contexto_economico?.scenario_id || 'base';
            if (scenarioId === 'auto') {
                const signal = this.externalTool.execute({
                    tool: 'market-signal',
                    input: {
                        sector: config.contexto_estrutural.setor_atuacao.valor,
                        companySize: config.contexto_estrutural.tamanho_ftes.valor,
                        framework: config.framework_config?.id || 'custom'
                    },
                    seed
                });
                scenarioId = typeof signal.result.signal === 'string' ? signal.result.signal : 'base';
                this.state.external_tool_signals = [{
                    tool: signal.tool,
                    offline: signal.offline,
                    summary: `sinal sintético ${scenarioId}; confiança ${signal.result.confidence}`
                }];
                this.appendReasoning('resolver hipótese macroeconômica automática', 'external_tool_stub', `stub offline selecionou ${scenarioId}`);
            }
            const scenario = scenarios.find(item => item.id === scenarioId) ?? selectEconomicScenario(scenarios, seed);
            config.contexto_economico = {
                ...config.contexto_economico,
                seed,
                scenario_id: scenario.id,
                scenario
            };
            this.state.economic_context = {
                profile_id: config.contexto_economico.profile_id,
                scenario_id: scenario.id,
                label: scenario.label,
                uncertainty: scenario.uncertainty
            };
            const riskSignal = this.externalTool.execute({
                tool: 'risk-check',
                input: { framework: config.framework_config?.id || 'custom', scenario: scenario.id },
                seed
            });
            this.state.external_tool_signals = [
                ...(this.state.external_tool_signals ?? []),
                {
                    tool: riskSignal.tool,
                    offline: riskSignal.offline,
                    summary: `risco sintético ${riskSignal.result.riskScore}/100; não é dado externo real`
                }
            ];
            this.state.scratchpad = `${this.state.scratchpad} Cenário econômico ${scenario.label}: demanda x${scenario.demandMultiplier}, trabalho x${scenario.laborCostMultiplier}, incidentes x${scenario.incidentMultiplier}; ${scenario.uncertainty}`.slice(-2000);
            this.appendReasoning('aplicar hipótese econômica controlada', 'economic_scenario', `${scenario.id}; seed ${seed >>> 0}`);
        } catch (error) {
            this.markDegraded('cenário econômico indisponível');
            this.metricsService.markDegraded?.();
            this.appendReasoning('aplicar hipótese econômica controlada', 'economic_scenario', `falha ${this.safeError(error)}`);
        }
        return config;
    }

    private async prepareQueryContext(query: string): Promise<string> {
        const classification = await this.queryRouter.classify(query);
        this.appendReasoning('selecionar fontes para a situação atual', 'rag_router', `${classification.mode}; confiança ${classification.confidence.toFixed(2)}`);
        if (!this.vectorStore || !this.queryRouter.shouldUseRAG(classification)) return query;
        try {
            const results = await this.vectorStore.hybridSearch({
                query: classification.refinedQuery,
                collections: classification.filters.collections,
                topK: 5
            });
            this.throwIfAborted();
            const snippets = results.slice(0, 5).map((result, index) => {
                const source = this.sanitizeText(result.metadata?.collection || 'fonte', 40);
                return `${index + 1}) [${source}] ${this.sanitizeText(result.content, 320)}`;
            });
            this.appendReasoning('buscar evidências possivelmente divergentes', 'rag_search', `${snippets.length} contexto(s) recuperado(s)`);
            if (snippets.length === 0) return query;
            return `${this.sanitizeText(query, 2_000)}\n[CONTEXTO RAG — fontes podem ser incompletas ou conflitantes; explicite divergências]\n${snippets.join('\n')}`.slice(0, 4_000);
        } catch (error) {
            this.rethrowCancellation(error);
            this.markDegraded('RAG da situação indisponível');
            this.metricsService.markDegraded?.();
            this.appendReasoning('buscar evidências possivelmente divergentes', 'rag_search', `falha ${this.safeError(error)}; consulta original preservada`);
            return query;
        }
    }

    private throwIfAborted(): void {
        if (!this.activeSignal?.aborted) return;
        const error = new Error('Simulation cancelled.');
        error.name = 'AbortError';
        throw error;
    }

    private rethrowCancellation(error: unknown): void {
        if (this.activeSignal?.aborted) this.throwIfAborted();
        if (error instanceof Error && error.name === 'AbortError') throw error;
    }

    private safeError(error: unknown): string {
        return error instanceof Error ? error.name : 'Unavailable';
    }

    private async loadLongTermMemory(queries: string[], config?: SimulationConfig): Promise<void> {
        this.throwIfAborted();
        if (!this.vectorStore) {
            this.appendReasoning('contextualizar a simulação com histórico', 'recall_memories', 'vector store não configurado');
            return;
        }

        const query = this.sanitizeText(
            queries.filter(Boolean).join(' | ') || config?.contexto_situacional.cenario_atual || 'simulação',
            MAX_MEMORY_QUERY_CHARS
        );
        try {
            const memories = await this.vectorStore.recallMemories(query, 3);
            this.throwIfAborted();
            const snippets = memories
                .map(memory => ({
                    content: this.sanitizeText(memory?.content, MAX_MEMORY_ENTRY_CHARS),
                    score: Number(memory?.score) || Number.POSITIVE_INFINITY
                }))
                .filter(memory => Boolean(memory.content))
                .sort((left, right) => left.score - right.score || left.content.localeCompare(right.content))
                .slice(0, 3);
            if (snippets.length > 0) {
                this.longTermMemoryContext = ` Memórias relevantes: ${snippets.map((item, index) => `${index + 1}) ${item.content}`).join(' ')}`;
                this.state.scratchpad = `${this.state.scratchpad}${this.longTermMemoryContext}`.slice(-2000);
            }
            this.appendReasoning('contextualizar a simulação com histórico', 'recall_memories', `${snippets.length} memória(s) recuperada(s)`);
        } catch (error) {
            this.rethrowCancellation(error);
            console.warn(`Memória de longo prazo indisponível; seguindo em modo fail-open (${this.safeError(error)}).`);
            this.markDegraded('memória de longo prazo indisponível');
            this.metricsService.markDegraded?.();
            this.appendReasoning('contextualizar a simulação com histórico', 'recall_memories', 'falha; execução continuou sem memória');
        }
    }

    private async persistLongTermMemory(): Promise<void> {
        this.throwIfAborted();
        if (!this.vectorStore) {
            this.appendReasoning('persistir contexto para próximas simulações', 'save_memory', 'vector store não configurado');
            return;
        }

        const score = Number((this.state as any).plausibility_score ?? 0);
        const summary = this.sanitizeText(
            `Run ${this.state.run_id ?? 'unknown'}; turnos ${this.state.turno}; objetivo ${this.state.current_objective}; moral ${this.state.moral_time.toFixed(0)}; confiança ${this.state.confianca_stakeholders.toFixed(0)}; crítica ${score.toFixed(0)}: ${this.state.critique_summary ?? 'indisponível'}; replan ${this.state.metricas_agenticas?.replan_count ?? 0}.`,
            MAX_MEMORY_WRITE_CHARS
        );
        try {
            const persisted = await this.vectorStore.saveMemory(summary, {
                run_id: this.state.run_id ?? 'unknown',
                turno: this.state.turno,
                plausibility_score: score,
                replan_count: this.state.metricas_agenticas?.replan_count ?? 0,
                degraded: Boolean(this.state.degraded)
            });
            this.throwIfAborted();
            if (persisted === false) throw new Error('vector store recusou a persistência');
            this.appendReasoning('persistir contexto para próximas simulações', 'save_memory', 'resumo e crítica persistidos');
        } catch (error) {
            this.rethrowCancellation(error);
            console.warn(`Não foi possível persistir memória; resposta preservada (${this.safeError(error)}).`);
            this.markDegraded('falha ao persistir memória de longo prazo');
            this.metricsService.markDegraded?.();
            this.appendReasoning('persistir contexto para próximas simulações', 'save_memory', 'falha; resposta preservada em fail-open');
        }
    }
}

export function createOrchestrator(apiKey?: string, vectorStore?: VectorStoreService): OrchestratorAgent {
    return new OrchestratorAgent(apiKey, vectorStore);
}
