/**
 * RAG Service - Integração do sistema RAG otimizado com o projeto principal
 * 
 * Este serviço conecta os componentes do RAG implement/ com o geminiService.ts
 * Usa Self-RAG para decidir automaticamente quando usar retrieval
 */

import { GoogleGenAI } from "@google/genai";
import type { SingleSimulationConfig } from "../types";

// Tipos do sistema RAG
export type QueryMode =
    | 'PERSONA_PURA'
    | 'CALCULO_ROI'
    | 'CENARIO_COMPARATIVO'
    | 'EVENTO_SIMULACAO'
    | 'HIBRIDO';

export interface QueryClassification {
    mode: QueryMode;
    confidence: number;
    shouldUseRAG: boolean;
    collections: string[];
}

export interface RAGContext {
    playbooks: string;
    metrics: string;
    profiles: string;
    events: string;
}

// Few-shot examples por arquétipo (condensados para contexto)
const ARCHETYPE_EXAMPLES: Record<string, string[]> = {
    'CEO_CETICO': [
        'Situação: Proposta de Scrum → "Já tentamos isso em 2019. Perdemos 3 meses e 2 Tech Leads."',
        'Situação: ROI positivo → "Interessante, mas precisamos de 3 trimestres consecutivos para validar."'
    ],
    'CFO_PRAGMATICO': [
        'Situação: Pedido de budget → "Qual o payback esperado? Preciso de cenários pessimista/realista/otimista."',
        'Situação: Atraso em projeto → "Cada dia nos custa R$50.000. Quais opções para acelerar?"'
    ],
    'CTO_ENTUSIASTA': [
        'Situação: Daily Standup → "Excelente! Vamos começar com piloto no squad de plataforma."',
        'Situação: Resistência → "Workshops hands-on. A melhor forma de convencer é mostrar resultados."'
    ],
    'TECH_LEAD_CETICO': [
        'Situação: Mais cerimônias → "Mais reuniões? Já perdemos 30% do tempo. Prefiro reviews assíncronos."',
        'Situação: Pair programming → "Funciona para contextos específicos, obrigar em tudo reduz velocidade."'
    ],
    'DEV_SENIOR_AUTONOMO': [
        'Situação: Mudança de framework → "Desde que não interfira no meu fluxo, não tenho problemas."',
        'Situação: Retro semanal → "Prefiro a cada duas semanas. Semanal não dá tempo de ter progresso."'
    ]
};

// Curva J - fatores de adaptação por mês
const J_CURVE_FACTORS = [0.6, 0.6, 0.9, 0.9, 1.2, 1.2, 1.3, 1.3, 1.4, 1.4, 1.5, 1.5];

// Modificadores de dívida técnica
const TECH_DEBT_MODIFIERS: Record<string, { bugs: number; velocity: number; taxa: number }> = {
    'low': { bugs: 0.8, velocity: 1.0, taxa: 0.01 },
    'medium': { bugs: 1.0, velocity: 0.9, taxa: 0.05 },
    'high': { bugs: 1.5, velocity: 0.7, taxa: 0.10 },
    'critical': { bugs: 2.0, velocity: 0.5, taxa: 0.15 }
};

/**
 * Classificador de Query (Self-RAG)
 * Decide se deve usar RAG e quais fontes consultar
 */
