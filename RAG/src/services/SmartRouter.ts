import { LLMFactory, type GenerateOptions, type LLMProvider, type LLMResponse } from './LLMProvider.js';

export enum IntentType {
    COMPLEX_REASONING = 'COMPLEX_REASONING',
    CREATIVE_GENERATION = 'CREATIVE_GENERATION',
    SIMPLE_VALIDATION = 'SIMPLE_VALIDATION',
    UNKNOWN = 'UNKNOWN'
}

export interface SmartRouterOptions {
    localRouter?: LLMProvider | null;
    gpt?: LLMProvider | null;
    gemini?: LLMProvider | null;
    deepseek?: LLMProvider | null;
    localTimeoutMs?: number;
}

class ProviderChain implements LLMProvider {
    constructor(private readonly providers: LLMProvider[]) {}

    name(): string {
        return `SmartRouter[${this.providers.map(provider => provider.name()).join(' -> ')}]`;
    }

    async generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse> {
        let lastError: unknown;
        for (const provider of this.providers) {
            if (options?.signal?.aborted) throw options.signal.reason ?? new Error('Generation cancelled.');
            try {
                return await provider.generate(prompt, systemPrompt, options);
            } catch (error) {
                lastError = error;
                if (options?.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
            }
        }
        throw lastError instanceof Error ? lastError : new Error('No configured LLM provider completed the request.');
    }
}

function normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function explicitOrDefault<T>(value: T | null | undefined, factory: () => T | null): T | null {
    return value === undefined ? factory() : value;
}

export class SmartRouter {
    private readonly localRouter: LLMProvider | null;
    private readonly gpt: LLMProvider | null;
    private readonly gemini: LLMProvider | null;
    private readonly deepseek: LLMProvider | null;
    private readonly localTimeoutMs: number;

    constructor(options: SmartRouterOptions = {}) {
        this.localRouter = explicitOrDefault(options.localRouter, () => LLMFactory.getOllama('llama3'));
        this.gpt = explicitOrDefault(options.gpt, () => LLMFactory.hasGPT4() ? LLMFactory.getGPT4() : null);
        this.gemini = explicitOrDefault(options.gemini, () => LLMFactory.hasGemini() ? LLMFactory.getGemini() : null);
        this.deepseek = explicitOrDefault(options.deepseek, () => LLMFactory.hasDeepSeek() ? LLMFactory.getDeepSeek() : null);
        this.localTimeoutMs = Math.min(Math.max(options.localTimeoutMs ?? 1_200, 100), 5_000);
    }

    async route(prompt: string): Promise<LLMProvider> {
        const intent = await this.classifyIntent(prompt);
        const ordered = intent === IntentType.COMPLEX_REASONING
            ? [this.gpt, this.gemini, this.deepseek]
            : intent === IntentType.SIMPLE_VALIDATION
                ? [this.deepseek, this.gemini, this.gpt]
                : [this.gemini, this.gpt, this.deepseek];
        const providers = ordered.filter((provider): provider is LLMProvider => provider !== null);
        if (providers.length === 0) throw new Error('No LLM provider is configured for the SmartRouter.');
        return new ProviderChain(providers);
    }

    async classifyIntent(prompt: string): Promise<IntentType> {
        const normalized = normalize(prompt).slice(0, 4_000);

        // Obvious intents are routed without paying the latency of another LLM.
        if (/\b(critica|critique|replan|planej|estrateg|plausib|risco|roi|consolid|trade-?off|causal)\w*/.test(normalized)) {
            return IntentType.COMPLEX_REASONING;
        }
        if (/\b(json|valid|schema|format|extrai|classifi|normaliz|parse)\w*/.test(normalized)) {
            return IntentType.SIMPLE_VALIDATION;
        }
        if (/\b(persona|narrativ|cenario|simul|story|brainstorm|criativ)\w*/.test(normalized)) {
            return IntentType.CREATIVE_GENERATION;
        }

        if (!this.localRouter) return IntentType.UNKNOWN;
        const routerPrompt = `Classify as COMPLEX_REASONING, CREATIVE_GENERATION, or SIMPLE_VALIDATION. Return only the label.\nPrompt: ${prompt.slice(0, 500)}`;
        try {
            const response = await this.localRouter.generate(routerPrompt, undefined, { timeoutMs: this.localTimeoutMs });
            const content = response.content.trim().toUpperCase();
            if (content.includes('COMPLEX')) return IntentType.COMPLEX_REASONING;
            if (content.includes('CREATIVE')) return IntentType.CREATIVE_GENERATION;
            if (content.includes('SIMPLE')) return IntentType.SIMPLE_VALIDATION;
        } catch {
            // A local router is optional. UNKNOWN selects the general-purpose chain.
        }
        return IntentType.UNKNOWN;
    }
}
