
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
    // New Visual Data
    implementationNarrative: string; // Story of how it went
    sentimentBreakdown: Array<{
        group: string; // e.g., "Promotores", "Neutros", "Detratores"
        value: number;
    }>;
    resourceAllocation: Array<{
        category: string; // e.g., "Treinamento", "Ferramentas", "Consultoria", "Perda Produtividade"
        amount: number; // Percentage or value
    }>;

    timeline: Array<{
        month: number;
        adoptionRate: number;
        roi: number;
        compliance: number;
        efficiency: number;
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
}
