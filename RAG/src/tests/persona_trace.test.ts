import assert from 'node:assert/strict';
import { OrchestratorAgent } from '../agents/orchestrator.js';
import { manifestFixture } from './manifestFixture.js';

const run = async () => new OrchestratorAgent(undefined, undefined, manifestFixture.dependencies)
    .runSimulation(Array.from({ length: 16 }, (_, i) => `situation-${i + 1}`), manifestFixture.personas, manifestFixture.config);
const first = await run();
const traces = first.state.personaTraces ?? [];
assert.equal(traces.length, 32, 'full per-person trajectory must survive the 12-entry memory FIFO');
assert.equal(traces[0].turnId, 1);
assert.equal(traces[0].personaId, 'person-a');
assert.equal(traces[0].runId, first.state.run_id);
assert.equal(traces[0].source, 'synthetic');
assert.equal(traces[30].turnId, 16);
assert.ok(traces[30].after.memoria.length <= 12);
assert.notDeepEqual(traces[0].before, traces[0].after);
assert.deepEqual(traces[0].after, traces[2].before, 'consecutive state snapshots form one trajectory');
const events = traces.flatMap(trace => trace.events);
assert.equal(new Set(events.map(event => event.eventId)).size, events.length);
assert.ok(events.every(event => traces.some(trace => trace.personaId === event.personaId && trace.turnId === event.turnId)));
assert.ok(traces.some(trace => trace.tasks.length > 0), 'explicit synthetic work model records attributed opportunities');
assert.ok(traces.flatMap(trace => trace.tasks).every(task => task.source === 'synthetic' && task.modelVersion === 'synthetic-work-v1'));
const second = await run();
const replayValues = (trace: typeof traces[number]) => [trace.before, trace.after, trace.tasks.map(({ evidenceIds: _ids, ...task }) => task)];
assert.deepEqual(traces.map(replayValues), second.state.personaTraces?.map(replayValues), 'recording must preserve deterministic outcomes; event IDs belong to their run');
console.log('  ✓ complete individual traces, immutable snapshots, evidence identity and deterministic replay');
