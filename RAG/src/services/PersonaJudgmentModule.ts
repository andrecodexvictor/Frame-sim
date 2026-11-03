/**
 * Julgamento comportamental das personas-chave.
 *
 * Este módulo é uma seam profunda: o caller fornece apenas situação e estado
 * atual, enquanto batching, vocabulário semântico, gates, fallback e auditoria
 * ficam aqui. Nenhum tipo ou payload específico de fornecedor atravessa esta
 * interface.
 */

export type PersonaJudgmentMode = 'off' | 'shadow' | 'active';
export type Reaction = 'apoiar' | 'neutro' | 'resistir' | 'confrontar' | 'pedir_ajuda';
export type Intensity = 'baixa' | 'média' | 'alta' | 'crítica';
export type MoralDirection = 'negative' | 'neutral' | 'positive';
export type SemanticQuestionType = 'choice' | 'score' | 'noul';

export type StressCategory = 'baixo' | 'moderado' | 'alto' | 'crítico';
export type MoodCategory = 'muito_negativo' | 'negativo' | 'neutro' | 'positivo' | 'muito_positivo';
export type LevelCategory = 'baixo' | 'moderado' | 'alto' | 'crítico';

export interface PersonaStateInput {
    estresse?: number;
    stress?: number;
    humor?: number;
    mood?: number;
    energia?: number;
    energy?: number;
    engajamento?: number;
    engagement?: number;
    adaptabilidade?: number;
    adaptability?: number;
    influencia?: number;
    influence?: number;
    status?: string;
}

export interface PersonaStakeholderInput {
    context?: string;
    id?: string;
    personaId?: string;
    nome?: string;
    name?: string;
    cargo?: string;
    role?: string;
    estado?: PersonaStateInput;
    state?: PersonaStateInput;
    isKey?: boolean;
    stakeholderKey?: boolean;
}

export interface PersonaJudgmentConfig {
    mode: PersonaJudgmentMode;
    timeoutMs: number;
    minChoiceConfidence: number;
    minNoulConfidence: number;
    maxStakeholders: number;
}

export interface PersonaTurnInput {
    situation?: string;
    situacao?: string;
    turno?: number;
    turn?: number;
    stakeholders?: PersonaStakeholderInput[];
    personasChave?: PersonaStakeholderInput[];
    config?: Partial<PersonaJudgmentConfig>;
}

/** A única operação de que o caller precisa. */
export interface PersonaJudgmentEvaluator {
    evaluateTurn(input: PersonaTurnInput, signal?: AbortSignal): Promise<PersonaTurnJudgment>;
}

export interface SemanticQuestion {
    id: string;
    type: SemanticQuestionType;
    instructions?: string | Record<string, unknown>;
    criteria?: Record<string, string | null> | readonly string[] | string[];
    /** Valores fechados para Choice/Score; Noul usa o intervalo abaixo. */
    allowedValues?: readonly string[];
    min?: number;
    max?: number;
}

export interface SemanticStakeholder {
    context?: string;
    id: string;
    name: string;
    role: string;
    state: {
        stress: StressCategory;
        mood: MoodCategory;
        energy: LevelCategory;
        engagement: LevelCategory;
        adaptability: LevelCategory;
        influence: LevelCategory;
        status: string;
    };
}

/** Port local, propositalmente independente do fornecedor externo. */
export interface SemanticJudgeRequest {
    model: string;
    situation: string;
    turn: number;
    stakeholders: readonly SemanticStakeholder[];
    questions: readonly SemanticQuestion[];
}

export interface SemanticAnswer<T> {
    value: T;
    confidence: number;
}

export interface SemanticPersonaDecision {
    reaction: SemanticAnswer<string>;
    intensity: SemanticAnswer<string>;
    socialInfluence: SemanticAnswer<number>;
    moralDirection: SemanticAnswer<string>;
}

