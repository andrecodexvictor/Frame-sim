import {
    SemanticJudgePort,
    SemanticJudgeRequest,
    SemanticJudgeResponse,
    SemanticPersonaDecision,
} from './PersonaJudgmentModule.js';

export type JevErrorCode = 'configuration' | 'aborted' | 'timeout' | 'rate_limit' | 'http' | 'invalid_response';

export class JevHttpError extends Error {
    readonly code: JevErrorCode;
    readonly status?: number;

    constructor(code: JevErrorCode, message: string, status?: number) {
        super(message);
        this.name = 'JevHttpError';
        this.code = code;
        this.status = status;
    }
}

export interface JevFetchInit {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
}

export interface JevFetchResponse {
    status: number;
    ok: boolean;
    json(): Promise<unknown>;
}

export type JevFetch = (url: string, init: JevFetchInit) => Promise<JevFetchResponse>;

export interface JevHttpAdapterOptions {
    apiKey?: string;
    model?: string;
    endpoint?: string;
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    fetch?: JevFetch;
}

const DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_MODEL = 'jev-1.13.0';

function finite(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function unit(value: unknown): number | undefined {
    const parsed = finite(value);
    return parsed !== undefined && parsed >= 0 && parsed <= 1 ? parsed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

const INTENSITIES_LIST = ['baixa', 'média', 'alta', 'crítica'] as const;

function scoreToIntensity(score: number): string | undefined {
    if (!Number.isFinite(score) || score < 0 || score > 3) return undefined;
    const idx = Math.round(score);
    return INTENSITIES_LIST[idx];
}

function unwrapAnswer(value: unknown, numeric: boolean): { value: string | number; confidence: number } | undefined {
    const record = asRecord(value);
    if (!record) return undefined;
    const candidate = record.value ?? record.answer ?? record.result ?? record.selected ?? record.choice ?? record.score ?? record.noul;
    const confidence = unit(record.confidence ?? record.confidence_score ?? (record.type === 'noul' || record.noul !== undefined ? 1 : undefined));
    if (confidence === undefined || candidate === undefined) return undefined;
    if (numeric) {
        const parsed = typeof candidate === 'number' ? candidate : Number(candidate);
        return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? { value: parsed, confidence } : undefined;
    }
    return typeof candidate === 'string' ? { value: candidate, confidence } : undefined;
}

function answerFromFields(record: Record<string, unknown>, field: string, numeric: boolean): { value: string | number; confidence: number } | undefined {
    return unwrapAnswer(record[field], numeric) ?? unwrapAnswer(record[field.replace(/_/g, '')], numeric);
}

function parseDecision(value: unknown): SemanticPersonaDecision | undefined {
    const record = asRecord(value);
    if (!record) return undefined;
    const reaction = answerFromFields(record, 'reaction', false);
    let intensity = answerFromFields(record, 'intensity', false);
    if (!intensity && record.intensity) {
        const intRec = asRecord(record.intensity);
        const scoreVal = intRec?.score ?? intRec?.value;
        const conf = unit(intRec?.confidence ?? intRec?.confidence_score);
        if (typeof scoreVal === 'number' && conf !== undefined) {
            const mapped = scoreToIntensity(scoreVal);
            if (mapped) intensity = { value: mapped, confidence: conf };
        }
    }
    const socialInfluence = answerFromFields(record, 'socialInfluence', true) ?? answerFromFields(record, 'social_influence', true);
    const moralDirection = answerFromFields(record, 'moralDirection', false) ?? answerFromFields(record, 'moral_direction', false);
    if (!reaction || !intensity || !socialInfluence || !moralDirection) return undefined;
    return {
        reaction: { value: String(reaction.value), confidence: reaction.confidence },
        intensity: { value: String(intensity.value), confidence: intensity.confidence },
        socialInfluence: { value: Number(socialInfluence.value), confidence: socialInfluence.confidence },
        moralDirection: { value: String(moralDirection.value), confidence: moralDirection.confidence },
    };
}

function parseResponse(payload: unknown, request: SemanticJudgeRequest): SemanticJudgeResponse {
    const root = asRecord(payload);
    if (!root) throw new JevHttpError('invalid_response', 'Jev response must be an object');
    const decisionsContainer = asRecord(root.decisions);
    const answersContainer = asRecord(root.answers) ?? asRecord(root.results) ?? asRecord(root.output);
    const decisions: Record<string, SemanticPersonaDecision> = {};

    for (const stakeholder of request.stakeholders) {
        if (decisionsContainer?.[stakeholder.id]) {
            const parsed = parseDecision(decisionsContainer[stakeholder.id]);
            if (!parsed) throw new JevHttpError('invalid_response', `Missing typed decision for ${stakeholder.id}`);
            decisions[stakeholder.id] = parsed;
            continue;
        }

        if (!answersContainer) {
            throw new JevHttpError('invalid_response', `Missing typed decision for ${stakeholder.id}`);
        }

        // Match exact question IDs without splitting IDs
        const reactionRaw = answersContainer[`reaction_${stakeholder.id}`] ?? answersContainer[`reaction:${stakeholder.id}`];
        const intensityRaw = answersContainer[`intensity_${stakeholder.id}`] ?? answersContainer[`intensity:${stakeholder.id}`];
        const socialRaw = answersContainer[`social_influence_${stakeholder.id}`] ?? answersContainer[`social_influence:${stakeholder.id}`];
        const moralRaw = answersContainer[`moral_direction_${stakeholder.id}`] ?? answersContainer[`moral_direction:${stakeholder.id}`];

        if (!reactionRaw || !intensityRaw || !socialRaw || !moralRaw) {
            throw new JevHttpError('invalid_response', `Missing typed decision for ${stakeholder.id}`);
        }

        const reactionRec = asRecord(reactionRaw);
        const reactionVal = reactionRec?.choice ?? reactionRec?.value ?? reactionRec?.answer;
        const reactionConf = unit(reactionRec?.confidence ?? reactionRec?.confidence_score);
        if (typeof reactionVal !== 'string' || reactionConf === undefined) {
            throw new JevHttpError('invalid_response', `Invalid reaction answer for ${stakeholder.id}`);
        }

        const intensityRec = asRecord(intensityRaw);
        const intensityScore = intensityRec?.score ?? intensityRec?.value ?? intensityRec?.answer;
        const intensityConf = unit(intensityRec?.confidence ?? intensityRec?.confidence_score);
        if (intensityScore === undefined || intensityConf === undefined) {
            throw new JevHttpError('invalid_response', `Invalid intensity answer for ${stakeholder.id}`);
        }
        let intensityVal: string;
        if (typeof intensityScore === 'number') {
            const mapped = scoreToIntensity(intensityScore);
            if (!mapped) {
                throw new JevHttpError('invalid_response', `Score out of range [0, 3] for ${stakeholder.id}: ${intensityScore}`);
            }
            intensityVal = mapped;
        } else if (typeof intensityScore === 'string') {
            intensityVal = intensityScore;
        } else {
            throw new JevHttpError('invalid_response', `Invalid intensity value for ${stakeholder.id}`);
        }

        // Noul probability independent of confidence; Noul answers carry NO confidence field in official docs
        const socialRec = asRecord(socialRaw);
        const socialProb = unit(socialRec?.noul ?? socialRec?.value ?? socialRec?.answer);
        if (socialProb === undefined) {
            throw new JevHttpError('invalid_response', `Invalid social influence probability for ${stakeholder.id}`);
        }
        const socialConf = unit(socialRec?.confidence) ?? 1;

        const moralRec = asRecord(moralRaw);
        const moralVal = moralRec?.choice ?? moralRec?.value ?? moralRec?.answer;
        const moralConf = unit(moralRec?.confidence ?? moralRec?.confidence_score);
        if (typeof moralVal !== 'string' || moralConf === undefined) {
            throw new JevHttpError('invalid_response', `Invalid moral direction answer for ${stakeholder.id}`);
        }

        decisions[stakeholder.id] = {
            reaction: { value: String(reactionVal), confidence: reactionConf },
            intensity: { value: intensityVal, confidence: intensityConf },
            socialInfluence: { value: socialProb, confidence: socialConf },
            moralDirection: { value: String(moralVal), confidence: moralConf },
        };
    }

    const usage = asRecord(root.usage);
    return {
        model: typeof root.model === 'string' ? root.model : request.model,
        decisions,
        inputTokens: finite(root.inputTokens ?? usage?.input_tokens ?? usage?.prompt_tokens),
        outputTokens: finite(root.outputTokens ?? usage?.output_tokens ?? usage?.completion_tokens),
    };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        const abort = () => {
            clearTimeout(timer);
            reject(new JevHttpError('aborted', 'Jev request aborted'));
        };
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
    });
}

