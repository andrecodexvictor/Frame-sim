/**
 * Orchestrator Agent - Coordena simulação multi-stakeholder
 * Gerencia turnos de fala, aplica eventos e consolida outputs
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type {
    PersonaProfile,
    SimulationConfig,
    SimulationEvent,
    OrchestratorOutput,
    PersonaResponse
} from '../types/index.js';
import { PersonaAgent } from './personaAgent.js';
import { ROICalculatorAgent } from './roiCalculator.js';
import { VectorStoreService } from '../services/vectorStore.js';
import { QueryRouter, QueryClassification } from '../services/queryRouter.js';

export interface SimulationState {
    turno: number;
    moral_time: number;
    velocidade_sprint: number;
    confianca_stakeholders: number;
    eventos_disparados: string[];
    historico: OrchestratorOutput[];
}

export interface SimulationStep {
    query: string;
    stakeholders: PersonaProfile[];
    config?: SimulationConfig;
}

const ORCHESTRATOR_PROMPT = `# ORQUESTRADOR DE SIMULAÇÃO MULTI-STAKEHOLDER

Você coordena uma simulação de implementação de framework ágil.

## ESTADO ATUAL
Turno: {turno}
Moral do Time: {moral_time}/100
Velocidade Sprint: {velocidade_sprint}%
Confiança Stakeholders: {confianca_stakeholders}%

## HISTÓRICO RECENTE
{historico}

## RESPOSTAS DO TURNO ATUAL
{respostas}

## INSTRUÇÃO
Analise as respostas e determine:
1. Eventos que podem ser disparados
2. Métricas atualizadas
3. Resumo da dinâmica do turno

## OUTPUT
JSON com próximo estado:
{
  "eventos_disparados": ["evento1", "evento2"],
  "moral_time_delta": número,
  "velocidade_delta": número,
  "confianca_delta": número,
  "resumo_turno": "texto resumo",
  "tensoes_identificadas": ["tensão1", "tensão2"]
}`;

export class OrchestratorAgent {
    private llm: ChatGoogleGenerativeAI;
    private personaAgent: PersonaAgent;
    private roiCalculator: ROICalculatorAgent;
    private queryRouter: QueryRouter;
    private vectorStore?: VectorStoreService;
    private state: SimulationState;

    constructor(apiKey?: string, vectorStore?: VectorStoreService) {
        this.llm = new ChatGoogleGenerativeAI({
            apiKey: apiKey || process.env.GOOGLE_API_KEY,
            model: 'gemini-1.5-pro',
            temperature: 0.5,
        });
        this.personaAgent = new PersonaAgent(apiKey);
        this.roiCalculator = new ROICalculatorAgent(apiKey, vectorStore);
        this.queryRouter = new QueryRouter(apiKey);
        this.vectorStore = vectorStore;

        this.state = {
            turno: 0,
            moral_time: 70,
            velocidade_sprint: 100,
            confianca_stakeholders: 50,
            eventos_disparados: [],
            historico: []
        };
    }

    setVectorStore(store: VectorStoreService): void {
        this.vectorStore = store;
        this.roiCalculator.setVectorStore(store);
    }

    /**
     * Processa uma query decidindo automaticamente o modo de RAG
     */
    async processQuery(
        query: string,
        stakeholders: PersonaProfile[],
        config?: SimulationConfig
    ): Promise<{
        classification: QueryClassification;
        responses: OrchestratorOutput[];
        ragResults?: unknown[];
    }> {
        // 1. Classificar a query
        const classification = await this.queryRouter.classify(query);
        console.log(`\n🎯 Query classificada como: ${classification.mode}`);

        let ragResults: unknown[] = [];

        // 2. Executar RAG se necessário
        if (this.vectorStore && this.queryRouter.shouldUseRAG(classification)) {
            console.log(`📚 Executando RAG nas collections: ${classification.filters.collections.join(', ')}`);

            ragResults = await this.vectorStore.hybridSearch({
                query: classification.refinedQuery,
                collections: classification.filters.collections,
                topK: 5
            });
        } else {
            console.log(`⚡ Query de persona pura - pulando RAG`);
        }

        // 3. Executar simulação com stakeholders
        const responses = await this.runTurn({ query, stakeholders, config });

        return { classification, responses, ragResults };
    }

    /**
     * Executa um turno de simulação com múltiplos stakeholders
     */
    async runTurn(step: SimulationStep): Promise<OrchestratorOutput[]> {
        const { query, stakeholders, config } = step;
        this.state.turno++;

        console.log(`\n🎲 Iniciando turno ${this.state.turno} com ${stakeholders.length} stakeholders`);

        const outputs: OrchestratorOutput[] = [];

        // Coletar respostas de cada stakeholder
        for (const stakeholder of stakeholders) {
            console.log(`  → Simulando ${stakeholder.informacoes_basicas.nome} (${stakeholder.informacoes_basicas.cargo})`);

            const response = await this.personaAgent.simulateResponse(
                stakeholder,
                query,
                config
            );

            outputs.push({
                turno: this.state.turno,
                stakeholder: stakeholder.informacoes_basicas.nome,
                resposta: response,
                metricas_atualizadas: {
                    moral_time: this.state.moral_time,
                    velocidade_sprint: this.state.velocidade_sprint,
                    confianca_stakeholders: this.state.confianca_stakeholders
                },
                eventos_disparados: []
            });

            // Atualizar estado com impacto da resposta
            this.state.moral_time += response.impacto_moral * 0.5; // Suavizar impacto
            this.state.moral_time = Math.max(0, Math.min(100, this.state.moral_time));
        }

        // Consolidar e atualizar estado global
        await this.consolidateTurn(outputs);

        // Adicionar ao histórico
        this.state.historico.push(...outputs);

        return outputs;
    }

    /**
     * Consolida resultados do turno e atualiza métricas globais
     */
    private async consolidateTurn(outputs: OrchestratorOutput[]): Promise<void> {
        const respostas = outputs
            .map(o => `${o.stakeholder}: "${o.resposta.resposta_persona}" (${o.resposta.emocao_detectada})`)
            .join('\n');

        const historicoRecente = this.state.historico
            .slice(-3)
            .map(o => `Turno ${o.turno} - ${o.stakeholder}: ${o.resposta.emocao_detectada}`)
            .join('\n');

        const prompt = ORCHESTRATOR_PROMPT
            .replace('{turno}', this.state.turno.toString())
            .replace('{moral_time}', this.state.moral_time.toFixed(0))
            .replace('{velocidade_sprint}', this.state.velocidade_sprint.toFixed(0))
            .replace('{confianca_stakeholders}', this.state.confianca_stakeholders.toFixed(0))
            .replace('{historico}', historicoRecente || 'Primeiro turno')
            .replace('{respostas}', respostas);

        try {
            const response = await this.llm.invoke(prompt);
            const content = typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content);

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);

                // Aplicar deltas
                this.state.moral_time += result.moral_time_delta || 0;
                this.state.velocidade_sprint += result.velocidade_delta || 0;
                this.state.confianca_stakeholders += result.confianca_delta || 0;

                // Clamp valores
                this.state.moral_time = Math.max(0, Math.min(100, this.state.moral_time));
                this.state.velocidade_sprint = Math.max(20, Math.min(150, this.state.velocidade_sprint));
                this.state.confianca_stakeholders = Math.max(0, Math.min(100, this.state.confianca_stakeholders));

                // Registrar eventos
                if (result.eventos_disparados) {
                    this.state.eventos_disparados.push(...result.eventos_disparados);
                }

                console.log(`\n📊 Estado atualizado:
  Moral: ${this.state.moral_time.toFixed(0)}%
  Velocidade: ${this.state.velocidade_sprint.toFixed(0)}%
  Confiança: ${this.state.confianca_stakeholders.toFixed(0)}%`);
            }
        } catch (error) {
            console.error('Erro ao consolidar turno:', error);
        }
    }

    /**
     * Executa simulação completa de múltiplos turnos
     */
    async runSimulation(
        queries: string[],
        stakeholders: PersonaProfile[],
        config?: SimulationConfig
    ): Promise<{
        state: SimulationState;
        roi?: unknown;
    }> {
        console.log(`\n🚀 Iniciando simulação com ${queries.length} situações e ${stakeholders.length} stakeholders\n`);

        for (const query of queries) {
            console.log(`\n📢 Situação: "${query}"`);
            await this.runTurn({ query, stakeholders, config });
        }

        // Calcular ROI final se config disponível
        let roi;
        if (config) {
            console.log('\n💰 Calculando ROI projetado...');
            roi = await this.roiCalculator.calculateROI(config);
        }

        return { state: this.state, roi };
    }

    /**
     * Retorna estado atual
     */
    getState(): SimulationState {
        return { ...this.state };
    }

    /**
     * Reseta o estado para nova simulação
     */
    resetState(): void {
        this.state = {
            turno: 0,
            moral_time: 70,
            velocidade_sprint: 100,
            confianca_stakeholders: 50,
            eventos_disparados: [],
            historico: []
        };
    }
}

// Export factory
export function createOrchestrator(apiKey?: string, vectorStore?: VectorStoreService): OrchestratorAgent {
    return new OrchestratorAgent(apiKey, vectorStore);
}