export interface SemanticJudgeResponse {
    model: string;
    decisions: Record<string, SemanticPersonaDecision>;
    inputTokens?: number;
    outputTokens?: number;
}

export interface SemanticJudgePort {
    evaluate(request: SemanticJudgeRequest, signal?: AbortSignal): Promise<SemanticJudgeResponse>;
}

export type DecisionOrigin = 'jev' | 'deterministic_fallback';
export type FallbackReason =
    | 'mode_off'
    | 'missing_port'
    | 'missing_key'
    | 'timeout'
    | 'aborted'
    | 'rate_limited'
    | 'invalid_response'
    | 'judge_error'
    | 'low_confidence';

export interface PersonaDecisionEffects {
    moralDelta: number;
    engagementDelta: number;
    stressDelta: number;
    confidenceDelta: number;
    contagion?: { targets: number; humorDelta: number; stressDelta: number };
}

export interface PersonaJudgmentDecision {
    personaId: string;
    reaction: Reaction;
    intensity: Intensity;
    moralDirection: MoralDirection;
    influencesPeers: boolean;
    confidence: number;
    origin: DecisionOrigin;
    effects: PersonaDecisionEffects;
}

export interface PersonaJudgmentAudit {
    responseReceived?: boolean;
    semanticDecisions?: Record<string,SemanticPersonaDecision>;
    acceptedDecisions?: number;
    appliedDecisions?: number;
    model: string;
    origin: DecisionOrigin;
    requestHash: string;
    confidence: number;
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
    fallbackReason?: FallbackReason;
}

export interface PersonaTurnJudgment {
    decisions: PersonaJudgmentDecision[];
    audit: PersonaJudgmentAudit;
}

export interface PersonaJudgmentModuleOptions {
    port?: SemanticJudgePort;
    config?: Partial<PersonaJudgmentConfig>;
    model?: string;
}

const DEFAULT_CONFIG: PersonaJudgmentConfig = {
    mode: 'off',
    timeoutMs: 3000,
    minChoiceConfidence: 0.75,
    minNoulConfidence: 0.8,
    maxStakeholders: 12,
};

const REACTIONS: readonly Reaction[] = ['apoiar', 'neutro', 'resistir', 'confrontar', 'pedir_ajuda'];
const INTENSITIES: readonly Intensity[] = ['baixa', 'média', 'alta', 'crítica'];
const MORAL_DIRECTIONS: readonly MoralDirection[] = ['negative', 'neutral', 'positive'];

function finiteNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function normalize(value: unknown): string {
    return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function level(value: unknown): LevelCategory {
    const n = clamp(finiteNumber(value, 50), 0, 100);
    if (n < 25) return 'baixo';
    if (n < 55) return 'moderado';
    if (n < 80) return 'alto';
    return 'crítico';
}

export function stressCategory(value: number): StressCategory {
    return level(value);
}

export function moodCategory(value: number): MoodCategory {
    const n = clamp(finiteNumber(value), -100, 100);
    if (n < -60) return 'muito_negativo';
    if (n < -15) return 'negativo';
    if (n <= 15) return 'neutro';
    if (n <= 60) return 'positivo';
    return 'muito_positivo';
}

function semanticStakeholder(persona: PersonaStakeholderInput): SemanticStakeholder {
    const state = persona.estado ?? persona.state ?? {};
    const stress = finiteNumber(state.estresse ?? state.stress);
    const mood = finiteNumber(state.humor ?? state.mood);
    const energy = finiteNumber(state.energia ?? state.energy, 50);
    const engagement = finiteNumber(state.engajamento ?? state.engagement, 50);
    const adaptability = finiteNumber(state.adaptabilidade ?? state.adaptability, 50);
    const influence = finiteNumber(state.influencia ?? state.influence, 50);
    return {
        id: String(persona.id ?? persona.personaId ?? ''),
        name: String(persona.nome ?? persona.name ?? persona.id ?? persona.personaId ?? ''),
        role: String(persona.cargo ?? persona.role ?? ''),
        ...(persona.context ? {context:persona.context.slice(0,2000)} : {}),
        state: {
            stress: stressCategory(stress),
            mood: moodCategory(mood),
            energy: level(energy),
            engagement: level(engagement),
            adaptability: level(adaptability),
            influence: level(influence),
            status: String(state.status ?? 'ativo'),
        },
    };
}

function rawState(persona: PersonaStakeholderInput): PersonaStateInput {
    return persona.estado ?? persona.state ?? {};
}

function keyStakeholders(input: PersonaTurnInput, max: number): PersonaStakeholderInput[] {
    const supplied = input.stakeholders ?? input.personasChave ?? [];
    return supplied.filter((persona) => persona.isKey !== false && persona.stakeholderKey !== false).slice(0, max);
}

function questionSet(personas: readonly SemanticStakeholder[]): SemanticQuestion[] {
    const questions: SemanticQuestion[] = [];
    for (const persona of personas) {
        questions.push(
            {
                id: `reaction_${persona.id}`,
                type: 'choice',
                instructions: `Como o stakeholder ${persona.name} (${persona.role}, id: ${persona.id}) reage à situação?`,
                criteria: {
                    apoiar: 'Apoiar a decisão ou iniciativa',
                    neutro: 'Posição neutra ou observadora',
                    resistir: 'Resistir à mudança ou apresentar objeções',
                    confrontar: 'Confrontar ativamente a liderança ou pares',
                    pedir_ajuda: 'Solicitar suporte, orientação ou alívio de estresse',
                },
                allowedValues: REACTIONS,
            },
            {
                id: `intensity_${persona.id}`,
                type: 'score',
                instructions: `Qual é a intensidade da postura do stakeholder ${persona.name} (${persona.role}, id: ${persona.id})?`,
                criteria: INTENSITIES,
                allowedValues: INTENSITIES,
            },
            {
                id: `social_influence_${persona.id}`,
                type: 'noul',
                instructions: `O stakeholder ${persona.name} (${persona.role}, id: ${persona.id}) tem probabilidade de influenciar seus colegas?`,
                criteria: {
                    true: 'A postura afeta diretamente os colegas',
                    false: 'A postura é isolada e não afeta os colegas',
                },
                min: 0,
                max: 1,
            },
            {
                id: `moral_direction_${persona.id}`,
                type: 'choice',
                instructions: `Qual é a direção do impacto moral provocada pelo stakeholder ${persona.name} (${persona.role}, id: ${persona.id})?`,
                criteria: {
                    positive: 'Impacto positivo e motivador',
                    neutral: 'Impacto neutro',
                    negative: 'Impacto negativo e desgastante',
                },
                allowedValues: MORAL_DIRECTIONS,
            },
        );
    }
    return questions;
}

function hashRequest(request: SemanticJudgeRequest): string {
    let hash = 5381;
    const text = JSON.stringify(request);
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function effectFor(reaction: Reaction, intensity: Intensity, direction: MoralDirection): PersonaDecisionEffects {
    const magnitude: Record<Intensity, number> = { baixa: 1, média: 3, alta: 5, crítica: 8 };
    const moralDelta = direction === 'positive' ? magnitude[intensity] : direction === 'negative' ? -magnitude[intensity] : 0;
    if (reaction === 'apoiar') {
        return { moralDelta: moralDelta || 3, engagementDelta: 0, stressDelta: 0, confidenceDelta: 0, contagion: { targets: 2, humorDelta: 2, stressDelta: 0 } };
    }
    if (reaction === 'resistir') return { moralDelta, engagementDelta: -10, stressDelta: 0, confidenceDelta: 0 };
    if (reaction === 'confrontar') return { moralDelta, engagementDelta: 0, stressDelta: 0, confidenceDelta: -5 };
    if (reaction === 'pedir_ajuda') return { moralDelta, engagementDelta: 0, stressDelta: -10, confidenceDelta: 0 };
    return { moralDelta, engagementDelta: 0, stressDelta: 0, confidenceDelta: 0 };
}

function fallbackDecision(persona: PersonaStakeholderInput, semantic: SemanticStakeholder): PersonaJudgmentDecision {
    const state = rawState(persona);
    const humor = finiteNumber(state.humor ?? state.mood);
    const stress = finiteNumber(state.estresse ?? state.stress);
    const engagement = finiteNumber(state.engajamento ?? state.engagement, 50);
    const adaptability = finiteNumber(state.adaptabilidade ?? state.adaptability, 50);
    const influence = finiteNumber(state.influencia ?? state.influence, 50);
    let reaction: Reaction = 'neutro';
    if (humor > 40 && engagement > 65) reaction = 'apoiar';
    else if (stress >= 60 && stress <= 80 && humor > 0) reaction = 'pedir_ajuda';
    else if (humor < -30 && adaptability < 45) reaction = 'resistir';
    else if (humor < -50 && influence > 70) reaction = 'confrontar';
    else if (humor < -40 && influence > 60) reaction = 'resistir';
    const intensity: Intensity = semantic.state.stress === 'crítico' ? 'crítica' : semantic.state.stress === 'alto' ? 'alta' : semantic.state.stress === 'moderado' ? 'média' : 'baixa';
    const direction: MoralDirection = reaction === 'apoiar' ? 'positive' : reaction === 'neutro' || reaction === 'pedir_ajuda' ? 'neutral' : 'negative';
    return {
        personaId: semantic.id,
        reaction,
        intensity,
        moralDirection: direction,
        influencesPeers: reaction === 'apoiar' || reaction === 'resistir',
        confidence: 1,
        origin: 'deterministic_fallback',
        effects: effectFor(reaction, intensity, direction),
    };
}

function canonicalReaction(value: unknown): Reaction | undefined {
    const v = normalize(value).replace(/[- ]/g, '_');
    if (v === 'apoiar' || v === 'support' || v === 'positive') return 'apoiar';
    if (v === 'neutro' || v === 'neutral') return 'neutro';
    if (v === 'resistir' || v === 'resist' || v === 'resistance') return 'resistir';
    if (v === 'confrontar' || v === 'confront') return 'confrontar';
    if (v === 'pedir_ajuda' || v === 'ask_help' || v === 'askhelp') return 'pedir_ajuda';
    return undefined;
}

function canonicalIntensity(value: unknown): Intensity | undefined {
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value < 0 || value > 3) return undefined;
        const index = Math.round(value);
        return INTENSITIES[index];
    }
    const v = normalize(value).replace(/[- ]/g, '_');
    if (v === 'baixa' || v === 'low') return 'baixa';
    if (v === 'media' || v === 'medium' || v === 'moderada' || v === 'moderate') return 'média';
    if (v === 'alta' || v === 'high') return 'alta';
    if (v === 'critica' || v === 'critical') return 'crítica';
    return undefined;
}

