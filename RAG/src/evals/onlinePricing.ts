import type { OnlinePlan } from './protocol.js';
export interface OnlinePricing { version: string; reviewedAt: string; providers: Array<{ provider: string; model: string; source: string; verified: boolean; maximumRequestUSD: number; maximumInputBytes: number; maximumOutputTokens: number }> }
/** Operator-reviewed ceilings, not a live billing meter. Missing or stale model pricing cannot authorize a request. */
export function validatePricing(value: OnlinePricing | undefined, plan: OnlinePlan, limits: { reservationUSD: number; maxOutputTokens: number; maxInputBytes: number }, models: Record<string, string>) {
    if (!value || !value.version || !Number.isFinite(Date.parse(value.reviewedAt)) || !Array.isArray(value.providers)) throw new Error('Verified versioned pricing is required for remote execution');
    for (const provider of new Set(plan.trials.flatMap(row => [row.generator, row.judge]))) {
        const price = value.providers.find(row => row.provider === provider && row.model === models[provider]);
        if (!price || !price.verified || !/^https:\/\//.test(price.source) || !Number.isFinite(price.maximumRequestUSD) || price.maximumRequestUSD <= 0 || price.maximumRequestUSD > limits.reservationUSD || !Number.isInteger(price.maximumInputBytes) || price.maximumInputBytes < limits.maxInputBytes || !Number.isInteger(price.maximumOutputTokens) || price.maximumOutputTokens < limits.maxOutputTokens) throw new Error(`Invalid or insufficient pricing ceiling for ${provider}`);
    }
    return value;
}
