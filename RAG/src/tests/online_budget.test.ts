import assert from 'node:assert/strict';
const protocol = await import('../evals/protocol.js').catch(() => null);
assert.ok(protocol, 'crossed online protocol must enforce reservations and mask generators');
const online = await import('../evals/onlineRunner.js');
const plan = protocol.createOnlinePlan({ taskIds: ['t1'], generators: ['google', 'deepseek'], judges: ['glm', 'kimi', 'jev'], seed: 17 });
assert.equal(plan.trials.length, 6);
assert.ok(plan.trials.every(row => row.generator !== row.judge));
assert.deepEqual(plan, protocol.createOnlinePlan({ taskIds: ['t1'], generators: ['google', 'deepseek'], judges: ['glm', 'kimi', 'jev'], seed: 17 }));
assert.throws(() => protocol.createOnlinePlan({ taskIds: ['t'], generators: ['glm'], judges: ['glm'], seed: 1 }), /self/i);
const budget = new protocol.ReservationBudget({ budgetUSD: 0.1, maxCalls: 2, timeoutMs: 100, reservationUSD: 0.06 });
assert.equal(budget.reserve(), true);
assert.equal(budget.reserve(), false);
assert.equal(budget.calls, 1);
let calls = 0;
const run = await online.runOnline(plan, [{ id: 't1', evidence: [{ eventId: 'e1', text: 'A helped B complete a task.' }], instruction: 'Summarize documented actions.' }], { dryRun: false, budgetUSD: 0.1, maxCalls: 5, timeoutMs: 100, reservationUSD: 0.03, maxOutputTokens: 500 }, async request => {
    calls++;
    if (request.phase === 'judge') {
        assert.ok(!request.prompt.includes('deepseek') && !request.prompt.includes('google'), 'judge prompt contains no generator identity');
        return { content: JSON.stringify({ score: 1, evidenceIds: ['e1'] }), model: 'mock-judge', provider: request.provider, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } };
    }
    return { content: JSON.stringify({ claims: [{ text: 'Helped complete task', evidenceIds: ['e1'] }] }), model: 'mock-generator', provider: request.provider, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } };
});
assert.equal(calls, 3);
assert.equal(run.trials.length, plan.trials.length, 'all trials are terminal including budget skips');
assert.ok(run.trials.some(row => row.status === 'budget-skipped'));
assert.ok(run.budget.reservedUSD <= 0.1);
let dryCalls = 0;
const dry = await online.runOnline(plan, [{ id: 't1', evidence: [], instruction: 'contract' }], { dryRun: true, budgetUSD: 0, maxCalls: 10, timeoutMs: 100, reservationUSD: 0.01, maxOutputTokens: 500 }, async () => { dryCalls++; throw new Error('must never call'); });
assert.equal(dryCalls, 0);
assert.ok(dry.trials.every(row => row.status === 'dry-run'));
assert.equal(run.ablations.filter(row => row.arm === 'deterministic').length, 2, 'each generator candidate has its own deterministic evaluation');
assert.ok(run.ablations.some(row => row.arm === 'full-pipeline'));
assert.equal(run.baselines[0].status, 'completed', 'extractive generator baseline executes without paid calls');
assert.equal(run.baselines[0].checks.exactSupportedClaims, 1);
assert.ok(run.ablations.filter(row => row.arm === 'deterministic' && row.checks).every(row => row.checks?.exactSupportedClaims === 0), 'valid references cannot establish semantic correctness');
let tamperedCalls = 0;
await assert.rejects(() => online.runOnline({ ...plan, hash: 'bad' }, [{ id: 't1', evidence: [], instruction: 'contract' }], { dryRun: false, budgetUSD: 1, maxCalls: 10, timeoutMs: 100, reservationUSD: 0.1, maxOutputTokens: 500 }, async () => { tamperedCalls++; throw new Error(); }), /protocol/i);
assert.equal(tamperedCalls, 0);
await assert.rejects(() => online.runOnline(plan, [{ id: 't1', evidence: [], instruction: 'contract' }], { dryRun: false, budgetUSD: 1, maxCalls: 10, timeoutMs: 100, reservationUSD: 0.1, maxOutputTokens: 500 }), /pricing/i);
console.log('  ✓ online matrix, masking, deterministic order, reservation caps and dry-run');
const savedFetch = globalThis.fetch, savedKey = process.env.TYPESAFE_API_KEY;
try {
    process.env.TYPESAFE_API_KEY = 'offline-fixture';
    const levels = ['Candidate contains claims contradicted by supplied evidence.', 'Candidate includes unsupported claims or omits critical uncertainty.', 'Candidate claims are supported but omit relevant documented context.', 'Candidate preserves supported claims, attribution and missing evidence without inventing facts.'];
    globalThis.fetch = async () => new Response(JSON.stringify({ model: 'jev-fixture', answers: { groundedness: { type: 'score', score: 0, confidence: 1, probabilities: { 0: 1, 1: 0, 2: 0, 3: 0, evil: 0 }, legend: Object.fromEntries(levels.map((level,index) => [index,level])) } } }));
    await assert.rejects(() => online.defaultOnlineTransport({ provider: 'jev', phase: 'judge', prompt: 'offline', signal: new AbortController().signal, timeoutMs: 100, maxOutputTokens: 500 }), /InvalidJev/i);
} finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = savedKey;
}