export class JevHttpAdapter implements SemanticJudgePort {
    private readonly apiKey: string;
    private readonly model: string;
    private readonly endpoint: string;
    private readonly timeoutMs: number;
    private readonly maxRetries: number;
    private readonly retryDelayMs: number;
    private readonly fetchImpl: JevFetch;

    constructor(options: JevHttpAdapterOptions | string = {}) {
        const config = typeof options === 'string' ? { apiKey: options } : options;
        this.apiKey = config.apiKey ?? '';
        this.model = config.model ?? DEFAULT_MODEL;
        this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
        this.timeoutMs = Math.max(1, config.timeoutMs ?? 3000);
        this.maxRetries = Math.max(0, config.maxRetries ?? 2);
        this.retryDelayMs = Math.max(0, config.retryDelayMs ?? 100);
        this.fetchImpl = config.fetch ?? ((url, init) => globalThis.fetch(url, init as RequestInit) as unknown as Promise<JevFetchResponse>);
    }

    async evaluate(request: SemanticJudgeRequest, signal?: AbortSignal): Promise<SemanticJudgeResponse> {
        if (!this.apiKey) throw new JevHttpError('configuration', 'TYPESAFE_API_KEY is not configured');
        if (signal?.aborted) throw new JevHttpError('aborted', 'Jev request aborted');

        const questionsMap: Record<string, unknown> = {};
        if (request.questions && request.questions.length > 0) {
            for (const q of request.questions) {
                questionsMap[q.id] = {
                    type: q.type,
                    instructions: q.instructions ?? `Avaliação para a pergunta ${q.id}`,
                    criteria: q.criteria ?? (
                        q.type === 'score'
                            ? ['baixa', 'média', 'alta', 'crítica']
                            : q.type === 'choice'
                                ? { apoiar: 'Apoiar', neutro: 'Neutro', resistir: 'Resistir', confrontar: 'Confrontar', pedir_ajuda: 'Pedir ajuda' }
                                : { true: 'Sim', false: 'Não' }
                    ),
                };
            }
        }
        for (const s of request.stakeholders) {
            const reactionId = `reaction_${s.id}`;
            if (!questionsMap[reactionId]) {
                questionsMap[reactionId] = {
                    type: 'choice',
                    instructions: `Como o stakeholder ${s.name} (${s.role}, id: ${s.id}) reage à situação?`,
                    criteria: {
                        apoiar: 'Apoiar a decisão ou iniciativa',
                        neutro: 'Posição neutra ou observadora',
                        resistir: 'Resistir à mudança ou apresentar objeções',
                        confrontar: 'Confrontar ativamente a liderança ou pares',
                        pedir_ajuda: 'Solicitar suporte, orientação ou alívio de estresse',
                    },
                };
            }
            const intensityId = `intensity_${s.id}`;
            if (!questionsMap[intensityId]) {
                questionsMap[intensityId] = {
                    type: 'score',
                    instructions: `Qual é a intensidade da postura do stakeholder ${s.name} (${s.role}, id: ${s.id})?`,
                    criteria: ['baixa', 'média', 'alta', 'crítica'],
                };
            }
            const socialId = `social_influence_${s.id}`;
            if (!questionsMap[socialId]) {
                questionsMap[socialId] = {
                    type: 'noul',
                    instructions: `O stakeholder ${s.name} (${s.role}, id: ${s.id}) tem probabilidade de influenciar seus colegas?`,
                    criteria: {
                        true: 'A postura afeta diretamente os colegas',
                        false: 'A postura é isolada e não afeta os colegas',
                    },
                };
            }
            const moralId = `moral_direction_${s.id}`;
            if (!questionsMap[moralId]) {
                questionsMap[moralId] = {
                    type: 'choice',
                    instructions: `Qual é a direção do impacto moral provocada pelo stakeholder ${s.name} (${s.role}, id: ${s.id})?`,
                    criteria: {
                        positive: 'Impacto positivo e motivador',
                        neutral: 'Impacto neutro',
                        negative: 'Impacto negativo e desgastante',
                    },
                };
            }
        }

        const body = JSON.stringify({
            model: this.model,
            state: {
                situation: request.situation,
                turn: request.turn,
                stakeholders: request.stakeholders,
            },
            questions: questionsMap,
        });
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            let response: JevFetchResponse;
            try {
                response = await this.fetchWithTimeout(body, signal);
            } catch (error) {
                if (error instanceof JevHttpError) throw error;
                if (signal?.aborted) throw new JevHttpError('aborted', 'Jev request aborted');
                throw new JevHttpError('http', error instanceof Error ? error.message : 'Jev request failed');
            }
            if (response.status === 429 || response.status === 529) {
                if (attempt >= this.maxRetries) throw new JevHttpError('rate_limit', `Jev rate limit after ${attempt + 1} attempts`, response.status);
                await sleep(this.retryDelayMs * (attempt + 1), signal);
                continue;
            }
            if (!response.ok || response.status < 200 || response.status >= 300) {
                throw new JevHttpError('http', `Jev HTTP ${response.status}`, response.status);
            }
            let payload: unknown;
            try {
                payload = await response.json();
            } catch {
                throw new JevHttpError('invalid_response', 'Jev response is not valid JSON', response.status);
            }
            return parseResponse(payload, request);
        }
        throw new JevHttpError('rate_limit', 'Jev retries exhausted');
    }

    private async fetchWithTimeout(body: string, signal?: AbortSignal): Promise<JevFetchResponse> {
        const controller = new AbortController();
        let timedOut = false;
        let parentAborted = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, this.timeoutMs);
        const abortParent = () => {
            parentAborted = true;
            controller.abort();
        };
        signal?.addEventListener('abort', abortParent, { once: true });
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let abortListener: (() => void) | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                timedOut = true;
                controller.abort();
                reject(new JevHttpError('timeout', `Jev timeout after ${this.timeoutMs}ms`));
            }, this.timeoutMs);
        });
        const abortPromise = signal
            ? new Promise<never>((_, reject) => {
                abortListener = () => {
                    parentAborted = true;
                    controller.abort();
                    reject(new JevHttpError('aborted', 'Jev request aborted'));
                };
                if (signal.aborted) abortListener();
                else signal.addEventListener('abort', abortListener, { once: true });
            })
            : undefined;
        try {
            const request = this.fetchImpl(this.endpoint, {
                method: 'POST',
                headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
                body,
                signal: controller.signal,
            });
            return await Promise.race([request, timeoutPromise, ...(abortPromise ? [abortPromise] : [])]);
        } catch (error) {
            if (parentAborted || signal?.aborted) throw new JevHttpError('aborted', 'Jev request aborted');
            if (timedOut || (error instanceof Error && error.name === 'AbortError')) throw new JevHttpError('timeout', `Jev timeout after ${this.timeoutMs}ms`);
            throw error;
        } finally {
            clearTimeout(timeout);
            if (timeoutHandle) clearTimeout(timeoutHandle);
            signal?.removeEventListener('abort', abortParent);
            if (abortListener) signal?.removeEventListener('abort', abortListener);
        }
    }
}
