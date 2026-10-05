import { writeFile } from 'node:fs/promises';
import { OrchestratorAgent } from '../RAG/src/agents/orchestrator';
import { manifestFixture } from '../RAG/src/tests/manifestFixture';
import type { EvalCase } from '../RAG/src/evals/dataset';
// Persist actual canonical output of the offline orchestrator, not predictions.
// Targets are direct acceptance counts, a contract oracle rather than human labels.
const cases: EvalCase[] = [];
for (const [index, split] of (['development', 'calibration', 'holdout', 'holdout'] as const).entries()) {
    const cohortId = `replay-cohort-${index + 1}`;
    const personas = manifestFixture.personas.map(person => ({ ...person, id: `${cohortId}:${person.id}` }));
    const result = await new OrchestratorAgent(undefined, undefined, manifestFixture.dependencies).runSimulation(['Document the first sampled work block.'], personas, { ...manifestFixture.config, parametros_simulacao: { ...manifestFixture.config.parametros_simulacao, seed: 71 + index } });
    const traces = result.state.personaTraces!.filter(trace => trace.personaId === personas[0].id);
    const accepted = traces.flatMap(trace => trace.tasks).reduce((sum, task) => sum + task.acceptedUnits, 0);
    const opportunities = traces.flatMap(trace => trace.tasks).reduce((sum, task) => sum + task.opportunityUnits, 0);
    cases.push({ id: `trace-case-${index + 1}`, split, cohortId, personaId: personas[0].id, source: 'synthetic', origin: { name: 'FrameSIM offline orchestrator trace replay; acceptance-count contract oracle', license: 'Project fixture', period: 'synthetic-work-v1' }, target: { kind: 'numeric', value: accepted / opportunities, unit: 'accepted units / opportunity units' }, input: { dimension: 'delivery', traces } });
}
await writeFile(new URL('../RAG/evals/fixtures/trace-replay-v1.json', import.meta.url), JSON.stringify({ version: 'trace-replay-v1', cases }, null, 2));
