import assert from 'node:assert/strict';
import { OrchestratorAgent } from '../agents/orchestrator.js';
import { MetricsService } from '../services/MetricsService.js';
import type { PersonaProfile, SimulationConfig } from '../types/index.js';

const profile: PersonaProfile = {
    id: 'offline-persona',
    tipo: 'Tech',
    informacoes_basicas: {
        nome: 'Offline Pessoa', genero: 'X', idade: 30, cargo: 'Sênior', area: 'Engenharia',
        tempo_empresa: '2 anos', tempo_carreira: '10 anos', formacao: 'Computação',
        localizacao: 'São Paulo', neurodivergencia: null
    },
    psicologia_comportamento: {
        'Estilo de Comunicação': 'Direto', 'Abordagem ao Trabalho': 'Pragmático',
        'Gestão de Conflitos': 'Compromisso', 'Relação com Tecnologia': 'Alta',
        'Liderança e Influência': 'Média', 'Relação com Processos': 'Crítico',
        'Gestão de Estresse': 'Resiliente', 'Motivadores Principais': 'Autonomia'
    },
    habilidades: { hard_skills: [], soft_skills: [] },
    contexto: { framework_preferido: 'Scrum', opiniao_agil: 'Pragmático', desafio_atual: 'Prazo', motivacao_atual: 'Entrega' },
    historia: 'offline',
    ace_metadata: { A: 'Medium', C: 'Medium', E: 'Medium', resumo_compacto: 'offline', tags_busca: [] }
};

const config: SimulationConfig = {
    contexto_estrutural: {
        categoria_cenario: { valor: 'Management', opcoes: [] }, setor_atuacao: { valor: 'Tech', opcoes: [] },
        tamanho_ftes: { valor: 10, descricao: 'FTEs' }, orcamento_disponivel: { valor: 'Medium', opcoes: [] }
    },
    calibragem_realismo: {
        divida_tecnica: { valor: 'Média', opcoes: [] }, velocidade_operacional: { valor: 'Ágil', opcoes: [] },
        historico_traumatico: { valor: false, descricao: '' }
    },
    ecossistema_humano: { distribuicao_selecionada: [], descricao: '' },
    contexto_situacional: { cenario_atual: 'offline', opcoes: [] },
    parametros_simulacao: { duracao_meses: 1, acuracia_alvo: 'High', adaptacao_pme: true }
};

function dependencies(delay = 0) {
    const calls = { critic: 0, roi: 0 };
    let mockReplans = 0;
    const personaAgent = {
        async simulateResponse(_persona: PersonaProfile, query: string) {
            if (delay) await new Promise(resolve => setTimeout(resolve, delay));
            return {
                resposta_persona: query,
                emocao_detectada: 'neutro', impacto_moral: 0,
                rag_utilizado: false, fonte_rag: null
            };
        }
    };
    const smartRouter = {
        async route() {
            return { async generate() {
                return { content: '{"confianca_delta":0,"scratchpad_update":"offline","resumo_turno":"ok","eventos_disparados":[]}', modelUsed: 'offline' };
            } };
        }
    };
    const criticAgent = {
        async critique() { calls.critic++; return { plausibilityScore: 88, justification: 'ok', replanRequired: false }; }
    };
    const roiCalculator = {
        setVectorStore() { /* no-op */ },
        async calculateROI() {
            calls.roi++;
            return { projecao_mensal: [], roi_final: 1, break_even_mes: null, eventos_ocorridos: [], confianca_estimativa: 'Alta' as const };
        }
    };
    const metricsService = {
        startCycle() { /* no-op */ },
        calculateMetrics() {
            return {
                quality_per_cycle: 88, time_to_solve_ms: 1, cost_estimate_usd: 0, total_tokens: 0,
                router_choice: 'offline', input_tokens: 0, output_tokens: 0, replan_count: mockReplans,
                risk_incidents: 0, tir: 0, degraded: false
            };
        },
        recordReplan() { mockReplans++; },
        recordCycle() { /* no-op */ },
        recordIncident() { /* no-op */ },
        recordTokens() { /* no-op */ },
        setRouterChoice() { /* no-op */ },
        markDegraded() { /* no-op */ }
    };
    return { calls, personaAgent, smartRouter, criticAgent, roiCalculator, metricsService };
}

