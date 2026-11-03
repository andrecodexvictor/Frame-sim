import assert from 'node:assert/strict';
import { SmartChunker } from '../services/SmartChunker.js';
import {
    JevChunkEnricher,
    type SemanticJudgePort,
    type SemanticJudgeRequest,
} from '../services/JevChunkEnricher.js';

const chunking = new SmartChunker({ chunkSize: 160, minChunkSize: 30 }).chunk(
    '# Framework controls\n\nThis requirement must be reviewed by the audit team.\n\nThe procedure has three steps and should be repeated monthly.',
    'fixture-doc',
);

class FixtureJudge implements SemanticJudgePort {
    calls: SemanticJudgeRequest[] = [];
    constructor(private readonly response: unknown, private readonly delayMs = 0) { }

    async evaluate(request: SemanticJudgeRequest, signal?: AbortSignal) {
        this.calls.push(request);
        if (this.delayMs) await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, this.delayMs);
            signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                const error = new Error('cancelled');
                error.name = 'AbortError';
                reject(error);
            }, { once: true });
        });
        return { assessments: this.response };
    }
}

const firstChunkId = chunking.chunks[0]?.id;
assert.ok(firstChunkId);
const highConfidence = new FixtureJudge([{
    chunkId: firstChunkId,
    type: 'requirement',
    retrievalValue: 0.92,
    completeness: 'complete',
    noise: false,
    promptInjection: false,
    confidence: 0.96,
}]);
const high = await new JevChunkEnricher({ mode: 'active', judge: highConfidence, batchSize: 1 }).enrich(chunking);
assert.equal(high.result.chunks[0].metadata.semanticType, 'requirement');
assert.equal(high.result.chunks[0].metadata.enrichmentSource, 'jev');
assert.equal(high.stats.assessed, 1);
assert.equal(highConfidence.calls.length, chunking.chunks.length);
assert.deepEqual(high.result.chunks.map(chunk => chunk.content), chunking.chunks.map(chunk => chunk.content));
assert.deepEqual(high.result.chunks.map(chunk => chunk.id), chunking.chunks.map(chunk => chunk.id));

const malformedJudge = new FixtureJudge([{ chunkId: firstChunkId, type: 'not-a-type' }]);
const malformed = await new JevChunkEnricher({ mode: 'active', judge: malformedJudge, batchSize: 1 }).enrich(chunking);
assert.equal(malformed.result.chunks[0].metadata.enrichmentSource, 'deterministic');
assert.equal(malformed.stats.reason, 'jev_failure');

const lowConfidence = new FixtureJudge([{
    chunkId: firstChunkId,
    type: 'overview',
    retrievalValue: 0.99,
    completeness: 'continuation',
    noise: false,
    promptInjection: false,
    confidence: 0.2,
}]);
const low = await new JevChunkEnricher({ mode: 'active', judge: lowConfidence }).enrich(chunking);
assert.equal(low.result.chunks[0].metadata.enrichmentSource, 'deterministic');
assert.equal(low.result.chunks[0].metadata.enrichmentReason, 'low_confidence');
assert.equal(low.result.chunks[0].metadata.semanticConfidence, 0);
assert.equal(low.stats.reason, 'low_confidence');

const timeoutJudge = new FixtureJudge([], 50);
const timeout = await new JevChunkEnricher({ mode: 'active', judge: timeoutJudge, batchSize: 1, timeoutMs: 5 }).enrich(chunking);
assert.equal(timeout.stats.reason, 'timeout');
assert.ok(timeout.result.chunks.every(chunk => chunk.metadata.enrichmentSource === 'deterministic'));

const noKey = await new JevChunkEnricher({ mode: 'active', apiKey: '' }).enrich(chunking);
assert.equal(noKey.stats.reason, 'jev_unconfigured');
assert.ok(noKey.result.chunks.every(chunk => chunk.metadata.enrichmentSource === 'deterministic'));

const offJudge = new FixtureJudge([]);
const off = await new JevChunkEnricher({ mode: 'off', judge: offJudge }).enrich(chunking);
assert.equal(offJudge.calls.length, 0);
assert.deepEqual(off.result, chunking);

// Shadow HTTP call test and official schema decoding test
let shadowHttpCalls = 0;
let capturedChunkBody: any;
const shadowFetch = async (_url: unknown, init: any) => {
    shadowHttpCalls++;
    capturedChunkBody = JSON.parse(init.body);
    return {
        ok: true,
        status: 200,
        json: async () => ({
            model: 'jev-1.13.0',
            answers: {
                [`type_${firstChunkId}`]: { type: 'choice', choice: 'requirement', confidence: 0.95 },
                [`completeness_${firstChunkId}`]: { type: 'choice', choice: 'complete', confidence: 0.95 },
                [`retrieval_value_${firstChunkId}`]: { type: 'score', score: 3.5, confidence: 0.95 },
                [`noise_${firstChunkId}`]: { type: 'noul', noul: 0.05 },
                [`prompt_injection_${firstChunkId}`]: { type: 'noul', noul: 0.01 },
            },
        }),
    } as any;
};

const shadowEnricher = new JevChunkEnricher({
    mode: 'shadow',
    apiKey: 'shadow-key',
    fetchImpl: shadowFetch as any,
    batchSize: 1,
});
const shadowResult = await shadowEnricher.enrich(chunking);
assert.ok(shadowHttpCalls > 0, 'Shadow mode must execute HTTP call when configured');
assert.strictEqual(typeof capturedChunkBody.questions, 'object');
assert.strictEqual(capturedChunkBody.state.chunks.length, 1);
assert.ok(capturedChunkBody.questions[`type_${firstChunkId}`]);
assert.ok(capturedChunkBody.questions[`retrieval_value_${firstChunkId}`]);
assert.strictEqual(shadowResult.stats.source, 'deterministic');
assert.strictEqual(shadowResult.stats.assessed, 1);
assert.deepEqual(shadowResult.result, chunking, 'Shadow mode must return original chunks unchanged');

console.log('  ✓ Jev chunk enrichment gates confidence, executes shadow HTTP, and preserves deterministic fallback');

