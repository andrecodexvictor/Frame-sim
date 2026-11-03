import type { SimulationOutput } from '../types';
import { canonicalJSON } from '../RAG/src/core/artifactCanonical';
import { pairedComparison, summarizeIndependent, type IndependentSummary, type PairedSummary } from './comparisonStatistics';
import type { FailedCondition } from './interactiveRuns';

export type ComparisonMetric = 'totalRoi' | 'finalAdoption' | 'maturityScore' | 'monthsToComplete';
export const COMPARISON_METRICS: Record<ComparisonMetric, { label: string; unit: string }> = { totalRoi: { label: 'ROI projetado', unit: '%' }, finalAdoption: { label: 'Adoção simulada', unit: '%' }, maturityScore: { label: 'Maturidade simulada', unit: 'pontos (0–10)' }, monthsToComplete: { label: 'Duração da implantação', unit: 'meses' } };
export function outcomeStatus(output: SimulationOutput): 'completed' | 'failed' | 'fixture' | 'degraded' {
    const mode = output.execution?.mode ?? output.manifest?.executionMode;
    return mode === 'fixture' || mode === 'failed' || mode === 'degraded' ? mode : 'completed';
}
export interface ConditionSummary { id: string; label: string; statistics: IndependentSummary; runIds: string[] }
export interface ConditionComparison { a: string; b: string; statistics: PairedSummary; excludedReplicas: Array<{ replicaId: string; reason: string }> }
export interface ComparisonResults { metric: ComparisonMetric; unit: string; conditions: ConditionSummary[]; comparisons: ConditionComparison[]; empiricalValidation: 'pending'; limitations: string[] }

function pairMismatch(a: SimulationOutput | undefined, b: SimulationOutput | undefined): string | null {
    if (!a || !b) return 'Missing condition in the planned replica pair.';
    if (outcomeStatus(a) !== 'completed' || outcomeStatus(b) !== 'completed') return 'Failed, fixture or degraded condition excluded from inference.';
    const left = a.manifest, right = b.manifest;
    if (!left?.protocol || !right?.protocol || left.memoryPolicy !== 'isolated' || right.memoryPolicy !== 'isolated') return 'A verified isolated paired protocol is unavailable.';
    if (left.codeStateHash !== right.codeStateHash) return 'Local source snapshot mismatch.';
    if (left.experimentId !== right.experimentId || left.replicaId !== right.replicaId || left.scenarioId !== right.scenarioId || left.scenarioSeed !== right.scenarioSeed || left.datasetHash !== right.datasetHash || left.codeRevision !== right.codeRevision || canonicalJSON(left.protocol.exogenousSchedule) !== canonicalJSON(right.protocol.exogenousSchedule)) return 'Cohort, scenario, code revision or exogenous schedule mismatch.';
    return null;
}
/** Descriptive vectors and run-level paired deltas; no hidden composite winner. */
export function compareConditions(outputs: SimulationOutput[], metric: ComparisonMetric = 'totalRoi', failures: FailedCondition[] = []): ComparisonResults {
    const groups = new Map<string, SimulationOutput[]>();
    for (const [index, output] of outputs.entries()) {
        const identity = output.manifest?.protocol?.conditionId ?? output.manifest?.interventionId ?? `legacy-condition-${index + 1}`;
        groups.set(identity, [...(groups.get(identity) ?? []), output]);
    }
    for (const failure of failures) if (!groups.has(failure.experiment.conditionId)) groups.set(failure.experiment.conditionId, []);
    const replica = (output: SimulationOutput, index: number) => output.manifest ? JSON.stringify([output.manifest.experimentId, output.manifest.replicaId]) : `legacy-${index}`;
    const ordered = [...groups].sort(([a, runsA], [b, runsB]) => (runsA[0]?.manifest?.protocol?.conditionIndex ?? failures.find(f => f.experiment.conditionId === a)?.experiment.conditionIndex ?? Number.MAX_SAFE_INTEGER) - (runsB[0]?.manifest?.protocol?.conditionIndex ?? failures.find(f => f.experiment.conditionId === b)?.experiment.conditionIndex ?? Number.MAX_SAFE_INTEGER));
    const conditions: ConditionSummary[] = ordered.map(([id, runs]) => ({ id, label: runs[0]?.frameworkName ?? failures.find(failure => failure.experiment.conditionId === id)!.label,
        runIds: runs.map((output, index) => output.manifest?.runId ?? `${id}-legacy-${index}`),
        statistics: summarizeIndependent([...runs.map((output, index) => ({ replicaId: replica(output, index), value: output.summary[metric], status: outcomeStatus(output) })), ...failures.filter(failure => failure.experiment.conditionId === id).map(failure => ({ replicaId: JSON.stringify([failure.experiment.experimentId, failure.experiment.replicaId]), value: null, status: 'failed' as const }))]) }));
    const comparisons: ConditionComparison[] = [];
    const baseline = conditions[0];
    if (baseline) for (const other of conditions.slice(1)) {
        const left = new Map(groups.get(baseline.id)!.map((output, index) => [replica(output, index), output]));
        const right = new Map(groups.get(other.id)!.map((output, index) => [replica(output, index), output]));
        const excludedReplicas: ConditionComparison['excludedReplicas'] = [];
        const failedReplicas = failures.filter(failure => failure.experiment.conditionId === baseline.id || failure.experiment.conditionId === other.id).map(failure => JSON.stringify([failure.experiment.experimentId, failure.experiment.replicaId]));
        const pairs = [...new Set([...left.keys(), ...right.keys(), ...failedReplicas])].map(replicaId => {
            const a = left.get(replicaId), b = right.get(replicaId);
            const reason = pairMismatch(a, b);
            if (reason) excludedReplicas.push({ replicaId, reason });
            return { replicaId, a: reason ? null : a!.summary[metric], b: reason ? null : b!.summary[metric] };
        });
        comparisons.push({ a: baseline.id, b: other.id, statistics: pairedComparison(pairs), excludedReplicas });
    }
    return { metric, unit: COMPARISON_METRICS[metric].unit, conditions, comparisons, empiricalValidation: 'pending', limitations: ['Synthetic simulation results do not establish observed employee or organization performance.', 'Baseline is the first configured condition; no composite winner is selected.', 'Comparisons are exploratory and restricted to the tested scenarios; multiplicity correction remains pending.'] };
}
