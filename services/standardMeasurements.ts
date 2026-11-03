import type { SingleSimulationConfig, SimulationOutput } from '../types';
import { calculateMonthlyMetrics, type SimulationRawData } from './metricsCalculator';
import { addressedRandom } from './experimentProtocol';
const numeric = (value: unknown, min = -Infinity, max = Infinity): number | null => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function normalizeStandardMeasurements(value: unknown, config: SingleSimulationConfig, seed: number): { summary: SimulationOutput['summary']; timeline: SimulationOutput['timeline']; missingFields: string[] } {
    const root = object(value), summary = object(root.summary), missingFields: string[] = [];
    const months = config.durationMonths ?? 12, points = new Map<number, Record<string, unknown>>();
    for (const raw of Array.isArray(root.timeline) ? root.timeline : []) {
        const point = object(raw), month = numeric(point.month, 1, months);
        if (month === null || !Number.isInteger(month)) throw new Error('Invalid timeline month');
        if (points.has(month)) throw new Error('Duplicate timeline month');
        points.set(month, point);
    }
    let accumulatedValue = 0, accumulatedOpEx = 0, accumulatedCoNQ = 0, cumulativeAvailable = true;
    const timeline: SimulationOutput['timeline'] = Array.from({ length: months }, (_, index) => {
        const month = index + 1, point = points.get(month) ?? {}, raw = object(point.rawData);
        const validRaw = ['featuresDelivered', 'bugsGenerated', 'criticalIncidents', 'teamSize', 'learningCurveFactor'].every(key => numeric(raw[key], 0) !== null) && Number(raw.teamSize) > 0;
        if (!validRaw) { cumulativeAvailable = false; missingFields.push(`Financial inputs unavailable at month ${month}.`); }
        let roi: number | null = null;
        if (validRaw && cumulativeAvailable) {
            const calculated = calculateMonthlyMetrics({ ...raw, month } as unknown as SimulationRawData, config as any, accumulatedValue, accumulatedOpEx, accumulatedCoNQ, addressedRandom(seed, 'environment', month, 'financial-surprise'));
            accumulatedValue += calculated.valueDelivered; accumulatedOpEx += calculated.opEx; accumulatedCoNQ += calculated.conq;
            roi = numeric(calculated.accumulatedRoi);
        }
        return { month, adoptionRate: numeric(point.adoptionRate, 0, 100), compliance: numeric(point.compliance, 0, 100), efficiency: numeric(point.efficiency, 0), roi, ...(validRaw ? { rawData: raw as unknown as NonNullable<SimulationOutput['timeline'][number]['rawData']> } : {}) };
    });
    const scenarioValidity = numeric(summary.scenarioValidity, 0, 100);
    const normalized = { finalAdoption: numeric(summary.finalAdoption, 0, 100), maturityScore: numeric(summary.maturityScore, 0, 10), monthsToComplete: numeric(summary.monthsToComplete, 0), totalRoi: cumulativeAvailable && accumulatedOpEx > 0 ? (accumulatedValue - accumulatedCoNQ - accumulatedOpEx) / accumulatedOpEx * 100 : null, ...(scenarioValidity === null ? {} : { scenarioValidity }) };
    return { timeline, summary: normalized, missingFields };
}
