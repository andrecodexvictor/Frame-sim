
export interface FrameworkInput {
  id: string;
  name: string;
  text: string;
}

export type CorporateArchetype =
  | 'visionary'       // Early adopter, takes risks
  | 'skeptic'         // "We tried this before"
  | 'bureaucrat'      // Loves process, hates change
  | 'legacy_keeper'   // Protects old systems
  | 'overworked'      // No time for new things
  | 'new_grad'        // Eager but inexperienced
  | 'political_player' // Uses framework for power
  | 'hr_guardian'     // Focus on culture/people protection
  | 'sales_shark'     // Revenue first, process later
  | 'data_driven'     // Needs metrics, hates feeling
  | 'senior_staff'    // High XP, pragmatic, expensive
  | 'mid_level'       // The execution engine (Pleno)
  | 'ceo'             // Chief Executive Officer
  | 'cmo'             // Chief Marketing Officer
  | 'cto'             // Chief Technology Officer
  | 'cfo'             // Chief Financial Officer
  | 'coo';            // Chief Operating Officer

export interface SimulationConfig {
  frameworks: FrameworkInput[];
  frameworkCategory: 'development' | 'management' | 'governance' | 'hybrid' | string;
  companySize: number;
  currentMaturity: number;
  sector: string;
  budgetLevel: string;
  employeeArchetypes: CorporateArchetype[];

  // Realism & Accuracy Parameters
  techDebtLevel: 'low' | 'medium' | 'high' | 'critical';
  operationalVelocity: 'startup' | 'agile' | 'bureaucrat' | 'fossilized';
  previousFailures: boolean;

  // Scenario Context
  scenarioMode: 'recommended' | 'custom';
  selectedScenarioId?: string;
  customScenarioText?: string;
  durationMonths?: number;

  // Economic Profile (Custo Dinâmico)
  economicProfileId?: string; // e.g., 'br_pme', 'br_startup', 'us_faang'

  // Agentic Mode
  simulationMode?: 'standard' | 'agentic';
}

export interface SingleSimulationConfig {
  frameworkName: string;
  frameworkText: string;
  frameworkCategory: string;
  companySize: number;
  sector: string;
  budgetLevel: string;
  currentMaturity?: number;
  employeeArchetypes: CorporateArchetype[];

  // Accuracy & Context
  techDebtLevel: string;
  operationalVelocity: string;
  previousFailures: boolean;
  scenarioContext: string;
  durationMonths?: number;
}

export interface SimulationOutput {
  frameworkName: string;
  summary: {
    finalAdoption: number;
    totalRoi: number;
    maturityScore: number;
    monthsToComplete: number;
    scenarioValidity?: number;
  };

  // Core Visual Data
  implementationNarrative: string;
  sentimentBreakdown: Array<{
    group: string;
    value: number;
  }>;
  resourceAllocation: Array<{
    category: string;
    amount: number;
  }>;

  timeline: Array<{
    month: number;
    adoptionRate: number;
    roi: number;
    compliance: number;
    efficiency: number;
    rawData?: {
      featuresDelivered: number;
      bugsGenerated: number;
      criticalIncidents: number;
      teamSize: number;
      learningCurveFactor: number;
    };
  }>;

  keyPersonas: Array<{
    role: string;
    archetype: string;
    sentiment: number;
    impact: string;
  }>;

  risks: Array<{
    id: string;
    category: string;
    description: string;
    mitigation: string;
  }>;

  recommendations: Array<{
    id: string;
    phase: string;
    action: string;
  }>;

  departmentReadiness: Array<{
    department: string;
    score: number;
  }>;

  // ROI Analysis
  roiAnalysis?: {
    verdict: 'POSITIVO' | 'NEGATIVO' | 'NEUTRO';
    mainFactors: Array<{
      factor: string;
      impact: 'POSITIVO' | 'NEGATIVO';
      description: string;
    }>;
    breakEvenMonth: number;
    recommendation: string;
  };

  // NEW: Business Performance Metrics (Phase 5)
  businessMetrics?: {
    efficiencyGain: number;      // % improvement in team efficiency
    reworkReduction: number;     // % reduction in rework/bugs
    processAgility: number;      // % improvement in process speed
    timeToMarket: number;        // % reduction in delivery time
    qualityScore: number;        // Overall quality index (0-100)
  };

  // NEW: Company Evolution Metrics
  companyEvolution?: {
    initialTeamSize: number;
    finalTeamSize: number;
    newHires: number;
    turnover: number;            // % of people who left
    promotions: number;
    capacityGrowth: number;      // % growth in delivery capacity
    breakEvenProjection: number; // Month when ROI becomes positive (0 = never in period)
    maturityLevelBefore: number; // 1-5 scale
    maturityLevelAfter: number;  // 1-5 scale
    culturalShift: 'RESISTENTE' | 'NEUTRO' | 'FAVORÁVEL' | 'ENTUSIASTA';
  };

  // Agentic Observability (Developer Only)
  agenticMetrics?: AgenticMetrics;
}

export interface AgenticMetrics {
  quality_per_cycle: number;
  time_to_solve_ms: number;
  cost_estimate_usd: number;
  total_tokens: number;
  router_choice: string;
}