export async function classifyQuery(
    query: string,
    apiKey: string
): Promise<QueryClassification> {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Classifique esta query para um sistema de simulação empresarial:

Query: "${query}"

Tipos:
- PERSONA_PURA: Comportamento de stakeholder específico (ex: "Como o CEO reagiria?") → NÃO precisa RAG
- CALCULO_ROI: Métricas financeiras (ex: "Qual o break-even?") → Precisa metrics
- CENARIO_COMPARATIVO: Compara frameworks (ex: "Scrum vs Kanban?") → Precisa playbooks+metrics
- EVENTO_SIMULACAO: Eventos/riscos (ex: "O que causa incidente?") → Precisa events
- HIBRIDO: Combina aspectos → Precisa múltiplas fontes

Retorne JSON: {"mode": "TIPO", "confidence": 0.0-1.0, "collections": ["profiles"|"metrics"|"events"|"playbooks"]}`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const result = JSON.parse(response.text || '{}');
        return {
            mode: result.mode || 'HIBRIDO',
            confidence: result.confidence || 0.5,
            shouldUseRAG: result.mode !== 'PERSONA_PURA',
            collections: result.collections || []
        };
    } catch {
        return {
            mode: 'HIBRIDO',
            confidence: 0.5,
            shouldUseRAG: true,
            collections: ['profiles', 'metrics', 'playbooks', 'events']
        };
    }
}

/**
 * Gera contexto RAG otimizado baseado na classificação e configuração
 */
export function generateRAGContext(
    config: SingleSimulationConfig,
    classification?: QueryClassification
): RAGContext {
    const collections = classification?.collections || ['playbooks', 'metrics', 'profiles', 'events'];

    // Playbooks (sempre incluir se solicitado ou se for comparativo)
    let playbooks = '';
    if (collections.includes('playbooks') || !classification) {
        playbooks = `
CONHECIMENTO DE PLAYBOOKS (RAG):
- SCRUM: Daily Standup (15min, custo tempo 0.03), Sprint Planning (4h), Reviews. 
  Falha comum: Daily vira report de status em empresas burocráticas.
- KANBAN: Replenishment, Limite de WIP. 
  Falha comum: WIP estoura se dívida técnica for alta.
- SAFE: PI Planning (2 dias, custo alto), System Demo. 
  Falha comum: Overhead de processo mata produtividade em empresas < 50 FTEs.
- XP: Pair Programming, TDD, Refactoring contínuo.
  Falha comum: Resistência de devs seniores que preferem trabalhar sozinhos.
`;
    }

    // Métricas financeiras (incluir se ROI ou comparativo)
    let metrics = '';
    if (collections.includes('metrics') || !classification) {
        const debtMod = TECH_DEBT_MODIFIERS[config.techDebtLevel] || TECH_DEBT_MODIFIERS.medium;
        const jFactorInfo = J_CURVE_FACTORS.slice(0, 6).join(', ');

        // Calcular faixas realistas baseadas no tamanho da empresa
        const teamSize = config.companySize;
        const featuresMin = Math.floor(teamSize * 0.3 * debtMod.velocity);
        const featuresMax = Math.floor(teamSize * 0.8 * debtMod.velocity);
        const bugsMin = Math.floor(teamSize * 0.05 * debtMod.bugs);
        const bugsMax = Math.floor(teamSize * 0.2 * debtMod.bugs);

        metrics = `
MODELO DE MÉTRICAS FINANCEIRAS (RAG) - REGRAS OBRIGATÓRIAS:

⚠️ FAIXAS NUMÉRICAS OBRIGATÓRIAS para rawData:
- featuresDelivered: MÍNIMO ${featuresMin}, MÁXIMO ${featuresMax} por mês
  → Meses 1-3 (Curva J): use valores PRÓXIMOS ao mínimo (${featuresMin}-${Math.floor(featuresMin * 1.3)})
  → Meses 4-6: use valores médios (${Math.floor((featuresMin + featuresMax) / 2)})
  → Meses 7+: pode subir até máximo (${featuresMax})
  
- bugsGenerated: MÍNIMO ${bugsMin}, MÁXIMO ${bugsMax} por mês
  → Dívida técnica ${config.techDebtLevel.toUpperCase()}: bugs devem CRESCER com o tempo se não tratada

- learningCurveFactor: OBRIGATÓRIO seguir padrão:
  → Meses 1-2: 0.5 a 0.7 (queda de produtividade)
  → Meses 3-4: 0.8 a 0.95 (recuperando)
  → Meses 5+: 1.0 a 1.3 (performando)

- criticalIncidents: 0 na maioria, máximo 1-2 por mês em cenários de dívida alta

CURVA J APLICADA: [${jFactorInfo}...]
DÍVIDA TÉCNICA (${config.techDebtLevel.toUpperCase()}):
  * Multiplicador de bugs: ${debtMod.bugs}x
  * Fator velocidade: ${debtMod.velocity}x

SE NÃO SEGUIR ESTAS FAIXAS, O ROI SERÁ IRREAL!
`;
    }


    // Perfis/Personas (incluir se persona pura ou hibrido)
    let profiles = '';
    if (collections.includes('profiles') || !classification) {
        const archetypes = config.employeeArchetypes || ['Céticos', 'Pragmáticos'];
        const relevantExamples: string[] = [];

        // Mapear arquétipos selecionados para examples
        if (archetypes.some(a => a.toLowerCase().includes('c-level') || a.toLowerCase().includes('ceo'))) {
            relevantExamples.push(...ARCHETYPE_EXAMPLES.CEO_CETICO);
        }
        if (archetypes.some(a => a.toLowerCase().includes('cético') || a.toLowerCase().includes('cetico'))) {
            relevantExamples.push(...ARCHETYPE_EXAMPLES.TECH_LEAD_CETICO);
        }
        if (archetypes.some(a => a.toLowerCase().includes('sênior') || a.toLowerCase().includes('senior'))) {
            relevantExamples.push(...ARCHETYPE_EXAMPLES.DEV_SENIOR_AUTONOMO);
        }

        // Default se nenhum mapeado
        if (relevantExamples.length === 0) {
            relevantExamples.push(...ARCHETYPE_EXAMPLES.CFO_PRAGMATICO);
        }

        profiles = `
EXEMPLOS DE COMPORTAMENTO POR ARQUÉTIPO (Few-Shot):
${relevantExamples.join('\n')}

INSTRUÇÕES:
- Use estes exemplos como base para manter consistência nas personas
- Se a query for sobre comportamento específico, priorize estes padrões
- Adapte ao contexto do cenário: ${config.scenarioContext || 'Transformação Digital'}
`;
    }

    // Eventos (incluir se evento ou hibrido)
    let events = '';
    if (collections.includes('events') || !classification) {
        events = `
EVENTOS DE SIMULAÇÃO (Gatilhos):
1. Queda Crítica em Produção (15% base, 2x se dívida alta)
   Impacto: ROI -50.000, Moral -10, Confiança -15
2. Resistência Passiva em Reunião (40% se histórico traumático)
   Impacto: Velocidade Sprint -20%, Moral -5
3. Perda de Talento Chave (30% em layoffs/M&A)
   Impacto: Custo reposição +30.000, Atraso +15 dias
4. Aprovação de Orçamento Extra (20% em hipercrescimento)
   Impacto: ROI -100.000 (investimento), +5 contratações
5. Gargalo de Processo (50% se burocrática)
   Impacto: Eficiência +10% após identificar
`;
    }

    return { playbooks, metrics, profiles, events };
}

/**
 * Combina todos os contextos RAG em uma string para injeção no prompt
 */
export function injectRAGContext(ragContext: RAGContext): string {
    const sections = [
        ragContext.playbooks,
        ragContext.metrics,
        ragContext.profiles,
        ragContext.events
    ].filter(Boolean);

    if (sections.length === 0) {
        return '/* RAG Context: Nenhum contexto adicional necessário para esta query */';
    }

    return `
/* ===== CONHECIMENTO RAG INJETADO ===== */
${sections.join('\n')}
/* ===== FIM DO CONTEXTO RAG ===== */
`;
}

/**
 * Calcula projeção de ROI mês a mês com lógica determinística
 */
export function calculateDeterministicROI(
    config: SingleSimulationConfig,
    months: number = 12
): Array<{
    month: number;
    opex: number;
    value: number;
    conq: number;
    roi: number;
    jFactor: number;
}> {
    const isPME = config.companySize <= 100;
    const vars = {
        custoDev: isPME ? 400 : 800,
        valorPontoFuncao: isPME ? 1500 : 5000,
        custoIncidente: isPME ? 5000 : 500000,
        custoRework: isPME ? 2000 : 20000
    };

    const debtMod = TECH_DEBT_MODIFIERS[config.techDebtLevel] || TECH_DEBT_MODIFIERS.medium;
    const ftes = config.companySize;
    const hasTrauma = config.previousFailures;

    const projection = [];
    let opexAcc = 0, valueAcc = 0, conqAcc = 0;

    for (let mes = 1; mes <= months; mes++) {
        // OpEx mensal
        const opex = ftes * vars.custoDev * 22;

        // Fator da Curva J
        const jFactor = J_CURVE_FACTORS[Math.min(mes - 1, J_CURVE_FACTORS.length - 1)];

        // Fator trauma (ramp-up lento)
        const traumaFactor = hasTrauma && mes <= 3 ? 0.8 : 1.0;

        // Features entregues
        const featuresBase = ftes * 0.5;
        const features = featuresBase * jFactor * debtMod.velocity * traumaFactor;

        // Value
        const value = features * 3 * vars.valorPontoFuncao;

        // CoNQ (Custo da Não-Qualidade)
        const bugs = ftes * 0.1 * debtMod.bugs;
        const custoRework = bugs * vars.custoRework;
        const custoManutencao = (vars.custoRework * ftes * 0.05) * Math.pow(1 + debtMod.taxa, mes);
        const conq = custoRework + custoManutencao;

        // Acumular
        opexAcc += opex;
        valueAcc += value;
        conqAcc += conq;

        // ROI parcial
        const roi = opexAcc > 0
            ? ((valueAcc - conqAcc - opexAcc) / opexAcc) * 100
            : 0;

        projection.push({
            month: mes,
            opex: Math.round(opex),
            value: Math.round(value),
            conq: Math.round(conq),
            roi: Math.round(roi * 100) / 100,
            jFactor
        });
    }

    return projection;
}

/**
 * Versão otimizada do prompt com RAG seletivo
 */
export function buildOptimizedPrompt(
    config: SingleSimulationConfig,
    ragContext: RAGContext,
    classification?: QueryClassification
): string {
    const ragInjection = injectRAGContext(ragContext);
    const skipMessage = classification?.mode === 'PERSONA_PURA'
        ? '\n/* NOTA: Query de persona pura - usando few-shot direto, sem retrieval adicional */'
        : '';

    return `
Atue como uma Engine de Realidade Estendida (XRE) e CFO Virtual Multidimensional.

OBJETIVO:
Simular a implementação do framework "${config.frameworkName}" com 95% de fidelidade ao mundo real.
${skipMessage}

DADOS DE ENTRADA:
- Framework: ${config.frameworkText?.substring(0, 3000) || config.frameworkName}
- Categoria: ${config.frameworkCategory?.toUpperCase() || 'HÍBRIDO'}
- Tamanho: ${config.companySize} funcionários
- Setor: ${config.sector}
- Orçamento: ${config.budgetLevel}
- Dívida Técnica: ${config.techDebtLevel?.toUpperCase() || 'MÉDIO'}
- Trauma Anterior: ${config.previousFailures ? 'SIM' : 'NÃO'}

${ragInjection}

PROTOCOLO DE REALISMO ABSOLUTO:
1. Se dívida técnica ALTA/CRÍTICA → ROI inicial DEVE ser negativo
2. Se trauma anterior SIM → Adoção começa abaixo de 10% por 3-6 meses
3. Use os few-shot examples para manter consistência nas personas

SAÍDA: JSON estrito conforme schema definido.
`;
}
