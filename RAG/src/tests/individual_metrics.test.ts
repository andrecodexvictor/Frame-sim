import assert from 'node:assert/strict';
import { deriveInitialBrain } from '../core/employeeBrainCore.js';
import type { PersonaTrace } from '../types/evaluation.js';
import { evaluateIndividualMetrics } from '../services/IndividualMetrics.js';

const brain = deriveInitialBrain({ id: 'a', nome: 'Same', cargo: 'Engineer' }, 7);
const trace: PersonaTrace = { runId: 'run', personaId: 'a', turnId: 1, role: 'Engineer', before: brain, after: { ...brain, estresse: 95 }, source: 'synthetic',
    events: [{ eventId: 'task-event', personaId: 'a', turnId: 1, type: 'acceptance', text: 'accepted with documented attribution', kind: 'task-observation', source: 'synthetic' }],
    tasks: [{ taskId: 'task-a', opportunityUnits: 10, deliveredUnits: 8, acceptedUnits: 7, reworkUnits: 1, leadTimeHours: 5, evidenceIds: ['task-event'], source: 'synthetic' }] };
const metric = (traces: PersonaTrace[], id: string) => evaluateIndividualMetrics(traces)[0].metrics.find(item => item.id === id)!;
assert.equal(metric([trace], 'delivery').value, 0.7);
assert.equal(metric([trace], 'delivery').numerator, 7);
assert.equal(metric([trace], 'delivery').denominator, 10);
assert.equal(metric([trace], 'quality').value, 0.75);
assert.equal(metric([trace], 'lead-time').value, 5);
assert.deepEqual(metric([trace], 'delivery').evidenceIds, ['task-event']);
assert.equal(metric([trace], 'delivery').unit, 'accepted units / opportunity units');
assert.equal(metric([{ ...trace, after: { ...brain, estresse: 0 } }], 'delivery').value, 0.7, 'stress does not arbitrarily penalize performance');
const noTasks = { ...trace, tasks: [] };
assert.equal(metric([noTasks], 'delivery').value, null);
assert.equal(metric([noTasks], 'quality').coverage, 0);
assert.ok(metric([noTasks], 'quality').missingReason);
assert.equal(metric([{ ...trace, tasks: [{ ...trace.tasks[0], evidenceIds: ['unknown'] }] }], 'delivery').value, null, 'unlinked evidence must not count as measured delivery');
assert.throws(() => evaluateIndividualMetrics([{ ...trace, tasks: [{ ...trace.tasks[0], acceptedUnits: 11 }] }]), /Invalid task/);
assert.equal(evaluateIndividualMetrics([trace, { ...trace, personaId: 'b', before: { ...brain, personaId: 'b' }, after: { ...brain, personaId: 'b' }, tasks: [] }]).length, 2);
const censored: PersonaTrace = { ...trace, tasks: [{ ...trace.tasks[0], censored: true, acceptedUnits: 0, reworkUnits: 0, status: 'rejected' }] };
assert.equal(metric([censored], 'lead-time').value, null, 'censored durations cannot enter the accepted-task median');
const expert = { ...trace, source: 'expert_labeled' as const, tasks: trace.tasks.map(task => ({ ...task, source: 'expert_labeled' as const })), events: trace.events.map(event => ({ ...event, source: 'expert_labeled' as const })) };
assert.equal(evaluateIndividualMetrics([expert])[0].source, 'expert_labeled');
const mixed = { ...trace, source: 'observed' as const, events: trace.events.map(event => ({ ...event, source: 'observed' as const })) };
assert.equal(evaluateIndividualMetrics([mixed])[0].source, 'synthetic', 'synthetic task outcomes cannot become observed through the enclosing trace');
const distribution = evaluateIndividualMetrics([trace])[0].leadTimeByClass;
assert.equal(distribution?.[0].median, 5);
assert.deepEqual(distribution?.[0].observations[0].evidenceIds, ['task-event']);
assert.equal(evaluateIndividualMetrics([censored])[0].leadTimeByClass?.[0].nCensored, 1);
console.log('  ✓ observable metrics, denominators, missing evidence and separation of stress/performance');
