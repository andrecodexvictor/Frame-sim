import assert from 'node:assert';
import type { PersonaProfile, PersonaResponse, SimulationConfig } from '../types/index.js';
import { OrchestratorAgent, type OrchestratorDependencies } from '../agents/orchestrator.js';
import type { PersonaTurnJudgment, SemanticJudgeRequest } from '../services/PersonaJudgmentModule.js';
import { DocumentLoader } from '../services/documentLoader.js';

let testCount = 0;
const previousJevMode = process.env.JEV_MODE;
// The active integration fixtures model an explicitly enabled server policy.
process.env.JEV_MODE = 'active';
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    await fn();
    testCount++;
    console.log(`  ✓ ${name}`);
}

const profile: PersonaProfile = {
    id: 'key-1', tipo: 'Tech',
    informacoes_basicas: {
        nome: 'Ana', genero: 'F', idade: 35, cargo: 'Tech Lead', area: 'Tecnologia',
        tempo_empresa: '3 anos', tempo_carreira: '12 anos', formacao: 'Computação',
        localizacao: 'São Paulo', neurodivergencia: null,
    },
    psicologia_comportamento: {
        'Estilo de Comunicação': 'Direta', 'Abordagem ao Trabalho': 'Pragmático',
        'Gestão de Conflitos': 'Colaborativa', 'Relação com Tecnologia': 'Alta',
        'Liderança e Influência': 'Alta', 'Relação com Processos': 'Pragmática',
        'Gestão de Estresse': 'Resiliente', 'Motivadores Principais': 'Autonomia',
    },
    habilidades: { hard_skills: ['TS'], soft_skills: ['liderança'] },
    contexto: { framework_preferido: 'Scrum', opiniao_agil: 'Entusiasta', desafio_atual: 'escala', motivacao_atual: 'impacto' },
    historia: 'experiência',
    ace_metadata: { A: 'autonomia', C: 'escala', E: 'liderança', resumo_compacto: 'lead', tags_busca: ['lead'] },
};

const narrativeResponse: PersonaResponse = {
    resposta_persona: 'Vamos testar a mudança.', emocao_detectada: 'esperança', impacto_moral: 7,
    rag_utilizado: false, fonte_rag: null, degraded: false,
};

function judgment(): PersonaTurnJudgment {
    return {
        decisions: [{
            personaId: 'key-1', reaction: 'apoiar', intensity: 'alta', moralDirection: 'positive',
            influencesPeers: true, confidence: 0.95, origin: 'jev',
            effects: { moralDelta: 5, engagementDelta: 0, stressDelta: 0, confidenceDelta: 0, contagion: { targets: 2, humorDelta: 2, stressDelta: 0 } },
        }],
        audit: { model: 'jev-1.13.0', origin: 'jev', requestHash: 'test', confidence: 0.95, latencyMs: 1 },
    };
}

function dependencies(captured: { requests: SemanticJudgeRequest[]; narratives: unknown[]; audits: unknown[] }): OrchestratorDependencies {
    return {
        personaAgent: {
            async simulateResponse(...args: unknown[]) {
                captured.narratives.push(args[5]);
                return narrativeResponse;
            },
        },
        personaJudgment: {
            async evaluateTurn(input) {
                captured.requests.push(input as unknown as SemanticJudgeRequest);
                return judgment();
            },
        },
        metricsService: {
            startCycle() {}, calculateMetrics: () => ({
                quality_per_cycle: 100, time_to_solve_ms: 1, cost_estimate_usd: 0, total_tokens: 0,
                router_choice: 'test', input_tokens: 0, output_tokens: 0, replan_count: 0,
                risk_incidents: 0, tir: 0, degraded: false,
            }),
            recordPersonaJudgment(input) { captured.audits.push(input); },
            recordCycle() {}, recordIncident() {}, setJevMode() {},
        },
        smartRouter: {
            async route() { return { async generate() { return { content: '{"confianca_delta":0}' }; } }; },
        },
    };
}

