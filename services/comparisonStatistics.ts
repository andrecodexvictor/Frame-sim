import { mulberry32 } from '../RAG/src/core/employeeBrainCore';

export interface IndependentObservation { replicaId: string; value: number | null; status?: 'completed' | 'failed' | 'fixture' | 'degraded' }
export interface IndependentSummary { mean: number | null; sampleSD: number | null; min: number | null; max: number | null; interval95: [number, number] | null; nIndependent: number; nExcluded: number; method: 'student-t' | 'unavailable'; limitations: string[] }
export interface PairedObservation { replicaId: string; a: number | null; b: number | null; status?: 'completed' | 'failed' | 'fixture' | 'degraded' }
export interface PairedSummary { delta: number | null; interval95: [number, number] | null; nIndependent: number; nExcluded: number; method: 'paired-run-bootstrap' | 'unavailable'; seed: number; resamples: number; limitations: string[] }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
function assertIndependent(observations: Array<{ replicaId: string }>): void {
    const seen = new Set<string>();
    for (const observation of observations) { if (!observation.replicaId || seen.has(observation.replicaId)) throw new Error('Duplicate replica or missing independent unit identity'); seen.add(observation.replicaId); }
}
const t975 = (df: number) => {
    const table = [0, 12.7062, 4.3027, 3.1824, 2.7764, 2.5706, 2.4469, 2.3646, 2.3060, 2.2622, 2.2281, 2.2010, 2.1788, 2.1604, 2.1448, 2.1314, 2.1199, 2.1098, 2.1009, 2.0930, 2.0860, 2.0796, 2.0739, 2.0687, 2.0639, 2.0595, 2.0555, 2.0518, 2.0484, 2.0452, 2.0423];
    if (df <= 30) return table[df];
    const z = 1.959963984540054;
    return z + (z ** 3 + z) / (4 * df) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df ** 2);
};
export function summarizeIndependent(observations: IndependentObservation[]): IndependentSummary {
    assertIndependent(observations);
    const values = observations.filter(item => (!item.status || item.status === 'completed') && finite(item.value)).map(item => item.value as number);
    const average = values.length ? mean(values) : null;
    const sd = values.length >= 2 ? Math.sqrt(values.reduce((sum, value) => sum + (value - average!) ** 2, 0) / (values.length - 1)) : null;
    const margin = sd === null ? null : t975(values.length - 1) * sd / Math.sqrt(values.length);
    return { mean: average, sampleSD: sd, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null,
        interval95: margin === null ? null : [average! - margin, average! + margin], nIndependent: values.length, nExcluded: observations.length - values.length, method: margin === null ? 'unavailable' : 'student-t',
        limitations: ['Intervals describe independent simulated runs under the tested scenarios; external validity is pending.', ...(values.length < 2 ? ['At least two independent replicas are required for an interval.'] : ['Student-t interval assumes independent runs and approximately normal run-level means.'])] };
}
function quantile(sorted: number[], probability: number): number {
    const index = (sorted.length - 1) * probability, low = Math.floor(index), fraction = index - low;
    return sorted[low] + fraction * (sorted[Math.ceil(index)] - sorted[low]);
}
export function pairedComparison(observations: PairedObservation[], options: { seed?: number; resamples?: number } = {}): PairedSummary {
    assertIndependent(observations);
    const valid = observations.filter(item => (!item.status || item.status === 'completed') && finite(item.a) && finite(item.b));
    const deltas = valid.map(item => item.b! - item.a!);
    const seed = options.seed ?? 71, resamples = options.resamples ?? 2000;
    if (!Number.isInteger(resamples) || resamples < 100 || resamples > 10_000 || !Number.isSafeInteger(seed)) throw new Error('Invalid bootstrap budget');
    const rng = mulberry32(seed);
    const samples = deltas.length < 2 ? [] : Array.from({ length: resamples }, () => mean(Array.from({ length: deltas.length }, () => deltas[Math.floor(rng() * deltas.length)]))).sort((a, b) => a - b);
    return { delta: deltas.length ? mean(deltas) : null, interval95: samples.length ? [quantile(samples, 0.025), quantile(samples, 0.975)] : null,
        nIndependent: deltas.length, nExcluded: observations.length - deltas.length, method: samples.length ? 'paired-run-bootstrap' : 'unavailable', seed, resamples: samples.length ? resamples : 0,
        limitations: ['Delta is condition B minus condition A. Resampling unit is the complete replica pair.', 'Exploratory comparison; multiplicity and observed holdout validation remain pending.', ...(deltas.length < 2 ? ['At least two complete independent pairs are required for an interval.'] : ['Percentile bootstrap can be unstable with very few independent pairs.'])] };
}
