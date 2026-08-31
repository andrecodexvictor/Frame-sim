
import { SimulationConfig, SimulationOutput, SingleSimulationConfig, EnhancedBatchConfig, WarmupResult, BatchSummary, OptimizedParameters, RacingConfig, AgentConfig, AgentResult, RaceResult, RacingMetrics } from '../types';
import { runSimulation } from './geminiService';
import { hashString } from '../RAG/src/core/employeeBrainCore';

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

const MAX_BATCH_ITERATIONS = 50;
const DEFAULT_BATCH_CONCURRENCY = 3;

function validateIterations(iterations: number): number {
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_BATCH_ITERATIONS) {
        throw new RangeError(`Iterations must be an integer between 1 and ${MAX_BATCH_ITERATIONS}.`);
    }
    return iterations;
}

function normalizeScore(value: unknown, fallback = 50): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.min(100, value))
        : fallback;
}

function seedFor(config: SimulationConfig, label: string): number {
    return hashString([
        config.frameworks[0]?.name || 'framework',
        config.companySize,
        config.sector,
        config.selectedScenarioId || config.customScenarioText || 'recommended',
        label
    ].join(':'));
}

async function mapConcurrent<T, R>(
    values: readonly T[],
    concurrency: number,
    worker: (value: T, index: number) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(values.length);
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= values.length) return;
            results[index] = await worker(values[index], index);
        }
    });
    await Promise.all(workers);
    return results;
}

function summarizeOutputs(outputs: SimulationOutput[]): BatchSummary {
    if (outputs.length === 0) {
        throw new Error('No simulation completed successfully; batch statistics are unavailable.');
    }
    const rois = outputs.map(o => o.summary.totalRoi).filter(Number.isFinite);
    const adoptions = outputs.map(o => o.summary.finalAdoption).filter(Number.isFinite);
    if (rois.length === 0 || adoptions.length === 0) {
        throw new Error('Simulation results did not contain finite ROI/adoption values.');
    }
    const averageRoi = rois.reduce((a, b) => a + b, 0) / rois.length;
    const averageAdoption = adoptions.reduce((a, b) => a + b, 0) / adoptions.length;
    const variance = rois.reduce((sum, value) => sum + Math.pow(value - averageRoi, 2), 0) / rois.length;
    const stdDevRoi = Math.sqrt(variance);
    const margin = 1.96 * (stdDevRoi / Math.sqrt(rois.length));
    return {
        averageRoi,
        averageAdoption,
        successRate: (rois.filter(r => r > 0).length / rois.length) * 100,
        stdDevRoi,
        minRoi: Math.min(...rois),
        maxRoi: Math.max(...rois),
        confidenceInterval95: [averageRoi - margin, averageRoi + margin]
    };
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
                durationMonths: 6,
                economicProfileId: config.economicProfileId,
                economicScenarioId: config.economicScenarioId,
                temperature: candidateParams.temperature,
                seed: seedFor(config, `warmup:${i}`)
            };

            const result = await runSimulation(singleConfig);

            // Simple plausibility score based on scenario validity
            const score = normalizeScore(result.summary.scenarioValidity);

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
                temperature: space.temperatures[iteration % space.temperatures.length],
                topK: space.topKValues[(iteration * 2 + 1) % space.topKValues.length],
                ragMode: space.ragModes[(iteration * 3 + 1) % space.ragModes.length]
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
    ): Promise<RaceResult> {
        console.log(`⚔️ AGENT RACING: ${this.agents.length} agents competing...`);
        const startTime = Date.now();
        const timeoutMs = Math.max(1_000, racingConfig.timeout || 120_000);

        const results = await Promise.all(this.agents.map(async (agent): Promise<AgentResult> => {
            const agentStartedAt = Date.now();
            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort('agent-timeout'), timeoutMs);
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
                durationMonths: config.durationMonths || 12,
                economicProfileId: config.economicProfileId,
                economicScenarioId: config.economicScenarioId,
                temperature: agent.temperature,
                modelPreference: agent.model,
                agentPersona: agent.persona,
                seed: seedFor(config, `race:${agent.id}`)
            };

            try {
                const result = await runSimulation(singleConfig, { signal: controller.signal });
                return {
                    agentId: agent.id,
                    agentConfig: agent,
                    result,
                    critiqueScore: normalizeScore(result.summary.scenarioValidity),
                    duration: Date.now() - agentStartedAt,
                    success: true
                };
            } catch (error) {
                return {
                    agentId: agent.id,
                    agentConfig: agent,
                    result: null,
                    critiqueScore: 0,
                    duration: Date.now() - agentStartedAt,
                    success: false,
                    error: error instanceof Error ? error.message : 'Agent failed.'
                };
            } finally {
                window.clearTimeout(timer);
            }
        }));

        const successful = results.filter((result): result is AgentResult & { result: SimulationOutput } =>
            result.success && result.result !== null
        );
        if (successful.length === 0) throw new Error('All racing agents failed or timed out.');

        const scoreSum = successful.reduce((sum, result) => sum + Math.max(1, result.critiqueScore), 0);
        const ensemble = {
            weightedROI: successful.reduce((sum, item) => sum + item.result.summary.totalRoi * Math.max(1, item.critiqueScore), 0) / scoreSum,
            weightedAdoption: successful.reduce((sum, item) => sum + item.result.summary.finalAdoption * Math.max(1, item.critiqueScore), 0) / scoreSum,
            confidence: successful.reduce((sum, item) => sum + item.critiqueScore, 0) / successful.length,
            contributingAgents: successful.map(item => item.agentId)
        };

        const best = successful.reduce((current, item) => item.critiqueScore > current.critiqueScore ? item : current);
        const winner = racingConfig.selectionStrategy === 'weighted'
            ? successful.reduce((current, item) =>
                Math.abs(item.result.summary.totalRoi - ensemble.weightedROI) < Math.abs(current.result.summary.totalRoi - ensemble.weightedROI)
                    ? item
                    : current
            )
            : best;
        const averageScore = successful.reduce((sum, item) => sum + item.critiqueScore, 0) / successful.length;
        const metrics: RacingMetrics = {
            totalDuration: Date.now() - startTime,
            agentsCompleted: successful.length,
            agentsFailed: results.length - successful.length,
            averageScore,
            scoreVariance: successful.reduce((sum, item) => sum + Math.pow(item.critiqueScore - averageScore, 2), 0) / successful.length
        };

        return {
            winner,
            allResults: results,
            ...(racingConfig.selectionStrategy === 'best' ? {} : { ensemble }),
            metrics
        };
    }
}

