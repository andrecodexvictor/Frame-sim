
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

/**
 * SURPRISE FACTOR - Elemento de surpresa para casos excepcionais
 * 
 * Permite resultados positivos inesperados em ~15% dos casos quando:
 * - Equipe demonstra alta adaptação (learningCurveFactor alto)
 * - Poucos bugs gerados (equipe engajada)
 * - Eficiência acima da média
 * 
 * Isso simula casos reais onde pequenas empresas ou equipes em situações
 * difíceis conseguem resultados excepcionais por engajamento excepcional.
 */
export const calculateSurpriseFactor = (
    rawData: SimulationRawData,
    config: SimulationConfig
): { multiplier: number; triggered: boolean; reason?: string } => {

    // Sinais de adaptação excepcional
    const highAdaptation = rawData.learningCurveFactor >= 1.1;
    const lowBugRatio = rawData.bugsGenerated < (rawData.featuresDelivered * 0.3);
    const highEfficiency = (rawData.efficiency || 100) >= 85;
    const smallAgileTeam = rawData.teamSize <= 50;

    // Calcular probabilidade de surpresa (base 5%, máx 20%)
    let surpriseProbability = 0.05;
    if (highAdaptation) surpriseProbability += 0.05;
    if (lowBugRatio) surpriseProbability += 0.03;
    if (highEfficiency) surpriseProbability += 0.04;
    if (smallAgileTeam) surpriseProbability += 0.03; // Pequenas equipes podem ser mais ágeis

    // Roll the dice
    const roll = Math.random();
    const triggered = roll < surpriseProbability;

    if (!triggered) {
        return { multiplier: 1.0, triggered: false };
    }

    // Determinar intensidade da surpresa (1.15 a 1.40)
    let multiplier = 1.15 + (Math.random() * 0.25);
    let reason = '🎲 Adoção Surpreendente: ';

    if (highAdaptation && lowBugRatio) {
        reason += 'Equipe demonstrou adaptação excepcional com alta qualidade.';
        multiplier += 0.05;
    } else if (smallAgileTeam && highEfficiency) {
        reason += 'Empresa pequena conseguiu agilidade acima do esperado.';
        multiplier += 0.03;
    } else if (config.techDebtLevel === 'high' || config.techDebtLevel === 'critical') {
        reason += 'Equipe superou obstáculos técnicos com engajamento excepcional.';
        multiplier += 0.08; // Bônus maior por superar dívida técnica
    } else {
        reason += 'Fatores culturais positivos aceleraram a adoção.';
    }

    console.log(`✨ SURPRISE FACTOR TRIGGERED: ${reason} (multiplier: ${multiplier.toFixed(2)})`);

    return {
        multiplier: Math.min(1.50, multiplier), // Cap at 50% boost
        triggered: true,
        reason
    };
};

/**
 * FRAMEWORK-ORGANIZATION FIT - Avalia compatibilidade framework vs organização
 * 
 * Frameworks leves (Scrum, Kanban, XP) funcionam melhor em orgs pequenas
 * Frameworks pesados (SAFe, COBIT, TOGAF) requerem estrutura e budget
 * 
 * Retorna um multiplicador:
 * - < 1.0: Fit ruim (framework grande demais ou pequeno demais)
 * - = 1.0: Fit neutro
 * - > 1.0: Fit excelente (framework ideal para o contexto)
 */

// Classificação de frameworks por complexidade
const FRAMEWORK_COMPLEXITY: Record<string, 'lightweight' | 'medium' | 'enterprise' | 'unknown'> = {
    // Leves - ideais para pequenas empresas
    'scrum': 'lightweight',
    'kanban': 'lightweight',
    'xp': 'lightweight',
    'extreme programming': 'lightweight',
    'lean': 'lightweight',
    'scrumban': 'lightweight',

    // Médios - flexíveis
    'spotify': 'medium',
    'less': 'medium',
    'nexus': 'medium',
    'crystal': 'medium',
    'dsdm': 'medium',

    // Enterprise - requerem estrutura
    'safe': 'enterprise',
    'scaled agile': 'enterprise',
    'cobit': 'enterprise',
    'itil': 'enterprise',
    'togaf': 'enterprise',
    'prince2': 'enterprise',
    'pmbok': 'enterprise',
    'cmmi': 'enterprise',
    'iso 27001': 'enterprise',
    'sox': 'enterprise',
};

