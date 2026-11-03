/** Testes isolados do julgamento de personas; nenhuma chamada de rede é feita. */
import assert from 'node:assert';
import {
    FixtureSemanticJudgeAdapter,
    PersonaJudgmentModule,
    SemanticJudgeRequest,
    SemanticJudgeResponse,
} from '../services/PersonaJudgmentModule.js';
import { JevHttpAdapter, JevHttpError, JevFetchResponse } from '../services/JevHttpAdapter.js';

let testCount = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    await fn();
    testCount++;
    console.log(`  ✓ ${name}`);
}

const stakeholder = {
    id: 'key-1', nome: 'Ana', cargo: 'Lead', isKey: true,
    estado: { estresse: 72, humor: 55, energia: 60, engajamento: 80, adaptabilidade: 50, influencia: 75 },
};

function response(reaction = 'apoiar', confidence = 0.95): SemanticJudgeResponse {
    return {
        model: 'jev-1.13.0',
        decisions: {
            'key-1': {
                reaction: { value: reaction, confidence },
                intensity: { value: 'alta', confidence },
                socialInfluence: { value: 0.9, confidence: 0.9 },
                moralDirection: { value: 'positive', confidence },
            },
        },
    };
}

await test('faz uma única avaliação em lote e envia categorias sem estado numérico', async () => {
    let calls = 0;
    let captured: SemanticJudgeRequest | undefined;
    const port = new FixtureSemanticJudgeAdapter((request) => {
        calls++;
        captured = request;
        return response();
    });
    const module = new PersonaJudgmentModule({ port, config: { mode: 'active' } });
    const result = await module.evaluateTurn({ situation: 'mudança de prioridade', turno: 3, stakeholders: [stakeholder] });
    assert.strictEqual(calls, 1);
    assert.strictEqual(captured?.questions.length, 4);
    assert.strictEqual(captured?.stakeholders[0].state.stress, 'alto');
    assert.strictEqual(result.decisions[0].origin, 'jev');
    assert.strictEqual(result.decisions[0].effects.moralDelta, 5);
});

await test('confidence baixa não interrompe o turno e usa fallback determinístico', async () => {
    const module = new PersonaJudgmentModule(new FixtureSemanticJudgeAdapter(response('confrontar', 0.4)), { mode: 'active' });
    const result = await module.evaluateTurn({ situation: 'conflito', turno: 4, stakeholders: [stakeholder] });
    assert.strictEqual(result.decisions[0].origin, 'deterministic_fallback');
    assert.strictEqual(result.audit.fallbackReason, 'low_confidence');
    assert.strictEqual(result.audit.confidence,0.4,'fallback must not inflate semantic model confidence to 1');
});

await test('rejeita confidence e socialInfluence fora de [0,1]', async () => {
    for (const invalid of [
        { reaction: { value: 'apoiar', confidence: 1.01 }, intensity: { value: 'alta', confidence: 0.95 }, socialInfluence: { value: 0.9, confidence: 0.9 }, moralDirection: { value: 'positive', confidence: 0.95 } },
        { reaction: { value: 'apoiar', confidence: 0.95 }, intensity: { value: 'alta', confidence: 0.95 }, socialInfluence: { value: 1.01, confidence: 0.9 }, moralDirection: { value: 'positive', confidence: 0.95 } },
        { reaction: { value: 'apoiar', confidence: 0.95 }, intensity: { value: 'alta', confidence: 0.95 }, socialInfluence: { value: 0.9, confidence: -0.01 }, moralDirection: { value: 'positive', confidence: 0.95 } },
    ]) {
        const module = new PersonaJudgmentModule(new FixtureSemanticJudgeAdapter({
            model: 'jev-1.13.0', decisions: { 'key-1': invalid },
        }), { mode: 'active' });
        const result = await module.evaluateTurn({ situation: 'dados inválidos', turno: 1, stakeholders: [stakeholder] });
        assert.strictEqual(result.decisions[0].origin, 'deterministic_fallback');
    }
});

await test('timeout por turno cancela a porta sem deixar a avaliação pendente', async () => {
    let aborted = false;
    const port = new FixtureSemanticJudgeAdapter((_request, signal) => new Promise<SemanticJudgeResponse>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
            aborted = true;
            reject(Object.assign(new Error('aborted'), { code: 'aborted' }));
        }, { once: true });
    }));
    const module = new PersonaJudgmentModule({ port, config: { mode: 'active', timeoutMs: 5 } });
    const result = await module.evaluateTurn({ situation: 'timeout', turno: 1, stakeholders: [stakeholder] });
    assert.equal(aborted, true);
    assert.equal(result.audit.fallbackReason, 'timeout');
    assert.equal(result.decisions[0].origin, 'deterministic_fallback');
});

