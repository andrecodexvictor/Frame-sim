import assert from 'node:assert/strict';
import { MOCK_SIMULATION_RESULT } from '../services/mockData';
import { createExperimentAssignment } from '../services/experimentProtocol';
import { compareConditions } from '../services/experimentResults';
const service = await import('../services/interactiveRuns').catch(() => null);
assert.ok(service, 'interactive collection must preserve successful and failed arms');
const assignment = (id: string) => createExperimentAssignment({ seed: 71, durationMonths: 2 }, { experimentId: 'interactive', replicaId: '1', interventionId: id });
const collected = await service.collectInteractiveRuns([
    { label: 'A', experiment: assignment('a'), run: async () => MOCK_SIMULATION_RESULT },
    { label: 'B', experiment: assignment('b'), run: async () => { throw new Error('secret details'); } }
]);
assert.equal(collected.outputs.length, 1);
assert.equal(collected.failures.length, 1);
assert.equal(collected.failures[0].errorCode, 'Error');
assert.ok(!JSON.stringify(collected.failures).includes('secret details'));
const output = { ...MOCK_SIMULATION_RESULT, manifest: { protocol: { ...assignment('a'), conditionIndex: 0 }, experimentId: 'interactive', replicaId: '1', interventionId: 'a' } as any };
const report = compareConditions([output], 'totalRoi', collected.failures);
assert.equal(report.conditions.length, 2);
assert.equal(report.conditions[1].statistics.mean, null);
assert.equal(report.conditions[1].statistics.nExcluded, 1);
assert.equal(report.comparisons[0].statistics.nExcluded, 1);
const failedFirst = await service.collectInteractiveRuns([
    { label: 'A', experiment: assignment('a'), run: async () => { throw new Error('failed'); } },
    { label: 'B', experiment: assignment('b'), run: async () => ({ ...output, manifest: { ...output.manifest, protocol: assignment('b') } }) }
]);
const failedBaseline = compareConditions(failedFirst.outputs, 'totalRoi', failedFirst.failures);
assert.equal(failedBaseline.conditions[0].id, 'a', 'failed first condition must remain the configured baseline');
assert.equal(failedBaseline.comparisons[0].a, 'a');
console.log('  ✓ failed interactive arms do not erase successful conditions');