await test('active usa uma chamada em lote e força impacto numérico do julgamento', async () => {
    const captured = { requests: [] as SemanticJudgeRequest[], narratives: [] as unknown[], audits: [] as unknown[] };
    const orchestrator = new OrchestratorAgent(undefined, undefined, dependencies(captured));
    const config = { jev: { mode: 'active' } } as SimulationConfig;
    const outputs = await orchestrator.runTurn({ query: 'prioridade nova', stakeholders: [profile], config });
    assert.strictEqual(captured.requests.length, 1);
    assert.strictEqual(captured.requests[0].stakeholders.length, 1);
    assert.equal((captured.narratives[0] as { reaction: string }).reaction, 'apoiar');
    assert.strictEqual(outputs[0].resposta.impacto_moral, 5);
    assert.strictEqual(outputs[0].resposta.julgamento?.origin, 'jev');
    assert.strictEqual((captured.audits[0] as { mode: string }).mode, 'active');
});

await test('baixa confiança retorna ao caminho integral do EmployeeBrain', async () => {
    const captured = { requests: [] as SemanticJudgeRequest[], narratives: [] as unknown[], audits: [] as unknown[] };
    const deps = dependencies(captured);
    deps.personaJudgment = {
        async evaluateTurn(input) {
            captured.requests.push(input as unknown as SemanticJudgeRequest);
            const accepted = judgment();
            return {
                decisions: accepted.decisions.map(decision => ({
                    ...decision,
                    origin: 'deterministic_fallback' as const,
                })),
                audit: { ...accepted.audit, origin: 'deterministic_fallback' as const, fallbackReason: 'low_confidence' as const },
            };
        },
    };
    const orchestrator = new OrchestratorAgent(undefined, undefined, deps);
    const outputs = await orchestrator.runTurn({
        query: 'conflito de baixa confiança', stakeholders: [profile], config: { jev: { mode: 'active' } } as SimulationConfig,
    });
    assert.strictEqual(outputs[0].resposta.impacto_moral, 7);
    assert.strictEqual(outputs[0].resposta.julgamento, undefined);
    assert.strictEqual(captured.narratives[0], undefined);
    assert.strictEqual(orchestrator.getState().persona_judgment_audits?.[0].origin, 'deterministic_fallback');
});

await test('request active não eleva o kill switch server-side off', async () => {
    const previous = process.env.JEV_MODE;
    process.env.JEV_MODE = 'off';
    try {
        const captured = { requests: [] as SemanticJudgeRequest[], narratives: [] as unknown[], audits: [] as unknown[] };
        const orchestrator = new OrchestratorAgent(undefined, undefined, dependencies(captured));
        const outputs = await orchestrator.runTurn({
            query: 'kill switch', stakeholders: [profile], config: { jev: { mode: 'active' } } as SimulationConfig,
        });
        assert.strictEqual((captured.requests[0] as unknown as { config?: { mode?: string } }).config?.mode, 'off');
        assert.strictEqual(outputs[0].resposta.impacto_moral, 7);
        assert.strictEqual(outputs[0].resposta.julgamento, undefined);
    } finally {
        if (previous === undefined) delete process.env.JEV_MODE;
        else process.env.JEV_MODE = previous;
    }
});

await test('off preserva o impacto narrativo atual e não injeta julgamento na fala', async () => {
    const captured = { requests: [] as SemanticJudgeRequest[], narratives: [] as unknown[], audits: [] as unknown[] };
    const orchestrator = new OrchestratorAgent(undefined, undefined, dependencies(captured));
    const config = { jev: { mode: 'off' } } as SimulationConfig;
    const outputs = await orchestrator.runTurn({ query: 'modo legado', stakeholders: [profile], config });
    assert.strictEqual(outputs[0].resposta.impacto_moral, 7);
    assert.strictEqual(captured.narratives[0], undefined);
    assert.strictEqual((captured.audits[0] as { mode: string }).mode, 'off');
});

await test('ingestão de frameworks mantém fallback local e permite enriquecimento injetado sem rede', async () => {
    let calls = 0;
    const loader = new DocumentLoader('.', {
        enrichFrameworks: true,
        frameworkEnricher: {
            async enrichChunks(result) {
                calls++;
                return {
                    result: { ...result, chunks: result.chunks.map(chunk => ({
                        ...chunk, metadata: { ...chunk.metadata, semanticType: 'overview', enrichmentSource: 'jev' as const },
                    })) },
                    stats: { source: 'jev' as const, batches: 1, assessed: result.chunks.length, fallback: 0 },
                };
            },
        },
    });
    const documents = await loader.loadPlaybooks();
    assert.ok(calls > 0);
    assert.ok(documents.some(document => document.metadata.enrichment_source === 'jev'));
});

console.log(`OK ${testCount} tests`);
if (previousJevMode === undefined) delete process.env.JEV_MODE;
else process.env.JEV_MODE = previousJevMode;
