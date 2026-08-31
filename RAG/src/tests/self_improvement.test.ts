import assert from 'node:assert/strict';
import { SelfImprovementService } from '../services/SelfImprovementService.js';
import type { OptimizedParameters, WarmupConfig } from '../types/index.js';

const config: WarmupConfig = {
    maxIterations: 5,
    targetPlausibility: 100,
    seed: 0x51A7E,
    parameterSpace: {
        temperatures: [0.3, 0.5, 0.7, 0.9],
        topKValues: [3, 5, 10],
        ragModes: ['full', 'selective', 'none']
    }
};

async function execute() {
    const service = new SelfImprovementService();
    (service as any).criticAgent = {
        async critique(result: { params: OptimizedParameters }) {
            const score = 40 + result.params.temperature * 20 + result.params.topK;
            return { plausibilityScore: score, justification: 'offline', replanRequired: score < 70 };
        }
    };
    return service.runWarmup(async params => ({ params }), config);
}

const first = await execute();
const second = await execute();
assert.deepEqual(first.optimalParams, second.optimalParams);
assert.deepEqual(
    first.convergenceHistory.map(point => ({ params: point.params, score: point.plausibilityScore })),
    second.convergenceHistory.map(point => ({ params: point.params, score: point.plausibilityScore }))
);
assert.equal(first.iterationsUsed, 5);
assert.ok(first.finalScore > 0);

console.log('  ✓ self-improvement exploration is seed-replayable and bounded');
