import { mulberry32 } from './employeeBrainCore.js';
/** Resample whole independent cohorts, retaining every correlated record in a selected cohort. */
export function clusterBootstrap<T>(rows: T[], clusterId: (row: T) => string, statistic: (sample: T[]) => number | null, seed = 17, iterations = 2000): [number, number] | null {
    const clusters = new Map<string, T[]>();
    for (const row of rows) { const key = clusterId(row); clusters.set(key, [...(clusters.get(key) ?? []), row]); }
    if (clusters.size < 2) return null;
    const groups = [...clusters.values()], random = mulberry32(seed), estimates: number[] = [];
    for (let iteration = 0; iteration < iterations; iteration++) {
        const sample = Array.from({ length: groups.length }, () => groups[Math.floor(random() * groups.length)]).flat();
        const value = statistic(sample); if (value !== null && Number.isFinite(value)) estimates.push(value);
    }
    if (estimates.length < iterations / 2) return null;
    estimates.sort((a, b) => a - b);
    const quantile = (p: number) => { const index = (estimates.length - 1) * p, lower = Math.floor(index), fraction = index - lower; return estimates[lower] + (estimates[Math.ceil(index)] - estimates[lower]) * fraction; };
    return [quantile(0.025), quantile(0.975)];
}
