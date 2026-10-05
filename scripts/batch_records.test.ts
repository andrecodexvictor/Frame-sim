import assert from 'node:assert/strict';
import { runEnhancedBatchSimulation, runBatchSimulation, generateCSV } from '../services/batchService';
import { MOCK_SIMULATION_RESULT } from '../services/mockData';
import type { SimulationConfig } from '../types';
const config = { frameworks: [{ id: 'a', name: 'A', text: '' }], companySize: 20, sector: 'tech', durationMonths: 2, scenarioMode: 'custom', customScenarioText: 'Same actual scenario', employeeArchetypes: ['cto'], seed: 71 } as SimulationConfig;
const seen: import('../types').SingleSimulationConfig[] = [];
const outcome = await runEnhancedBatchSimulation(config, { iterations: 3, enableWarmup: false, enableRacing: false }, () => undefined, { run: async input => {
    seen.push(input);
    if (input.experiment?.replicaId === '2') throw new Error('synthetic failure');
    return { ...MOCK_SIMULATION_RESULT, execution: { mode: input.experiment?.replicaId === '3' ? 'fixture' : 'live', provider: 'none', model: 'synthetic', attempts: 0 } };
} });
assert.equal(outcome.runs?.length, 3, 'each planned run has a terminal record');
assert.deepEqual(outcome.runs?.map(run => run.status), ['completed', 'failed', 'fixture']);
assert.equal(outcome.summary.nIndependent, 1);
assert.equal(outcome.summary.nExcluded, 2);
assert.equal(outcome.summary.confidenceInterval95, null);
assert.ok(seen.every(input => input.scenarioContext === config.customScenarioText), 'replica labels cannot replace the scenario');
assert.equal(new Set(seen.map(input => input.seed)).size, 3);
assert.ok(seen.every(input => input.experiment?.memoryPolicy === 'isolated'));
console.log('  ✓ batch preserves planned failures/fixtures and scenario under independent assignments');

const legacySeen: import('../types').SingleSimulationConfig[] = [];
const legacy = await runBatchSimulation(config, 3, () => undefined, { run: async input => {
    legacySeen.push(input);
    if (input.experiment?.replicaId === '2') throw new Error('private failure details');
    return { ...MOCK_SIMULATION_RESULT, frameworkName: 'A, "B"', summary: { ...MOCK_SIMULATION_RESULT.summary, finalAdoption: null }, execution: { mode: 'live', provider: 'none', model: 'synthetic', attempts: 0 } };
} });
assert.deepEqual(legacy.runs?.map(run => run.status), ['completed', 'failed', 'completed']);
assert.equal(legacy.summary.nExcluded, 1);
assert.ok(legacySeen.every(input => input.scenarioContext === config.customScenarioText));
const csv = generateCSV(legacy);
assert.ok(!csv.includes('Uptime') && !csv.includes('TMA') && !csv.includes('NPS'), 'CSV cannot fabricate proxies');
assert.ok(csv.includes('"A, ""B"""'));
assert.ok(csv.includes('failed'), 'export includes failures');

(globalThis as any).window = globalThis;
const racingInputs: import('../types').SingleSimulationConfig[] = [];
const racing = await runEnhancedBatchSimulation(config, { iterations: 1, enableWarmup: false, enableRacing: true, racingConfig: { numAgents: 3, selectionStrategy: 'ensemble', timeout: 2000, diversityMode: 'full' } }, () => undefined, { run: async input => {
    racingInputs.push(input);
    return { ...MOCK_SIMULATION_RESULT, summary: { ...MOCK_SIMULATION_RESULT.summary, totalRoi: input.temperature! * 100, scenarioValidity: input.temperature! * 100 }, execution: { mode: 'live', provider: 'none', model: 'synthetic', attempts: 0 } };
} });
assert.equal(racing.runs?.[0].racingTrials?.length, 3);
assert.equal(new Set(racingInputs.map(input => input.seed)).size, 1);
assert.ok(racingInputs.every(input => input.scenarioContext === config.customScenarioText));
assert.equal(new Set(racingInputs.map(input => JSON.stringify(input.experiment?.exogenousSchedule))).size, 1);
assert.equal(racing.outputs[0].summary.totalRoi, 70, 'selected trajectory is never overwritten by ensemble');
const failedRace = await runEnhancedBatchSimulation(config, { iterations: 1, enableWarmup: false, enableRacing: true, racingConfig: { numAgents: 2, selectionStrategy: 'best', timeout: 2000, diversityMode: 'full' } }, () => undefined, { run: async () => { throw new Error('failure'); } });
assert.equal(failedRace.runs?.[0].status, 'failed');
assert.equal(failedRace.runs?.[0].racingTrials?.length, 2);
console.log('  ✓ legacy failures and racing trajectories remain independently auditable');