await test('modo off não chama a port', async () => {
    let called = false;
    const port = new FixtureSemanticJudgeAdapter(() => { called = true; return response(); });
    const module = new PersonaJudgmentModule({ port, config: { mode: 'off' } });
    const result = await module.evaluateTurn({ situation: 'normal', turno: 1, stakeholders: [stakeholder] });
    assert.strictEqual(called, false);
    assert.strictEqual(result.audit.origin, 'deterministic_fallback');
});

function http(status: number, body: unknown): JevFetchResponse {
    return { status, ok: status >= 200 && status < 300, json: async () => body };
}

await test('adapter faz retry apenas para 529 e valida o contrato tipado', async () => {
    let calls = 0;
    const adapter = new JevHttpAdapter({
        apiKey: 'server-only', retryDelayMs: 0,
        fetch: async () => {
            calls++;
            if (calls === 1) return http(529, {});
            return http(200, { model: 'jev-1.13.0', decisions: response().decisions });
        },
    });
    const request: SemanticJudgeRequest = {
        model: 'jev-1.13.0', situation: 'x', turn: 1,
        stakeholders: [{ id: 'key-1', name: 'Ana', role: 'Lead', state: { stress: 'alto', mood: 'positivo', energy: 'alto', engagement: 'alto', adaptability: 'moderado', influence: 'alto', status: 'ativo' } }],
        questions: [],
    };
    const result = await adapter.evaluate(request);
    assert.strictEqual(calls, 2);
    assert.strictEqual(result.decisions['key-1'].reaction.value, 'apoiar');
});

await test('adapter transforma timeout em erro classificável', async () => {
    const adapter = new JevHttpAdapter({ apiKey: 'server-only', timeoutMs: 5, fetch: async () => new Promise<JevFetchResponse>(() => undefined) });
    const request = { model: 'jev-1.13.0', situation: '', turn: 1, stakeholders: [], questions: [] };
    await assert.rejects(() => adapter.evaluate(request), (error: unknown) => error instanceof JevHttpError && error.code === 'timeout');
});

await test('adapter envia schema oficial (model, state, questions map) e decodifica answers oficiais', async () => {
    let capturedBody: any;
    const adapter = new JevHttpAdapter({
        apiKey: 'server-only',
        fetch: async (_url, init) => {
            capturedBody = JSON.parse(init.body);
            return http(200, {
                model: 'jev-1.13.0',
                answers: {
                    'reaction_dev_lead_1': { type: 'choice', choice: 'apoiar', confidence: 0.95 },
                    'intensity_dev_lead_1': { type: 'score', score: 2.2, confidence: 0.92, legend: { '0': 'baixa', '1': 'média', '2': 'alta', '3': 'crítica' } },
                    'social_influence_dev_lead_1': { type: 'noul', noul: 0.88 },
                    'moral_direction_dev_lead_1': { type: 'choice', choice: 'positive', confidence: 0.9 },
                },
                usage: { input_tokens: 100, output_tokens: 25 },
            });
        },
    });
    const stakeholderWithUnderscore = {
        id: 'dev_lead_1',
        name: 'Carlos',
        role: 'Tech Lead',
        state: { stress: 'alto' as const, mood: 'positivo' as const, energy: 'alto' as const, engagement: 'alto' as const, adaptability: 'moderado' as const, influence: 'alto' as const, status: 'ativo' },
    };
    const request: SemanticJudgeRequest = {
        model: 'jev-1.13.0',
        situation: 'Reorganização do time',
        turn: 2,
        stakeholders: [stakeholderWithUnderscore],
        questions: [],
    };
    const result = await adapter.evaluate(request);
    assert.strictEqual(capturedBody.model, 'jev-1.13.0');
    assert.strictEqual(capturedBody.state.situation, 'Reorganização do time');
    assert.strictEqual(typeof capturedBody.questions, 'object');
    assert.ok(capturedBody.questions['reaction_dev_lead_1']);
    assert.ok(capturedBody.questions['reaction_dev_lead_1'].instructions.includes('Carlos'));
    assert.ok(capturedBody.questions['reaction_dev_lead_1'].instructions.includes('dev_lead_1'));
    assert.deepEqual(capturedBody.questions['intensity_dev_lead_1'].criteria, ['baixa', 'média', 'alta', 'crítica']);

    const decision = result.decisions['dev_lead_1'];
    assert.ok(decision);
    assert.strictEqual(decision.reaction.value, 'apoiar');
    assert.strictEqual(decision.reaction.confidence, 0.95);
    assert.strictEqual(decision.intensity.value, 'alta');
    assert.strictEqual(decision.intensity.confidence, 0.92);
    assert.strictEqual(decision.socialInfluence.value, 0.88);
    assert.strictEqual(decision.moralDirection.value, 'positive');
    assert.strictEqual(decision.moralDirection.confidence, 0.9);
});

console.log(`OK ${testCount} tests`);