export const calculateFrameworkFit = (
    frameworkName: string,
    companySize: number,
    budgetLevel: string,
    category: string
): { multiplier: number; fitLevel: 'EXCELENTE' | 'BOM' | 'NEUTRO' | 'RUIM' | 'PÉSSIMO'; reason: string } => {

    // Detectar complexidade do framework pelo nome
    const nameLower = frameworkName.toLowerCase();
    let complexity: 'lightweight' | 'medium' | 'enterprise' | 'unknown' = 'unknown';

    for (const [key, value] of Object.entries(FRAMEWORK_COMPLEXITY)) {
        if (nameLower.includes(key)) {
            complexity = value;
            break;
        }
    }

    // Se não encontrou, inferir pela categoria
    if (complexity === 'unknown') {
        if (category === 'governance') complexity = 'enterprise';
        else if (category === 'development') complexity = 'lightweight';
        else complexity = 'medium';
    }

    // Classificar tamanho da empresa
    const isSmall = companySize <= 50;
    const isMedium = companySize > 50 && companySize <= 200;
    const isLarge = companySize > 200;
    const hasLowBudget = budgetLevel === 'low' || budgetLevel === 'very_low';

    let multiplier = 1.0;
    let fitLevel: 'EXCELENTE' | 'BOM' | 'NEUTRO' | 'RUIM' | 'PÉSSIMO' = 'NEUTRO';
    let reason = '';

    // CENÁRIO 1: Framework leve + empresa pequena = EXCELENTE
    if (complexity === 'lightweight' && isSmall) {
        multiplier = 1.20 + (Math.random() * 0.15); // 1.20 a 1.35
        fitLevel = 'EXCELENTE';
        reason = `🎯 FIT EXCELENTE: ${frameworkName} é ideal para equipes pequenas e ágeis.`;
    }
    // CENÁRIO 2: Framework leve + empresa média = BOM
    else if (complexity === 'lightweight' && isMedium) {
        multiplier = 1.10;
        fitLevel = 'BOM';
        reason = `✅ FIT BOM: ${frameworkName} funciona bem em empresas de médio porte.`;
    }
    // CENÁRIO 3: Framework enterprise + empresa pequena sem budget = PÉSSIMO
    else if (complexity === 'enterprise' && isSmall && hasLowBudget) {
        multiplier = 0.60 + (Math.random() * 0.10); // 0.60 a 0.70
        fitLevel = 'PÉSSIMO';
        reason = `❌ FIT PÉSSIMO: ${frameworkName} é muito pesado para uma empresa pequena sem orçamento. Overhead excessivo.`;
    }
    // CENÁRIO 4: Framework enterprise + empresa pequena com budget = RUIM
    else if (complexity === 'enterprise' && isSmall) {
        multiplier = 0.75;
        fitLevel = 'RUIM';
        reason = `⚠️ FIT RUIM: ${frameworkName} requer estrutura que a empresa não possui. Considere versão simplificada.`;
    }
    // CENÁRIO 5: Framework enterprise + empresa grande = BOM
    else if (complexity === 'enterprise' && isLarge) {
        multiplier = 1.15;
        fitLevel = 'BOM';
        reason = `✅ FIT BOM: ${frameworkName} é apropriado para a escala da organização.`;
    }
    // CENÁRIO 6: Framework médio + qualquer tamanho = NEUTRO a BOM
    else if (complexity === 'medium') {
        multiplier = isMedium ? 1.10 : 1.0;
        fitLevel = isMedium ? 'BOM' : 'NEUTRO';
        reason = `📊 FIT ${fitLevel}: ${frameworkName} oferece flexibilidade para diferentes contextos.`;
    }

    if (multiplier !== 1.0) {
        console.log(`🎯 FRAMEWORK FIT: ${reason} (multiplier: ${multiplier.toFixed(2)})`);
    }

    return { multiplier, fitLevel, reason };
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
    if (config.techDebtLevel === 'high') techDebtPenalty = 0.85;
    if (config.techDebtLevel === 'critical') techDebtPenalty = 0.65;

    // Team scale factor (logarithmic)
    const teamScaleFactor = Math.log10(Math.max(10, rawData.teamSize)) / 2;

    // Feature Value (New Deliverables)
    const featureValue = rawData.featuresDelivered * constants.FEATURE_VALUE * teamScaleFactor * rawData.learningCurveFactor * techDebtPenalty;

    // Maintenance Value (Business as Usual) - RESPONSIVE to scenario
    // Base: 65%, adjusted by efficiency and compliance
    // Extreme scenarios (critical debt + previous failures) can drop to 55%
    // Good scenarios (low debt, no failures) can reach 75%
    const efficiencyMultiplier = Math.max(0.4, (rawData.efficiency || 100) / 100);
    const complianceMultiplier = (rawData.compliance || 100) / 100;

    // Dynamic base rate based on tech debt and scenario health
    let maintenanceBaseRate = 0.65; // Neutral starting point
    if (config.techDebtLevel === 'low') maintenanceBaseRate += 0.10; // Healthy codebase = more value
    if (config.techDebtLevel === 'critical') maintenanceBaseRate -= 0.10; // Crisis mode = less value
    if (config.previousFailures) maintenanceBaseRate -= 0.05; // Trauma overhead
    // Clamp between 0.55 (extreme negative) and 0.75 (best case)
    maintenanceBaseRate = Math.max(0.55, Math.min(0.75, maintenanceBaseRate));

    const maintenanceValue = (opEx * maintenanceBaseRate) * efficiencyMultiplier * complianceMultiplier;

    // BASE value before surprise factor
    let valueDelivered = featureValue + maintenanceValue;

    // SURPRISE FACTOR: Rare positive boost for exceptional adaptation
    const surprise = calculateSurpriseFactor(rawData, config);
    if (surprise.triggered) {
        valueDelivered *= surprise.multiplier;
    }

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
