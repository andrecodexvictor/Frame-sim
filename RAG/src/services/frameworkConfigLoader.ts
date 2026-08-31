import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_FRAMEWORK_CONFIG_PATH = fileURLToPath(new URL('../../framework_config.json', import.meta.url));

export interface FrameworkRitual {
    name: string;
    cadence: string;
    purpose: string;
}

export interface FrameworkRiskRule {
    id: string;
    trigger: string;
    impact: string;
}

export interface FrameworkConfig {
    id: string;
    name: string;
    version: string;
    category: string;
    description: string;
    roles: string[];
    rituals: FrameworkRitual[];
    artifacts: string[];
    metrics: string[];
    riskRules: FrameworkRiskRule[];
}

export interface FrameworkConfigDocument {
    version: string;
    frameworks: FrameworkConfig[];
}

export class FrameworkConfigValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FrameworkConfigValidationError';
    }
}

function text(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new FrameworkConfigValidationError(`${field} must be a non-empty string`);
    }
    return value.trim();
}

function stringList(value: unknown, field: string): string[] {
    if (!Array.isArray(value) || value.length === 0) {
        throw new FrameworkConfigValidationError(`${field} must be a non-empty array`);
    }
    return value.map((item, index) => text(item, `${field}[${index}]`));
}

function object(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new FrameworkConfigValidationError(`${field} must be an object`);
    }
    return value as Record<string, unknown>;
}

function parseFramework(value: unknown, index: number): FrameworkConfig {
    const item = object(value, `frameworks[${index}]`);
    const ritualsValue = item.rituals;
    if (!Array.isArray(ritualsValue) || ritualsValue.length === 0) {
        throw new FrameworkConfigValidationError(`frameworks[${index}].rituals must be a non-empty array`);
    }
    const rituals = ritualsValue.map((raw, ritualIndex) => {
        const ritual = object(raw, `frameworks[${index}].rituals[${ritualIndex}]`);
        return {
            name: text(ritual.name, `frameworks[${index}].rituals[${ritualIndex}].name`),
            cadence: text(ritual.cadence, `frameworks[${index}].rituals[${ritualIndex}].cadence`),
            purpose: text(ritual.purpose, `frameworks[${index}].rituals[${ritualIndex}].purpose`),
        };
    });
    const risksValue = item.riskRules;
    if (!Array.isArray(risksValue) || risksValue.length === 0) {
        throw new FrameworkConfigValidationError(`frameworks[${index}].riskRules must be a non-empty array`);
    }
    const riskRules = risksValue.map((raw, riskIndex) => {
        const risk = object(raw, `frameworks[${index}].riskRules[${riskIndex}]`);
        return {
            id: text(risk.id, `frameworks[${index}].riskRules[${riskIndex}].id`),
            trigger: text(risk.trigger, `frameworks[${index}].riskRules[${riskIndex}].trigger`),
            impact: text(risk.impact, `frameworks[${index}].riskRules[${riskIndex}].impact`),
        };
    });
    return {
        id: text(item.id, `frameworks[${index}].id`).toLowerCase(),
        name: text(item.name, `frameworks[${index}].name`),
        version: text(item.version, `frameworks[${index}].version`),
        category: text(item.category, `frameworks[${index}].category`),
        description: text(item.description, `frameworks[${index}].description`),
        roles: stringList(item.roles, `frameworks[${index}].roles`),
        rituals,
        artifacts: stringList(item.artifacts, `frameworks[${index}].artifacts`),
        metrics: stringList(item.metrics, `frameworks[${index}].metrics`),
        riskRules,
    };
}

export function validateFrameworkConfig(input: unknown): FrameworkConfigDocument {
    const document = object(input, 'framework config');
    const version = text(document.version, 'version');
    if (!Array.isArray(document.frameworks) || document.frameworks.length === 0) {
        throw new FrameworkConfigValidationError('frameworks must be a non-empty array');
    }
    const frameworks = document.frameworks.map(parseFramework);
    const ids = new Set<string>();
    for (const framework of frameworks) {
        if (ids.has(framework.id)) throw new FrameworkConfigValidationError(`duplicate framework id: ${framework.id}`);
        ids.add(framework.id);
    }
    return { version, frameworks };
}

export function loadFrameworkConfig(filePath = DEFAULT_FRAMEWORK_CONFIG_PATH): FrameworkConfigDocument {
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new FrameworkConfigValidationError(`unable to read framework config: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return validateFrameworkConfig(parsed);
}
