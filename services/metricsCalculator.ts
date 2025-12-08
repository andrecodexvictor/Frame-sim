
import { SimulationConfig } from '../types';
import costProfiles from '../data/cost_profiles.json';

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

export interface CostConstants {
    DEV_DAY_COST: number;
    SENIOR_DEV_DAY_COST: number;
    FEATURE_VALUE: number;
    INCIDENT_COST: number;
    BUG_FIX_COST: number;
    TRAINING_COST_PER_HEAD: number;
    TURNOVER_COST_MULTIPLIER: number;
}

// Default Constants (fallback if no profile selected)
const DEFAULT_CONSTANTS: CostConstants = {
    DEV_DAY_COST: 400,
    SENIOR_DEV_DAY_COST: 700,
    FEATURE_VALUE: 3000,
    INCIDENT_COST: 5000,
    BUG_FIX_COST: 300,
    TRAINING_COST_PER_HEAD: 2000,
    TURNOVER_COST_MULTIPLIER: 3
};

/**
 * Recupera as constantes de custo baseadas no perfil econômico selecionado
 */
export const getCostConstants = (profileId?: string): CostConstants => {
    if (!profileId) return DEFAULT_CONSTANTS;

    const profile = costProfiles.profiles.find(p => p.id === profileId);
    if (!profile) {
        console.warn(`Cost profile '${profileId}' not found, using default`);
        return DEFAULT_CONSTANTS;
    }

    return profile.constants as CostConstants;
};

/**
 * Recupera informações do perfil econômico para exibição
 */
export const getCostProfile = (profileId?: string) => {
    if (!profileId) return null;
    return costProfiles.profiles.find(p => p.id === profileId) || null;
};

/**
 * Lista todos os perfis disponíveis
 */
export const getAllCostProfiles = () => {
    return costProfiles.profiles;
};

export const calculateMonthlyMetrics = (
    rawData: SimulationRawData,
    config: SimulationConfig,
    previousAccumulatedValue: number = 0,
    previousAccumulatedOpEx: number = 0,
    previousAccumulatedCoNQ: number = 0
): CalculatedMetrics => {

    // Use dynamic cost profile or fallback to default
    const constants = getCostConstants(config.economicProfileId);

    // 1. Calculate OpEx (Operational Expenditure)
    // Formula: (Devs * DailyCost * 22 days)
    const opEx = rawData.teamSize * constants.DEV_DAY_COST * 22;

    // 2. Calculate Value Delivered
    // Formula: Features * ValuePerPoint * LearningCurve
    // Tech Debt Impact: If critical, value is reduced by 20%
    let techDebtPenalty = 1.0;
    if (config.techDebtLevel === 'high') techDebtPenalty = 0.8;
    if (config.techDebtLevel === 'critical') techDebtPenalty = 0.5;

    // Team scale factor (logarithmic)
    const teamScaleFactor = Math.log10(Math.max(10, rawData.teamSize)) / 2;

    // Feature Value (New Deliverables)
    const featureValue = rawData.featuresDelivered * constants.FEATURE_VALUE * teamScaleFactor * rawData.learningCurveFactor * techDebtPenalty;

    // Maintenance Value (Business as Usual)
    const efficiencyMultiplier = Math.max(0.4, (rawData.efficiency || 100) / 100);
    const complianceMultiplier = (rawData.compliance || 100) / 100;
    const maintenanceValue = (opEx * 0.50) * efficiencyMultiplier * complianceMultiplier;

    const valueDelivered = featureValue + maintenanceValue;

    // 3. Calculate CoNQ (Cost of Non-Quality)
    const conq = (rawData.bugsGenerated * constants.BUG_FIX_COST) + (rawData.criticalIncidents * constants.INCIDENT_COST);

    // 4. Calculate ROI (Monthly Snapshot)
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
