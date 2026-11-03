import type { EvidenceMetric, IndividualEvaluation, PersonaTrace, TaskObservation } from '../types/evaluation.js';

const missing = (id: string, unit: string, reason: string): EvidenceMetric => ({ id, value: null, unit, evidenceIds: [], coverage: 0, missingReason: reason });
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };

/** Deterministic measurements only; narrative and personality never establish delivery. */
export function evaluateIndividualMetrics(traces: PersonaTrace[]): IndividualEvaluation[] {
    const groups = new Map<string, PersonaTrace[]>();
    for (const trace of traces) {
        if (trace.before.personaId !== trace.personaId || trace.after.personaId !== trace.personaId) throw new Error('Invalid trace identity');
        const key = JSON.stringify([trace.runId, trace.personaId]);
        groups.set(key, [...(groups.get(key) ?? []), trace]);
    }
    return [...groups.values()].map(personal => {
        personal.sort((a, b) => a.turnId - b.turnId);
        const first = personal[0];
        const known = new Set(personal.flatMap(trace => trace.events.filter(event => event.personaId === first.personaId && event.turnId === trace.turnId).map(event => event.eventId)));
        const tasks = new Map<string, TaskObservation>();
        let plannedTasks = 0;
        for (const trace of personal) for (const task of trace.tasks) {
            const units = [task.opportunityUnits, task.deliveredUnits, task.acceptedUnits, task.reworkUnits];
            if (units.some(value => !Number.isFinite(value) || value < 0) || task.acceptedUnits > task.deliveredUnits || task.deliveredUnits > task.opportunityUnits || task.reworkUnits > task.acceptedUnits || (task.leadTimeHours !== undefined && (!Number.isFinite(task.leadTimeHours) || task.leadTimeHours < 0))) throw new Error('Invalid task observation');
            plannedTasks++;
            if (!task.evidenceIds.length || !task.evidenceIds.every(id => known.has(id))) continue;
            const existing = tasks.get(task.taskId);
            if (existing && JSON.stringify(existing) !== JSON.stringify(task)) throw new Error('Invalid task: conflicting duplicate observation');
            tasks.set(task.taskId, task);
        }
        const measured = [...tasks.values()];
        const sum = (field: 'opportunityUnits' | 'deliveredUnits' | 'acceptedUnits' | 'reworkUnits') => measured.reduce((total, task) => total + task[field], 0);
        const evidenceIds = [...new Set(measured.flatMap(task => task.evidenceIds))];
        const ratio = (id: string, numerator: number, denominator: number, unit: string): EvidenceMetric => denominator > 0
            ? { id, numerator, denominator, value: numerator / denominator, unit, evidenceIds, coverage: plannedTasks ? measured.length / plannedTasks : 0 }
            : missing(id, unit, 'No attributed task observations with a positive denominator.');
        const timed = measured.filter(task => task.leadTimeHours !== undefined && task.censored !== true && task.acceptedUnits > 0);
        const classes = new Map<string, TaskObservation[]>();
        for (const task of measured) { const classId = task.classId ?? `${first.role}:unspecified`; classes.set(classId, [...(classes.get(classId) ?? []), task]); }
        const leadTimeByClass = [...classes].map(([classId, rows]) => {
            const accepted = rows.filter(task => task.acceptedUnits > 0 && task.censored !== true);
            const durations = accepted.flatMap(task => task.leadTimeHours === undefined ? [] : [task.leadTimeHours]);
            return { classId, unit: 'hours' as const, median: durations.length ? median(durations) : null, nAccepted: accepted.length, nCensored: rows.filter(task => task.censored === true).length, nMissingTiming: accepted.length - durations.length,
                observations: rows.map(task => ({ taskId: task.taskId, hours: task.leadTimeHours ?? null, accepted: task.acceptedUnits > 0 && task.censored !== true, censored: task.censored ?? null, evidenceIds: [...task.evidenceIds] })) };
        });
        const sources = new Set([...personal.map(trace => trace.source), ...measured.map(task => task.source), ...personal.flatMap(trace => trace.events.map(event => event.source))]);
        const stateIds = personal.flatMap(trace => trace.events.filter(event => event.kind === 'state-transition').map(event => event.eventId));
        const contextual = (id: string, field: 'estresse' | 'energia'): EvidenceMetric => stateIds.length
            ? { id, value: mean(personal.map(trace => trace.after[field])), unit: 'simulated state points (0–100)', evidenceIds: stateIds, coverage: personal.filter(trace => trace.events.some(event => event.kind === 'state-transition')).length / personal.length }
            : missing(id, 'simulated state points (0–100)', 'No recorded state transition.');
        return {
            personaId: first.personaId, runId: first.runId, role: first.role,
            source: sources.has('synthetic') ? 'synthetic' : sources.has('expert_labeled') ? 'expert_labeled' : 'observed', empiricalValidation: 'pending', leadTimeByClass,
            metrics: [ratio('delivery', sum('acceptedUnits'), sum('opportunityUnits'), 'accepted units / opportunity units'),
                ratio('quality', sum('acceptedUnits') - sum('reworkUnits'), sum('deliveredUnits'), 'accepted without rework / delivered units'),
                timed.length ? { id: 'lead-time', value: median(timed.map(task => task.leadTimeHours!)), unit: 'hours', evidenceIds: [...new Set(timed.flatMap(task => task.evidenceIds))], coverage: timed.length / measured.length } : missing('lead-time', 'hours', 'No accepted uncensored tasks with a recorded duration.'),
                missing('adaptation', 'comparable behavioral change', 'Comparable baseline and opportunities are not documented.'),
                contextual('stress-context', 'estresse'), contextual('energy-context', 'energia')],
            semantic: {}, limitations: ['Simulated state is contextual, not measured employee performance.', 'Task units are compared within the same role; cross-role normalization is pending.', 'No independent observed holdout has validated these results.', ...(measured.some(task => task.modelVersion === 'synthetic-work-v1') ? ['Task outcomes describe a sampled synthetic work block per turn, not total monthly production. Unaccepted tasks are censored at the block boundary and do not carry over. Lead-time median is conditional on accepted tasks and includes reserved review time and downtime. Review reservations may remain unused when the assigned task is not delivered. Work quality/capacity are independent of stress and personality; framework superiority is not encoded.'] : [])],
        };
    });
}
