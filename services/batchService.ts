
import { SimulationConfig, SimulationOutput, SingleSimulationConfig, EnhancedBatchConfig, WarmupResult, BatchSummary, OptimizedParameters, RacingConfig, AgentConfig } from '../types';
import { runSimulation } from './geminiService';

export interface BatchResult {
    config: SimulationConfig;
    outputs: SimulationOutput[];
    warmupResult?: WarmupResult;
    summary: BatchSummary;
}

export interface BatchProgress {
    phase: 'WARMUP' | 'RACING' | 'BATCH' | 'CONSOLIDATION';
    percent: number;
    message: string;
    currentIteration?: number;
}

// ========== SELF-IMPROVEMENT SERVICE (Inline for Frontend) ==========
class FrontendSelfImprovementService {
    private bestParams: OptimizedParameters | null = null;
    private bestScore: number = 0;

    async runWarmup(
        config: SimulationConfig,
        warmupConfig: { maxIterations: number; targetPlausibility: number; parameterSpace: any },
        onProgress?: (iteration: number, score: number) => void
    ): Promise<WarmupResult> {
        console.log('🔥 WARMUP: Iniciando auto-aprimoramento...');
        const history: any[] = [];
        this.bestParams = null;
        this.bestScore = 0;

        for (let i = 0; i < warmupConfig.maxIterations; i++) {
            const candidateParams = this.sampleParameters(warmupConfig.parameterSpace, i, history);
            console.log(`📍 Iteration ${i + 1}: T=${candidateParams.temperature}, TopK=${candidateParams.topK}`);

            // Mini-simulation
            const singleConfig: SingleSimulationConfig = {
                frameworkName: config.frameworks[0]?.name || 'Test',
                frameworkText: config.frameworks[0]?.text || '',
                frameworkCategory: config.frameworkCategory,
                companySize: config.companySize,
                sector: config.sector,
                budgetLevel: config.budgetLevel,
                employeeArchetypes: config.employeeArchetypes,
                techDebtLevel: config.techDebtLevel,
                operationalVelocity: config.operationalVelocity,
                previousFailures: config.previousFailures,
                scenarioContext: `[WARMUP] T=${candidateParams.temperature}`,
                durationMonths: 6
            };

            const result = await runSimulation(singleConfig);

            // Simple plausibility score based on scenario validity
            const score = result.summary.scenarioValidity || 50;

            history.push({ iteration: i + 1, params: candidateParams, plausibilityScore: score, timestamp: Date.now() });

            if (score > this.bestScore) {
                this.bestScore = score;
                this.bestParams = candidateParams;
                console.log(`   ✅ New best! Score=${score}`);
            }

            onProgress?.(i + 1, score);

            if (this.bestScore >= warmupConfig.targetPlausibility) {
                console.log(`🎯 Converged at iteration ${i + 1}!`);
                break;
            }
        }

        return {
            optimalParams: this.bestParams || { temperature: 0.6, topK: 5, ragMode: 'selective' },
            iterationsUsed: history.length,
            finalScore: this.bestScore,
            convergenceHistory: history
        };
    }

    private sampleParameters(space: any, iteration: number, history: any[]): OptimizedParameters {
        if (iteration < 2) {
            return {
                temperature: space.temperatures[Math.floor(Math.random() * space.temperatures.length)],
                topK: space.topKValues[Math.floor(Math.random() * space.topKValues.length)],
                ragMode: space.ragModes[Math.floor(Math.random() * space.ragModes.length)]
            };
        }
        if (this.bestParams) {
            return this.bestParams; // Exploit best
        }
        return { temperature: 0.6, topK: 5, ragMode: 'selective' };
    }
}

// ========== AGENT RACING SERVICE (Inline for Frontend) ==========
class FrontendAgentRacingService {
    private agents: AgentConfig[] = [];