function canonicalDirection(value: unknown): MoralDirection | undefined {
    const v = normalize(value);
    return v === 'negative' || v === 'negative_direction' ? 'negative' : v === 'neutral' ? 'neutral' : v === 'positive' ? 'positive' : undefined;
}

function validAnswer<T>(answer: SemanticAnswer<T> | undefined, minConfidence: number): answer is SemanticAnswer<T> {
    return !!answer
        && Number.isFinite(answer.confidence)
        && answer.confidence >= 0
        && answer.confidence <= 1
        && answer.confidence >= minConfidence;
}

function decisionFromSemantic(
    personaId: string,
    answer: SemanticPersonaDecision,
    config: PersonaJudgmentConfig
): PersonaJudgmentDecision | undefined {
    const reaction = canonicalReaction(answer.reaction?.value);
    const intensity = canonicalIntensity(answer.intensity?.value);
    const direction = canonicalDirection(answer.moralDirection?.value);
    if (!reaction || !intensity || !direction) return undefined;
    if (!validAnswer(answer.reaction, config.minChoiceConfidence) || !validAnswer(answer.intensity, config.minChoiceConfidence) || !validAnswer(answer.moralDirection, config.minChoiceConfidence)) return undefined;
    const probability = answer.socialInfluence?.value;
    if (typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1) {
        return undefined;
    }
    const noulConfidence = answer.socialInfluence?.confidence;
    if (noulConfidence !== undefined && (!Number.isFinite(noulConfidence) || noulConfidence < 0 || noulConfidence > 1)) {
        return undefined;
    }
    const influencesPeers = probability >= 0.5;
    const confidence = Math.min(answer.reaction.confidence, answer.intensity.confidence, answer.moralDirection.confidence);
    return {
        personaId,
        reaction,
        intensity,
        moralDirection: direction,
        influencesPeers,
        confidence,
        origin: 'jev',
        effects: effectFor(reaction, intensity, direction),
    };
}

