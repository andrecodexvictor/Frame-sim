import { mulberry32 } from '../core/employeeBrainCore.js';
import { artifactHash } from '../services/RunManifest.js';
import type { ProviderId } from '../services/ProviderRegistry.js';
export interface OnlineTrialPlan { id: string; taskId: string; generator: Exclude<ProviderId, 'jev'>; judge: ProviderId; blindId: string }
export interface OnlinePlan { version: 'crossed-v1'; seed: number; trials: OnlineTrialPlan[]; hash: string }
export function createOnlinePlan(input: { taskIds: string[]; generators: Exclude<ProviderId, 'jev'>[]; judges: ProviderId[]; seed: number }): OnlinePlan {
    if (!Number.isSafeInteger(input.seed) || !input.taskIds.length || !input.generators.length || !input.judges.length || new Set(input.taskIds).size !== input.taskIds.length || input.taskIds.some(id => typeof id !== 'string' || !id.trim())) throw new Error('Invalid online protocol');
    const trials: OnlineTrialPlan[] = [];
    for (const taskId of input.taskIds) for (const generator of [...new Set(input.generators)]) for (const judge of [...new Set(input.judges)]) {
        if (generator === judge) throw new Error('A generator cannot self-evaluate in the external judge matrix');
        if (!['google', 'deepseek', 'glm', 'kimi', 'openai'].includes(generator) || !['google', 'deepseek', 'glm', 'kimi', 'openai', 'jev'].includes(judge)) throw new Error('Invalid provider identity');
        const id = `trial-${trials.length + 1}`;
        trials.push({ id, taskId, generator, judge, blindId: `candidate-${artifactHash([input.seed, taskId, generator]).slice(0, 16)}` });
    }
    const random = mulberry32(input.seed);
    for (let index = trials.length - 1; index > 0; index--) { const other = Math.floor(random() * (index + 1)); [trials[index], trials[other]] = [trials[other], trials[index]]; }
    const plan = { version: 'crossed-v1' as const, seed: input.seed, trials };
    return { ...plan, hash: artifactHash(plan) };
}
/** Conservative per-call reservations remain spent even after failures; no quota-chasing retries. */
export class ReservationBudget {
    calls = 0;
    private reservedMicros = 0;
    private readonly limitMicros: number;
    private readonly perCallMicros: number;
    constructor(readonly options: { budgetUSD: number; maxCalls: number; timeoutMs: number; reservationUSD: number }) {
        if (!Number.isFinite(options.budgetUSD) || options.budgetUSD < 0 || !Number.isFinite(options.reservationUSD) || options.reservationUSD <= 0 || !Number.isInteger(options.maxCalls) || options.maxCalls < 1 || options.maxCalls > 10000 || !Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 90000) throw new Error('Explicit valid budget, calls, reservation and timeout are required');
        this.limitMicros = Math.floor(options.budgetUSD * 1e6); this.perCallMicros = Math.ceil(options.reservationUSD * 1e6);
    }
    reserve(): boolean {
        if (this.calls >= this.options.maxCalls || this.reservedMicros + this.perCallMicros > this.limitMicros) return false;
        this.calls++; this.reservedMicros += this.perCallMicros; return true;
    }
    get reservedUSD(): number { return this.reservedMicros / 1e6; }
}
