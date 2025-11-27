
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SingleSimulationConfig, SimulationOutput } from "../types";

const SIMULATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        finalAdoption: { type: Type.NUMBER, description: "Porcentagem final de adoção (0-100)" },
        totalRoi: { type: Type.NUMBER, description: "ROI total calculado em porcentagem (pode ser negativo)" },
        maturityScore: { type: Type.NUMBER, description: "Pontuação final de maturidade (1-10)" },
        monthsToComplete: { type: Type.NUMBER, description: "Meses reais estimados (considerando atrasos)" },
      },
      required: ["finalAdoption", "totalRoi", "maturityScore", "monthsToComplete"],
    },
    timeline: {
      type: Type.ARRAY,
      description: "Dados de progressão mensal. DEVE incluir quedas, platôs e volatilidade realista.",
      items: {
        type: Type.OBJECT,
        properties: {
          month: { type: Type.NUMBER },
          adoptionRate: { type: Type.NUMBER },
          roi: { type: Type.NUMBER },
          compliance: { type: Type.NUMBER },
          efficiency: { type: Type.NUMBER },
        },
        required: ["month", "adoptionRate", "roi", "compliance", "efficiency"],
      },
    },
    keyPersonas: {
      type: Type.ARRAY,
      description: "Simulação de 3 a 4 arquétipos de funcionários reais que impactaram o resultado.",
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING, description: "Cargo (ex: Tech Lead Sênior, Gerente de Projetos)" },
          archetype: { type: Type.STRING, description: "Perfil psicológico (ex: O Cético, O Visionário, O Sabotador)" },
          sentiment: { type: Type.NUMBER, description: "Nível de aprovação 0-100" },
          impact: { type: Type.STRING, description: "Citação ou ação específica que esta pessoa tomou durante a simulação" }
        },
        required: ["role", "archetype", "sentiment", "impact"]
      }
    },
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: { type: Type.STRING, enum: ["Crítico", "Alto", "Médio"] },
          description: { type: Type.STRING, description: "Descrição crua e realista do risco" },
          mitigation: { type: Type.STRING },
        },
        required: ["id", "category", "description", "mitigation"],
      },
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          phase: { type: Type.STRING },
          action: { type: Type.STRING },
        },
        required: ["id", "phase", "action"],
      },
    },
    departmentReadiness: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          department: { type: Type.STRING },
          score: { type: Type.NUMBER },
        },
        required: ["department", "score"],
      },
    },
  },
  required: ["summary", "timeline", "keyPersonas", "risks", "recommendations", "departmentReadiness"],
};

export const runSimulation = async (config: SingleSimulationConfig): Promise<SimulationOutput> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Define category-specific chaos context
    let categoryContext = "";
    switch (config.frameworkCategory) {
      case 'development':
        categoryContext = "FOCO DO CAOS: Resistência técnica forte. Desenvolvedores odeiam burocracia. Problemas com ferramentas legadas. Burnout. Guerras de editor/IDE. 'Isso não escala'.";
        break;
      case 'management':
        categoryContext = "FOCO DO CAOS: Teatro corporativo. Excesso de reuniões. Média gestão com medo de perder poder. Métricas de vaidade. Processo pelo processo. 'Flavor of the month'.";
        break;
      case 'governance':
        categoryContext = "FOCO DO CAOS: Gargalos de aprovação. Shadow IT (burlar regras para entregar). Auditorias falhas. Documentação que ninguém lê. Segurança vs Velocidade.";
        break;
      default: // hybrid
        categoryContext = "FOCO DO CAOS: Conflito de prioridades. Departamentos não se falam. Confusão de papéis. Fadiga de transformação digital. Disputa por orçamento.";
        break;
    }

    // Prompt "DAN-style" for realism (Do Anything Now / Unrestricted Realism)
    // We instruct the model to simulate agents, politics, and friction.
    const prompt = `
      Atue como uma Engine de Realidade Estendida (XRE) sem filtros corporativos.
      Você NÃO é um assistente motivacional. Você é um simulador estocástico frio e calculista.
      
      OBJETIVO:
      Simular a implementação do framework "${config.frameworkName}" na empresa descrita, modelando o comportamento humano REAL (medo, preguiça, política, incompetência, genialidade).
      
      DADOS DE ENTRADA:
      - Framework: ${config.frameworkText.substring(0, 300)}...
      - Categoria: ${config.frameworkCategory.toUpperCase()}
      - Tamanho: ${config.companySize} vidas humanas (funcionários).
      - Setor: ${config.sector}.
      - Orçamento: ${config.budgetLevel}.
      
      MODIFICADOR DE CENÁRIO (${config.frameworkCategory.toUpperCase()}):
      ${categoryContext}
      
      DIRETRIZES DE SIMULAÇÃO "MODO REALISTA":
      1. AGENTES AUTÔNOMOS: Imagine que você instanciou ${config.companySize} agentes virtuais com traços de personalidade Big Five. Calcule como eles reagem a mudanças.
      2. ATRITO: A implementação NUNCA é uma linha reta. Insira quedas de produtividade quando o framework é introduzido (J-Curve).
      3. CAOS: Simule eventos aleatórios (ex: corte de verba, saída de tech lead, resistência passiva).
      4. ROI: Pode ser negativo nos primeiros meses. Não tenha medo de mostrar prejuízo inicial.
      
      SAÍDA OBRIGATÓRIA:
      - Timeline não-linear (com altos e baixos).
      - Personas detalhadas (quem está apoiando e quem está sabotando?).
      - Linguagem: PORTUGUÊS BRASIL.
      
      Retorne APENAS o JSON conforme o schema.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SIMULATION_SCHEMA,
        temperature: 0.6, // Slightly increased for more varied scenario generation
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Falha crítica na engine de simulação.");

    return JSON.parse(jsonText) as SimulationOutput;

  } catch (error) {
    console.error("Simulation Engine Critical Failure:", error);
    throw error;
  }
};