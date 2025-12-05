/**
 * Tipos centrais do sistema RAG para simulação de cenários
 */

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
        collections: ('profiles' | 'metrics' | 'events' | 'playbooks')[];
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
    parametros_simulacao: {
        duracao_meses: number;
        acuracia_alvo: string;
        adaptacao_pme: boolean;
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
}

// ===== AGENT OUTPUTS =====

export interface PersonaResponse {
    resposta_persona: string;
    emocao_detectada: string;
    impacto_moral: number;  // -10 a +10
    rag_utilizado: boolean;
    fonte_rag: string | null;
}

export interface OrchestratorOutput {
    turno: number;
    stakeholder: string;
    resposta: PersonaResponse;
    metricas_atualizadas: {
        moral_time: number;
        velocidade_sprint: number;
        confianca_stakeholders: number;
    };
    eventos_disparados: string[];
}

// ===== FEW-SHOT EXAMPLES =====

export interface FewShotExample {
    situacao: string;
    resposta: string;
}

export interface ArchetypeFewShots {
    [archetype: string]: FewShotExample[];
}
