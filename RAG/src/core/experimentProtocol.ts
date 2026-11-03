import { hashString, mulberry32 } from './employeeBrainCore.js';

export interface ExogenousShock {
    turnId: number;
    pressureDelta: number;
    demandMultiplier: number;
    incidentUniform: number;
    source: 'synthetic';
}
export interface ExperimentAssignment {
    protocolVersion: 'paired-v1';
    experimentId: string;
    replicaId: string;
    scenarioId: string;
    scenarioSeed: number;
    interventionId: string;
    conditionId: string;
    conditionIndex?: number;
    memoryPolicy: 'isolated';
    exogenousSchedule: ExogenousShock[];
}
export interface ScenarioDefinition {
    seed?: number;
    companySize?: number;
    sector?: string;
    budgetLevel?: string;
    currentMaturity?: number;
    employeeArchetypes?: readonly string[];
    techDebtLevel?: string;
    operationalVelocity?: string;
    previousFailures?: boolean;
    scenarioMode?: string;
    selectedScenarioId?: string;
    customScenarioText?: string;
    scenarioContext?: string;
    durationMonths?: number;
    economicScenarioId?: string;
    economicProfileId?: string;
    frameworks?: unknown;
}

/** One RNG per causal mechanism/address. Drawing more in one mechanism cannot shift another. */
export const addressedRandom = (seed: number, personaId: string, turnId: number, mechanism: string) => mulberry32(hashString(JSON.stringify([seed, personaId, turnId, mechanism])));
export function commonScenarioSeed(config: ScenarioDefinition): number {
    if (config.seed !== undefined) {
        if (!Number.isSafeInteger(config.seed)) throw new Error('Invalid scenario seed');
        return config.seed >>> 0;
    }
    return hashString(JSON.stringify([config.companySize, config.sector, config.budgetLevel, config.currentMaturity, [...(config.employeeArchetypes ?? [])].sort(), config.techDebtLevel, config.operationalVelocity, config.previousFailures,
        config.scenarioMode === 'custom' ? config.customScenarioText : config.selectedScenarioId || config.scenarioContext,
        config.durationMonths, config.economicScenarioId, config.economicProfileId]));
}
export function createExperimentAssignment(config: ScenarioDefinition, identity: { experimentId: string; replicaId: string; interventionId: string; conditionId?: string }): ExperimentAssignment {
    if (![identity.experimentId, identity.replicaId, identity.interventionId].every(value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160)) throw new Error('Invalid experiment identity');
    const scenarioSeed = hashString(`${commonScenarioSeed(config)}:replica:${identity.replicaId}`);
    const months = config.durationMonths ?? 12;
    if (!Number.isInteger(months) || months < 1 || months > 60) throw new Error('Invalid experiment duration');
    return { protocolVersion: 'paired-v1', ...identity, conditionId: identity.conditionId ?? identity.interventionId,
        scenarioId: config.scenarioMode === 'custom' ? config.customScenarioText || 'custom' : config.selectedScenarioId || config.scenarioContext || 'recommended',
        scenarioSeed, memoryPolicy: 'isolated',
        exogenousSchedule: Array.from({ length: months }, (_, index) => ({ turnId: index + 1,
            pressureDelta: (addressedRandom(scenarioSeed, 'environment', index + 1, 'pressure')() - 0.5) * 0.1,
            demandMultiplier: 0.9 + addressedRandom(scenarioSeed, 'environment', index + 1, 'demand')() * 0.2,
            incidentUniform: addressedRandom(scenarioSeed, 'environment', index + 1, 'incident')(), source: 'synthetic' })),
    };
}

/** Validate and whitelist the protocol at the HTTP boundary. */
export function validateExperimentAssignment(value: unknown): ExperimentAssignment {
    const object = (input: unknown): Record<string, unknown> => { if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid experiment protocol'); return input as Record<string, unknown>; };
    const input = object(value);
    if (input.conditionIndex !== undefined && (!Number.isSafeInteger(input.conditionIndex) || Number(input.conditionIndex) < 0)) throw new Error('Invalid condition order');
    const identity = (key: string, max = 160) => { const item = input[key]; if (typeof item !== 'string' || !item.trim() || item.length > max) throw new Error('Invalid experiment identity'); return item; };
    if (input.protocolVersion !== 'paired-v1' || input.memoryPolicy !== 'isolated' || !Number.isSafeInteger(input.scenarioSeed) || Number(input.scenarioSeed) < 0 || Number(input.scenarioSeed) > 0xffffffff || !Array.isArray(input.exogenousSchedule) || input.exogenousSchedule.length < 1 || input.exogenousSchedule.length > 60) throw new Error('Invalid experiment protocol');
    const schedule = input.exogenousSchedule.map((value, index): ExogenousShock => {
        const shock = object(value);
        if (shock.turnId !== index + 1 || shock.source !== 'synthetic' || typeof shock.pressureDelta !== 'number' || !Number.isFinite(shock.pressureDelta) || Math.abs(shock.pressureDelta) > 0.5 || typeof shock.demandMultiplier !== 'number' || !Number.isFinite(shock.demandMultiplier) || shock.demandMultiplier <= 0 || shock.demandMultiplier > 2 || typeof shock.incidentUniform !== 'number' || !Number.isFinite(shock.incidentUniform) || shock.incidentUniform < 0 || shock.incidentUniform >= 1) throw new Error('Invalid exogenous schedule');
        return { turnId: index + 1, source: 'synthetic', pressureDelta: shock.pressureDelta, demandMultiplier: shock.demandMultiplier, incidentUniform: shock.incidentUniform };
    });
    return { protocolVersion: 'paired-v1', memoryPolicy: 'isolated', experimentId: identity('experimentId'), replicaId: identity('replicaId'), scenarioId: identity('scenarioId', 20_000), interventionId: identity('interventionId'), conditionId: identity('conditionId'), scenarioSeed: Number(input.scenarioSeed), exogenousSchedule: schedule, ...(input.conditionIndex === undefined ? {} : { conditionIndex: Number(input.conditionIndex) }) };
}