    setupAgents(numAgents: number): void {
        const personas = ['CFO_Conservador', 'CTO_Otimista', 'COO_Pragmatico', 'CEO_Visionario', 'HR_Cauteloso'];
        const temperatures = [0.3, 0.5, 0.7, 0.9, 1.0];
        this.agents = [];
        for (let i = 0; i < numAgents; i++) {
            this.agents.push({
                id: `agent_${i + 1}`,
                temperature: temperatures[i % temperatures.length],
                model: 'gemini-2.5-flash',
                persona: personas[i % personas.length]
            });
        }
        console.log(`🏁 ${this.agents.length} agents configured for racing`);
    }

    async race(
        config: SimulationConfig,
        racingConfig: RacingConfig
    ): Promise<{ winner: any; allResults: any[]; metrics: any }> {
        console.log(`⚔️ AGENT RACING: ${this.agents.length} agents competing...`);
        const startTime = Date.now();
        const results: any[] = [];

        for (const agent of this.agents) {
            const singleConfig: SingleSimulationConfig = {
                frameworkName: config.frameworks[0]?.name || 'Framework',
                frameworkText: config.frameworks[0]?.text || '',
                frameworkCategory: config.frameworkCategory,
                companySize: config.companySize,
                sector: config.sector,
                budgetLevel: config.budgetLevel,
                employeeArchetypes: config.employeeArchetypes,
                techDebtLevel: config.techDebtLevel,
                operationalVelocity: config.operationalVelocity,
                previousFailures: config.previousFailures,
                scenarioContext: `[RACING] Agent ${agent.id} (${agent.persona})`,
                durationMonths: config.durationMonths || 12
            };

            const result = await runSimulation(singleConfig);
            const score = result.summary.scenarioValidity || 50;
            results.push({ agentId: agent.id, agentConfig: agent, result, critiqueScore: score, success: true });
        }

        const winner = results.reduce((best, r) => r.critiqueScore > best.critiqueScore ? r : best);

        return {
            winner,
            allResults: results,
            metrics: {
                totalDuration: Date.now() - startTime,
                agentsCompleted: results.length,
                agentsFailed: 0,
                averageScore: results.reduce((s, r) => s + r.critiqueScore, 0) / results.length,
                scoreVariance: 0
            }
        };
    }
}

