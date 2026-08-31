import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface SimulationRule {
    id: string;
    description: string;
    metric: 'roi_final';
    operator: 'greater_than' | 'less_than';
    value: number;
    maxPlausibility: number;
}

export interface SimulationRules {
    version: number;
    plausibilityThreshold: number;
    rules: SimulationRule[];
}

let cachedRules: SimulationRules | undefined;

function validate(raw: unknown): SimulationRules {
    if (!raw || typeof raw !== 'object') throw new Error('simulation rules must be an object');
    const value = raw as Partial<SimulationRules>;
    if (!Number.isInteger(value.version) || Number(value.version) < 1) throw new Error('simulation rules version is invalid');
    if (!Number.isFinite(value.plausibilityThreshold)
        || Number(value.plausibilityThreshold) < 0
        || Number(value.plausibilityThreshold) > 100) {
        throw new Error('plausibilityThreshold must be between 0 and 100');
    }
    if (!Array.isArray(value.rules)) throw new Error('simulation rules list is invalid');
    const rules = value.rules.map((rule, index) => {
        if (!rule || typeof rule !== 'object') throw new Error(`simulation rule ${index} is invalid`);
        const candidate = rule as Partial<SimulationRule>;
        if (!candidate.id?.trim() || !candidate.description?.trim()) throw new Error(`simulation rule ${index} lacks identity`);
        if (candidate.metric !== 'roi_final') throw new Error(`simulation rule ${candidate.id} has an unsupported metric`);
        if (candidate.operator !== 'greater_than' && candidate.operator !== 'less_than') throw new Error(`simulation rule ${candidate.id} has an unsupported operator`);
        if (!Number.isFinite(candidate.value) || !Number.isFinite(candidate.maxPlausibility)
            || Number(candidate.maxPlausibility) < 0 || Number(candidate.maxPlausibility) > 100) {
            throw new Error(`simulation rule ${candidate.id} has invalid bounds`);
        }
        return candidate as SimulationRule;
    });
    return {
        version: Number(value.version),
        plausibilityThreshold: Number(value.plausibilityThreshold),
        rules
    };
}

export function loadSimulationRules(): SimulationRules {
    if (cachedRules) return cachedRules;
    const candidates = [
        path.join(process.cwd(), 'simulation_rules.json'),
        path.join(process.cwd(), 'RAG', 'simulation_rules.json')
    ];
    for (const candidate of candidates) {
        try {
            cachedRules = validate(JSON.parse(readFileSync(candidate, 'utf8')));
            return cachedRules;
        } catch (error) {
            if (error instanceof SyntaxError) throw new Error(`simulation rules JSON is malformed: ${error.message}`);
        }
    }
    throw new Error('simulation_rules.json was not found');
}

export function applySimulationRules(
    rules: SimulationRules,
    metrics: { roi_final?: unknown },
    proposedScore: number
): { score: number; triggered: string[] } {
    let score = Math.max(0, Math.min(100, Number.isFinite(proposedScore) ? proposedScore : 0));
    const roi = Number(metrics.roi_final);
    const triggered: string[] = [];
    if (!Number.isFinite(roi)) return { score, triggered };
    for (const rule of rules.rules) {
        const matches = rule.operator === 'greater_than' ? roi > rule.value : roi < rule.value;
        if (!matches) continue;
        score = Math.min(score, rule.maxPlausibility);
        triggered.push(rule.id);
    }
    return { score, triggered };
}
