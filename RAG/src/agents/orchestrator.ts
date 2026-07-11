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

// Tipos de decisão do EmployeeBrain considerados "graves" o suficiente para também
// entrar em state.eventos_disparados (visível fora do painel de RH).
const GRAVE_DECISION_TYPES = new Set(['pedido_demissao', 'burnout', 'confronto_lideranca']);

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

export class OrchestratorAgent {
    private vectorStore?: VectorStoreService;
    private roiCalculator: ROICalculatorAgent;
    private queryRouter: QueryRouter;
    private smartRouter: SmartRouter;
    private metricsService: MetricsService;
    private personaAgent: PersonaAgent;
    private goalAgent: GoalAgent;
    private criticAgent: CriticAgent;
    private state!: SimulationState;
    // EmployeeBrain: array ordenado é a fonte da verdade (applyContagion opera em arrays).
    // state.funcionarios aponta para este mesmo array e serializa junto com o state.
    private brains: EmployeeBrainState[] = [];
    // Moral no início do turno anterior — deriva o impacto pessoal das personas de
    // fundo (que não têm resposta LLM): elas sentem o delta de moral do turno passado.
    private moralPrevTurn = 70;
    // velocidadeBase fixa = velocidade inicial do sprint (100). Aplicar velocidadeMod
    // sobre a velocidade já modificada comporia a penalidade turno a turno; como o LLM
    // não emite mais deltas de velocidade, a base não tem outra fonte de mudança.
    private static readonly VELOCIDADE_BASE = 100;

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
        this.criticAgent = new CriticAgent();

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
            console.log(`  → Simulando ${stakeholder.informacoes_basicas.nome} (${stakeholder.informacoes_basicas.cargo})`);

            const brainIdx = this.brains.findIndex(b => b.personaId === stakeholder.id);

            const response = await this.personaAgent.simulateResponse(
                stakeholder,
                query,
                config,
                brainIdx >= 0 ? this.brains[brainIdx] : undefined
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
            const response = await llm.generate(prompt);

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
                this.state.scratchpad = result.scratchpad_update;
            }

            if (result.eventos_disparados) {
                this.state.eventos_disparados.push(...result.eventos_disparados);
            }

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
            console.error('Erro ao consolidar turno (narrativa LLM):', error);
            // Estado numérico já foi aplicado deterministicamente acima — nada a reverter.
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
        teamProfiles?: PersonaProfile[]
    ): Promise<{
        state: SimulationState;
        roi?: unknown;
    }> {
        console.log(`\n🚀 Iniciando simulação com ${queries.length} situações e ${stakeholders.length} stakeholders\n`);
        this.resetState();

        // EmployeeBrain: stakeholders + time de fundo (ensureBrains deduplica por id)
        this.ensureBrains([...stakeholders, ...(teamProfiles ?? [])]);
        console.log(`🧠 Brains inicializados: ${this.brains.length}`);

        for (const query of queries) {
            console.log(`\n📢 Situação: "${query}"`);
            await this.runTurn({ query, stakeholders, config });
        }

        // CRITIC: 1 chamada por simulação (não por turno) — valida o resultado final.
        // CriticAgent.critique já é fail-open (score 100 em erro); o try/catch aqui só
        // cobre falha ao montar o resumo, o que na prática nunca deveria disparar.
        try {
            const criticSummary = {
                moral_time: this.state.moral_time,
                velocidade_sprint: this.state.velocidade_sprint,
                confianca_stakeholders: this.state.confianca_stakeholders,
                eventos_disparados: this.state.eventos_disparados,
                eventos_rh: this.state.eventos_rh,
                baixas: this.brains.filter(b => b.status !== 'ativo').length
            };
            const critique = await this.criticAgent.critique(criticSummary, `Query original: ${queries.join(' | ')}`);
            (this.state as any).plausibility_score = critique.plausibilityScore;
            (this.state as any).replan_triggered = critique.replanRequired;

            if (critique.replanRequired) {
                // Replan barato (máx 1 ajuste, sem re-rodar turnos nem LLM extra):
                // anexa a crítica ao scratchpad e registra o evento.
                this.state.scratchpad += ` [CRÍTICA: ${critique.justification}${critique.replanSuggestion ? ' → ' + critique.replanSuggestion : ''}]`;
                this.state.eventos_disparados.push('Replan solicitado pelo Critic');
            }
        } catch (error) {
            console.error('CriticAgent falhou ao montar o resumo final (bypass):', error);
            (this.state as any).plausibility_score = 100;
            (this.state as any).replan_triggered = false;
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
        this.brains = [];
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
            eventos_rh: []
        };
    }
}

export function createOrchestrator(apiKey?: string, vectorStore?: VectorStoreService): OrchestratorAgent {
    return new OrchestratorAgent(apiKey, vectorStore);
}