function reasonFor(error: unknown): FallbackReason {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
    if (code === 'timeout') return 'timeout';
    if (code === 'aborted') return 'aborted';
    if (code === 'rate_limit') return 'rate_limited';
    if (code === 'invalid_response') return 'invalid_response';
    return 'judge_error';
}

async function evaluateWithTimeout(
    port: SemanticJudgePort,
    request: SemanticJudgeRequest,
    timeoutMs: number,
    signal?: AbortSignal,
): Promise<SemanticJudgeResponse> {
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const timeoutError = () => Object.assign(new Error(`Jev timeout after ${timeoutMs}ms`), { code: 'timeout' });
    const abortError = () => Object.assign(new Error('Jev request aborted'), { code: 'aborted' });
    const requestPromise = port.evaluate(request, controller.signal);
    const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
            reject(timeoutError());
        }, timeoutMs);
    });
    const abortPromise = signal
        ? new Promise<never>((_, reject) => {
            onAbort = () => {
                controller.abort();
                reject(abortError());
            };
            if (signal.aborted) onAbort();
            else signal.addEventListener('abort', onAbort, { once: true });
        })
        : undefined;
    try {
        return await Promise.race([requestPromise, timeoutPromise, ...(abortPromise ? [abortPromise] : [])]);
    } catch (error) {
        if (timedOut) throw timeoutError();
        throw error;
    } finally {
        if (timer) clearTimeout(timer);
        if (onAbort) signal?.removeEventListener('abort', onAbort);
    }
}

export class FixtureSemanticJudgeAdapter implements SemanticJudgePort {
    private readonly fixture: SemanticJudgeResponse | ((request: SemanticJudgeRequest, signal?: AbortSignal) => SemanticJudgeResponse | Promise<SemanticJudgeResponse>);

    constructor(fixture: SemanticJudgeResponse | ((request: SemanticJudgeRequest, signal?: AbortSignal) => SemanticJudgeResponse | Promise<SemanticJudgeResponse>)) {
        this.fixture = fixture;
    }

    async evaluate(request: SemanticJudgeRequest, signal?: AbortSignal): Promise<SemanticJudgeResponse> {
        if (signal?.aborted) throw Object.assign(new Error('aborted'), { code: 'aborted' });
        return typeof this.fixture === 'function' ? this.fixture(request, signal) : this.fixture;
    }
}

export class PersonaJudgmentModule implements PersonaJudgmentEvaluator {
    private readonly port?: SemanticJudgePort;
    private readonly defaults: PersonaJudgmentConfig;
    private readonly model: string;

