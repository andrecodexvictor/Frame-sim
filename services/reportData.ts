import type { SimulationConfig, SimulationOutput, RunManifest, PersonaTrace, IndividualEvaluation } from '../types';
import type { BatchResult } from './batchService';
import type { FailedCondition } from './interactiveRuns';
import { compareConditions, COMPARISON_METRICS, outcomeStatus, type ComparisonResults, type ComparisonMetric } from './experimentResults';
import { summarizeIndependent } from './comparisonStatistics';
export type ReportMode = 'individual' | 'comparison' | 'batch';
export interface ReportMetric {
    key: string; id: string; label: string; value: number | null; unit: string;
    group: 'run' | 'timeline' | 'individual' | 'semantic' | 'aggregate' | 'delta' | 'aggregate-timeline' | 'auxiliary' | 'task-duration';
    runId?: string; conditionId?: string; replicaId?: string; personaId?: string; turnId?: number; timeUnit?: 'month' | 'turn';
    interval95?: [number, number] | null; nIndependent?: number; nExcluded?: number; method?: string;
    numerator?: number; denominator?: number; coverage?: number; evidenceIds?: string[]; missingReason?: string;
    taskId?: string; classId?: string; censored?: boolean | null;
    source: string; status: string;
}
export interface ReportRun {
    id: string; label: string; conditionId: string; replicaId: string; status: ReturnType<typeof outcomeStatus>; source: string; timeUnit: 'month' | 'turn';
    manifest?: RunManifest; traces: PersonaTrace[]; individualEvaluations: IndividualEvaluation[]; narrative: string; errorCode?: string;
    racingTrials?: NonNullable<BatchResult['runs']>[number]['racingTrials'];
    ensemble?: NonNullable<BatchResult['runs']>[number]['ensemble'];
    protocol?: RunManifest['protocol'];
    visuals?: ReportVisuals;
}
export type ReportVisuals = Pick<SimulationOutput, 'resourceAllocation' | 'sentimentBreakdown' | 'departmentReadiness' | 'businessMetrics' | 'companyEvolution' | 'roiAnalysis' | 'agenticMetrics'> & { systemicBalance: Array<{ subject: string; A: number | null; fullMark: number }> };
export interface ReportData {
    schemaVersion: 1; mode: ReportMode; title: string; empiricalValidation: 'pending';
    runs: ReportRun[]; metrics: ReportMetric[]; comparisons: Partial<Record<ComparisonMetric, ComparisonResults>>;
    config?: Record<string, unknown>; selectionProtocol: string; limitations: string[];
}
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const timelineDefinitions = { roi: { label: 'ROI projetado', unit: '%' }, adoptionRate: { label: 'Adoção simulada', unit: '%' }, compliance: { label: 'Conformidade simulada', unit: '%' }, efficiency: { label: 'Eficiência simulada', unit: 'pontos simulados' } };
// Strip runtime-only credentials even when a caller provides extra properties outside the TS contract.
export function publicArtifact<T>(value: T): T {
    return JSON.parse(JSON.stringify(value, (key, item) => {
        if (/api.?key|authorization|password|secret|headers|access.?token/i.test(key)) return undefined;
        return typeof item === 'string' ? item.replace(/(?:apikey_[a-zA-Z0-9_]+|nvapi-[a-zA-Z0-9_-]+|AQ\.Ab[a-zA-Z0-9_-]+)/g, '[credential removed]') : item;
    })) as T;
}
export function buildReportData(input: { mode: ReportMode; outputs: SimulationOutput[]; config?: SimulationConfig; failures?: FailedCondition[]; batch?: BatchResult }): ReportData {
    const metrics: ReportMetric[] = [], runs: ReportRun[] = [];
    const outputRuns = input.outputs.map((output, index) => {
        const record = input.batch?.runs?.find(item => item.output === output);
        const manifest = output.manifest;
        const run: ReportRun = { id: manifest?.runId ?? `run-${index + 1}`, label: output.frameworkName, conditionId: manifest?.protocol?.conditionId ?? record?.conditionId ?? manifest?.interventionId ?? `legacy-condition-${index + 1}`, replicaId: manifest?.replicaId ?? record?.replicaId ?? String(index + 1), status: outcomeStatus(output), source: manifest?.dataSource ?? 'synthetic', timeUnit: output.timeUnit ?? 'month', manifest, traces: output.personaTraces ?? [], individualEvaluations: output.individualEvaluations ?? [], narrative: output.implementationNarrative, ...(record?.racingTrials ? { racingTrials: record.racingTrials, ensemble: record.ensemble } : {}) };
        runs.push(run);
        run.protocol = manifest?.protocol;
        run.visuals = { resourceAllocation: output.resourceAllocation, sentimentBreakdown: output.sentimentBreakdown, departmentReadiness: output.departmentReadiness, businessMetrics: output.businessMetrics, companyEvolution: output.companyEvolution, roiAnalysis: output.roiAnalysis, agenticMetrics: output.agenticMetrics,
            systemicBalance: [{ subject: 'Processos', A: output.timeline.at(-1)?.efficiency ?? null, fullMark: 100 }, { subject: 'Compliance', A: output.timeline.at(-1)?.compliance ?? null, fullMark: 100 }, { subject: 'Cultura', A: output.summary.finalAdoption, fullMark: 100 }, { subject: 'Maturidade', A: output.summary.maturityScore === null ? null : output.summary.maturityScore * 10, fullMark: 100 }] };
        const base = { runId: run.id, conditionId: run.conditionId, replicaId: run.replicaId, source: run.source, status: run.status };
        for (const [id, definition] of Object.entries(COMPARISON_METRICS)) metrics.push({ ...base, key: JSON.stringify([run.id, id]), id, ...definition, value: finite(output.summary[id as ComparisonMetric]), group: 'run', ...(output.summary[id as ComparisonMetric] === null ? { missingReason: 'This dimension was not measured by the run.' } : {}) });
        metrics.push({ ...base, key: JSON.stringify([run.id, 'scenarioValidity']), id: 'scenarioValidity', label: 'Plausibilidade da narrativa', value: finite(output.summary.scenarioValidity), unit: 'pontos de rubrica', group: 'run' });
        for (const point of output.timeline) for (const [id, definition] of Object.entries(timelineDefinitions)) metrics.push({ ...base, key: JSON.stringify([run.id, point.month, id]), id, ...definition, ...(id === 'efficiency' && run.timeUnit === 'turn' ? { label: 'Velocidade simulada', unit: '% da velocidade de referência' } : {}), value: finite(point[id as keyof typeof timelineDefinitions]), group: 'timeline', turnId: point.month, timeUnit: run.timeUnit });
        for (const evaluation of run.individualEvaluations) {
            for (const metric of evaluation.metrics) metrics.push({ ...base, ...metric, key: JSON.stringify([run.id, evaluation.personaId, metric.id]), group: 'individual', label: `${evaluation.personaId} · ${metric.id}`, personaId: evaluation.personaId, source: evaluation.source });
            for (const [id, dimension] of Object.entries(evaluation.semantic)) metrics.push({ ...base, key: JSON.stringify([run.id, evaluation.personaId, 'semantic', id]), id, group: 'semantic', label: `${evaluation.personaId} · ${id}`, personaId: evaluation.personaId, source: evaluation.source, value: dimension.status === 'evaluated' ? finite(dimension.score) : null, unit: 'pontos de rubrica', status: dimension.status, evidenceIds: dimension.evidenceIds, missingReason: dimension.reason });
            for (const distribution of evaluation.leadTimeByClass ?? []) for (const observation of distribution.observations) metrics.push({ ...base, key: JSON.stringify([run.id, evaluation.personaId, 'lead-time.sample', distribution.classId, observation.taskId]), id: 'lead-time.sample', group: 'task-duration', label: `${evaluation.personaId} · ${distribution.classId} · ${observation.taskId}`, personaId: evaluation.personaId, taskId: observation.taskId, classId: distribution.classId, censored: observation.censored, source: evaluation.source, value: finite(observation.hours), unit: distribution.unit, evidenceIds: observation.evidenceIds, status: observation.censored === true ? 'censored' : observation.accepted === true || observation.censored === false ? 'accepted' : 'unknown' });
        }
        const append = (id: string, label: string, value: unknown, unit: string, index = 0, turnId?: number) => metrics.push({ ...base, key: JSON.stringify([run.id, id, index, turnId]), id, label, value: finite(value), unit, group: 'auxiliary', ...(turnId === undefined ? {} : { turnId, timeUnit: run.timeUnit }) });
        output.resourceAllocation.forEach((row, index) => append('resourceAllocation', row.category, row.amount, 'unidades de alocação (escala fornecida pelo modelo)', index));
        output.sentimentBreakdown.forEach((row, index) => append('sentimentBreakdown', row.group, row.value, run.timeUnit === 'turn' ? 'pessoas' : '%', index));
        output.departmentReadiness.forEach((row, index) => append('departmentReadiness', row.department, row.score, '%', index));
        for (const [id, value] of Object.entries(output.businessMetrics ?? {})) append(`business.${id}`, id, value, id === 'qualityScore' ? 'pontos (0–100)' : '%');
        const companyUnits: Record<string, string> = { initialTeamSize: 'pessoas', finalTeamSize: 'pessoas', newHires: 'pessoas', promotions: 'pessoas', turnover: '%', capacityGrowth: '%', breakEvenProjection: 'meses (0 = não projetado)', maturityLevelBefore: 'nível (1–5)', maturityLevelAfter: 'nível (1–5)' };
        for (const [id, unit] of Object.entries(companyUnits)) if (output.companyEvolution) append(`company.${id}`, id, output.companyEvolution[id as keyof NonNullable<SimulationOutput['companyEvolution']>], unit);
        run.visuals.systemicBalance.forEach((row, index) => append('systemicBalance', row.subject, row.A, 'coordenada normalizada (maturidade ×10)', index));
        if (output.roiAnalysis) append('roiAnalysis.breakEvenMonth', 'Break-even projetado', output.roiAnalysis.breakEvenMonth, 'meses (0 = não projetado)');
        const agentUnits: Record<string, string> = { quality_per_cycle: '%', time_to_solve_ms: 'ms', cost_estimate_usd: 'USD estimado', total_tokens: 'tokens', tir: '%', risk_incidents: 'incidentes', replan_count: 'replanejamentos' };
        for (const [id, unit] of Object.entries(agentUnits)) if (output.agenticMetrics) append(`agentic.${id}`, id, output.agenticMetrics[id as keyof NonNullable<SimulationOutput['agenticMetrics']>], unit);
        for (const point of output.timeline) for (const [id, value] of Object.entries(point.rawData ?? {})) append(`financialInput.${id}`, `${id} · ${point.month}`, value, id === 'teamSize' ? 'pessoas' : id === 'learningCurveFactor' ? 'fator' : 'contagem sintética', 0, point.month);
        return { run, output };
    });
    for (const [index, failure] of (input.failures ?? []).entries()) runs.push({ id: `failed-${index + 1}`, label: failure.label, conditionId: failure.experiment.conditionId, replicaId: failure.experiment.replicaId, status: 'failed', source: 'synthetic', timeUnit: input.config?.simulationMode === 'agentic' ? 'turn' : 'month', protocol: failure.experiment, traces: [], individualEvaluations: [], narrative: '', errorCode: failure.errorCode });
    for (const record of input.batch?.runs?.filter(item => !item.output) ?? []) runs.push({ id: `failed-batch-${record.replicaId}`, label: input.batch!.config.frameworks?.[0]?.name ?? 'Condition', conditionId: record.conditionId, replicaId: record.replicaId, status: record.status, source: 'synthetic', timeUnit: input.batch?.config.simulationMode === 'agentic' ? 'turn' : 'month', protocol: record.experiment, traces: [], individualEvaluations: [], narrative: '', errorCode: record.errorCode, racingTrials: record.racingTrials });
    const comparisons: ReportData['comparisons'] = {};
    if (input.mode === 'comparison') for (const id of Object.keys(COMPARISON_METRICS) as ComparisonMetric[]) {
        const report = compareConditions(input.outputs, id, input.failures); comparisons[id] = report;
        for (const condition of report.conditions) metrics.push({ key: JSON.stringify(['aggregate', condition.id, id]), id, label: condition.label, conditionId: condition.id, value: condition.statistics.mean, unit: report.unit, group: 'aggregate', source: 'synthetic', status: condition.statistics.mean === null ? 'unavailable' : 'completed', interval95: condition.statistics.interval95, nIndependent: condition.statistics.nIndependent, nExcluded: condition.statistics.nExcluded, method: condition.statistics.method });
        for (const pair of report.comparisons) metrics.push({ key: JSON.stringify(['delta', pair.a, pair.b, id]), id, label: `${pair.b} − ${pair.a}`, conditionId: pair.b, value: pair.statistics.delta, unit: report.unit === '%' ? 'pontos percentuais' : report.unit, group: 'delta', source: 'synthetic', status: pair.statistics.delta === null ? 'unavailable' : 'completed', interval95: pair.statistics.interval95, nIndependent: pair.statistics.nIndependent, nExcluded: pair.statistics.nExcluded, method: pair.statistics.method });
    }
    if (input.mode === 'batch') {
        for (const [id, definition] of Object.entries(COMPARISON_METRICS)) {
            const records = input.batch?.runs;
            const observations = records ? records.map(record => ({ replicaId: record.replicaId, value: record.output?.summary[id as ComparisonMetric] ?? null, status: record.status })) : outputRuns.map(({ run, output }) => ({ replicaId: run.replicaId, value: output.summary[id as ComparisonMetric], status: run.status }));
            const statistic = summarizeIndependent(observations);
            metrics.push({ key: JSON.stringify(['aggregate', id]), id, ...definition, value: statistic.mean, group: 'aggregate', source: 'synthetic', status: statistic.mean === null ? 'unavailable' : 'completed', interval95: statistic.interval95, nIndependent: statistic.nIndependent, nExcluded: statistic.nExcluded, method: statistic.method });
        }
        for (const timeUnit of ['month', 'turn'] as const) for (const turnId of [...new Set(metrics.filter(row => row.group === 'timeline' && row.timeUnit === timeUnit).map(row => row.turnId!))].sort((a, b) => a - b)) for (const [id, definition] of Object.entries(timelineDefinitions)) {
            const observations = runs.filter(run => run.timeUnit === timeUnit).map(run => ({ replicaId: run.replicaId, value: metrics.find(row => row.runId === run.id && row.group === 'timeline' && row.turnId === turnId && row.id === id)?.value ?? null, status: run.status }));
            const statistic = summarizeIndependent(observations);
            metrics.push({ key: JSON.stringify(['aggregate-timeline', timeUnit, turnId, id]), id, ...definition, ...(id === 'efficiency' && timeUnit === 'turn' ? { label: 'Velocidade simulada', unit: '% da velocidade de referência' } : {}), value: statistic.mean, group: 'aggregate-timeline', source: 'synthetic', status: statistic.mean === null ? 'unavailable' : 'completed', turnId, timeUnit, interval95: statistic.interval95, nIndependent: statistic.nIndependent, nExcluded: statistic.nExcluded, method: statistic.method });
        }
    }
    const config = input.config ?? input.batch?.config;
    const safeConfig = config ? Object.fromEntries(['frameworks', 'frameworkCategory', 'companySize', 'sector', 'budgetLevel', 'currentMaturity', 'employeeArchetypes', 'techDebtLevel', 'operationalVelocity', 'previousFailures', 'scenarioMode', 'selectedScenarioId', 'customScenarioText', 'durationMonths', 'economicProfileId', 'economicScenarioId', 'simulationMode', 'semanticEvaluation', 'seed', 'experiment', 'workloadPolicy'].filter(key => key in config).map(key => [key, config[key as keyof SimulationConfig]])) : undefined;
    return publicArtifact({ schemaVersion: 1, mode: input.mode, title: `FrameSIM · ${input.mode}`, empiricalValidation: 'pending', runs, metrics, comparisons, config: safeConfig, selectionProtocol: input.batch?.selectionProtocol ?? (input.mode === 'comparison' ? 'paired-v1' : 'single-run'), limitations: [...new Set(['Results are synthetic simulations unless evidence explicitly records an observed source.', 'Empirical validation is pending: no independent observed holdout is attached to these runs.', 'Individual delivery and quality require attributed task observations; missing data remain unavailable.', 'Stress and energy are contextual states, not performance penalties.', 'Intervals use independent run replicas, never individual turns as independent samples.', ...(input.batch?.selectionProtocol === 'production-optimization' ? ['Racing/warmup selects production candidates; selected runs are not an unbiased benchmark sample.'] : []), ...runs.flatMap(run => run.individualEvaluations.flatMap(evaluation => evaluation.limitations))])] });
}
export function reportTimeline(report: ReportData, runIndex: number): SimulationOutput['timeline'] {
    const runId = report.runs[runIndex]?.id;
    return [...new Set(report.metrics.filter(row => row.runId === runId && row.group === 'timeline').map(row => row.turnId!))].sort((a, b) => a - b).map(month => {
        const value = (id: string) => report.metrics.find(row => row.group === 'timeline' && row.runId === runId && row.turnId === month && row.id === id)?.value ?? null;
        return { month, roi: value('roi'), adoptionRate: value('adoptionRate'), compliance: value('compliance'), efficiency: value('efficiency') };
    });
}
export function reportSummary(report: ReportData, runIndex: number): SimulationOutput['summary'] {
    const runId = report.runs[runIndex]?.id, value = (id: string) => report.metrics.find(row => row.runId === runId && row.group === 'run' && row.id === id)?.value ?? null;
    return { totalRoi: value('totalRoi'), finalAdoption: value('finalAdoption'), maturityScore: value('maturityScore'), monthsToComplete: value('monthsToComplete'), ...(value('scenarioValidity') === null ? {} : { scenarioValidity: value('scenarioValidity')! }) };
}
export function reportVisuals(report: ReportData, runIndex: number): ReportVisuals {
    return structuredClone(report.runs[runIndex]?.visuals ?? { resourceAllocation: [], sentimentBreakdown: [], departmentReadiness: [], systemicBalance: [] });
}
