
import { SimulationConfig, SimulationOutput, SingleSimulationConfig } from '../types';
import { runSimulation } from './geminiService';

export interface BatchResult {
    config: SimulationConfig;
    outputs: SimulationOutput[];
    summary: {
        averageRoi: number;
        averageAdoption: number;
        successRate: number; // % of runs with ROI > 0
        stdDevRoi: number;
    };
}

export const runBatchSimulation = async (
    config: SimulationConfig,
    iterations: number,
    onProgress: (completed: number) => void
): Promise<BatchResult> => {
    const outputs: SimulationOutput[] = [];

    // Prepare base config
    const baseScenario = config.scenarioMode === 'custom'
        ? config.customScenarioText || "Nenhum cenário específico."
        : `Cenário Recomendado: ${config.selectedScenarioId}`;

    // We only simulate the first framework for batch mode to keep it simple for TCC
    // or we could simulate all. Let's assume the first one is the target.
    const targetFramework = config.frameworks[0];
    if (!targetFramework) throw new Error("Nenhum framework selecionado para validação.");

    for (let i = 0; i < iterations; i++) {
        // Slight variation could be introduced here if we wanted "Monte Carlo" style
        // For now, we rely on the LLM's natural variance + our probabilistic calculator

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
            // Continue despite errors? Or stop? Let's continue and ignore failed run.
        }

        onProgress(i + 1);
    }

    // Calculate Statistics
    const rois = outputs.map(o => o.summary.totalRoi);
    const adoptions = outputs.map(o => o.summary.finalAdoption);

    const averageRoi = rois.reduce((a, b) => a + b, 0) / rois.length;
    const averageAdoption = adoptions.reduce((a, b) => a + b, 0) / adoptions.length;
    const successRate = (rois.filter(r => r > 0).length / rois.length) * 100;

    // Standard Deviation ROI
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
            stdDevRoi
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