async function testGraphTopologyAndExecution() {
    const deps = dependencies();
    const orchestrator = new OrchestratorAgent(undefined, undefined, deps);
    assert.deepEqual(orchestrator.getSimulationGraphTopology().nodes, ['initialize', 'turn', 'roi', 'critique', 'replan', 'finalize']);
    const result = await orchestrator.runSimulation(['q1', 'q2'], [profile], config);
    assert.equal(result.state.turno, 2);
    assert.equal(result.state.historico.length, 2);
    assert.equal(deps.calls.critic, 1);
    assert.equal(deps.calls.roi, 1);
    assert.equal(result.state.historico[1].metricas_atualizadas.moral_time, result.state.moral_time);
    assert.equal(result.state.metricas_agenticas?.risk_incidents, 0);
    assert.equal(orchestrator.getCheckpointThreadCount(), 0, 'completed run must release its checkpoint thread');
    assert.ok(result.state.framework_context);
    assert.ok(result.state.economic_context);
    assert.equal(result.state.health?.healthy, true);

    result.state.eventos_disparados.push('caller mutation');
    assert.equal(orchestrator.getState().eventos_disparados.includes('caller mutation'), false);
    console.log('  ✓ StateGraph topology, loop, critique, ROI, and deep state isolation');
}

function testAgenticMetrics() {
    const metrics = new MetricsService();
    metrics.startCycle();
    metrics.recordCycle();
    metrics.recordCycle();
    metrics.recordIncident(2);
    metrics.recordReplan();
    metrics.setRouterChoice('offline-router');
    metrics.recordTokens(10, 5, 'offline');
    const result = metrics.calculateMetrics();
    assert.equal(result.total_tokens, 15);
    assert.equal(result.input_tokens, 10);
    assert.equal(result.output_tokens, 5);
    assert.equal(result.replan_count, 1);
    assert.equal(result.risk_incidents, 2);
    assert.equal(result.tir, 100);
    assert.equal(result.router_choice, 'offline-router');
    assert.ok(result.cost_estimate_usd > 0);
    console.log('  ✓ agentic metrics report tokens, router, incidents, TIR, and replans');
}

async function testSingleExplicitReplan() {
    const deps = dependencies();
    let critiques = 0;
    deps.criticAgent = {
        async critique() {
            critiques++;
            return { plausibilityScore: 40, justification: 'offline critique', replanRequired: true, replanSuggestion: 'reduce scope' };
        }
    };
    let replans = 0;
    const originalRecordReplan = deps.metricsService.recordReplan;
    deps.metricsService.recordReplan = () => { replans++; originalRecordReplan?.(); };
    const orchestrator = new OrchestratorAgent(undefined, undefined, deps);
    const result = await orchestrator.runSimulation(['q1'], [profile], config);
    assert.equal(critiques, 2, 'replan must be followed by one final critique');
    assert.equal(replans, 1, 'at most one replan cycle is allowed');
    assert.equal(result.state.historico.length, 2, 'one original turn plus one replan turn');
    assert.equal(result.state.metricas_agenticas?.replan_count, 1);
    assert.equal(result.state.aspirational_adjustment, 'reduce scope');
    assert.equal(result.state.reasoning_log?.filter(entry => entry.action === 'ajuste_aspiracional').length, 1);
    console.log('  ✓ low critique routes through one explicit bounded replan node');
}

async function testLongTermMemoryFailOpenAndReasoningLog() {
    const deps = dependencies();
    const recalled: Array<{ query: string; topK: number }> = [];
    const writes: Array<{ content: string; metadata: Record<string, unknown> }> = [];
    const vectorStore = {
        async recallMemories(query: string, topK: number) {
            recalled.push({ query, topK });
            return [
                { content: 'memória útil\ncom controle', score: 0.2, metadata: {} },
                { content: 'segunda memória', score: 0.3, metadata: {} },
                { content: 'terceira memória', score: 0.4, metadata: {} },
                { content: 'não deve ser injetada', score: 0.5, metadata: {} }
            ];
        },
        async saveMemory(content: string, metadata: Record<string, unknown>) {
            writes.push({ content, metadata });
            return true;
        }
    };
    const orchestrator = new OrchestratorAgent(undefined, vectorStore as any, deps);
    const result = await orchestrator.runSimulation(['memory query'], [profile], config);
    assert.equal(recalled.length, 1);
    assert.equal(recalled[0].topK, 3);
    assert.match(result.state.scratchpad, /memória útil com controle/);
    assert.doesNotMatch(result.state.scratchpad, /não deve ser injetada/);
    assert.equal(writes.length, 1, 'only final summary is persisted');
    assert.equal(writes[0].metadata.run_id, result.state.run_id);
    assert.match(writes[0].content, /crítica 88: ok/);
    assert.ok(result.state.reasoning_log?.some(entry => entry.action === 'recall_memories'));
    assert.ok(result.state.reasoning_log?.some(entry => entry.action === 'router'));
    assert.ok(result.state.reasoning_log?.some(entry => entry.action === 'critique'));
    assert.ok(result.state.reasoning_log?.some(entry => entry.action === 'roi'));
    assert.ok(result.state.reasoning_log?.every(entry => entry.reason.length <= 240 && entry.action.length <= 240 && entry.observation.length <= 240));
    console.log('  ✓ long-term memory is bounded, sanitized, fail-open, and auditable');
}

