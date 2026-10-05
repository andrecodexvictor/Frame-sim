
import { SimulationConfig, SimulationOutput, SingleSimulationConfig, EnhancedBatchConfig, WarmupResult, BatchSummary, OptimizedParameters, RacingConfig, AgentConfig, AgentResult, RaceResult, RacingMetrics } from '../types';
import { runSimulation } from './geminiService';
import { runAgenticSimulation } from './agenticService';
import { hashString } from '../RAG/src/core/employeeBrainCore';
import { commonScenarioSeed, createExperimentAssignment } from './experimentProtocol';
import { summarizeIndependent } from './comparisonStatistics';
import { outcomeStatus } from './experimentResults';
export interface BatchRunRecord { replicaId: string; conditionId: string; seed: number; experiment?: import('./experimentProtocol').ExperimentAssignment; status: 'completed' | 'failed' | 'fixture' | 'degraded'; output?: SimulationOutput; errorCode?: string; racingTrials?: AgentResult[]; ensemble?: RaceResult['ensemble'] }

export interface BatchResult {
    runs?: BatchRunRecord[];
    selectionProtocol?: 'independent-replicas' | 'production-optimization';
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
export interface BatchRunnerOptions { run?: typeof runSimulation; agenticRun?: typeof runAgenticSimulation; standardRun?: typeof runSimulation }
function batchRunner(config: SimulationConfig, options: BatchRunnerOptions): typeof runSimulation {
    if (options.run) return options.run;
    if (config.simulationMode !== 'agentic') return options.standardRun ?? runSimulation;
    return (single, requestOptions) => (options.agenticRun ?? runAgenticSimulation)({ ...config, seed: single.seed, experiment: single.experiment, durationMonths: single.durationMonths, currentMaturity: single.currentMaturity ?? config.currentMaturity,
        frameworks: [{ id: single.experiment?.interventionId ?? config.frameworks[0].id, name: single.frameworkName, text: single.frameworkText }], workloadPolicy: single.workloadPolicy ?? config.workloadPolicy,
        customScenarioText: single.scenarioContext }, { signal: requestOptions?.signal });
}

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
    return hashString(`${commonScenarioSeed(config)}:${label}`);
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

export function summarizeOutputs(outputs: SimulationOutput[], records?: BatchRunRecord[]): BatchSummary {
    const observations = (field: 'totalRoi' | 'finalAdoption') => records ? records.map(run => ({ replicaId: run.replicaId, value: run.output?.summary[field] ?? null, status: run.status })) : outputs.map((output, index) => ({ replicaId: output.manifest?.replicaId ?? String(index + 1), value: output.summary[field], status: outcomeStatus(output) }));
    const roi = summarizeIndependent(observations('totalRoi'));
    const adoption = summarizeIndependent(observations('finalAdoption'));
    const rois = observations('totalRoi').filter(item => item.status === 'completed' && typeof item.value === 'number' && Number.isFinite(item.value));
    return {
        averageRoi: roi.mean, averageAdoption: adoption.mean,
        successRate: rois.length ? rois.filter(item => item.value! > 0).length / rois.length * 100 : null,
        stdDevRoi: roi.sampleSD, minRoi: roi.min, maxRoi: roi.max,
        confidenceInterval95: roi.interval95, nIndependent: roi.nIndependent, nExcluded: roi.nExcluded,
        intervalMethod: roi.method, limitations: roi.limitations
    };
}

// ========== SELF-IMPROVEMENT SERVICE (Inline for Frontend) ==========
class FrontendSelfImprovementService {
    constructor(private run: typeof runSimulation = runSimulation) {}
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

            const result = await this.run({ ...singleConfig, currentMaturity: config.currentMaturity, workloadPolicy: config.workloadPolicy });

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
    constructor(private run: typeof runSimulation = runSimulation) {}