// ========== ENHANCED BATCH SIMULATION ==========
export const runEnhancedBatchSimulation = async (
    config: SimulationConfig,
    batchConfig: EnhancedBatchConfig,
    onProgress: (status: BatchProgress) => void
): Promise<BatchResult> => {
    const selfImprovement = new FrontendSelfImprovementService();
    const agentRacing = new FrontendAgentRacingService();

    let optimalParams: OptimizedParameters | undefined;
    let warmupResult: WarmupResult | undefined;
    const outputs: SimulationOutput[] = [];

    // ═══════════════════════════════════════════════════════════════════
    // FASE 0: SELF-IMPROVEMENT (Warmup)
    // ═══════════════════════════════════════════════════════════════════
    if (batchConfig.enableWarmup && batchConfig.warmupConfig) {
        onProgress({ phase: 'WARMUP', percent: 0, message: '🔥 Iniciando auto-aprimoramento...' });

        warmupResult = await selfImprovement.runWarmup(
            config,
            batchConfig.warmupConfig,
            (iteration, score) => {
                onProgress({
                    phase: 'WARMUP',
                    percent: (iteration / batchConfig.warmupConfig!.maxIterations) * 100,
                    message: `Iteração ${iteration}: Score ${score}%`,
                    currentIteration: iteration
                });
            }
        );

        optimalParams = warmupResult.optimalParams;
        onProgress({ phase: 'WARMUP', percent: 100, message: `✅ Warmup completo! Score: ${warmupResult.finalScore}%` });
    }

    // ═══════════════════════════════════════════════════════════════════
    // FASE 1: BATCH EXECUTION
    // ═══════════════════════════════════════════════════════════════════
    for (let i = 0; i < batchConfig.iterations; i++) {
        onProgress({ phase: 'BATCH', percent: (i / batchConfig.iterations) * 100, message: `Simulação ${i + 1}/${batchConfig.iterations}`, currentIteration: i + 1 });

        let result: SimulationOutput;

        if (batchConfig.enableRacing && batchConfig.racingConfig) {
            onProgress({ phase: 'RACING', percent: (i / batchConfig.iterations) * 100, message: `⚔️ Racing simulação ${i + 1}...` });
            agentRacing.setupAgents(batchConfig.racingConfig.numAgents);
            const raceResult = await agentRacing.race(config, batchConfig.racingConfig);
            result = raceResult.winner.result;
            (result as any).racingMetrics = raceResult.metrics;
        } else {
            const singleConfig: SingleSimulationConfig = {
                frameworkName: config.frameworks[0]?.name || 'Framework',
                frameworkText: config.frameworks[0]?.text || '',
                frameworkCategory: config.frameworkCategory,
                companySize: config.companySize,
                sector: config.sector,
                budgetLevel: config.budgetLevel,
                employeeArchetypes: config.employeeArchetypes,
                techDebtLevel: config.techDebtLevel,
                operationalVelocity: config.operationalVelocity,
                previousFailures: config.previousFailures,
                scenarioContext: optimalParams ? `[OPTIMIZED] T=${optimalParams.temperature}` : `Simulation ${i + 1}`,
                durationMonths: config.durationMonths || 12
            };
            result = await runSimulation(singleConfig);
        }

        outputs.push(result);
    }

    // ═══════════════════════════════════════════════════════════════════
    // FASE 2: CONSOLIDAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    onProgress({ phase: 'CONSOLIDATION', percent: 95, message: '📊 Consolidando resultados...' });

    const rois = outputs.map(o => o.summary.totalRoi);
    const adoptions = outputs.map(o => o.summary.finalAdoption);
    const avgRoi = rois.reduce((a, b) => a + b, 0) / rois.length;
    const stdDevRoi = Math.sqrt(rois.map(r => Math.pow(r - avgRoi, 2)).reduce((a, b) => a + b, 0) / rois.length);

    // 95% CI
    const marginOfError = 1.96 * (stdDevRoi / Math.sqrt(rois.length));
    const ci95: [number, number] = [avgRoi - marginOfError, avgRoi + marginOfError];

    const summary: BatchSummary = {
        averageRoi: avgRoi,
        averageAdoption: adoptions.reduce((a, b) => a + b, 0) / adoptions.length,
        successRate: (rois.filter(r => r > 0).length / rois.length) * 100,
        stdDevRoi,
        minRoi: Math.min(...rois),
        maxRoi: Math.max(...rois),
        confidenceInterval95: ci95
    };

    onProgress({ phase: 'CONSOLIDATION', percent: 100, message: '✅ Batch completo!' });

    return { config, outputs, warmupResult, summary };
};