async function testLongTermMemoryOutageDoesNotFailRun() {
    const deps = dependencies();
    const vectorStore = {
        async recallMemories() { throw new Error('offline Chroma'); },
        async saveMemory() { throw new Error('offline Chroma'); }
    };
    const orchestrator = new OrchestratorAgent(undefined, vectorStore as any, deps);
    const result = await orchestrator.runSimulation(['outage query'], [profile], config);
    assert.equal(result.state.turno, 1);
    assert.equal(result.state.degraded, true);
    assert.ok(result.state.degraded_reasons?.some(reason => reason.includes('memória')));
    assert.ok(result.state.reasoning_log?.some(entry => entry.action === 'save_memory' && entry.observation.includes('fail-open')));
    console.log('  ✓ Chroma outages remain fail-open and explicitly degraded');
}

async function testContradictoryRagAndArbitraryFrameworkContext() {
    const deps = dependencies();
    const seenQueries: string[] = [];
    deps.personaAgent = {
        async simulateResponse(_persona: PersonaProfile, query: string) {
            seenQueries.push(query);
            return {
                resposta_persona: 'contexto recebido',
                emocao_detectada: 'cautela', impacto_moral: 0,
                rag_utilizado: true, fonte_rag: null
            };
        }
    };
    const vectorStore = {
        async recallMemories() { return []; },
        async saveMemory() { return true; },
        async hybridSearch() {
            return [
                { content: 'Scrum reduz o lead time neste contexto.', score: 0.1, metadata: { collection: 'playbooks' } },
                { content: 'Scrum aumenta o custo de coordenação neste contexto.', score: 0.2, metadata: { collection: 'metrics' } }
            ];
        }
    };
    const arbitraryConfig: SimulationConfig = {
        ...config,
        framework_config: {
            id: 'flow-lattice',
            name: 'Flow Lattice 9',
            source: 'uploaded',
            description: 'Papéis rotativos, cadência semanal e limites explícitos de trabalho em progresso.'
        }
    };
    const orchestrator = new OrchestratorAgent(undefined, vectorStore as any, deps);
    const result = await orchestrator.runSimulation(
        ['Compare Scrum versus Kanban em custo e risco.'],
        [profile],
        arbitraryConfig
    );
    assert.equal(result.state.framework_context?.name, 'Flow Lattice 9');
    assert.equal(result.state.framework_context?.source, 'uploaded');
    assert.ok(result.state.reasoning_log?.some(entry => entry.action === 'framework_config' && entry.observation.includes('Flow Lattice 9')));
    assert.match(seenQueries[0], /fontes podem ser incompletas ou conflitantes/);
    assert.match(seenQueries[0], /Scrum reduz o lead time/);
    assert.match(seenQueries[0], /Scrum aumenta o custo de coordenação/);
    assert.ok(result.state.reasoning_log?.some(entry => entry.action === 'rag_search' && entry.observation.includes('2 contexto')));
    console.log('  ✓ contradictory RAG evidence and arbitrary uploaded frameworks remain explicit and traceable');
}

async function testConcurrentRequestIsolation() {
    const leftDeps = dependencies(5);
    const rightDeps = dependencies(1);
    const left = new OrchestratorAgent(undefined, undefined, leftDeps);
    const right = new OrchestratorAgent(undefined, undefined, rightDeps);
    const [leftResult, rightResult] = await Promise.all([
        left.runSimulation(['left'], [profile], config),
        right.runSimulation(['right'], [profile], config)
    ]);
    assert.equal(leftResult.state.turno, 1);
    assert.equal(rightResult.state.turno, 1);
    assert.equal(leftResult.state.historico.length, 1);
    assert.equal(rightResult.state.historico.length, 1);
    assert.equal(leftResult.state.historico[0].resposta.resposta_persona, 'left');
    assert.equal(rightResult.state.historico[0].resposta.resposta_persona, 'right');
    console.log('  ✓ concurrent orchestrators keep independent state/checkpoints');
}