    setupAgents(numAgents: number): void {
        if (!Number.isInteger(numAgents) || numAgents < 1 || numAgents > 10) throw new RangeError('Racing requires 1–10 agents.');
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
                scenarioContext: config.scenarioMode === 'custom' ? config.customScenarioText || 'Nenhum cenário específico.' : `Cenário Recomendado: ${config.selectedScenarioId}`,
                durationMonths: config.durationMonths || 12,
                economicProfileId: config.economicProfileId,
                economicScenarioId: config.economicScenarioId,
                temperature: agent.temperature,
                modelPreference: agent.model,
                agentPersona: agent.persona,
                seed: config.experiment?.scenarioSeed ?? commonScenarioSeed(config),
                experiment: config.experiment,
                currentMaturity: config.currentMaturity,
                workloadPolicy: config.workloadPolicy
            };

            try {
                const result = await this.run(singleConfig, { signal: controller.signal });
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
                    error: error instanceof Error ? error.name : 'SimulationError'
                };
            } finally {
                window.clearTimeout(timer);
            }
        }));

        const successful = results.filter((result): result is AgentResult & { result: SimulationOutput } =>
            result.success && result.result !== null
        );
        if (successful.length === 0) return { winner: results[0], allResults: results, metrics: { totalDuration: Date.now() - startTime, agentsCompleted: 0, agentsFailed: results.length, averageScore: 0, scoreVariance: 0 } };

        const scoreSum = successful.reduce((sum, result) => sum + Math.max(1, result.critiqueScore), 0);
        const ensemble = {
            weightedROI: successful.reduce((sum, item) => sum + item.result.summary.totalRoi * Math.max(1, item.critiqueScore), 0) / scoreSum,
            weightedAdoption: successful.every(item => item.result.summary.finalAdoption !== null) ? successful.reduce((sum, item) => sum + item.result.summary.finalAdoption! * Math.max(1, item.critiqueScore), 0) / scoreSum : null,
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
    onProgress: (status: BatchProgress) => void,
    options: BatchRunnerOptions = {}
): Promise<BatchResult> => {
    const iterationCount = validateIterations(batchConfig.iterations);
    const run = batchRunner(config, options);
    const selfImprovement = new FrontendSelfImprovementService(run);
    const agentRacing = new FrontendAgentRacingService(run);

    let optimalParams: OptimizedParameters | undefined;
    let warmupResult: WarmupResult | undefined;
    const outputs: SimulationOutput[] = [];
    const records: BatchRunRecord[] = [];
    const experimentId = config.experiment?.experimentId ?? `batch-${crypto.randomUUID()}`;
    const baseScenario = config.scenarioMode === 'custom' ? config.customScenarioText || 'Nenhum cenário específico.' : `Cenário Recomendado: ${config.selectedScenarioId}`;

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
            const experiment = createExperimentAssignment(config, { experimentId, replicaId: String(i + 1), interventionId: config.frameworks[0]?.id || 'framework' });
            const record: BatchRunRecord = { replicaId: experiment.replicaId, conditionId: experiment.conditionId, seed: experiment.scenarioSeed, experiment, status: 'failed' };
            records[i] = record;
            try {
            let result: SimulationOutput;
            if (batchConfig.enableRacing && batchConfig.racingConfig) {
                onProgress({ phase: 'RACING', percent: (completed / iterationCount) * 100, message: `⚔️ Racing simulação ${i + 1}...`, currentIteration: i + 1 });
                agentRacing.setupAgents(batchConfig.racingConfig.numAgents);
                const raceResult = await agentRacing.race({ ...config, experiment }, batchConfig.racingConfig);
                record.racingTrials = raceResult.allResults;
                if (!raceResult.winner.result) throw new Error('Racing winner did not return a simulation.');
                result = raceResult.winner.result;
                record.ensemble = raceResult.ensemble;
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
                    scenarioContext: baseScenario,
                    durationMonths: config.durationMonths || 12,
                    economicProfileId: config.economicProfileId,
                    economicScenarioId: config.economicScenarioId,
                    temperature: optimalParams?.temperature,
                    seed: experiment.scenarioSeed,
                    currentMaturity: config.currentMaturity,
                    workloadPolicy: config.workloadPolicy,
                    experiment
                };
                result = await run(singleConfig);
            }
            record.output = result;
            record.status = outcomeStatus(result);
            return result;
            } catch (error) {
                record.status = 'failed';
                record.errorCode = error instanceof Error ? error.name : 'SimulationError';
                return null;
            } finally {
            completed++;
            onProgress({
                phase: 'BATCH',
                percent: (completed / iterationCount) * 100,
                message: `Simulações concluídas: ${completed}/${iterationCount}`,
                currentIteration: completed
            });
            }
        }
    );
    outputs.push(...batchOutputs.filter((output): output is SimulationOutput => output !== null));

    // ═══════════════════════════════════════════════════════════════════
    // FASE 2: CONSOLIDAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    onProgress({ phase: 'CONSOLIDATION', percent: 95, message: '📊 Consolidando resultados...' });

    const summary = summarizeOutputs(outputs, records);

    onProgress({ phase: 'CONSOLIDATION', percent: 100, message: '✅ Batch completo!' });

    return { config, outputs, warmupResult, summary, runs: records, selectionProtocol: batchConfig.enableWarmup || batchConfig.enableRacing ? 'production-optimization' : 'independent-replicas' };
};

