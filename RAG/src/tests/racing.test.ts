import assert from 'node:assert/strict';
import { AgentRacingService } from '../services/AgentRacingService.js';

const delay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        const error = new Error('cancelled');
        error.name = 'AbortError';
        reject(error);
    }, { once: true });
});

const racing = new AgentRacingService();
(racing as any).criticAgent = {
    critique: async (result: { score: number }) => ({
        plausibilityScore: result.score,
        justification: 'offline fixture',
        replanRequired: false
    })
};
racing.setupAgents({ numAgents: 3, selectionStrategy: 'weighted', timeout: 200, diversityMode: 'full' });

let active = 0;
let maxActive = 0;
const scores: Record<string, number> = { agent_1: 70, agent_2: 90, agent_3: 80 };
const result = await racing.race(async agent => {
    active++;
    maxActive = Math.max(maxActive, active);
    await delay(agent.id === 'agent_1' ? 12 : 6);
    active--;
    const score = scores[agent.id];
    return { score, summary: { totalRoi: score, finalAdoption: score / 2 } };
}, { numAgents: 3, selectionStrategy: 'weighted', timeout: 200, diversityMode: 'full' });

assert.equal(maxActive, 3, 'all configured agents must run concurrently');
assert.equal(result.winner.agentId, 'agent_2', 'weighted selection must be deterministic and quality-led');
assert.equal(result.allResults.length, 3);
assert.equal(result.metrics.agentsFailed, 0);
assert.deepEqual(result.ensemble?.contributingAgents, ['agent_1', 'agent_2', 'agent_3']);
assert.ok(Math.abs((result.ensemble?.weightedROI ?? 0) - (70 * 70 + 90 * 90 + 80 * 80) / 240) < 0.001);

const timeoutRace = new AgentRacingService();
(timeoutRace as any).criticAgent = (racing as any).criticAgent;
timeoutRace.setupAgents({ numAgents: 2, selectionStrategy: 'best', timeout: 10, diversityMode: 'persona' });
let observedAbort = false;
const timeoutResult = await timeoutRace.race(async (agent, _params, signal) => {
    if (agent.id === 'agent_1') {
        signal?.addEventListener('abort', () => { observedAbort = true; }, { once: true });
        await delay(100, signal);
    }
    return { score: 85, summary: { totalRoi: 10, finalAdoption: 20 } };
}, { numAgents: 2, selectionStrategy: 'best', timeout: 10, diversityMode: 'persona' });

assert.equal(observedAbort, true, 'timed-out agent must receive cancellation');
assert.equal(timeoutResult.metrics.agentsCompleted, 1);
assert.equal(timeoutResult.metrics.agentsFailed, 1);
assert.equal(timeoutResult.winner.agentId, 'agent_2');

console.log('  ✓ agent racing is concurrent, deterministic, ensembled, and cancellation-aware');
