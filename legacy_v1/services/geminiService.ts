
import { GoogleGenAI, Type } from "@google/genai";
import { SingleSimulationConfig, SimulationOutput } from "../types";

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
            description: "Dados mensais. ROI deve flutuar independentemente da adoção. ROI geralmente começa negativo (investimento).",
            items: {
                type: Type.OBJECT,
                properties: {
                    month: { type: Type.NUMBER },
                    adoptionRate: { type: Type.NUMBER },
                    roi: { type: Type.NUMBER, description: "Retorno Financeiro Mensal Acumulado %" },
                    compliance: { type: Type.NUMBER },
                    efficiency: { type: Type.NUMBER },
                },
                required: ["month", "adoptionRate", "roi", "compliance", "efficiency"],
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
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // RAG Logic Injection - Playbooks Summary
        const playbookLogic = `
      CONHECIMENTO DE PLAYBOOKS (RAG):
      - SCRUM: Daily Standup (15min, custo tempo 0.03), Sprint Planning (4h), Reviews. Falha comum: Daily vira report de status em empresas burocráticas.
      - KANBAN: Replenishment, Limite de WIP. Falha comum: WIP estoura se dívida técnica for alta.
      - SAFE: PI Planning (2 dias, custo alto), System Demo. Falha comum: Overhead de processo mata produtividade em empresas < 50 FTEs.
    `;

        // RAG Logic Injection - Business Metrics
        const metricsLogic = `
      MODELO DE MÉTRICAS FINANCEIRAS (RAG):
      - OpEx (Custo Operacional): Salários + Infra + Licenças.
      - CoNQ (Custo da Não-Qualidade): Bugs (Rework) + Incidentes.
      - Curva J (Productivity Dip): Mês 1-2 tem queda de 40% na velocidade (Learning Curve).
      - Lei de Brooks: Adicionar pessoas a projeto atrasado o atrasa mais.
      - Dívida Técnica: Juros compostos. Se ignorada, velocidade cai 50% em 6 meses.
      - ROI = ((Valor Entregue - CoNQ) - OpEx) / OpEx.
    `;

        // Sample Profiles from RAG (Condensed for context window)
        const profileSamples = `
      EXEMPLOS DE PERFIS REAIS (Use como base para 'keyPersonas'):
      1. [Tech] Avery Souza (Estagiário, Architecture): Diplomático, Foco em velocidade. Stack: React/K8s.
      2. [Tech] Vanessa Gomes (Estagiário, FullStack): Casual, Foco em qualidade. Stack: JS/Docker.
      3. [Tech] Kai Almeida (Estagiário, DevOps): Reservado, Visionário. Stack: Rust/Python.
      4. [Tech] Igor Schmidt (PM): Autista Nível 1, Metódico, Técnico puro.
      5. [Non-Tech] Sofia Pereira (Vendas): Diplomática, Líder nata. Foco em CRM.
      6. [Non-Tech] Wagner Vieira (Diretor Financeiro): Formal, Conservador. Foco em Contabilidade.
    `;

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

        // Prompt "DAN-style" for realism with Multi-Threaded Brain
        const prompt = `
      Atue como uma Engine de Realidade Estendida (XRE) e CFO Virtual Multidimensional.
      
      OBJETIVO:
      Simular a implementação do framework "${config.frameworkName}" na empresa com 95% de fidelidade ao mundo real, utilizando os dados de RAG fornecidos.
      
      DADOS DE ENTRADA:
      - Framework: ${config.frameworkText.substring(0, 500)}...
      - Categoria: ${config.frameworkCategory.toUpperCase()}
      - Tamanho: ${config.companySize} funcionários.
      - Setor: ${config.sector}.
      - Orçamento: ${config.budgetLevel}.
      - ECOSSISTEMA HUMANO: ${archetypesList}.
      
      CONHECIMENTO RAG INJETADO:
      ${playbookLogic}
      ${metricsLogic}
      ${profileSamples}
      
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

        return { ...result, frameworkName: config.frameworkName } as SimulationOutput;

    } catch (error) {
        console.error("Simulation Engine Critical Failure:", error);
        throw error;
    }
};