    constructor(portOrOptions?: SemanticJudgePort | PersonaJudgmentModuleOptions, config: Partial<PersonaJudgmentConfig> = {}) {
        if (portOrOptions && typeof (portOrOptions as SemanticJudgePort).evaluate === 'function') {
            this.port = portOrOptions as SemanticJudgePort;
            this.defaults = { ...DEFAULT_CONFIG, ...config };
            this.model = 'jev-1.13.0';
        } else {
            const options = (portOrOptions ?? {}) as PersonaJudgmentModuleOptions;
            this.port = options.port;
            this.defaults = { ...DEFAULT_CONFIG, ...(options.config ?? {}), ...config };
            this.model = options.model ?? 'jev-1.13.0';
        }
    }

    async evaluateTurn(input: PersonaTurnInput, signal?: AbortSignal): Promise<PersonaTurnJudgment> {
        const started = Date.now();
        const config = { ...this.defaults, ...(input.config ?? {}) };
        const selected = keyStakeholders(input, Math.max(0, config.maxStakeholders));
        const semantic = selected.map(semanticStakeholder);
        const request: SemanticJudgeRequest = {
            model: this.model,
            situation: String(input.situation ?? input.situacao ?? ''),
            turn: finiteNumber(input.turno ?? input.turn, 0),
            stakeholders: semantic,
            questions: questionSet(semantic),
        };
        const fallback = (fallbackReason: FallbackReason): PersonaTurnJudgment => ({
            decisions: selected.map((persona, index) => ({ ...fallbackDecision(persona, semantic[index]), origin: 'deterministic_fallback' as const })),
            audit: {
                model: this.model,
                origin: 'deterministic_fallback',
                requestHash: hashRequest(request),
                confidence: 1,
                latencyMs: Date.now() - started,
                fallbackReason,
            },
        });

        if (config.mode === 'off') return fallback('mode_off');
        if (selected.length === 0) return fallback('missing_key');
        if (!this.port) return fallback('missing_port');
        if (signal?.aborted) return fallback('aborted');

        try {
            const timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs > 0
                ? config.timeoutMs
                : DEFAULT_CONFIG.timeoutMs;
            const response = await evaluateWithTimeout(this.port, request, timeoutMs, signal);
            const decisions = selected.map((persona, index) => {
                const semanticDecision = response.decisions[semantic[index].id];
                return decisionFromSemantic(semantic[index].id, semanticDecision, config) ?? fallbackDecision(persona, semantic[index]);
            });
            const usedFallback = decisions.some((decision) => decision.origin === 'deterministic_fallback');
            const confidences = semantic.map(persona=>{
                const answer=response.decisions[persona.id];
                const values=[answer?.reaction?.confidence,answer?.intensity?.confidence,answer?.moralDirection?.confidence];
                return values.every(value=>typeof value==='number' && Number.isFinite(value)) ? Math.min(...values as number[]) : 0;
            });
            const confidence = confidences.length ? confidences.reduce((sum,value)=>sum+value,0)/confidences.length : 0;
            const result: PersonaTurnJudgment = {
                decisions,
                audit: {
                    model: response.model || this.model,
                    responseReceived: true,
                    semanticDecisions: response.decisions,
                    acceptedDecisions: decisions.filter(decision=>decision.origin==='jev').length,
                    appliedDecisions: config.mode==='active' ? decisions.filter(decision=>decision.origin==='jev').length : 0,
                    origin: config.mode === 'shadow' || usedFallback ? 'deterministic_fallback' : 'jev',
                    requestHash: hashRequest(request),
                    confidence,
                    latencyMs: Date.now() - started,
                    inputTokens: response.inputTokens,
                    outputTokens: response.outputTokens,
                    fallbackReason: usedFallback ? 'low_confidence' : undefined,
                },
            };
            if (config.mode === 'shadow') return { ...fallback('mode_off'), audit: { ...result.audit, origin: 'deterministic_fallback', fallbackReason: undefined } };
            return result;
        } catch (error) {
            return fallback(reasonFor(error));
        }
    }
}
