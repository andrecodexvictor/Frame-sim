/**
 * Offline contract for future external tools.
 * The stub intentionally never performs network I/O or echoes request payloads.
 */
export const EXTERNAL_TOOL_CONTRACT = 'framesim.external-tool/v1';

export type ExternalToolName = 'market-signal' | 'cost-estimate' | 'risk-check';

export interface ExternalToolRequest {
    tool: ExternalToolName;
    input: Record<string, unknown>;
    seed?: number;
}

export interface ExternalToolResponse {
    contract: typeof EXTERNAL_TOOL_CONTRACT;
    tool: ExternalToolName;
    ok: true;
    offline: true;
    seed: number;
    result: Record<string, string | number | boolean>;
    warnings: string[];
}

export class ExternalToolContractError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExternalToolContractError';
    }
}

function stableValue(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
    if (typeof value === 'object') {
        return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stableValue((value as Record<string, unknown>)[key])}`).join(',')}}`;
    }
    return JSON.stringify(String(value));
}

function hash(input: string): number {
    let result = 2166136261;
    for (let index = 0; index < input.length; index++) {
        result ^= input.charCodeAt(index);
        result = Math.imul(result, 16777619);
    }
    return result >>> 0;
}

function unit(seed: number, input: Record<string, unknown>): number {
    return hash(`${seed >>> 0}:${stableValue(input)}`) / 0x100000000;
}

function normaliseSeed(seed: unknown): number {
    return typeof seed === 'number' && Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
}

export class ExternalToolStub {
    execute(request: ExternalToolRequest): ExternalToolResponse {
        if (!request || !['market-signal', 'cost-estimate', 'risk-check'].includes(request.tool)) {
            throw new ExternalToolContractError('tool must be a supported external tool name');
        }
        if (!request.input || typeof request.input !== 'object' || Array.isArray(request.input)) {
            throw new ExternalToolContractError('input must be a JSON object');
        }
        const seed = normaliseSeed(request.seed);
        const value = unit(seed, request.input);
        let result: ExternalToolResponse['result'];
        const confidence = Math.round((0.55 + value * 0.4) * 100) / 100;
        if (request.tool === 'market-signal') {
            result = {
                signal: value < 0.33 ? 'recession' : value < 0.66 ? 'base' : 'expansion',
                confidence,
            };
        } else if (request.tool === 'cost-estimate') {
            result = { costMultiplier: Math.round((0.8 + value * 0.5) * 1000) / 1000, confidence };
        } else {
            result = { riskScore: Math.round(value * 100), confidence };
        }
        return {
            contract: EXTERNAL_TOOL_CONTRACT,
            tool: request.tool,
            ok: true,
            offline: true,
            seed,
            result,
            warnings: ['offline deterministic stub; replace with an approved adapter before production use'],
        };
    }
}
