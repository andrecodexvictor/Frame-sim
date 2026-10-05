import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import { artifactHash } from '../services/RunManifest.js';
import { evaluateIndividualMetrics } from '../services/IndividualMetrics.js';
import { clusterBootstrap } from '../core/clusterBootstrap.js';
import { validateDataset, tracesFromCase, type EvalDataset, type EvalCase, type EvalPrediction, type PredictorInput } from './dataset.js';
export interface EvalTrial { id: string; split: EvalCase['split']; cohortId: string; target: EvalCase['target']; source: EvalCase['source']; prediction: EvalPrediction; baseline: number | null; status: 'completed' | 'abstained' | 'failed'; errorCode?: string }
interface FrozenPolicy { calibrationStatus: 'pending' | 'synthetic-contract-only' | 'development-calibrated'; threshold: number | null; calibrationDatasetHash: string; hash: string; maxError: number | null; minimumCoverage: number | null }
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const targetKey = (target: EvalCase['target']) => JSON.stringify([target.kind, target.unit]);
const correlation = (a: number[], b: number[]) => { const ma = mean(a)!, mb = mean(b)!; const denominator = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0)); return a.length < 2 || !denominator ? null : a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / denominator; };
const ranks = (values: number[]) => values.map(value => { const less = values.filter(x => x < value).length, equal = values.filter(x => x === value).length; return less + (equal + 1) / 2; });
export function summarizeTrials(trials: EvalTrial[]) {
    const accepted = trials.filter(row => row.status === 'completed' && row.prediction.value !== null);
    const numeric = accepted.filter(row => row.target.kind !== 'binary'), binary = accepted.filter(row => row.target.kind === 'binary'), ordinal = accepted.filter(row => row.target.kind === 'ordinal');
    const mae = (rows: EvalTrial[]) => mean(rows.map(row => Math.abs(row.prediction.value! - row.target.value)));
    const rmse = (rows: EvalTrial[]) => rows.length ? Math.sqrt(mean(rows.map(row => (row.prediction.value! - row.target.value) ** 2))!) : null;
    const brier = (rows: EvalTrial[]) => mean(rows.map(row => (row.prediction.value! - row.target.value) ** 2));
    const logLoss = (rows: EvalTrial[]) => mean(rows.map(row => { const p = Math.max(1e-12, Math.min(1 - 1e-12, row.prediction.value!)); return -(row.target.value * Math.log(p) + (1 - row.target.value) * Math.log(1 - p)); }));
    const cluster = (row: EvalTrial) => row.cohortId;
    const intervals95 = { mae: clusterBootstrap(numeric, cluster, mae), rmse: clusterBootstrap(numeric, cluster, rmse), brier: clusterBootstrap(binary, cluster, brier), logLoss: clusterBootstrap(binary, cluster, logLoss) };
    const calibrationCurve = Array.from({ length: 10 }, (_, bin) => {
        const selected = binary.filter(row => Math.min(9, Math.floor(row.prediction.value! * 10)) === bin);
        return { lower: bin / 10, upper: (bin + 1) / 10, n: selected.length, nIndependent: new Set(selected.map(cluster)).size, meanForecast: mean(selected.map(row => row.prediction.value!)), observedFrequency: mean(selected.map(row => row.target.value)) };
    });
    return { n: accepted.length, nIndependent: new Set(accepted.map(row => row.cohortId)).size, nExcluded: trials.length - accepted.length, coverage: trials.length ? accepted.length / trials.length : 0,
        mae: mae(numeric), rmse: rmse(numeric),
        baselineMAE: mean(numeric.filter(row => row.baseline !== null).map(row => Math.abs(row.baseline! - row.target.value))),
        brier: brier(binary), baselineBrier: mean(binary.filter(row => row.baseline !== null).map(row => (row.baseline! - row.target.value) ** 2)), logLoss: logLoss(binary), calibrationCurve,
        rankCorrelation: correlation(ranks(ordinal.map(row => row.prediction.value!)), ranks(ordinal.map(row => row.target.value))), interval95: numeric.length ? intervals95.mae : intervals95.brier, intervals95, intervalMethod: accepted.length ? 'cohort-cluster-percentile-bootstrap (2000, seed 17)' : 'unavailable', weighting: 'case-weighted error; cohort resampling preserves correlated records' };
}
export async function deterministicPrediction(item: PredictorInput): Promise<EvalPrediction> {
    const traces = tracesFromCase(item);
    if (traces) {
        const metric = evaluateIndividualMetrics(traces).find(row => row.personaId === item.personaId)?.metrics.find(row => row.id === item.input.dimension);
        if (!metric || metric.unit !== item.target.unit) throw new Error('Target unit mismatch');
        return { value: metric.value };
    }
    if (item.prediction) return item.prediction;
    throw new Error('MissingPrediction');
}
export async function runOffline(dataset: EvalDataset, options: { maxCalibrationError?: number; minimumCoverage?: number } = {}, predictor = deterministicPrediction) {
    if ((options.maxCalibrationError !== undefined && (!Number.isFinite(options.maxCalibrationError) || options.maxCalibrationError < 0)) || (options.minimumCoverage !== undefined && (!Number.isFinite(options.minimumCoverage) || options.minimumCoverage <= 0 || options.minimumCoverage > 1))) throw new Error('Invalid calibration constraints');
    const units = new Set(dataset.cases.map(row => targetKey(row.target)));
    if (units.size !== 1) throw new Error('Evaluate each target kind and unit separately; do not mix scales');
    const development = dataset.cases.filter(row => row.split === 'development');
    const baseline = mean(development.map(row => row.target.value));
    const trials: EvalTrial[] = [];
    const execute = async (items: EvalCase[]) => {
        for (const item of items) {
            try {
                const prediction = await predictor(structuredClone({ ...item, target: { kind: item.target.kind, unit: item.target.unit } }));
                if (prediction.value !== null && (!Number.isFinite(prediction.value) || (item.target.kind === 'binary' && (prediction.value < 0 || prediction.value > 1)))) throw new Error('InvalidPrediction');
                if (prediction.confidence !== undefined && (!Number.isFinite(prediction.confidence) || prediction.confidence < 0 || prediction.confidence > 1)) throw new Error('InvalidConfidence');
                trials.push({ id: item.id, split: item.split, cohortId: item.cohortId, target: item.target, source: item.source, prediction, baseline, status: prediction.value === null ? 'abstained' : 'completed' });
            } catch (error) { trials.push({ id: item.id, split: item.split, cohortId: item.cohortId, target: item.target, source: item.source, prediction: { value: null }, baseline, status: 'failed', errorCode: error instanceof Error ? error.name : 'EvaluationError' }); }
        }
    };
    await execute(development);
    const calibration = dataset.cases.filter(row => row.split === 'calibration');
    await execute(calibration);
    const calTrials = trials.filter(row => row.split === 'calibration');
    let threshold: number | null = null;
    if (options.maxCalibrationError !== undefined && options.minimumCoverage !== undefined && calTrials.length) {
        for (const candidate of [...new Set(calTrials.filter(row => row.status === 'completed' && row.prediction.confidence !== undefined).map(row => row.prediction.confidence!))].sort((a, b) => a - b)) {
            const retained = calTrials.filter(row => row.status === 'completed' && (row.prediction.confidence ?? -1) >= candidate);
            if (retained.length / calTrials.length >= options.minimumCoverage && mean(retained.map(row => Math.abs(row.prediction.value! - row.target.value)))! <= options.maxCalibrationError) { threshold = candidate; break; }
        }
    }
    const policyData = { calibrationStatus: threshold === null ? 'pending' as const : calibration.every(row => row.source !== 'synthetic') ? 'development-calibrated' as const : 'synthetic-contract-only' as const, threshold, calibrationDatasetHash: artifactHash(calibration), maxError: options.maxCalibrationError ?? null, minimumCoverage: options.minimumCoverage ?? null };
    const policy: FrozenPolicy = { ...policyData, hash: artifactHash(policyData) };
    // Freeze policy before evaluating holdout. No labels from holdout influence baseline or threshold.
    await execute(dataset.cases.filter(row => row.split === 'holdout'));
    for (const row of trials.filter(row => row.split === 'holdout')) if (row.status === 'completed' && threshold !== null && (row.prediction.confidence ?? -1) < threshold) row.status = 'abstained';
    const holdoutTrials = trials.filter(row => row.split === 'holdout');
    return { schemaVersion: 1, datasetHash: dataset.hash, target: dataset.cases[0].target.unit, policy, empiricalValidation: holdoutTrials.some(row => row.status === 'completed') && holdoutTrials.every(row => row.source === 'observed') && policy.calibrationStatus === 'development-calibrated' ? 'observed_holdout_evaluated' : 'empirical_validation_pending', trials, development: summarizeTrials(trials.filter(row => row.split === 'development')), calibration: summarizeTrials(calTrials), holdout: summarizeTrials(holdoutTrials), limitations: ['Synthetic fixtures validate contracts, not real-world fidelity.', 'Confidence is a selection signal, not correctness probability.', 'Intervals resample independent cohorts; tiny cohort samples remain exploratory. Human agreement/adjudication requires external human labels.', 'Baseline is the mean development target; imported predictions require independent provenance.'] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const flag = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
    const path = flag('--dataset') ?? 'evals/fixtures/contract-v1.json';
    const dataset = validateDataset(JSON.parse(await readFile(path, 'utf8')));
    const result = await runOffline(dataset, { ...(flag('--max-calibration-error') ? { maxCalibrationError: Number(flag('--max-calibration-error')) } : {}), ...(flag('--minimum-coverage') ? { minimumCoverage: Number(flag('--minimum-coverage')) } : {}) });
    const output = flag('--output') ?? 'evals/results/offline-contract-v1.json';
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ output, datasetHash: result.datasetHash, status: result.empiricalValidation, holdout: result.holdout }));
}
