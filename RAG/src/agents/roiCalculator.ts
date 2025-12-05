/**
 * ROI Calculator Agent - Cálculos financeiros determinísticos
 * Usa RAG para buscar fórmulas e aplica tools para cálculos
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type {
    ROIResult,
    ROIProjection,
    SimulationConfig,
    SimulationEvent
} from '../types/index.js';
import { VectorStoreService, SearchResult } from '../services/vectorStore.js';

// Variáveis base por tipo de empresa
const BASE_VARIABLES = {
    PME: {
        CUSTO_DEV_DIA: 400,
        VALOR_PONTO_FUNCAO: 1500,
        CUSTO_ATRASO_DIA: 1000,
        CUSTO_INCIDENTE: 5000,
        CUSTO_REWORK: 2000
    },
    Enterprise: {
        CUSTO_DEV_DIA: 800,
        VALOR_PONTO_FUNCAO: 5000,
        CUSTO_ATRASO_DIA: 50000,
        CUSTO_INCIDENTE: 500000,
        CUSTO_REWORK: 20000
    }
};

// Modificadores por dívida técnica
const TECH_DEBT_MODIFIERS: Record<string, { bugs: number; velocity: number; taxa: number }> = {
    'BAIXA (GREENFIELD)': { bugs: 0.8, velocity: 1.0, taxa: 0.01 },
    'MÉDIA (SISTEMAS ESTÁVEIS)': { bugs: 1.0, velocity: 0.9, taxa: 0.05 },
    'ALTA (MONOLITO LEGADO)': { bugs: 1.5, velocity: 0.7, taxa: 0.10 },
    'CRÍTICA (RISCO DE COLAPSO)': { bugs: 2.0, velocity: 0.5, taxa: 0.15 }
};

// Curva J - fator de adaptação por mês
const J_CURVE_FACTORS = [0.6, 0.6, 0.9, 0.9, 1.2, 1.2, 1.3, 1.3, 1.4, 1.4, 1.5, 1.5];

const ROI_PROMPT = `# CALCULADORA DE ROI - MODO ANALÍTICO

Você é um analista financeiro calculando o impacto de frameworks ágeis.

## FÓRMULAS BASE (do RAG)
{formulas}

## CENÁRIO ATUAL
- Tipo: {tipo_empresa}
- FTEs: {ftes}
- Dívida Técnica: {divida_tecnica}
- Duração: {duracao} meses
- Framework Proposto: {framework}

## VARIÁVEIS CALCULADAS
{variaveis}

## PROJEÇÃO PARCIAL
{projecao_parcial}

## INSTRUÇÃO
Com base nas fórmulas e variáveis acima, analise a projeção e forneça:

1. Pontos de inflexão identificados
2. Riscos principais
3. Recomendações de ajuste
4. Confiança na estimativa

## OUTPUT
JSON com análise qualitativa:
{
  "analise": "texto com análise",
  "riscos": ["risco1", "risco2"],
  "recomendacoes": ["rec1", "rec2"],
  "confianca": "Alta|Média|Baixa"
}`;

export class ROICalculatorAgent {
    private llm: ChatGoogleGenerativeAI;
    private vectorStore?: VectorStoreService;

    constructor(apiKey?: string, vectorStore?: VectorStoreService) {
        this.llm = new ChatGoogleGenerativeAI({
            apiKey: apiKey || process.env.GOOGLE_API_KEY,
            model: 'gemini-1.5-pro',
            temperature: 0, // Determinístico para cálculos
        });
        this.vectorStore = vectorStore;
    }

    setVectorStore(store: VectorStoreService): void {
        this.vectorStore = store;
    }

    /**
     * Calcula ROI projetado para o cenário
     */
    async calculateROI(
        config: SimulationConfig,
        framework: string = 'Scrum',
        events: SimulationEvent[] = []
    ): Promise<ROIResult> {
        const isPME = config.parametros_simulacao.adaptacao_pme;
        const tipo = isPME ? 'PME' : 'Enterprise';
        const vars = BASE_VARIABLES[tipo];
        const duracao = config.parametros_simulacao.duracao_meses;
        const ftes = config.contexto_estrutural.tamanho_ftes.valor;
        const dividaTecnica = config.calibragem_realismo.divida_tecnica.valor;
        const debtMod = this.getDebtModifier(dividaTecnica);

        // Buscar fórmulas no RAG se disponível
        let formulas = '';
        if (this.vectorStore) {
            const metricsResults = await this.vectorStore.findMetrics('ROI OpEx Value', 5);
            formulas = metricsResults.map(r => r.content).join('\n\n---\n\n');
        }

        // Calcular projeção mês a mês
        const projecao: ROIProjection[] = [];
        let opexAcumulado = 0;
        let valueAcumulado = 0;
        let conqAcumulado = 0;

        for (let mes = 1; mes <= duracao; mes++) {
            const projection = this.calculateMonthlyProjection(
                mes,
                ftes,
                vars,
                debtMod,
                config.calibragem_realismo.historico_traumatico.valor
            );

            // Aplicar eventos aleatórios
            const eventosMes = this.applyEvents(events, config, mes);
            for (const evt of eventosMes) {
                if (evt.impacto.roi) projection.value += evt.impacto.roi;
                if (evt.impacto.custo_reposicao) projection.opex += evt.impacto.custo_reposicao;
            }

            opexAcumulado += projection.opex;
            valueAcumulado += projection.value;
            conqAcumulado += projection.conq;

            const roiParcial = opexAcumulado > 0
                ? ((valueAcumulado - conqAcumulado - opexAcumulado) / opexAcumulado) * 100
                : 0;

            projecao.push({
                mes,
                opex: Math.round(projection.opex),
                value: Math.round(projection.value),
                conq: Math.round(projection.conq),
                roi_parcial: Math.round(roiParcial * 100) / 100
            });
        }

        // Encontrar break-even
        const breakEvenMes = projecao.findIndex(p => p.roi_parcial > 0);

        // ROI final
        const roiFinal = opexAcumulado > 0
            ? ((valueAcumulado - conqAcumulado - opexAcumulado) / opexAcumulado) * 100
            : 0;

        // Determinar confiança
        const confianca = this.determineConfidence(config, duracao);

        return {
            projecao_mensal: projecao,
            roi_final: Math.round(roiFinal * 100) / 100,
            break_even_mes: breakEvenMes > 0 ? breakEvenMes + 1 : null,
            eventos_ocorridos: [],
            confianca_estimativa: confianca
        };
    }

    /**
     * Calcula projeção de um mês específico
     */
    private calculateMonthlyProjection(
        mes: number,
        ftes: number,
        vars: typeof BASE_VARIABLES.PME,
        debtMod: { bugs: number; velocity: number; taxa: number },
        historicoTraumatico: boolean
    ): { opex: number; value: number; conq: number } {
        // OpEx mensal
        const diasUteis = 22;
        const opex = ftes * vars.CUSTO_DEV_DIA * diasUteis;

        // Fator da Curva J
        const jFactor = J_CURVE_FACTORS[Math.min(mes - 1, J_CURVE_FACTORS.length - 1)];

        // Ajuste para histórico traumático (ramp-up mais lento)
        const traumaFactor = historicoTraumatico && mes <= 3 ? 0.8 : 1.0;

        // Features entregues (simplificado)
        const featuresBase = ftes * 0.5; // 0.5 features/FTE/mês base
        const featuresAjustadas = featuresBase * jFactor * debtMod.velocity * traumaFactor;

        // Complexidade média por feature
        const complexidadeMedia = 3;

        // Value
        const value = featuresAjustadas * complexidadeMedia * vars.VALOR_PONTO_FUNCAO;

        // CoNQ (Custo da Não-Qualidade)
        const bugsBase = ftes * 0.1 * debtMod.bugs; // 0.1 bugs/FTE/mês * modificador
        const custoRework = bugsBase * vars.CUSTO_REWORK;

        // Juros compostos da dívida técnica
        const custoManutencao = (vars.CUSTO_REWORK * ftes * 0.05) * Math.pow(1 + debtMod.taxa, mes);

        const conq = custoRework + custoManutencao;

        return { opex, value, conq };
    }

    /**
     * Aplica eventos baseados em probabilidade e gatilhos
     */
    private applyEvents(
        events: SimulationEvent[],
        config: SimulationConfig,
        mes: number
    ): SimulationEvent[] {
        const triggered: SimulationEvent[] = [];

        for (const event of events) {
            let prob = event.gatilhos.probabilidade_base;

            // Aplicar modificadores
            if (event.gatilhos.modificadores) {
                for (const mod of event.gatilhos.modificadores) {
                    if (this.evaluateCondition(mod.condicao, config)) {
                        prob *= mod.fator;
                    }
                }
            }

            // Roll do dado
            if (Math.random() < prob / 12) { // Dividir por 12 para probabilidade mensal
                triggered.push(event);
            }
        }

        return triggered;
    }

    /**
     * Avalia uma condição simples
     */
    private evaluateCondition(condicao: string, config: SimulationConfig): boolean {
        // Parser simplificado de condições
        if (condicao.includes('divida_tecnica')) {
            const valor = config.calibragem_realismo.divida_tecnica.valor;
            if (condicao.includes('Alta') && valor.includes('ALTA')) return true;
            if (condicao.includes('Crítica') && valor.includes('CRÍTICA')) return true;
        }

        if (condicao.includes('velocidade_operacional')) {
            const valor = config.calibragem_realismo.velocidade_operacional.valor;
            if (condicao.includes('BUROCRÁTICA') && valor.includes('BUROCRÁTICA')) return true;
            if (condicao.includes('Ágil') && valor.includes('STARTUP')) return true;
        }

        return false;
    }

    /**
     * Retorna modificador de dívida técnica
     */
    private getDebtModifier(dividaTecnica: string): { bugs: number; velocity: number; taxa: number } {
        for (const [key, mod] of Object.entries(TECH_DEBT_MODIFIERS)) {
            if (dividaTecnica.toUpperCase().includes(key.split(' ')[0])) {
                return mod;
            }
        }
        return TECH_DEBT_MODIFIERS['MÉDIA (SISTEMAS ESTÁVEIS)'];
    }

    /**
     * Determina confiança da estimativa
     */
    private determineConfidence(config: SimulationConfig, duracao: number): 'Alta' | 'Média' | 'Baixa' {
        let score = 3;

        // Mais incerteza em projeções longas
        if (duracao > 24) score--;
        if (duracao > 36) score--;

        // Mais incerteza com dívida técnica alta
        if (config.calibragem_realismo.divida_tecnica.valor.includes('ALTA')) score--;
        if (config.calibragem_realismo.divida_tecnica.valor.includes('CRÍTICA')) score -= 2;

        // Histórico traumático aumenta incerteza
        if (config.calibragem_realismo.historico_traumatico.valor) score--;

        if (score >= 2) return 'Alta';
        if (score >= 0) return 'Média';
        return 'Baixa';
    }

    /**
     * Análise qualitativa usando LLM
     */
    async analyzeProjection(
        result: ROIResult,
        config: SimulationConfig,
        framework: string = 'Scrum'
    ): Promise<{ analise: string; riscos: string[]; recomendacoes: string[] }> {
        // Buscar fórmulas no RAG
        let formulas = 'Fórmulas padrão de ROI';
        if (this.vectorStore) {
            const metricsResults = await this.vectorStore.findMetrics('ROI OpEx Value modificadores', 3);
            formulas = metricsResults.map(r => r.content).join('\n\n');
        }

        const prompt = ROI_PROMPT
            .replace('{formulas}', formulas)
            .replace('{tipo_empresa}', config.parametros_simulacao.adaptacao_pme ? 'PME' : 'Enterprise')
            .replace('{ftes}', config.contexto_estrutural.tamanho_ftes.valor.toString())
            .replace('{divida_tecnica}', config.calibragem_realismo.divida_tecnica.valor)
            .replace('{duracao}', config.parametros_simulacao.duracao_meses.toString())
            .replace('{framework}', framework)
            .replace('{variaveis}', JSON.stringify(BASE_VARIABLES, null, 2))
            .replace('{projecao_parcial}', JSON.stringify(result.projecao_mensal.slice(0, 6), null, 2));

        try {
            const response = await this.llm.invoke(prompt);
            const content = typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content);

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('JSON não encontrado');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            return {
                analise: 'Projeção calculada com sucesso.',
                riscos: ['Incerteza em projeções de longo prazo'],
                recomendacoes: ['Revisar após 3 meses de implementação']
            };
        }
    }
}

// Export singleton
export const roiCalculator = new ROICalculatorAgent();
