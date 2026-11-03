import type { EmployeeBrainState } from '../core/employeeBrainCore.js';
import type { EvidenceSource, PersonaTrace, TraceEvent } from '../types/evaluation.js';

/** Append-only evidence collector. It never draws randomness or edits the kernel. */
export class TraceRecorder {
    private traces: PersonaTrace[] = [];
    recordTurn(runId: string, turnId: number, before: EmployeeBrainState[], after: EmployeeBrainState[],
        events: Array<Omit<TraceEvent, 'eventId' | 'turnId' | 'source'>>, source: EvidenceSource = 'synthetic'): void {
        for (const previous of before) {
            const next = after.find(brain => brain.personaId === previous.personaId);
            if (!next) throw new Error('Missing persona in state transition');
            const personalEvents = [{ personaId: previous.personaId, type: 'brain-transition', text: `Recorded state transition for turn ${turnId}`, kind: 'state-transition' as const }, ...events.filter(event => event.personaId === previous.personaId)];
            this.traces.push(structuredClone({ runId, personaId: previous.personaId, turnId, role: previous.cargo,
                before: previous, after: next, tasks: [], source,
                events: personalEvents.map((event, index) => ({ ...event, eventId: `${runId}:${encodeURIComponent(previous.personaId)}:${turnId}:${index}`, turnId, source })) }));
        }
    }
    snapshot(): PersonaTrace[] { return structuredClone(this.traces); }
    /** Attach observations computed by a separate model without changing state or RNG. */
    attachWorkTurn(enriched: PersonaTrace[]): void {
        for (const replacement of enriched) {
            const index = this.traces.findIndex(trace => trace.runId === replacement.runId && trace.personaId === replacement.personaId && trace.turnId === replacement.turnId);
            if (index < 0 || JSON.stringify(this.traces[index].before) !== JSON.stringify(replacement.before) || JSON.stringify(this.traces[index].after) !== JSON.stringify(replacement.after)) throw new Error('Work observation cannot alter a recorded state');
            this.traces[index] = structuredClone(replacement);
        }
    }
    reset(): void { this.traces = []; }
}
