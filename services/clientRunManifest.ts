import { canonicalJSON } from '../RAG/src/core/artifactCanonical';
import type { RunManifest, SingleSimulationConfig } from '../types';
import type { ProviderGenerateResponse } from './providerClient';
import rubric from '../RAG/evals/rubrics/individual-v1.json';
import { resolveWorkPolicy } from '../RAG/src/core/syntheticWork';

export async function browserArtifactHash(value: unknown): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJSON(value)));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function createClientRunManifest(runId: string, config: SingleSimulationConfig, profiles: Array<{ id: string }>, response: ProviderGenerateResponse, startedAt: string): Promise<RunManifest> {
    const [configHash, datasetHash, rubricHash] = await Promise.all([browserArtifactHash(config), browserArtifactHash([...profiles].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), browserArtifactHash(rubric)]);
    const policy = resolveWorkPolicy(config.workloadPolicy);
    return { schemaVersion: 1, runId, experimentId: config.experiment?.experimentId ?? 'interactive-standard', replicaId: config.experiment?.replicaId ?? String(config.seed ?? 0),
        taskModel: { policy, policyHash: await browserArtifactHash(policy), source: 'synthetic', scope: 'sampled-work-block' },
        scenarioId: config.experiment?.scenarioId ?? config.scenarioContext, scenarioSeed: config.experiment?.scenarioSeed ?? config.seed ?? 0,
        interventionId: config.experiment?.interventionId ?? config.frameworkName, ...(config.experiment ? { protocol: structuredClone(config.experiment) } : {}),
        configHash, datasetHash, rubricHash, rubricVersion: rubric.version, codeRevision: response.codeRevision ?? 'unknown', codeStateHash: response.codeStateHash, startedAt, completedAt: new Date().toISOString(),
        dataSource: 'synthetic', empiricalValidation: 'pending', executionMode: response.degraded ? 'degraded' : 'live', memoryPolicy: 'isolated',
        models: [{ role: 'narrative', provider: response.provider, requestedModel: response.requestedModel ?? config.modelPreference ?? response.model, resolvedModel: response.model, ...(config.temperature !== undefined ? { temperature: config.temperature } : {}), status: 'completed' }],
    };
}
