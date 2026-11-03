import assert from 'node:assert/strict';
import { JevEvaluator } from '../services/JevEvaluator.js';
import rubric from '../../evals/rubrics/individual-v1.json' with { type: 'json' };
import { deriveInitialBrain } from '../core/employeeBrainCore.js';
import type { PersonaTrace } from '../types/evaluation.js';

const brain = deriveInitialBrain({ id: 'a', nome: 'Same', cargo: 'Engineer' }, 1);
const trace: PersonaTrace = { runId: 'run', personaId: 'a', turnId: 1, role: 'Engineer', before: brain, after: brain, tasks: [], source: 'synthetic',
    events: [{ eventId: 'collab-1', personaId: 'a', turnId: 1, source: 'synthetic', kind: 'collaboration', type: 'peer-help', text: 'Person a reviewed peer b task; b confirmed that the blocker was removed.', relatedPersonaIds: ['b'] }] };
const policy = { version: 'test-calibration-v1', calibrationStatus: 'development-calibrated' as const, calibrationDatasetHash: '0'.repeat(64), minEvidenceProbability: 0.8, minDistributionConfidence: 0.5 };
const body = () => ({ model: 'jev-1.13.0', answers: {
    collaboration: { type: 'score', score: 2, confidence: 0.9, probabilities: { '0': 0, '1': 0, '2': 1, '3': 0 }, legend: Object.fromEntries(rubric.levels.map((level, index) => [String(index), level])) },
    evidence_sufficient: { type: 'noul', noul: 0.95 },
    evidence_class: { type: 'choice', choice: 'supported', confidence: 0.9, probabilities: { supported: 1, contradictory: 0, insufficient: 0 } },
}, usage: { input_tokens: 200, output_tokens: 30 } });
const calls: Array<{ url: string; init?: RequestInit }> = [];
const transport: typeof fetch = async (input, init) => { calls.push({ url: String(input), init }); return new Response(JSON.stringify(body()), { status: 200 }); };
const evaluator = new JevEvaluator({ apiKey: 'synthetic-test-key', fetch: transport, policy });
assert.equal((await evaluator.evaluate([{ ...trace, events: [] }])).status, 'abstained');
assert.equal(calls.length, 0, 'missing evidence abstains before inference');
const result = await evaluator.evaluate([trace]);
assert.equal(calls.length, 1, 'three independent questions share one request');
assert.equal(calls[0].url, 'https://api.typesafe.ai/v1/systemone');
const sent = JSON.parse(String(calls[0].init?.body));
assert.equal(Object.keys(sent.questions).length, 3);
assert.ok(!JSON.stringify(sent.state).includes('estresse'), 'personality/context cannot establish performance');
assert.equal(result.status, 'evaluated');
assert.equal(result.score, 2);
assert.equal(result.noul, 0.95);
assert.equal(result.choice, 'supported');
assert.deepEqual(result.choiceProbabilities, body().answers.evidence_class.probabilities);
assert.equal(result.choiceConfidence, body().answers.evidence_class.confidence);
assert.equal(result.model, 'jev-1.13.0');
assert.deepEqual(result.evidenceIds, ['collab-1']);
assert.equal(result.inputTokens, 200);
assert.equal(result.questionCount, 3);
assert.equal(result.policyVersion, policy.version);
assert.equal((await new JevEvaluator({ apiKey: 'fixture', fetch: transport }).evaluate([trace])).status, 'abstained', 'uncalibrated thresholds must not claim an accepted evaluation');
const bad = body(); bad.answers.collaboration.probabilities['2'] = 2;
assert.equal((await new JevEvaluator({ apiKey: 'fixture', policy, fetch: async () => new Response(JSON.stringify(bad)) }).evaluate([trace])).status, 'unavailable');
const conflict = body(); conflict.answers.evidence_class.choice = 'contradictory'; conflict.answers.evidence_class.probabilities = { supported: 0, contradictory: 1, insufficient: 0 };
const conflicting = await new JevEvaluator({ apiKey: 'fixture', policy, fetch: async () => new Response(JSON.stringify(conflict)) }).evaluate([trace]);
assert.equal(conflicting.status, 'abstained');
assert.equal(conflicting.score, 2, 'raw judgment is preserved, but not accepted');
const waitForAbort: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('deadline', 'AbortError')), { once: true }));
const timeout = await new JevEvaluator({ apiKey: 'fixture', policy, fetch: waitForAbort }).evaluate([trace], { timeoutMs: 5 });
assert.equal(timeout.status, 'unavailable');
assert.equal(timeout.score, undefined);
assert.equal((await evaluator.evaluate([trace], { maxContextChars: 10 })).status, 'abstained', 'evidence cannot silently truncate');
const { OrchestratorAgent } = await import('../agents/orchestrator.js');
const { manifestFixture } = await import('./manifestFixture.js');
let evaluations = 0;
const orchestrator = new OrchestratorAgent(undefined, undefined, { ...manifestFixture.dependencies, jevEvaluator: {
    async evaluate() { evaluations++; return { status: 'abstained' as const, evidenceIds: [], rubricVersion: 'individual-v1', model: 'jev-1.13.0', requestedModel: 'jev-latest', reason: 'synthetic integration fixture' }; },
} });
const integrated = await orchestrator.runSimulation(['fixture'], manifestFixture.personas, { ...manifestFixture.config, semantic_evaluation: { enabled: true, max_requests: 1, timeout_ms: 500 } });
assert.equal(evaluations, 1, 'run-level semantic cap must stop additional requests');
assert.equal(integrated.state.individualEvaluations?.[0].semantic.collaboration.status, 'abstained');
assert.equal(integrated.state.individualEvaluations?.[1].semantic.collaboration.status, 'unavailable');
assert.ok(integrated.state.manifest?.models.some(model => model.role === 'semantic-evaluation' && model.resolvedModel === 'jev-1.13.0'));
console.log('  ✓ Jev typed judgments, evidence gates, calibration abstention, invalid output and timeout');
