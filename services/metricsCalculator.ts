
import { SimulationConfig } from '../types';

export interface SimulationRawData {
    month: number;
    teamSize: number;
    featuresDelivered: number;
    bugsGenerated: number;
    criticalIncidents: number;
    teamMood: number; // 0-100
    learningCurveFactor: number; // 0.1 - 1.5 (1.0 = normal)
    efficiency?: number;
    compliance?: number;
}

export interface CalculatedMetrics {
    opEx: number;
    valueDelivered: number;
    conq: number; // Cost of Non-Quality
    roi: number;
    accumulatedRoi: number;
}

// Base Constants (can be adjusted based on company size/sector if needed)
const BASE_CONSTANTS = {
    PME: {
        DEV_DAY_COST: 400,
        FEATURE_VALUE: 3000, // Dampened value since Maintenance covers base
        INCIDENT_COST: 5000,
        BUG_FIX_COST: 300,
    },
    ENTERPRISE: {
        DEV_DAY_COST: 800,
        FEATURE_VALUE: 12000, // Dampened value since Maintenance covers base
        INCIDENT_COST: 500000,
        BUG_FIX_COST: 2000,
    }
};

export const calculateMonthlyMetrics = (
    rawData: SimulationRawData,
    config: SimulationConfig,
    previousAccumulatedValue: number = 0,
    previousAccumulatedOpEx: number = 0,
    previousAccumulatedCoNQ: number = 0
): CalculatedMetrics => {

    const isEnterprise = config.companySize >= 50;
    const constants = isEnterprise ? BASE_CONSTANTS.ENTERPRISE : BASE_CONSTANTS.PME;

    // 1. Calculate OpEx (Operational Expenditure)
    // Formula: (Devs * DailyCost * 22 days)
    const opEx = rawData.teamSize * constants.DEV_DAY_COST * 22;

    // 2. Calculate Value Delivered
    // Formula: Features * ValuePerPoint * LearningCurve
    // Tech Debt Impact: If critical, value is reduced by 20%
    let techDebtPenalty = 1.0;
    if (config.techDebtLevel === 'high') techDebtPenalty = 0.8;
    if (config.techDebtLevel === 'critical') techDebtPenalty = 0.5;

    // CORREÇÃO: Removido teamScaleFactor excessivo (era teamSize/8 = 12.5x para 100 FTEs!)
    // Agora usamos um fator logarítmico mais suave
    const teamScaleFactor = Math.log10(Math.max(10, rawData.teamSize)) / 2; // ~1.0 para 100 FTEs

    // Feature Value (New Deliverables) - "Profit"
    const featureValue = rawData.featuresDelivered * constants.FEATURE_VALUE * teamScaleFactor * rawData.learningCurveFactor * techDebtPenalty;

    // Maintenance Value (Business as Usual) - "Survival"
    // CORREÇÃO: Reduzido de 90% para 50% do OpEx - times geram valor igual ao custo no baseline
    // Efficiency e compliance ajustam, mas não inflacionam
    const efficiencyMultiplier = Math.max(0.4, (rawData.efficiency || 100) / 100);
    const complianceMultiplier = (rawData.compliance || 100) / 100;

    // Maintenance value é ~50% do OpEx (break-even point)
    const maintenanceValue = (opEx * 0.50) * efficiencyMultiplier * complianceMultiplier;

    const valueDelivered = featureValue + maintenanceValue;


    // 3. Calculate CoNQ (Cost of Non-Quality)
    // Formula: (Bugs * FixCost) + (Incidents * IncidentCost)
    const conq = (rawData.bugsGenerated * constants.BUG_FIX_COST) + (rawData.criticalIncidents * constants.INCIDENT_COST);

    // 4. Calculate ROI (Monthly Snapshot)
    // ROI = ((Value - CoNQ) - OpEx) / OpEx
    // Note: This is a monthly snapshot, real ROI is usually accumulated.
    const roi = opEx > 0 ? ((valueDelivered - conq) - opEx) / opEx : 0;

    // 5. Accumulated ROI
    const totalValue = previousAccumulatedValue + valueDelivered;
    const totalOpEx = previousAccumulatedOpEx + opEx;
    const totalCoNQ = previousAccumulatedCoNQ + conq;

    const accumulatedRoi = totalOpEx > 0 ? ((totalValue - totalCoNQ) - totalOpEx) / totalOpEx : 0;

    return {
        opEx,
        valueDelivered,
        conq,
        roi: roi * 100, // Percentage
        accumulatedRoi: accumulatedRoi * 100 // Percentage
    };
};
