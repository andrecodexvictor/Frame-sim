
export interface TimelinePoint {
  month: number;
  adoptionRate: number; // 0-100
  roi: number; // Percentage or raw value
  compliance: number; // 0-100
  efficiency: number; // 0-100
}

export interface Risk {
  id: string;
  category: 'Crítico' | 'Alto' | 'Médio' | 'Baixo';
  description: string;
  mitigation: string;
}

export interface Recommendation {
  id: string;
  phase: string;
  action: string;
}

export interface KeyPersona {
  role: string;
  archetype: string;
  sentiment: number; // 0-100
  impact: string;
}

export interface HeatmapCell {
  department: string;
  score: number; // 0-100
}

export interface SimulationOutput {
  frameworkName: string; // Added to identify output in comparison
  summary: {
    finalAdoption: number;
    totalRoi: number;
    maturityScore: number; // 0-10
    monthsToComplete: number;
  };
  timeline: TimelinePoint[];
  keyPersonas: KeyPersona[];
  risks: Risk[];
  recommendations: Recommendation[];
  departmentReadiness: HeatmapCell[];
}

export interface FrameworkInput {
  id: string;
  name: string;
  text: string;
}

export interface SimulationConfig {
  frameworks: FrameworkInput[]; // Changed from single name/text to array
  frameworkCategory: 'development' | 'management' | 'governance' | 'hybrid';
  companySize: number;
  sector: 'tech' | 'finance' | 'retail' | 'healthcare' | 'other';
  currentMaturity: number; // 1-5
  budgetLevel: 'low' | 'medium' | 'high';
}

export interface SingleSimulationConfig extends Omit<SimulationConfig, 'frameworks'> {
  frameworkName: string;
  frameworkText: string;
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  CONFIG = 'CONFIG',
  SIMULATING = 'SIMULATING',
  RESULTS = 'RESULTS',
}