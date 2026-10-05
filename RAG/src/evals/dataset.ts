import { artifactHash } from '../services/RunManifest.js';
import type { EvidenceSource, PersonaTrace } from '../types/evaluation.js';
export interface EvalPrediction { value: number | null; confidence?: number }
export interface PredictionProvenance { method: string; model: string; version: string; createdAt: string; inputHash: string }
export interface EvalCase {
    id: string; split: 'development' | 'calibration' | 'holdout'; cohortId: string; personaId: string;
    source: EvidenceSource; origin: { name: string; license: string; period: string };
    target: { kind: 'numeric' | 'binary' | 'ordinal'; value: number; unit: string };
    input: Record<string, unknown>; prediction?: EvalPrediction;
    predictionOrigin?: PredictionProvenance;
}
export interface EvalDataset { version: string; cases: EvalCase[]; hash: string }
export type PredictorInput = Omit<EvalCase, 'target'> & { target: Omit<EvalCase['target'], 'value'> };
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid dataset object'); return value as Record<string, unknown>; };
const text = (value: unknown): string => { if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw new Error('Missing identity or provenance'); return value; };
export function validateDataset(value: unknown): EvalDataset {
    const root = object(value), version = text(root.version);
    if (!Array.isArray(root.cases) || !root.cases.length || root.cases.length > 100_000) throw new Error('Invalid dataset cases');
    const ids = new Set<string>(), inputs = new Set<string>(), cohorts = new Map<string, string>(), people = new Map<string, string>();
    const cases = root.cases.map((raw): EvalCase => {
        const row = object(raw), origin = object(row.origin), target = object(row.target), input = object(row.input);
        const id = text(row.id), split = text(row.split), cohortId = text(row.cohortId), personaId = text(row.personaId), source = text(row.source);
        if (!['development', 'calibration', 'holdout'].includes(split) || !['synthetic', 'expert_labeled', 'observed'].includes(source) || !['numeric', 'binary', 'ordinal'].includes(String(target.kind)) || typeof target.value !== 'number' || !Number.isFinite(target.value) || (target.kind === 'binary' && target.value !== 0 && target.value !== 1)) throw new Error('Invalid target or split');
        const inputHash = artifactHash(input);
        if (ids.has(id) || inputs.has(inputHash)) throw new Error('Duplicate case identity or input');
        if (cohorts.has(cohortId) && cohorts.get(cohortId) !== split) throw new Error('Cohort crosses splits');
        if (people.has(personaId) && people.get(personaId) !== split) throw new Error('Persona crosses splits');
        ids.add(id); inputs.add(inputHash); cohorts.set(cohortId, split); people.set(personaId, split);
        let prediction: EvalPrediction | undefined, predictionOrigin: PredictionProvenance | undefined;
        if (row.prediction !== undefined) {
            const p = object(row.prediction);
            if (p.value !== null && (typeof p.value !== 'number' || !Number.isFinite(p.value) || (target.kind === 'binary' && (p.value < 0 || p.value > 1)))) throw new Error('Invalid prediction');
            if (p.confidence !== undefined && (typeof p.confidence !== 'number' || !Number.isFinite(p.confidence) || p.confidence < 0 || p.confidence > 1)) throw new Error('Invalid confidence');
            prediction = { value: p.value as number | null, ...(p.confidence === undefined ? {} : { confidence: p.confidence as number }) };
            if (source !== 'synthetic' && !row.predictionOrigin) throw new Error('Missing prediction provenance');
            if (row.predictionOrigin) {
                const provenance = object(row.predictionOrigin);
                if (provenance.inputHash !== inputHash || typeof provenance.createdAt !== 'string' || !Number.isFinite(Date.parse(provenance.createdAt))) throw new Error('Invalid prediction provenance hash or timestamp');
                predictionOrigin = { method: text(provenance.method), model: text(provenance.model), version: text(provenance.version), createdAt: provenance.createdAt, inputHash };
            }
        }
        return { id, split: split as EvalCase['split'], cohortId, personaId, source: source as EvidenceSource, origin: { name: text(origin.name), license: text(origin.license), period: text(origin.period) }, target: { kind: target.kind as EvalCase['target']['kind'], value: target.value, unit: text(target.unit) }, input, ...(prediction ? { prediction } : {}), ...(predictionOrigin ? { predictionOrigin } : {}) };
    });
    return { version, cases, hash: artifactHash({ version, cases }) };
}
export function tracesFromCase(item: Pick<EvalCase, 'input'>): PersonaTrace[] | null {
    return Array.isArray(item.input.traces) ? item.input.traces as PersonaTrace[] : null;
}