// ========== LEGACY BATCH SIMULATION (unchanged) ==========
export const runBatchSimulation = async (
    config: SimulationConfig,
    iterations: number,
    onProgress: (completed: number) => void,
    options: BatchRunnerOptions = {}
): Promise<BatchResult> => {
    const iterationCount = validateIterations(iterations);
    const run = batchRunner(config, options);

    const baseScenario = config.scenarioMode === 'custom'
        ? config.customScenarioText || "Nenhum cenário específico."
        : `Cenário Recomendado: ${config.selectedScenarioId}`;

    const targetFramework = config.frameworks[0];
    if (!targetFramework) throw new Error("Nenhum framework selecionado para validação.");

    let completed = 0;
    const records: BatchRunRecord[] = [];
    const experimentId = config.experiment?.experimentId ?? `batch-${crypto.randomUUID()}`;
    const settled = await mapConcurrent(
        Array.from({ length: iterationCount }, (_, index) => index),
        DEFAULT_BATCH_CONCURRENCY,
        async (i): Promise<SimulationOutput | null> => {
        const experiment = createExperimentAssignment(config, { experimentId, replicaId: String(i + 1), interventionId: targetFramework.id });
        const record: BatchRunRecord = { replicaId: experiment.replicaId, conditionId: experiment.conditionId, seed: experiment.scenarioSeed, experiment, status: 'failed' };
        records[i] = record;
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
            scenarioContext: baseScenario,
            durationMonths: config.durationMonths || 12,
            economicProfileId: config.economicProfileId,
            economicScenarioId: config.economicScenarioId,
            seed: experiment.scenarioSeed,
            experiment,
            workloadPolicy: config.workloadPolicy
        };

        try {
            const output = await run(singleConfig);
            record.output = output;
            record.status = outcomeStatus(output);
            return output;
        } catch (error) {
            record.errorCode = error instanceof Error ? error.name : 'SimulationError';
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
        summary: summarizeOutputs(outputs, records), runs: records, selectionProtocol: 'independent-replicas'
    };
};

export const generateCSV = (batchResult: BatchResult): string => {
    const quote = (value: unknown) => value === null || value === undefined ? '' : '"' + String(value).replace(/"/g, '""') + '"';
    const records = batchResult.runs ?? batchResult.outputs.map((output, index) => ({ replicaId: output.manifest?.replicaId ?? String(index + 1), conditionId: output.manifest?.interventionId ?? 'legacy', seed: output.execution?.seed, status: outcomeStatus(output), output }));
    const headers = ['Replica ID', 'Condition ID', 'Run ID', 'Framework', 'Status', 'Seed', 'ROI (%)', 'Adoption (%)', 'Maturity (0-10)', 'Duration (months)', 'Scenario validity', 'Source'];
    const rows = records.map(record => [record.replicaId, record.conditionId, record.output?.manifest?.runId, record.output?.frameworkName, record.status, record.seed, record.output?.summary.totalRoi, record.output?.summary.finalAdoption, record.output?.summary.maturityScore, record.output?.summary.monthsToComplete, record.output?.summary.scenarioValidity, record.output?.manifest?.dataSource ?? 'synthetic'].map(quote).join(','));
    return [headers.map(quote).join(','), ...rows].join('\n');
};