async function testCancellationCleansCheckpoint() {
    const deps = dependencies(30);
    const orchestrator = new OrchestratorAgent(undefined, undefined, deps);
    const controller = new AbortController();
    const pending = orchestrator.runSimulation(['cancel-me'], [profile], config, [], { signal: controller.signal });
    setTimeout(() => controller.abort('offline-test'), 5);
    await assert.rejects(pending, (error: unknown) => error instanceof Error && error.name === 'AbortError');
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(orchestrator.getCheckpointThreadCount(), 0, 'aborted run must release its checkpoint thread');
    await assert.rejects(
        orchestrator.runSimulation(['must-not-reuse'], [profile], config),
        /already running/,
        'an aborted request-scoped orchestrator must be retired while late provider work drains'
    );
    console.log('  ✓ cancellation propagates and releases LangGraph checkpoints');
}

async function testCancellationIsNeverConvertedToDegradedSuccess() {
    const runStage = async (
        customize: (deps: ReturnType<typeof dependencies>, started: () => void) => { vectorStore?: any }
    ) => {
        const deps = dependencies();
        let markStarted!: () => void;
        const started = new Promise<void>(resolve => { markStarted = resolve; });
        const { vectorStore } = customize(deps, markStarted);
        const orchestrator = new OrchestratorAgent(undefined, vectorStore, deps);
        const controller = new AbortController();
        const pending = orchestrator.runSimulation(['cancel-boundary'], [profile], config, [], { signal: controller.signal });
        await started;
        controller.abort('boundary-test');
        await assert.rejects(pending, (error: unknown) => error instanceof Error && error.name === 'AbortError');
        await new Promise(resolve => setTimeout(resolve, 40));
        assert.equal(orchestrator.getCheckpointThreadCount(), 0);
    };

    await runStage((deps, started) => {
        deps.smartRouter = {
            async route() {
                return { async generate() {
                    started();
                    await new Promise(resolve => setTimeout(resolve, 25));
                    return { content: '{"confianca_delta":0}', modelUsed: 'offline' };
                } };
            }
        };
        return {};
    });

    await runStage((deps, started) => {
        deps.criticAgent = {
            async critique() {
                started();
                await new Promise(resolve => setTimeout(resolve, 25));
                return { plausibilityScore: 88, justification: 'late', replanRequired: false };
            }
        };
        return {};
    });

    await runStage((_deps, started) => ({
        vectorStore: {
            async recallMemories() {
                started();
                await new Promise(resolve => setTimeout(resolve, 25));
                return [];
            },
            async saveMemory() { return true; }
        }
    }));

    await runStage((_deps, started) => ({
        vectorStore: {
            async recallMemories() { return []; },
            async saveMemory() {
                started();
                await new Promise(resolve => setTimeout(resolve, 25));
                return true;
            }
        }
    }));

    console.log('  ✓ cancellation survives narrative, critique, recall, and persistence fail-open boundaries');
}

async function testOneRunPerOrchestratorInstance() {
    const orchestrator = new OrchestratorAgent(undefined, undefined, dependencies(25));
    const first = orchestrator.runSimulation(['first'], [profile], config);
    await assert.rejects(
        orchestrator.runSimulation(['overlap'], [profile], config),
        /already running/
    );
    await first;
    const sequential = await orchestrator.runSimulation(['sequential'], [profile], config);
    assert.equal(sequential.state.historico[0].resposta.resposta_persona, 'sequential');
    console.log('  ✓ one request per orchestrator instance; sequential reuse remains isolated');
}

await testGraphTopologyAndExecution();
testAgenticMetrics();
await testSingleExplicitReplan();
await testLongTermMemoryFailOpenAndReasoningLog();
await testLongTermMemoryOutageDoesNotFailRun();
await testContradictoryRagAndArbitraryFrameworkContext();
await testConcurrentRequestIsolation();
await testCancellationCleansCheckpoint();
await testCancellationIsNeverConvertedToDegradedSuccess();
await testOneRunPerOrchestratorInstance();
