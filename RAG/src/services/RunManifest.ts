import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { PersonaProfile, SimulationConfig } from '../types/index.js';
import type { RunManifest, ModelObservation } from '../types/evaluation.js';
import rubric from '../../evals/rubrics/individual-v1.json' with { type: 'json' };
import { resolveWorkPolicy } from '../core/syntheticWork.js';
import { fingerprintSources } from './CodeSnapshot.js';

import { canonicalJSON } from '../core/artifactCanonical.js';
export { canonicalJSON } from '../core/artifactCanonical.js';
export const artifactHash = (value: unknown) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const processCodeState = fingerprintSources(fileURLToPath(new URL('../../../', import.meta.url)));
export const codeStateHash = () => processCodeState;
let revision: string | undefined;
export function codeRevision(): string {
    if (revision) return revision;
    try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(new URL('../../../', import.meta.url)), encoding: 'utf8', windowsHide: true, timeout: 5000 }).trim(); }
    catch { revision = 'unknown'; }
    return revision;
}
export function createRunManifest(runId: string, config: SimulationConfig | undefined, profiles: PersonaProfile[]): RunManifest {
    const seed = config?.parametros_simulacao.seed ?? 0;
    const policy = resolveWorkPolicy(config?.task_policy);
    return {
        ...(config?.experiment ? { protocol: structuredClone(config.experiment) } : {}),
        schemaVersion: 1, runId,
        taskModel: { policy, policyHash: artifactHash(policy), source: 'synthetic', scope: 'sampled-work-block' },
        experimentId: config?.experiment?.experimentId || 'interactive',
        replicaId: config?.experiment?.replicaId || String(seed),
        scenarioId: config?.experiment?.scenarioId || config?.contexto_situacional.cenario_atual || 'unspecified',
        scenarioSeed: seed,
        interventionId: config?.experiment?.interventionId || config?.framework_config?.id || 'unspecified',
        configHash: artifactHash(config ?? {}), datasetHash: artifactHash([...profiles].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        codeRevision: codeRevision(), codeStateHash: codeStateHash(), startedAt: new Date().toISOString(), dataSource: 'synthetic', empiricalValidation: 'pending', executionMode: 'live', models: [],
        rubricVersion: rubric.version, rubricHash: artifactHash(rubric),
        memoryPolicy: config?.experiment ? 'isolated' : 'interactive',
    };
}
export function recordModel(manifest: RunManifest | undefined, model: ModelObservation): void {
    if (!manifest) return;
    if (!manifest.models.some(existing => canonicalJSON(existing) === canonicalJSON(model))) manifest.models.push(model);
}
