/// <reference types="vite/client" />

import { GoogleGenAI, Type } from "@google/genai";
import { SingleSimulationConfig, SimulationOutput } from "../types";
import { calculateMonthlyMetrics, SimulationRawData } from "./metricsCalculator";
import { MOCK_SIMULATION_RESULT } from "./mockData";
import { generateRAGContext, injectRAGContext } from "./ragService";


// === NEW: Document Digestion Service (Gemini Flash) ===
export const digestFrameworkDocument = async (rawText: string): Promise<string> => {
  try {
    const apiKey = import.meta.env.VITE_API_KEY || process.env.API_KEY;
    if (!apiKey) return rawText; // Fallback if no key

    const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Você é um Arquiteto de Soluções Sênior. Sua tarefa é analisar este documento técnico de um Framework Corporativo e extrair um MANIFESTO ESTRUTURADO DENSO para ser usado em uma simulação.
            
            Foque em:
            1. Valores Core e Filosofia
            2. Papéis e Responsabilidades (Quem faz o que)
            3. Cerimônias, Reuniões e Eventos
            4. Artefatos e Saídas
            5. Estratégias de Adoção Recomendadas

            Se o texto for muito longo, priorize os processos e regras de negócio.
            
            SAÍDA: Um texto Markdown bem estruturado e conciso (máximo 4000 caracteres) com essas seções.`
          }, {
            text: `DOCUMENTO ORIGINAL (Trecho): ${rawText.slice(0, 500000)}` // Limit to safe Flash context
          }]
        }]
      })
    });

    const data = await result.json();
    const digest = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return digest ? `=== DOCUMENTO DIGERIDO (via Gemini 1.5 Flash) ===\n\n${digest}` : rawText;

  } catch (error) {
    console.error("Erro na digestão do documento:", error);
    return rawText; // Fallback to raw text on error
  }
};


const SIMULATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        finalAdoption: { type: Type.NUMBER, description: "Porcentagem final de adoção (0-100)" },
        totalRoi: { type: Type.NUMBER, description: "ROI financeiro. IMPORTANTE: Pode ser negativo (ex: -20) ou alto (ex: 350)." },
        maturityScore: { type: Type.NUMBER, description: "Pontuação final de maturidade (1-10)" },
        monthsToComplete: { type: Type.NUMBER, description: "Meses reais estimados (considerando atrasos)" },
        scenarioValidity: { type: Type.NUMBER, description: "Score de 0-100 indicando a viabilidade/realismo da combinação de cenário proposta." },
      },
      required: ["finalAdoption", "totalRoi", "maturityScore", "monthsToComplete", "scenarioValidity"],
    },
    implementationNarrative: { type: Type.STRING, description: "Um resumo executivo de 2-3 parágrafos contando a história de como foi a implantação, focando nos pontos de virada." },
    roiAnalysis: {
      type: Type.OBJECT,
      description: "Análise detalhada explicando por que o ROI ficou positivo ou negativo",
      properties: {
        verdict: { type: Type.STRING, enum: ["POSITIVO", "NEGATIVO", "NEUTRO"], description: "Resultado geral do ROI" },
        mainFactors: {
          type: Type.ARRAY,
          description: "3-5 fatores principais que influenciaram o ROI (positivos ou negativos)",
          items: {
            type: Type.OBJECT,
            properties: {
              factor: { type: Type.STRING, description: "Nome do fator (ex: 'Curva J Acentuada', 'Dívida Técnica', 'Resistência Cultural')" },
              impact: { type: Type.STRING, enum: ["POSITIVO", "NEGATIVO"], description: "Se contribuiu positiva ou negativamente" },
              description: { type: Type.STRING, description: "Explicação curta de como este fator afetou o ROI" }
            },
            required: ["factor", "impact", "description"]
          }
        },
        breakEvenMonth: { type: Type.NUMBER, description: "Mês em que o ROI passou a ser positivo (0 se nunca)" },
        recommendation: { type: Type.STRING, description: "Recomendação de 1 frase para melhorar o ROI" }
      },
      required: ["verdict", "mainFactors", "breakEvenMonth", "recommendation"]
    },
    sentimentBreakdown: {
      type: Type.ARRAY,
      description: "Distribuição do sentimento dos funcionários para gráfico de pizza/rosca.",
      items: {
        type: Type.OBJECT,
        properties: {
          group: { type: Type.STRING, enum: ["Promotores", "Neutros", "Detratores"] },
          value: { type: Type.NUMBER, description: "Quantidade de pessoas ou porcentagem" }
        },
        required: ["group", "value"]
      }
    },
    resourceAllocation: {
      type: Type.ARRAY,
      description: "Onde o orçamento/esforço foi gasto para gráfico de pizza.",
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: ["Treinamento", "Licenças/Ferramentas", "Consultoria", "Perda de Produtividade (Curva J)"] },
          amount: { type: Type.NUMBER, description: "Valor relativo ou porcentagem" }
        },
        required: ["category", "amount"]
      }
    },
    timeline: {
      type: Type.ARRAY,
      description: "Dados mensais. OBRIGATÓRIO: Forneça os dados brutos operacionais (features, bugs) para que o sistema calcule o ROI exato.",
      items: {
        type: Type.OBJECT,
        properties: {
          month: { type: Type.NUMBER },
          adoptionRate: { type: Type.NUMBER },
          // Removed ROI from LLM responsibility - it will be calculated
          compliance: { type: Type.NUMBER },
          efficiency: { type: Type.NUMBER },
          rawData: {
            type: Type.OBJECT,
            properties: {
              featuresDelivered: { type: Type.NUMBER, description: "Quantidade absoluta de features, histórias ou PROCESSOS/CONTROLES (para Governança) entregues." },
              bugsGenerated: { type: Type.NUMBER, description: "Quantidade de bugs encontrados em produção" },
              criticalIncidents: { type: Type.NUMBER, description: "Incidentes graves (P0)" },
              teamSize: { type: Type.NUMBER, description: "Tamanho do time neste mês" },
              learningCurveFactor: { type: Type.NUMBER, description: "Fator de produtividade (0.5 = aprendendo, 1.0 = normal, 1.2 = performando)" }
            },
            required: ["featuresDelivered", "bugsGenerated", "criticalIncidents", "teamSize", "learningCurveFactor"]
          }
        },
        required: ["month", "adoptionRate", "compliance", "efficiency", "rawData"],
      },
    },
    keyPersonas: {
      type: Type.ARRAY,
      description: "Simulação de 3 a 5 arquétipos de funcionários reais que impactaram o resultado. OBRIGATÓRIO: Identifique stakeholders críticos.",
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING, description: "Cargo e Nome fictício baseado no perfil. ADICIONE ' / STAKEHOLDER' AO FINAL SE FOR UM TOMADOR DE DECISÃO CRÍTICO." },
          archetype: { type: Type.STRING, description: "Perfil psicológico utilizado (ex: Cético, Visionário)" },
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
  required: ["summary", "implementationNarrative", "sentimentBreakdown", "resourceAllocation", "timeline", "keyPersonas", "risks", "recommendations", "departmentReadiness"],
};

export const runSimulation = async (config: SingleSimulationConfig): Promise<SimulationOutput> => {
  try {
    const apiKey = import.meta.env.VITE_API_KEY || process.env.API_KEY;

    // Fallback to Mock if no API Key (Safety Net)
    if (!apiKey) {
      console.warn("No API Key found. Using Mock Mode.");
      return { ...MOCK_SIMULATION_RESULT, frameworkName: config.frameworkName };
    }

    const ai = new GoogleGenAI({ apiKey });

    // ===== RAG OTIMIZADO =====
    // Gera contexto RAG baseado na configuração (Self-RAG implícito)
    const ragContext = generateRAGContext(config);
    const ragInjection = injectRAGContext(ragContext);

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

    const archetypesList = config.employeeArchetypes && config.employeeArchetypes.length > 0
      ? config.employeeArchetypes.join(", ")
      : "Mistura padrão de céticos e pragmáticos";

    const isHighDensity = config.employeeArchetypes && config.employeeArchetypes.length > 5;

    // Realism Factors Calculation
    const realismContext = `
      FATORES DE REALISMO (ACCURACY 95%):
      - Dívida Técnica: ${config.techDebtLevel.toUpperCase()} ${config.techDebtLevel === 'critical' ? '(Sistemas quase colapsando, qualquer mudança quebra tudo)' : ''}
      - Velocidade Operacional: ${config.operationalVelocity.toUpperCase()}
      - Trauma Anterior: ${config.previousFailures ? 'SIM (Funcionários céticos, "lá vem outra bala de prata")' : 'NÃO'}
      - Cenário Específico: ${config.scenarioContext}
    `;

    // Prompt otimizado com RAG dinâmico
    const prompt = `
      Atue como uma Engine de Realidade Estendida (XRE) e CFO Virtual Multidimensional.
      
      OBJETIVO:
      Simular a implementação do framework "${config.frameworkName}" na empresa com 95% de fidelidade ao mundo real, utilizando os dados de RAG fornecidos.
      
      DADOS DE ENTRADA:
      - Framework: ${config.frameworkText.substring(0, 5000)}...
      - Categoria: ${config.frameworkCategory.toUpperCase()}
      - Tamanho: ${config.companySize} funcionários.
      - Setor: ${config.sector}.
      - Orçamento: ${config.budgetLevel}.
      - ECOSSISTEMA HUMANO: ${archetypesList}.
      
      INSTRUÇÃO DE CONTEXTO:
      Caso o texto do "Framework" acima seja breve ou genérico, você DEVE utilizar seu vasto conhecimento interno sobre o framework citado (rituais, papéis, artefatos, métricas) para preencher as lacunas. Não invente frameworks inexistentes, mas expanda os conceitos padrão de mercado se necessário.

      ${ragInjection}
      
      MODIFICADORES DE CENÁRIO:
      ${categoryContext}
      ${realismContext}
      
      ${isHighDensity ? "ALERTA DE ALTA DENSIDADE: Muitos arquétipos selecionados. Simule conflitos interdepartamentais." : ""}

      PROCESSAMENTO MULTI-VERTENTE (SIMULAÇÃO PARALELA):
      Obrigatório analisar a simulação sob 3 vertentes distintas antes de consolidar:
      1. VERTENTE FINANCEIRA (CFO): Foco em custo (OpEx), ROI e desperdício. Aplique a lógica de Custo da Não-Qualidade.
      2. VERTENTE TÉCNICA (CTO): Foco em débito técnico, complexidade e resistência dos devs. Aplique a lógica da Curva J.
      3. VERTENTE CULTURAL (RH): Foco em burnout, política interna e "Rádio Peão". Use os perfis de exemplo para gerar personas realistas.
      
      PROTOCOLO DE REALISMO ABSOLUTO & VALIDAÇÃO:
      1. Se o cenário for implausível (ex: Scrum em fábrica de 100 anos sem computadores), o 'scenarioValidity' deve ser baixo (<40).
      2. SE 'Dívida Técnica' for ALTA/CRÍTICA -> O ROI inicial DEVE ser fortemente negativo (refatoração forçada e CoNQ alto).
      3. SE 'Trauma Anterior' for SIM -> Adoção começa muito lenta (abaixo de 10%) por 3-6 meses.
      
      STAKEHOLDERS E PERSONAS:
      No array 'keyPersonas', você DEVE identificar explicitamente quem são os Stakeholders Críticos.
      Para estes personas, adicione o texto " / STAKEHOLDER" ao final do campo 'role'. 
      Use nomes e traços psicológicos baseados nos "EXEMPLOS DE PERFIS REAIS" fornecidos acima para dar vida aos personagens.
      
      SAÍDA OBRIGATÓRIA:
      - JSON estrito conforme o schema.
      - Timeline DEVE conter exatamente ${config.durationMonths || 12} meses.
      - Personas reagindo especificamente ao cenário (Ex: 'Wagner Vieira' bloqueando orçamento devido a ROI baixo).
      - Linguagem: PORTUGUÊS BRASIL.
      
      Retorne APENAS o JSON conforme o schema.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SIMULATION_SCHEMA,
        temperature: 0.6,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Falha crítica na engine de simulação.");

    // Sanitization to prevent JSON parse errors if model adds markdown blocks
    // Note: The regex below is safe.
    const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanJson);

    // Safety: ensure default validation score if missing
    if (result.summary && typeof result.summary.scenarioValidity === 'undefined') {
      result.summary.scenarioValidity = 50;
    }

    // Post-Processing: Calculate Deterministic ROI
    let accumulatedValue = 0;
    let accumulatedOpEx = 0;
    let accumulatedCoNQ = 0;

    const processedTimeline = result.timeline.map((monthData: any) => {
      // Safety check for rawData
      const rawData = monthData.rawData || {
        featuresDelivered: 5,
        bugsGenerated: 2,
        criticalIncidents: 0,
        teamSize: config.companySize,
        learningCurveFactor: 1.0
      };

      const metrics = calculateMonthlyMetrics(
        rawData,
        config as any, // Type assertion needed as SingleSimulationConfig is slightly different from SimulationConfig but compatible for this
        accumulatedValue,
        accumulatedOpEx,
        accumulatedCoNQ
      );

      // Update accumulators
      accumulatedValue += metrics.valueDelivered;
      accumulatedOpEx += metrics.opEx;
      accumulatedCoNQ += metrics.conq;

      return {
        ...monthData,
        roi: parseFloat(metrics.accumulatedRoi.toFixed(2)), // Overwrite LLM ROI with calculated one
        rawData // Keep raw data for transparency
      };
    });

    const finalResult = {
      ...result,
      timeline: processedTimeline,
      summary: {
        ...result.summary,
        totalRoi: parseFloat(((accumulatedValue - accumulatedCoNQ - accumulatedOpEx) / accumulatedOpEx * 100).toFixed(2))
      },
      frameworkName: config.frameworkName
    };

    return finalResult as SimulationOutput;

  } catch (error) {
    console.error("Simulation Engine Critical Failure:", error);
    console.warn("Falling back to MOCK MODE due to error.");
    // Safe Mode: Return Mock Data instead of crashing
    return { ...MOCK_SIMULATION_RESULT, frameworkName: config.frameworkName };
  }
};
