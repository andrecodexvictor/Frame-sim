/**
 * Tipos centrais do sistema RAG para simulação de cenários
 */

import type { EmployeeBrainState } from '../core/employeeBrainCore.js';
import type { RunManifest, PersonaTrace, IndividualEvaluation } from './evaluation.js';
import type { ExperimentAssignment } from '../core/experimentProtocol.js';
import type { SyntheticWorkPolicy } from '../core/syntheticWork.js';

// ===== QUERY ROUTING =====

export type QueryMode =
    | 'PERSONA_PURA'      // Comportamento de stakeholder - Skip RAG
    | 'CALCULO_ROI'       // Métricas financeiras - Metrics RAG only
    | 'CENARIO_COMPARATIVO' // Comparação frameworks - Full RAG
    | 'EVENTO_SIMULACAO'  // Gatilhos/eventos - Events RAG only
    | 'HIBRIDO';          // Múltiplas fontes

export interface QueryClassification {
    mode: QueryMode;
    confidence: number;
    filters: {
        collections: ('profiles' | 'metrics' | 'events' | 'playbooks' | 'history')[];
        metadata?: Record<string, string | string[]>;
    };
    refinedQuery: string;
}

// ===== PROFILES =====

export interface PersonaProfile {
    id: string;
    tipo: 'Tech' | 'Non-Tech';
    informacoes_basicas: {
        nome: string;
        genero: string;
        idade: number;
        cargo: string;
        area: string;
        tempo_empresa: string;
        tempo_carreira: string;
        formacao: string;
        localizacao: string;
        neurodivergencia: string | null;
    };
    psicologia_comportamento: {
        'Estilo de Comunicação': string;
        'Abordagem ao Trabalho': string;
        'Gestão de Conflitos': string;
        'Relação com Tecnologia': string;
        'Liderança e Influência': string;
        'Relação com Processos': string;
        'Gestão de Estresse': string;
        'Motivadores Principais': string;
    };
    habilidades: {
        hard_skills: string[];
        soft_skills: string[];
    };
    contexto: {
        framework_preferido: string;
        opiniao_agil: string;
        desafio_atual: string;
        motivacao_atual: string;
    };
    historia: string;
    ace_metadata: {
        A: string;
        C: string;
        E: string;
        resumo_compacto: string;
        tags_busca: string[];
    };
}

// ===== SIMULATION CONFIG =====

export interface SimulationConfig {
    task_policy?: Partial<SyntheticWorkPolicy>;
    semantic_evaluation?: { enabled: boolean; max_requests: number; timeout_ms: number };
    experiment?: ExperimentAssignment;
    framework_config?: {
        id: string;
        name: string;
        source: 'catalog' | 'uploaded' | 'inferred';
        description?: string;
    };
    contexto_estrutural: {
        categoria_cenario: { valor: string; opcoes: string[] };
        setor_atuacao: { valor: string; opcoes: string[] };
        tamanho_ftes: { valor: number; descricao: string };
        orcamento_disponivel: { valor: string; opcoes: string[] };
    };
    calibragem_realismo: {
        divida_tecnica: { valor: string; opcoes: string[] };
        velocidade_operacional: { valor: string; opcoes: string[] };
        historico_traumatico: { valor: boolean; descricao: string };
    };
    ecossistema_humano: {
        distribuicao_selecionada: string[];
        descricao: string;
    };
    contexto_situacional: {
        cenario_atual: string;
        opcoes: string[];
    };
    contexto_economico?: {
        profile_id?: string;
        scenario_id?: string;
        seed?: number;
        scenario?: {
            id: string;
            label: string;
            demandMultiplier: number;
            laborCostMultiplier: number;
            budgetMultiplier: number;
            incidentMultiplier: number;
            uncertainty: string;
        };
    };
    parametros_simulacao: {
        duracao_meses: number;
        acuracia_alvo: string;
        adaptacao_pme: boolean;
        seed?: number;
    };
}

// ===== SIMULATION EVENTS =====

export interface SimulationEvent {
    id: string;
    titulo: string;
    tipo: string;
    gatilhos: {
        probabilidade_base: number;
        modificadores?: Array<{
            condicao: string;
            fator: number;
        }>;
        [key: string]: unknown;
    };
    impacto: Record<string, number>;
    descricao: string;
}

// ===== FRAMEWORK PLAYBOOKS =====

export interface FrameworkPlaybook {
    nome: string;
    rituais: Array<{
        nome: string;
        duracao: string;
        frequencia: string;
        custo_tempo: number;
    }>;
    regras_ouro: string[];
    falhas_comuns_simulacao: Array<{
        gatilho: string;
        efeito: string;
    }>;
}

// ===== ROI CALCULATION =====

export interface ROIProjection {
    mes: number;
    opex: number;
    value: number;
    conq: number;  // Custo da Não-Qualidade
    roi_parcial: number;
}

export interface ROIResult {
    projecao_mensal: ROIProjection[];
    roi_final: number;
    break_even_mes: number | null;
    eventos_ocorridos: string[];
    confianca_estimativa: 'Alta' | 'Média' | 'Baixa';
    economic_scenario?: string;
    seed?: number;
}

// ===== AGENT OUTPUTS =====

