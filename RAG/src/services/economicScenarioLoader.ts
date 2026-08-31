import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_COST_PROFILES_PATH = fileURLToPath(new URL('../../cost_profiles.md', import.meta.url));

export type EconomicScenarioId = 'recession' | 'base' | 'expansion' | string;

export interface EconomicScenario {
    id: EconomicScenarioId;
    label: string;
    demandMultiplier: number;
    laborCostMultiplier: number;
    budgetMultiplier: number;
    incidentMultiplier: number;
    uncertainty: string;
}

export class EconomicScenarioValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EconomicScenarioValidationError';
    }
}

const REQUIRED_COLUMNS = ['id', 'label', 'demand_multiplier', 'labor_cost_multiplier', 'budget_multiplier', 'incident_multiplier', 'uncertainty'];

function number(value: string, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 5) {
        throw new EconomicScenarioValidationError(`${field} must be a finite number between (0, 5]`);
    }
    return parsed;
}

function cleanCell(value: string): string {
    return value.trim().replace(/^`|`$/g, '');
}

/** Parse the stable table format in cost_profiles.md without a Markdown dependency. */
export function parseEconomicScenarios(markdown: string): EconomicScenario[] {
    if (typeof markdown !== 'string' || markdown.trim().length === 0) {
        throw new EconomicScenarioValidationError('cost profile document must be non-empty');
    }
    const lines = markdown.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const tableLine = lines.find(line => line.startsWith('|') && line.toLowerCase().includes('| id |'));
    if (!tableLine) throw new EconomicScenarioValidationError('cost profile table header not found');
    const header = tableLine.split('|').slice(1, -1).map(cleanCell);
    if (REQUIRED_COLUMNS.some((column, index) => header[index] !== column)) {
        throw new EconomicScenarioValidationError(`cost profile columns must be: ${REQUIRED_COLUMNS.join(', ')}`);
    }
    const headerIndex = lines.indexOf(tableLine);
    const scenarios: EconomicScenario[] = [];
    for (const line of lines.slice(headerIndex + 1)) {
        if (!line.startsWith('|') || /^\|\s*:?-+/.test(line)) continue;
        const cells = line.split('|').slice(1, -1).map(cleanCell);
        if (cells.length !== REQUIRED_COLUMNS.length) continue;
        const id = cells[0].toLowerCase();
        if (!/^[a-z][a-z0-9-]{1,31}$/.test(id)) throw new EconomicScenarioValidationError(`invalid scenario id: ${cells[0]}`);
        if (scenarios.some(scenario => scenario.id === id)) throw new EconomicScenarioValidationError(`duplicate scenario id: ${id}`);
        if (!cells[1] || !cells[6]) throw new EconomicScenarioValidationError(`scenario ${id} needs label and uncertainty`);
        scenarios.push({
            id,
            label: cells[1],
            demandMultiplier: number(cells[2], `${id}.demand_multiplier`),
            laborCostMultiplier: number(cells[3], `${id}.labor_cost_multiplier`),
            budgetMultiplier: number(cells[4], `${id}.budget_multiplier`),
            incidentMultiplier: number(cells[5], `${id}.incident_multiplier`),
            uncertainty: cells[6],
        });
    }
    if (scenarios.length === 0) throw new EconomicScenarioValidationError('no economic scenarios found');
    return scenarios;
}

export function loadEconomicScenarios(filePath = DEFAULT_COST_PROFILES_PATH): EconomicScenario[] {
    try {
        return parseEconomicScenarios(readFileSync(filePath, 'utf8'));
    } catch (error) {
        if (error instanceof EconomicScenarioValidationError) throw error;
        throw new EconomicScenarioValidationError(`unable to read cost profiles: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
}

function hashSeed(seed: number): number {
    let value = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x45d9f3b);
    value ^= value >>> 16;
    return Math.imul(value, 0x45d9f3b) >>> 0;
}

/** Deterministically choose a scenario. The input order is preserved and never shuffled. */
export function selectEconomicScenario(scenarios: EconomicScenario[], seed = 0): EconomicScenario {
    if (!Array.isArray(scenarios) || scenarios.length === 0) throw new EconomicScenarioValidationError('scenarios must be non-empty');
    const index = hashSeed(seed) % scenarios.length;
    return scenarios[index];
}