// ========== ENHANCED BATCH SIMULATION ==========
export const runEnhancedBatchSimulation = async (
    config: SimulationConfig,
    batchConfig: EnhancedBatchConfig,
    onProgress: (status: BatchProgress) => void
): Promise<BatchResult> => {
    const iterationCount = validateIterations(batchConfig.iterations);
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
    let completed = 0;
    const batchOutputs = await mapConcurrent(
        Array.from({ length: iterationCount }, (_, index) => index),
        batchConfig.enableRacing ? 1 : DEFAULT_BATCH_CONCURRENCY,
        async (i) => {
            let result: SimulationOutput;
            if (batchConfig.enableRacing && batchConfig.racingConfig) {
                onProgress({ phase: 'RACING', percent: (completed / iterationCount) * 100, message: `⚔️ Racing simulação ${i + 1}...`, currentIteration: i + 1 });
                agentRacing.setupAgents(batchConfig.racingConfig.numAgents);
                const raceResult = await agentRacing.race(config, batchConfig.racingConfig);
                if (!raceResult.winner.result) throw new Error('Racing winner did not return a simulation.');
                result = raceResult.winner.result;
                if (raceResult.ensemble) {
                    result = {
                        ...result,
                        summary: {
                            ...result.summary,
                            totalRoi: raceResult.ensemble.weightedROI,
                            finalAdoption: raceResult.ensemble.weightedAdoption
                        }
                    };
                }
                (result as SimulationOutput & { racingMetrics?: RacingMetrics }).racingMetrics = raceResult.metrics;
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
                    scenarioContext: optimalParams ? `[OPTIMIZED] T=${optimalParams.temperature}; run=${i + 1}` : `Simulation ${i + 1}`,
                    durationMonths: config.durationMonths || 12,
                    economicProfileId: config.economicProfileId,
                    economicScenarioId: config.economicScenarioId,
                    temperature: optimalParams?.temperature,
                    seed: seedFor(config, `batch:${i}`)
                };
                result = await runSimulation(singleConfig);
            }
            completed++;
            onProgress({
                phase: 'BATCH',
                percent: (completed / iterationCount) * 100,
                message: `Simulações concluídas: ${completed}/${iterationCount}`,
                currentIteration: completed
            });
            return result;
        }
    );
    outputs.push(...batchOutputs);

    // ═══════════════════════════════════════════════════════════════════
    // FASE 2: CONSOLIDAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    onProgress({ phase: 'CONSOLIDATION', percent: 95, message: '📊 Consolidando resultados...' });

    const summary = summarizeOutputs(outputs);

    onProgress({ phase: 'CONSOLIDATION', percent: 100, message: '✅ Batch completo!' });

    return { config, outputs, warmupResult, summary };
};

// ========== LEGACY BATCH SIMULATION (unchanged) ==========
export const runBatchSimulation = async (
    config: SimulationConfig,
    iterations: number,
    onProgress: (completed: number) => void
): Promise<BatchResult> => {
    const iterationCount = validateIterations(iterations);

    const baseScenario = config.scenarioMode === 'custom'
        ? config.customScenarioText || "Nenhum cenário específico."
        : `Cenário Recomendado: ${config.selectedScenarioId}`;

    const targetFramework = config.frameworks[0];
    if (!targetFramework) throw new Error("Nenhum framework selecionado para validação.");

    let completed = 0;
    const settled = await mapConcurrent(
        Array.from({ length: iterationCount }, (_, index) => index),
        DEFAULT_BATCH_CONCURRENCY,
        async (i): Promise<SimulationOutput | null> => {
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
            scenarioContext: `${baseScenario} (Simulação ${i + 1}/${iterationCount})`,
            durationMonths: config.durationMonths || 12,
            economicProfileId: config.economicProfileId,
            economicScenarioId: config.economicScenarioId,
            seed: seedFor(config, `legacy-batch:${i}`)
        };

        try {
            return await runSimulation(singleConfig);
        } catch (error) {
            console.error(`Batch run ${i + 1} failed`, error);
            return null;
        } finally {
            completed++;
            onProgress(completed);
        }
        }
    );
    const outputs = settled.filter((output): output is SimulationOutput => output !== null);

    return {
        config,
        outputs,
        summary: summarizeOutputs(outputs)
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
