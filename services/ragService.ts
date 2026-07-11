/**
 * RAG Service - Integração do sistema RAG otimizado com o projeto principal
 * 
 * Este serviço conecta os componentes do RAG implement/ com o geminiService.ts
 * Usa Self-RAG para decidir automaticamente quando usar retrieval
 */

import { GoogleGenAI } from "@google/genai";
import type { SingleSimulationConfig } from "../types";
import archetypeExamplesData from '../data/archetype_examples.json';

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

// Few-shot examples por arquétipo, carregados de data/archetype_examples.json
// (fonte única compartilhada com RAG/src/agents/personaAgent.ts).
// Shape unificado: Record<string, {situacao, resposta}[]>. Aqui condensamos
// cada exemplo em uma linha "Situação: X → resposta" para o contexto RAG.
type ArchetypeExample = { situacao: string; resposta: string };
const ARCHETYPE_EXAMPLES_DATA = archetypeExamplesData as Record<string, ArchetypeExample[]>;

function formatArchetypeExamples(archetype: string): string[] {
    const examples = ARCHETYPE_EXAMPLES_DATA[archetype] || [];
    return examples.map(ex => `Situação: ${ex.situacao} → "${ex.resposta}"`);
}

// Curva J - fatores de adaptação por mês (mais suave para permitir resultados balanceados)
const J_CURVE_FACTORS = [0.75, 0.8, 0.9, 0.95, 1.1, 1.15, 1.2, 1.25, 1.3, 1.3, 1.35, 1.35];

// Modificadores de dívida técnica (calibrados para permitir cenários positivos e negativos)
const TECH_DEBT_MODIFIERS: Record<string, { bugs: number; velocity: number; taxa: number }> = {
    'low': { bugs: 0.8, velocity: 1.0, taxa: 0.01 },
    'medium': { bugs: 1.0, velocity: 0.95, taxa: 0.03 },
    'high': { bugs: 1.3, velocity: 0.8, taxa: 0.07 },
    'critical': { bugs: 1.6, velocity: 0.65, taxa: 0.12 }
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
            model: "gemini-2.5-flash",
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

        // Calculate scenario severity to guide LLM
        const isCriticalScenario = config.techDebtLevel === 'critical' || (config.techDebtLevel === 'high' && config.previousFailures);
        const isOptimalScenario = config.techDebtLevel === 'low' && !config.previousFailures;

        const scenarioGuidance = isCriticalScenario
            ? `⚠️ CENÁRIO CRÍTICO DETECTADO: Resultados DEVEM refletir dificuldades reais. Espera-se ROI negativo significativo nos primeiros meses.`
            : isOptimalScenario
                ? `✅ CENÁRIO FAVORÁVEL: Condições permitem resultados positivos com boa execução. learningCurveFactor pode iniciar em 0.85+.`
                : `📊 CENÁRIO TÍPICO: Resultados moderados esperados. ROI pode ser ligeiramente negativo ou positivo dependendo da execução.`;

        metrics = `
MODELO DE MÉTRICAS FINANCEIRAS (RAG) - DIRETRIZES RESPONSIVAS:

${scenarioGuidance}

📊 FAIXAS para rawData (variam conforme scenario):
- featuresDelivered: ${featuresMin} a ${featuresMax} por mês
  → Meses 1-3: ${isCriticalScenario ? 'valores baixos (' + featuresMin + ')' : 'valores moderados (' + Math.floor(featuresMin * 1.3) + ')'}
  → Meses 4-6: progressão gradual
  → Meses 7+: ${isOptimalScenario ? 'pode atingir máximo (' + featuresMax + ')' : 'valores médio-altos'}
  
- bugsGenerated: ${bugsMin} a ${bugsMax} por mês
  → Dívida ${config.techDebtLevel.toUpperCase()}: ${isCriticalScenario ? 'bugs altos especialmente no início' : 'tendência de redução ao longo do tempo'}

- learningCurveFactor: PROGRESSÃO BASEADA NO CENÁRIO:
  → Meses 1-2: ${isCriticalScenario ? '0.60 a 0.75' : isOptimalScenario ? '0.85 a 0.95' : '0.75 a 0.85'}
  → Meses 3-4: ${isCriticalScenario ? '0.80 a 0.90' : isOptimalScenario ? '0.95 a 1.05' : '0.90 a 1.0'}
  → Meses 5+: ${isCriticalScenario ? '0.95 a 1.10' : isOptimalScenario ? '1.10 a 1.30' : '1.0 a 1.20'}

- criticalIncidents: ${isCriticalScenario ? '1-3 esperados nos primeiros meses' : '0-1, apenas se houver eventos adversos'}

DÍVIDA TÉCNICA (${config.techDebtLevel.toUpperCase()}): bugs ${debtMod.bugs}x | velocidade ${debtMod.velocity}x

IMPORTANTE: O ROI final deve REFLETIR as condições do cenário. Cenários ruins = ROI ruim. Cenários bons = ROI bom.

🎲 ELEMENTO SURPRESA (Casos Excepcionais ~15%):
Em casos raros, equipes demonstram ADAPTAÇÃO EXCEPCIONAL mesmo em cenários difíceis.
Se você perceber narrativamente que a equipe está engajada, considere:
- learningCurveFactor mais alto que o típico (1.15+)
- efficiency acima de 85%
- Bugs reduzidos mesmo com dívida técnica
Isso permite projeções positivas surpreendentes em empresas pequenas ou com desafios.
`;
    }


    // Perfis/Personas (incluir se persona pura ou hibrido)
    let profiles = '';
    if (collections.includes('profiles') || !classification) {
        const archetypes = config.employeeArchetypes || ['Céticos', 'Pragmáticos'];
        const relevantExamples: string[] = [];

        // Mapear arquétipos selecionados para examples
        if (archetypes.some(a => a.toLowerCase().includes('c-level') || a.toLowerCase().includes('ceo'))) {
            relevantExamples.push(...formatArchetypeExamples('CEO_CETICO'));
        }
        if (archetypes.some(a => a.toLowerCase().includes('cético') || a.toLowerCase().includes('cetico'))) {
            relevantExamples.push(...formatArchetypeExamples('TECH_LEAD_CETICO'));
        }
        if (archetypes.some(a => a.toLowerCase().includes('sênior') || a.toLowerCase().includes('senior'))) {
            relevantExamples.push(...formatArchetypeExamples('DEV_SENIOR_AUTONOMO'));
        }

        // Default se nenhum mapeado
        if (relevantExamples.length === 0) {
            relevantExamples.push(...formatArchetypeExamples('CFO_PRAGMATICO'));
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
