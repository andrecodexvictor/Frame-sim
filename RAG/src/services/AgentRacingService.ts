/**
 * AgentRacingService - Executa múltiplos agentes em paralelo e seleciona o melhor
 * 
 * Implementa competição entre agentes com diferentes configurações
 * (temperatura, persona, modelo) para encontrar o resultado mais plausível.
 */

import type {
    RacingConfig,
    AgentConfig,
    AgentResult,
    RaceResult,
    EnsembleResult,
    RacingMetrics,
    OptimizedParameters
} from '../types/index.js';
import { CriticAgent } from '../agents/CriticAgent.js';

export class AgentRacingService {
    private agents: AgentConfig[] = [];
    private criticAgent: CriticAgent;

    constructor() {
        this.criticAgent = new CriticAgent();
    }

    /**
     * Configura N agentes com parâmetros diversos
     */
    setupAgents(config: RacingConfig): void {
        this.agents = [];

        const personas = [
            'CFO_Conservador',
            'CTO_Otimista',
            'COO_Pragmatico',
            'CEO_Visionario',
            'HR_Cauteloso'
        ];

        const temperatures = [0.3, 0.5, 0.7, 0.9, 1.0];
        const models = ['gemini-2.5-flash', 'gemini-1.5-pro'];

        for (let i = 0; i < config.numAgents; i++) {
            this.agents.push({
                id: `agent_${i + 1}`,
                temperature: config.diversityMode === 'temperature' || config.diversityMode === 'full'
                    ? temperatures[i % temperatures.length]
                    : 0.6,
                model: config.diversityMode === 'model' || config.diversityMode === 'full'
                    ? models[i % models.length]
                    : 'gemini-2.5-flash',
                persona: config.diversityMode === 'persona' || config.diversityMode === 'full'
                    ? personas[i % personas.length]
                    : 'Balanced'
            });
        }

        console.log(`🏁 ${this.agents.length} agents configured for racing`);
        this.agents.forEach(a => console.log(`   ${a.id}: ${a.persona}, T=${a.temperature}`));
    }

    /**
     * Executa corrida de agentes em paralelo
     */
    async race(
        simulationFn: (agent: AgentConfig, optimalParams?: OptimizedParameters) => Promise<any>,
        racingConfig: RacingConfig,
        optimalParams?: OptimizedParameters
    ): Promise<RaceResult> {
        console.log(`\n⚔️ AGENT RACING: ${this.agents.length} agents competing...`);

        const startTime = Date.now();

        // Disparar todos em paralelo com timeout
        const racePromises = this.agents.map(agent =>
            this.runAgentWithTimeout(agent, simulationFn, racingConfig.timeout, optimalParams)
        );

        const allResults = await Promise.all(racePromises);
        const successfulResults = allResults.filter(r => r.success && r.critiqueScore > 0);

        console.log(`\n📊 Race Results:`);
        successfulResults.forEach(r => {
            console.log(`   ${r.agentId} (${r.agentConfig.persona}): Score=${r.critiqueScore}, Time=${r.duration}ms`);
        });

        // Selecionar vencedor baseado na estratégia
        const winner = this.selectWinner(successfulResults, racingConfig.selectionStrategy);
        const ensemble = racingConfig.selectionStrategy === 'ensemble'
            ? this.buildEnsemble(successfulResults)
            : undefined;

        const metrics: RacingMetrics = {
            totalDuration: Date.now() - startTime,
            agentsCompleted: successfulResults.length,
            agentsFailed: allResults.length - successfulResults.length,
            averageScore: this.calculateAverage(successfulResults.map(r => r.critiqueScore)),
            scoreVariance: this.calculateVariance(successfulResults.map(r => r.critiqueScore))
        };

        console.log(`\n🏆 Winner: ${winner.agentId} with score ${winner.critiqueScore}`);

        return {
            winner,
            allResults,
            ensemble,
            metrics
        };
    }

    /**
     * Executa um agente com timeout
     */
    private async runAgentWithTimeout(
        agent: AgentConfig,
        simulationFn: (agent: AgentConfig, optimalParams?: OptimizedParameters) => Promise<any>,
        timeout: number,
        optimalParams?: OptimizedParameters
    ): Promise<AgentResult> {
        const startTime = Date.now();

        try {
            const result = await Promise.race([
                simulationFn(agent, optimalParams),
                this.createTimeout(timeout)
            ]);

            if (result === 'TIMEOUT') {
                throw new Error('Agent timed out');
            }

            // Criticar resultado
            const critique = await this.criticAgent.critique(
                result,
                `Agent ${agent.id} (${agent.persona}), temperature=${agent.temperature}`
            );

            return {
                agentId: agent.id,
                agentConfig: agent,
                result,
                critiqueScore: critique.plausibilityScore,
                duration: Date.now() - startTime,
                success: true
            };

        } catch (error) {
            return {
                agentId: agent.id,
                agentConfig: agent,
                result: null,
                critiqueScore: 0,
                duration: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private createTimeout(ms: number): Promise<'TIMEOUT'> {
        return new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), ms));
    }

    /**
     * Seleciona vencedor baseado na estratégia
     */
    private selectWinner(results: AgentResult[], strategy: string): AgentResult {
        if (results.length === 0) {
            throw new Error('No successful results to select winner from');
        }

        switch (strategy) {
            case 'best':
                return results.reduce((best, r) =>
                    r.critiqueScore > best.critiqueScore ? r : best
                );

            case 'weighted':
                // Seleciona aleatoriamente ponderado pelo score
                const totalScore = results.reduce((sum, r) => sum + r.critiqueScore, 0);
                let random = Math.random() * totalScore;
                for (const r of results) {
                    random -= r.critiqueScore;
                    if (random <= 0) return r;
                }
                return results[0];

            default:
                return results[0];
        }
    }

    /**
     * Constrói resultado ensemble (média ponderada)
     */
    private buildEnsemble(results: AgentResult[]): EnsembleResult {
        const totalWeight = results.reduce((sum, r) => sum + r.critiqueScore, 0);

        const weightedROI = results.reduce((sum, r) => {
            const weight = r.critiqueScore / totalWeight;
            return sum + (r.result?.summary?.totalRoi || 0) * weight;
        }, 0);

        const weightedAdoption = results.reduce((sum, r) => {
            const weight = r.critiqueScore / totalWeight;
            return sum + (r.result?.summary?.finalAdoption || 0) * weight;
        }, 0);

        return {
            weightedROI,
            weightedAdoption,
            confidence: this.calculateAverage(results.map(r => r.critiqueScore)),
            contributingAgents: results.map(r => r.agentId)
        };
    }

    private calculateAverage(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }

    private calculateVariance(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        const avg = this.calculateAverage(numbers);
        const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
        return this.calculateAverage(squareDiffs);
    }
}

// Export singleton
export const agentRacingService = new AgentRacingService();
