
import { SimulationOutput } from '../types';

export const MOCK_SIMULATION_RESULT: SimulationOutput = {
  frameworkName: "Scrum (MOCK MODE)",
  summary: {
    finalAdoption: 85,
    totalRoi: 120.5,
    maturityScore: 8,
    monthsToComplete: 6,
    scenarioValidity: 95
  },
  implementationNarrative: "A implementação do Scrum seguiu um caminho positivo, apesar da resistência inicial da equipe de desenvolvimento acostumada com Waterfall. O ponto de virada ocorreu no mês 3, quando as entregas começaram a ficar mais consistentes e a diretoria viu valor nas demos quinzenais. Houve um pico de estresse no mês 2 devido à cobrança por estimativas precisas.",
  sentimentBreakdown: [
    { group: "Promotores", value: 40 },
    { group: "Neutros", value: 40 },
    { group: "Detratores", value: 20 }
  ],
  resourceAllocation: [
    { category: "Treinamento", amount: 30 },
    { category: "Licenças/Ferramentas", amount: 20 },
    { category: "Consultoria", amount: 40 },
    { category: "Perda de Produtividade (Curva J)", amount: 10 }
  ],
  timeline: [
    {
      month: 1,
      adoptionRate: 20,
      roi: -15,
      compliance: 40,
      efficiency: 60,
      rawData: {
        featuresDelivered: 2,
        bugsGenerated: 5,
        criticalIncidents: 0,
        teamSize: 10,
        learningCurveFactor: 0.6
      }
    },
    {
      month: 2,
      adoptionRate: 40,
      roi: -5,
      compliance: 60,
      efficiency: 75,
      rawData: {
        featuresDelivered: 4,
        bugsGenerated: 8,
        criticalIncidents: 1,
        teamSize: 10,
        learningCurveFactor: 0.8
      }
    },
    {
      month: 3,
      adoptionRate: 60,
      roi: 20,
      compliance: 80,
      efficiency: 90,
      rawData: {
        featuresDelivered: 8,
        bugsGenerated: 4,
        criticalIncidents: 0,
        teamSize: 10,
        learningCurveFactor: 1.0
      }
    },
    {
      month: 4,
      adoptionRate: 80,
      roi: 60,
      compliance: 90,
      efficiency: 110,
      rawData: {
        featuresDelivered: 12,
        bugsGenerated: 2,
        criticalIncidents: 0,
        teamSize: 10,
        learningCurveFactor: 1.2
      }
    }
  ],
  keyPersonas: [
    {
      role: "Tech Lead / STAKEHOLDER",
      archetype: "Cético",
      sentiment: 40,
      impact: "Questionou a necessidade de Dailies todos os dias, chamando de microgerenciamento."
    },
    {
      role: "Product Owner",
      archetype: "Visionário",
      sentiment: 90,
      impact: "Defendeu o framework e blindou o time de interrupções externas."
    },
    {
      role: "Desenvolvedor Backend",
      archetype: "Pragmático",
      sentiment: 70,
      impact: "Adaptou-se bem após ver que o QA pegava menos bugs em produção."
    }
  ],
  risks: [
    {
      id: "R1",
      category: "Médio",
      description: "Resistência passiva de desenvolvedores seniores.",
      mitigation: "Focar em resultados e autonomia, não em cerimônias."
    },
    {
      id: "R2",
      category: "Alto",
      description: "Pressão da diretoria por prazos fixos em modelo ágil.",
      mitigation: "Educação sobre estimativas probabilísticas e roadmap flexível."
    }
  ],
  recommendations: [
    {
      id: "REC1",
      phase: "Início",
      action: "Contratar Agile Coach experiente para facilitar as primeiras retrospectivas."
    },
    {
      id: "REC2",
      phase: "Meio",
      action: "Automatizar o pipeline de CI/CD para reduzir o custo de deploy."
    }
  ],
  departmentReadiness: [
    { department: "TI", score: 80 },
    { department: "Financeiro", score: 40 },
    { department: "RH", score: 60 }
  ]
};
