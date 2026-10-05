
import { SimulationConfig, SimulationOutput } from '../types';
import { presentAgenticResult } from './agenticPresentation';
import { SingleSimulationConfig } from '../types';
import { enrichArchetypesToTeam } from './personaEnricher';
import { hashString } from '../RAG/src/core/employeeBrainCore';
import { commonScenarioSeed } from './experimentProtocol';

const API_URL = (import.meta.env?.VITE_API_URL?.trim() || 'http://localhost:3002/api').replace(/\/$/, '');
const STATUS_TIMEOUT_MS = 4_000;
const SIMULATION_TIMEOUT_MS = 180_000;

export function buildAgenticQueries(config: SimulationConfig): string[] {
    const turns = config.durationMonths ?? 12;
    if (!Number.isInteger(turns) || turns < 1 || turns > 60) throw new Error('Invalid agentic duration');
    if (config.experiment && config.experiment.exogenousSchedule.length !== turns) throw new Error('Agentic duration differs from paired schedule');
    return Array.from({ length: turns }, (_, index) => `Turn ${index + 1}/${turns}: Simulate adoption of ${config.frameworks[0].name} for a ${config.companySize} company in ${config.sector}. Continue the recorded trajectory. Context: ${config.customScenarioText || config.selectedScenarioId || 'recommended'}`);
}

export interface AgenticStatus {
    available: boolean;
    mode: string;
    ready?: boolean;
    degraded?: boolean;
    graph?: string;
    providers?: Record<string, boolean>;
}

export const checkAgenticStatus = async (): Promise<AgenticStatus> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort('timeout'), STATUS_TIMEOUT_MS);
    try {
        const response = await fetch(`${API_URL}/status`, { signal: controller.signal });
        if (response.ok) {
            const status = await response.json().catch(() => ({}));
            return {
                available: status.ready !== false,
                ready: status.ready !== false,
                degraded: Boolean(status.degraded),
                mode: status.mode || 'agentic',
                graph: status.graph,
                providers: status.providers
            };
        }
    } catch (error) {
        console.warn('Agentic Server offline', error);
    } finally {
        window.clearTimeout(timeoutId);
    }
    return { available: false, mode: 'legacy' };
};

export const runAgenticSimulation = async (
    config: SimulationConfig,
    options: { signal?: AbortSignal } = {}
): Promise<SimulationOutput> => {
    console.log('🚀 Starting Agentic Simulation via API...');

    // Convert Frontend Config to Backend Orchestrator Input.
    // Send real persona ids (from profiles_compact.json) so the backend can
    // hydrate the full 350-persona profiles instead of synthetic ones.
    let stakeholders: Array<{ id: string; archetype?: string }> | string[];
    let teamSample: string[] = [];
    const simulationSeed = config.experiment?.scenarioSeed ?? commonScenarioSeed(config);
    try {
        const archetypes = config.employeeArchetypes || [];
        const { team, keyStakeholders } = enrichArchetypesToTeam(archetypes, config.companySize, simulationSeed);
        stakeholders = keyStakeholders.map(p => ({ id: p.id }));
        teamSample = team.slice(0, 30).map(p => p.id);
        if (stakeholders.length === 0) stakeholders = archetypes;
    } catch (e) {
        console.warn('Persona enrichment failed, falling back to archetype names', e);
        stakeholders = config.employeeArchetypes || [];
    }

    const payload = {
        query: buildAgenticQueries(config),
        stakeholders,
        teamSample,
        config: { ...config, simulationSeed }
    };

    const startedAt = Date.now();
    const requestController = new AbortController();
    const abortFromCaller = () => requestController.abort(options.signal?.reason ?? 'cancelled');
    if (options.signal?.aborted) abortFromCaller();
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });
    const requestTimeout = window.setTimeout(() => requestController.abort('timeout'), SIMULATION_TIMEOUT_MS);
    try {
        // STEP 1: Run Agentic Simulation (Multi-turn with Critic/Goal)
        const response = await fetch(`${API_URL}/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: requestController.signal
        });

        if (!response.ok) {
            throw new Error(`Server Error: ${response.statusText}`);
        }

        const agenticData = await response.json();
        console.log('✅ Agentic simulation completed, generating rich output...');

        return presentAgenticResult(agenticData, config);

    } catch (error) {
        console.error('Agentic Simulation Failed:', error);
        throw error;
    } finally {
        window.clearTimeout(requestTimeout);
        options.signal?.removeEventListener('abort', abortFromCaller);
    }
};
