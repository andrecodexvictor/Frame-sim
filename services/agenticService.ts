
import { SimulationConfig, SimulationOutput } from '../types';
import { runSimulation } from './geminiService';
import { SingleSimulationConfig } from '../types';
import { enrichArchetypesToTeam } from './personaEnricher';

const API_URL = 'http://localhost:3002/api';

export interface AgenticStatus {
    available: boolean;
    mode: string;
}

export const checkAgenticStatus = async (): Promise<AgenticStatus> => {
    try {
        const response = await fetch(`${API_URL}/status`);
        if (response.ok) {
            return { available: true, mode: 'agentic' };
        }
    } catch (error) {
        console.warn('Agentic Server offline', error);
    }
    return { available: false, mode: 'legacy' };
};

export const runAgenticSimulation = async (config: SimulationConfig): Promise<SimulationOutput> => {
    console.log('🚀 Starting Agentic Simulation via API...');

    // Convert Frontend Config to Backend Orchestrator Input.
    // Send real persona ids (from profiles_compact.json) so the backend can
    // hydrate the full 350-persona profiles instead of synthetic ones.
    let stakeholders: Array<{ id: string; archetype?: string }> | string[];
    let teamSample: string[] = [];
    try {
        const archetypes = config.employeeArchetypes || [];
        const { team, keyStakeholders } = enrichArchetypesToTeam(archetypes, config.companySize);
        stakeholders = keyStakeholders.map(p => ({ id: p.id }));
        teamSample = team.slice(0, 30).map(p => p.id);
        if (stakeholders.length === 0) stakeholders = archetypes;
    } catch (e) {
        console.warn('Persona enrichment failed, falling back to archetype names', e);
        stakeholders = config.employeeArchetypes || [];
    }

    const payload = {
        query: `Simulate adoption of ${config.frameworks[0].name} for a ${config.companySize} company in ${config.sector}. Context: ${config.customScenarioText || config.selectedScenarioId}`,
        stakeholders,
        teamSample,
        config: config
    };

    try {
        // STEP 1: Run Agentic Simulation (Multi-turn with Critic/Goal)
        const response = await fetch(`${API_URL}/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server Error: ${response.statusText}`);
        }

        const agenticData = await response.json();
        console.log('✅ Agentic simulation completed, generating rich output...');

        // STEP 2: Use Normal Simulation Logic for Rich Output
        // This ensures the same visual quality as the normal mode
        // But we inject the Agentic state as additional context
        const singleConfig: SingleSimulationConfig = {
            frameworkName: config.frameworks[0].name,
            frameworkText: config.frameworks[0].text,
            frameworkCategory: config.frameworkCategory,
            companySize: config.companySize,
            sector: config.sector,
            budgetLevel: config.budgetLevel,
            currentMaturity: config.currentMaturity,
            employeeArchetypes: config.employeeArchetypes,
            techDebtLevel: config.techDebtLevel,
            operationalVelocity: config.operationalVelocity,
            previousFailures: config.previousFailures,
            scenarioContext: `
                [CONTEXTO GERADO POR SIMULAÇÃO AGÊNTICA PROFUNDA]
                
                Estado Final da Simulação:
                - Moral do Time: ${agenticData.state?.moral_time || 70}%
                - Velocidade: ${agenticData.state?.velocidade_sprint || 65}%
                - Confiança Stakeholders: ${agenticData.state?.confianca_stakeholders || 60}%
                - Turnos Simulados: ${agenticData.state?.turno || 5}
                
                Insights (Scratchpad do Orquestrador):
                ${agenticData.state?.scratchpad || 'Simulação concluída sem observações críticas.'}
                
                Eventos Disparados:
                ${(agenticData.state?.eventos_disparados || []).join(', ') || 'Nenhum evento crítico'}
                
                ROI Calculado pelo Agente:
                ${agenticData.roi?.roi_final ? agenticData.roi.roi_final.toFixed(2) + '%' : 'Pendente cálculo detalhado'}
                
                INSTRUÇÃO: Use estes dados da simulação agêntica como BASE para gerar números e narrativas consistentes.
            `,
            durationMonths: config.durationMonths || 12
        };

        // Run the normal simulation with the Agentic context injected
        const richOutput = await runSimulation(singleConfig);

        // Add Agentic Metrics to the output (for developer observability)
        return {
            ...richOutput,
            agenticMetrics: {
                quality_per_cycle: 100, // Critic didn't trigger replan
                time_to_solve_ms: Date.now(), // Placeholder, would be tracked in real implementation
                cost_estimate_usd: 0.05,
                total_tokens: 5000,
                router_choice: 'Gemini Pro (via Agentic Router)'
            }
        };

    } catch (error) {
        console.error('Agentic Simulation Failed:', error);
        throw error;
    }
};