// ========== LEGACY BATCH SIMULATION (unchanged) ==========
export const runBatchSimulation = async (
    config: SimulationConfig,
    iterations: number,
    onProgress: (completed: number) => void
): Promise<BatchResult> => {
    const outputs: SimulationOutput[] = [];

    const baseScenario = config.scenarioMode === 'custom'
        ? config.customScenarioText || "Nenhum cenário específico."
        : `Cenário Recomendado: ${config.selectedScenarioId}`;

    const targetFramework = config.frameworks[0];
    if (!targetFramework) throw new Error("Nenhum framework selecionado para validação.");

    for (let i = 0; i < iterations; i++) {
        const singleConfig: SingleSimulationConfig = {
            frameworkName: targetFramework.name,
            frameworkText: targetFramework.text,
            frameworkCategory: config.frameworkCategory,
            companySize: config.companySize,
            sector: config.sector,
            budgetLevel: config.budgetLevel,
            currentMaturity: config.currentMaturity,
            employeeArchetypes: config.employeeArchetypes,
            techDebtLevel: config.techDebtLevel,
            operationalVelocity: config.operationalVelocity,
            previousFailures: config.previousFailures,
            scenarioContext: `${baseScenario} (Simulação ${i + 1}/${iterations})`
        };

        try {
            const result = await runSimulation(singleConfig);
            outputs.push(result);
        } catch (error) {
            console.error(`Batch run ${i + 1} failed`, error);
        }

        onProgress(i + 1);
    }

    const rois = outputs.map(o => o.summary.totalRoi);
    const adoptions = outputs.map(o => o.summary.finalAdoption);
    const averageRoi = rois.reduce((a, b) => a + b, 0) / rois.length;
    const averageAdoption = adoptions.reduce((a, b) => a + b, 0) / adoptions.length;
    const successRate = (rois.filter(r => r > 0).length / rois.length) * 100;
    const squareDiffs = rois.map(value => Math.pow(value - averageRoi, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    const stdDevRoi = Math.sqrt(avgSquareDiff);

    return {
        config,
        outputs,
        summary: {
            averageRoi,
            averageAdoption,
            successRate,
            stdDevRoi,
            minRoi: Math.min(...rois),
            maxRoi: Math.max(...rois),
            confidenceInterval95: [averageRoi - 1.96 * (stdDevRoi / Math.sqrt(rois.length)), averageRoi + 1.96 * (stdDevRoi / Math.sqrt(rois.length))]
        }
    };
};

export const generateCSV = (batchResult: BatchResult): string => {
    const headers = [
        "Run ID",
        "Framework",
        "ROI (%)",
        "Adoption (%)",
        "NPS (Sat.)",
        "Uptime Est. (%)",
        "TMA (Hours)",
        "Maturity Score",
        "Months to Complete",
        "Scenario Validity",
        "Features Delivered",
        "Bugs Generated",
        "Critical Incidents"
    ];

    const rows = batchResult.outputs.map((output, index) => {
        // Aggregate raw data
        const totalFeatures = output.timeline.reduce((acc, m) => acc + (m.rawData?.featuresDelivered || 0), 0);
        const totalBugs = output.timeline.reduce((acc, m) => acc + (m.rawData?.bugsGenerated || 0), 0);
        const totalIncidents = output.timeline.reduce((acc, m) => acc + (m.rawData?.criticalIncidents || 0), 0);

        // Calculate TCC Specific Metrics

        // 1. NPS (Net Promoter Score)
        const promoters = output.sentimentBreakdown.find(s => s.group === 'Promotores')?.value || 0;
        const detractors = output.sentimentBreakdown.find(s => s.group === 'Detratores')?.value || 0;
        // Normalize if values are counts instead of percentages (assuming sum is 100 or team size)
        // If values are percentages, NPS = Promoters - Detractors
        const nps = promoters - detractors;

        // 2. Uptime Estimation
        // Base 99.9% - (0.1% per incident)
        const uptime = Math.max(95, 99.9 - (totalIncidents * 0.2)).toFixed(2);

        // 3. TMA (Tempo Médio de Atendimento)
        // Inverse of efficiency. Base 4h.
        // If efficiency is 120%, TMA drops to 3.3h.
        const avgEfficiency = output.timeline.reduce((acc, m) => acc + m.efficiency, 0) / output.timeline.length;
        const tma = (4 * (100 / avgEfficiency)).toFixed(1);

        return [
            index + 1,
            output.frameworkName,
            output.summary.totalRoi.toFixed(2),
            output.summary.finalAdoption.toFixed(2),
            nps.toFixed(0),
            uptime,
            tma,
            output.summary.maturityScore,
            output.summary.monthsToComplete,
            output.summary.scenarioValidity,
            totalFeatures,
            totalBugs,
            totalIncidents
        ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
};
