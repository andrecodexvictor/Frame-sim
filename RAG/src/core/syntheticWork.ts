import { addressedRandom, type ExogenousShock } from './experimentProtocol.js';
import type { PersonaTrace, TaskObservation, TraceEvent } from '../types/evaluation.js';
export interface SyntheticWorkPolicy {
    version: 'synthetic-work-v1'; capacityHours: number; taskEffortHours: number;
    defectProbability: number; reviewProbability: number; detectionProbability: number;
    reviewHours: number; correctionHours: number; incidentProbability: number; incidentDowntimeHours: number; incidentPressureDelta: number;
}
export const DEFAULT_WORK_POLICY: Readonly<SyntheticWorkPolicy> = Object.freeze({ version: 'synthetic-work-v1', capacityHours: 2, taskEffortHours: 1, defectProbability: 0.2, reviewProbability: 0.5, detectionProbability: 0.9, reviewHours: 0.25, correctionHours: 0.25, incidentProbability: 0.1, incidentDowntimeHours: 0.5, incidentPressureDelta: 0.1 });
export function resolveWorkPolicy(input?: Partial<SyntheticWorkPolicy>): SyntheticWorkPolicy {
    const policy = { ...DEFAULT_WORK_POLICY, ...input };
    if (!input || typeof input === 'object') {
        if (policy.version !== 'synthetic-work-v1' || Object.keys(policy).some(key => !Object.hasOwn(DEFAULT_WORK_POLICY, key))) throw new Error('Invalid synthetic work policy');
        for (const key of ['defectProbability', 'reviewProbability', 'detectionProbability', 'incidentProbability', 'incidentPressureDelta'] as const) if (!Number.isFinite(policy[key]) || policy[key] < 0 || policy[key] > 1) throw new Error('Invalid synthetic work policy probability');
        for (const key of ['capacityHours', 'taskEffortHours', 'reviewHours', 'correctionHours', 'incidentDowntimeHours'] as const) if (!Number.isFinite(policy[key]) || policy[key] < 0 || policy[key] > 24) throw new Error('Invalid synthetic work policy duration');
        if (policy.taskEffortHours <= 0 || policy.capacityHours <= 0) throw new Error('Invalid synthetic work policy capacity');
        return policy;
    }
    throw new Error('Invalid synthetic work policy');
}
export function incidentContext(shock: { incidentUniform: number } | undefined, policy = DEFAULT_WORK_POLICY) {
    const occurred = Boolean(shock && shock.incidentUniform < policy.incidentProbability);
    return { version: policy.version, occurred, pressureDelta: occurred ? policy.incidentPressureDelta : 0, downtimeHours: occurred ? policy.incidentDowntimeHours : 0, source: 'synthetic' as const };
}
/** A sampled work block, independent of stress/personality. This does not model a month's entire output. */
export function simulateWorkBlock(input: PersonaTrace[], options: { seed: number; shock?: ExogenousShock; policy?: Partial<SyntheticWorkPolicy> }): PersonaTrace[] {
    const traces = structuredClone(input), policy = resolveWorkPolicy(options.policy), incident = incidentContext(options.shock, policy);
    if (!traces.length) return traces;
    if (traces.some(trace => trace.source !== 'synthetic' || trace.runId !== traces[0].runId || trace.turnId !== traces[0].turnId || trace.tasks.length)) throw new Error('Synthetic work needs one unaugmented synthetic run/turn');
    if (new Set(traces.map(trace => trace.personaId)).size !== traces.length) throw new Error('Duplicate synthetic persona identity');
    const eligible = traces.filter(trace => trace.before.status === 'ativo').sort((a, b) => a.personaId < b.personaId ? -1 : a.personaId > b.personaId ? 1 : 0);
    const jobs = eligible.flatMap((trace, index) => {
        const opportunities = Math.max(1, Math.min(6, Math.ceil(2 * (options.shock?.demandMultiplier ?? 1) * (0.75 + 0.5 * addressedRandom(options.seed, trace.personaId, trace.turnId, 'work-demand')()))));
        const peer = eligible.length > 1 ? eligible[(index + 1) % eligible.length] : undefined;
        return Array.from({ length: opportunities }, (_, job) => ({ trace, job, taskId: `${encodeURIComponent(trace.personaId)}:${trace.turnId}:task-${job + 1}`, peer: peer?.after.status === 'ativo' && addressedRandom(options.seed, trace.personaId, trace.turnId, `work-review:${job}`)() < policy.reviewProbability ? peer : undefined,
            defect: addressedRandom(options.seed, trace.personaId, trace.turnId, `work-defect:${job}`)() < policy.defectProbability,
            detected: addressedRandom(options.seed, trace.personaId, trace.turnId, `work-detection:${job}`)() < policy.detectionProbability }));
    });
    const event = (trace: PersonaTrace, suffix: string, type: string, text: string, kind: TraceEvent['kind'] = 'task-observation', relatedPersonaIds?: string[]): TraceEvent => ({ eventId: `${trace.runId}:${encodeURIComponent(trace.personaId)}:${trace.turnId}:work-${suffix}`, personaId: trace.personaId, turnId: trace.turnId, type, text, kind, source: 'synthetic', ...(relatedPersonaIds ? { relatedPersonaIds } : {}) });
    const reviewReservations = new Map<string, number>();
    for (const job of jobs) if (job.peer) {
        const used = reviewReservations.get(job.peer.personaId) ?? 0;
        if (used + policy.reviewHours > Math.max(0, policy.capacityHours - incident.downtimeHours)) job.peer = undefined;
        else reviewReservations.set(job.peer.personaId, used + policy.reviewHours);
    }
    for (const trace of traces) {
        if (incident.occurred) trace.events.push(event(trace, 'incident', 'environment-incident', JSON.stringify(incident), 'exogenous'));
        const reservedReviewHours = reviewReservations.get(trace.personaId) ?? 0;
        let remaining = trace.after.status === 'ativo' ? Math.max(0, policy.capacityHours - incident.downtimeHours - reservedReviewHours) : 0;
        let elapsed = incident.downtimeHours + reservedReviewHours;
        trace.events.push(event(trace, 'block', 'sampled-work-block', JSON.stringify({ policy, available: trace.after.status === 'ativo', reservedReviewHours, usableExecutionHours: remaining, scope: 'sampled block within turn, not total monthly production' })));
        for (const job of jobs.filter(job => job.trace.personaId === trace.personaId)) {
            const correction = Boolean(job.peer && job.defect && job.detected), effort = policy.taskEffortHours + (correction ? policy.correctionHours : 0);
            const delivered = remaining >= effort;
            if (delivered) { remaining -= effort; elapsed += effort; }
            const accepted = delivered && (!job.defect || correction), task: TaskObservation = { taskId: job.taskId, opportunityUnits: 1, deliveredUnits: delivered ? 1 : 0, acceptedUnits: accepted ? 1 : 0, reworkUnits: accepted && correction ? 1 : 0, evidenceIds: [], source: 'synthetic', classId: `${trace.role}:sampled-unit`, modelVersion: policy.version, assignedTurnId: trace.turnId, status: accepted ? 'accepted' : delivered ? 'rejected' : 'pending', censored: !accepted, ...(accepted ? { leadTimeHours: elapsed } : {}) };
            const observation = event(trace, `task-${job.job + 1}`, 'attributed-task-outcome', JSON.stringify({ ...task, effortHours: delivered ? effort : 0, rejectedForDefect: delivered && !accepted }));
            task.evidenceIds = [observation.eventId]; trace.events.push(observation); trace.tasks.push(task);
            if (accepted && correction && job.peer) job.peer.events.push(event(job.peer, `review-${encodeURIComponent(job.taskId)}`, 'documented-peer-correction', `Synthetic review of ${job.taskId} for ${trace.personaId} detected a defect; the executor corrected it and the task was accepted. Evidence: ${observation.eventId}.`, 'collaboration', [trace.personaId]));
        }
    }
    return traces;
}
