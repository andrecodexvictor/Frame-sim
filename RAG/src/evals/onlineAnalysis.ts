import type { OnlineTask, OnlineTrial, OnlineResponse } from './onlineRunner.js';
import { artifactHash } from '../services/RunManifest.js';
export interface CitationChecks { nClaims: number; citedClaims: number; validReferences: number; invalidReferences: number; exactSupportedClaims: number; unverifiedClaims: number }
export function checkCitations(candidate: OnlineResponse, task: OnlineTask): CitationChecks {
    const parsed = JSON.parse(candidate.content) as { claims: Array<{ text: string; evidenceIds: string[] }> };
    let validReferences = 0, invalidReferences = 0, citedClaims = 0, exactSupportedClaims = 0;
    for (const claim of parsed.claims) {
        if (claim.evidenceIds.length) citedClaims++;
        for (const id of claim.evidenceIds) task.evidence.some(event => event.eventId === id) ? validReferences++ : invalidReferences++;
        if (claim.evidenceIds.some(id => task.evidence.some(event => event.eventId === id && event.text === claim.text))) exactSupportedClaims++;
    }
    return { nClaims: parsed.claims.length, citedClaims, validReferences, invalidReferences, exactSupportedClaims, unverifiedClaims: parsed.claims.length - exactSupportedClaims };
}
export interface AblationRecord {
    taskId: string; generator: string; candidateHash?: string; arm: 'deterministic' | 'jev' | 'external-judge' | 'full-pipeline';
    status: OnlineTrial['status']; checks?: CitationChecks; judge?: string;
    judgments?: Array<{ trialId: string; judge: string; status: OnlineTrial['status']; score: number | null; evidenceIds: string[] }>;
}
/** Evaluation-path ablations reuse each candidate; model outputs are never averaged into a hidden winner. */
export function analyzeOnline(trials: OnlineTrial[], tasks: OnlineTask[]) {
    const baselines = tasks.map(task => {
        const generation = { provider: 'deterministic', model: 'extractive-evidence-v1', content: JSON.stringify({ claims: task.evidence.map(event => ({ text: event.text, evidenceIds: [event.eventId] })) }) };
        return { taskId: task.id, status: 'completed' as const, generation, checks: checkCitations(generation, task), limitations: ['Literal extraction is a citation baseline, not a semantic or performance evaluator.'] };
    });
    const groups = new Map<string, OnlineTrial[]>();
    for (const trial of trials) { const key = JSON.stringify([trial.taskId, trial.generator]); groups.set(key, [...(groups.get(key) ?? []), trial]); }
    const ablations: AblationRecord[] = [];
    for (const rows of groups.values()) {
        const first = rows[0], generation = rows.find(row => row.generation)?.generation;
        const base = { taskId: first.taskId, generator: first.generator, ...(generation ? { candidateHash: artifactHash(generation.content) } : {}) };
        const checks = generation ? checkCitations(generation, tasks.find(task => task.id === first.taskId)!) : undefined;
        ablations.push({ ...base, arm: 'deterministic', status: generation ? 'completed' : first.status, checks });
        const judgments = rows.map(row => ({ trialId: row.id, judge: row.judge, status: row.status, score: row.score ?? null, evidenceIds: row.evidenceIds ?? [] }));
        for (const row of rows) ablations.push({ ...base, arm: row.judge === 'jev' ? 'jev' : 'external-judge', judge: row.judge, status: row.status, judgments: judgments.filter(item => item.trialId === row.id) });
        const full = generation && rows.some(row => row.judge === 'jev') && rows.some(row => row.judge !== 'jev') && rows.every(row => row.status === 'completed');
        ablations.push({ ...base, arm: 'full-pipeline', status: full ? 'completed' : rows.every(row => row.status === 'dry-run') ? 'dry-run' : rows.find(row => row.status !== 'completed')?.status ?? 'failed', checks, judgments });
    }
    const percentile = (values: number[], quantile: number) => values.length ? [...values].sort((a,b) => a-b)[Math.ceil(quantile * values.length) - 1] : null;
    const latencies = trials.flatMap(row => row.latencyMs === undefined ? [] : [row.latencyMs]);
    const generations = [...groups.values()].flatMap(rows => { const response = rows.find(row => row.generation)?.generation; return response ? [response] : []; });
    const responses = [...generations, ...trials.flatMap(row => row.judgment ? [row.judgment] : [])];
    return { baselines, ablations, summary: { plannedTrials: trials.length, completedTrials: trials.filter(row => row.status === 'completed').length, validOutputRate: trials.length ? trials.filter(row => row.status === 'completed').length / trials.length : null, latencyP50Ms: percentile(latencies, 0.5), latencyP95Ms: percentile(latencies, 0.95), latencyScope: 'per trial; generation cache makes judge-only trials shorter', reportedTokens: responses.reduce((sum, response) => sum + (response.usage?.totalTokens ?? 0), 0), responsesWithUsage: responses.filter(response => response.usage).length, responsesWithoutUsage: responses.filter(response => !response.usage).length } };
}