export interface SimulationState {
    manifest?: RunManifest;
    personaTraces?: PersonaTrace[];
    individualEvaluations?: IndividualEvaluation[];
    turno: number;
    moral_time: number;
    velocidade_sprint: number;
    confianca_stakeholders: number;
    scratchpad: string;
    eventos_disparados: string[];
    historico: OrchestratorOutput[];
    difficulty_scalar: number;
    current_objective: string;
    /** Estado do EmployeeBrain por funcionário (stakeholders + team sample). Opcional
     *  para não quebrar callers/testes que ainda constroem SimulationState à mão. */
    funcionarios?: EmployeeBrainState[];
    /** Narrativas de decisões emergentes do EmployeeBrain (demissões, burnout, etc). */
    eventos_rh?: string[];
    /** True when a provider/critic was unavailable and deterministic fallback was used. */
    degraded?: boolean;
    degraded_reasons?: string[];
    run_id?: string;
    metricas_agenticas?: AgenticMetrics;
    /** Concise, bounded audit trail for the main agentic actions in a run. */
    reasoning_log?: ReasoningLogEntry[];
    /** A bounded suggestion recorded when the single replan was insufficient. */
    aspirational_adjustment?: string;
    /** Bounded final critic explanation retained for long-term memory. */
    critique_summary?: string;
    framework_context?: {
        id: string;
        name: string;
        source: string;
        matched: boolean;
    };
    economic_context?: {
        profile_id?: string;
        scenario_id: string;
        label: string;
        uncertainty: string;
    };
    external_tool_signals?: Array<{
        tool: string;
        offline: boolean;
        summary: string;
    }>;
    health?: {
        healthy: boolean;
        degraded: boolean;
        alerts: Array<{ code: string; severity: string; message: string }>;
    };
}

export interface ReasoningLogEntry {
    reason: string;
    action: string;
    observation: string;
}

export interface SimulationStep {
    query: string;
    stakeholders: PersonaProfile[];
    config?: SimulationConfig;
}

export interface PersonaResponse {
    provider?: string;
    requestedModel?: string;
    modelUsed?: string;
    resposta_persona: string;
    emocao_detectada: string;
    impacto_moral: number;  // -10 a +10
    rag_utilizado: boolean;
    fonte_rag: string | null;
    /** Provider/parsing fallback was used for this response. */
    degraded?: boolean;
}

export interface OrchestratorOutput {
    personaId?: string;
    turno: number;
    stakeholder: string;
    resposta: PersonaResponse;
    metricas_atualizadas: {
        moral_time: number;
        velocidade_sprint: number;
        confianca_stakeholders: number;
    };
    eventos_disparados: string[];
    metricas_agenticas?: AgenticMetrics;
}

export interface AgenticMetrics {
    quality_per_cycle: number; // 0-100 (Replan penalty)
    time_to_solve_ms: number;
    cost_estimate_usd: number;
    total_tokens: number;
    router_choice: string;
    input_tokens: number;
    output_tokens: number;
    replan_count: number;
    risk_incidents: number;
    /** Taxa de incidência de risco: incidentes / turnos, em percentual. */
    tir: number;
    degraded: boolean;
}

// ===== FEW-SHOT EXAMPLES =====

export interface FewShotExample {
    situacao: string;
    resposta: string;
}


// ===== GOAL AGENT =====

export interface GoalEvaluation {
    difficulty_scalar: number; // 0.8 (Easier) to 1.5 (Harder)
    new_directive?: string;
    crisis_triggered?: boolean;
    hope_triggered?: boolean;
    reasoning: string;
}

// === SELF-IMPROVEMENT TYPES ===
export interface WarmupConfig {
    maxIterations: number;           // Max warmup iterations (default: 5)
    targetPlausibility: number;      // Min CriticAgent score (default: 85)
    parameterSpace: ParameterSpace;
    seed?: number;                   // Replays the same exploration sequence
}

export interface ParameterSpace {
    temperatures: number[];          // [0.3, 0.5, 0.7, 0.9]
    topKValues: number[];            // [3, 5, 10]
    ragModes: ('full' | 'selective' | 'none')[];
}

export interface OptimizedParameters {
    temperature: number;
    topK: number;
    ragMode: 'full' | 'selective' | 'none';
    promptVariant?: string;
}

export interface WarmupResult {
    optimalParams: OptimizedParameters;
    iterationsUsed: number;
    finalScore: number;
    convergenceHistory: ConvergencePoint[];
}

export interface ConvergencePoint {
    iteration: number;
    params: OptimizedParameters;
    plausibilityScore: number;
    timestamp: number;
}

// === AGENT RACING TYPES ===
export interface RacingConfig {
    numAgents: number;               // How many agents compete (default: 3)
    selectionStrategy: 'best' | 'ensemble' | 'weighted';
    timeout: number;                 // Per-agent timeout in ms
    diversityMode: 'temperature' | 'persona' | 'model' | 'full';
}

export interface AgentConfig {
    id: string;
    temperature: number;
    model: string;
    persona: string;                 // "CFO", "CTO", "Pessimista"
}

export interface AgentResult {
    agentId: string;
    agentConfig: AgentConfig;
    result: any | null; // Placeholder for simulation output which might differ between FE/BE types
    critiqueScore: number;
    duration: number;
    success: boolean;
    error?: string;
}

export interface RaceResult {
    winner: AgentResult;
    allResults: AgentResult[];
    ensemble?: EnsembleResult;
    metrics: RacingMetrics;
}

export interface EnsembleResult {
    weightedROI: number;
    weightedAdoption: number;
    confidence: number;
    contributingAgents: string[];
}

export interface RacingMetrics {
    totalDuration: number;
    agentsCompleted: number;
    agentsFailed: number;
    averageScore: number;
    scoreVariance: number;
}

// === ENHANCED BATCH CONFIG ===
export interface EnhancedBatchConfig {
    iterations: number;
    enableWarmup: boolean;
    warmupConfig?: WarmupConfig;
    enableRacing: boolean;
    racingConfig?: RacingConfig;
}

export interface BatchSummary {
    averageRoi: number;
    averageAdoption: number;
    successRate: number;
    stdDevRoi: number;
    minRoi: number;
    maxRoi: number;
    confidenceInterval95: [number, number];
}
