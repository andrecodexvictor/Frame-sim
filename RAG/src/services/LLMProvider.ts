import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export enum LLMModel { GPT4 = 'gpt-4', GEMINI_PRO = 'gemini-pro', DEEPSEEK_CODER = 'deepseek-coder', OLLAMA_LLAMA3 = 'llama3', OLLAMA_PHI3 = 'phi3' }
export interface GenerateOptions { signal?: AbortSignal; timeoutMs?: number; }
export interface LLMResponse {
    provider?: string;
    requestedModel?: string;
    content: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    modelUsed: string;
}
export interface LLMProvider { generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse>; name(): string; }
export const geminiModel = (): string => process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 30_000;

function timeoutFor(options?: GenerateOptions): number {
    const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;
}
function abortError(message: string): Error { const error = new Error(message); error.name = 'AbortError'; return error; }
function toContent(value: unknown, provider: string): string {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value)) {
        const text = value.map(item => typeof item === 'string' ? item : item && typeof item === 'object' && 'text' in item ? String((item as { text?: unknown }).text || '') : '').join('');
        if (text.trim()) return text;
    }
    throw new Error(`${provider} returned an invalid response payload`);
}
function usageFrom(value: unknown, provider: string): LLMResponse['usage'] | undefined {
    if (value == null) return undefined;
    if (typeof value !== 'object') throw new Error(`${provider} returned invalid usage metadata`);
    const usage = value as Record<string, unknown>;
    const promptTokens = Number(usage.promptTokens ?? usage.prompt_tokens ?? usage.input_tokens);
    const completionTokens = Number(usage.completionTokens ?? usage.completion_tokens ?? usage.output_tokens);
    const totalTokens = Number(usage.totalTokens ?? usage.total_tokens);
    if (![promptTokens, completionTokens, totalTokens].every(Number.isFinite) || [promptTokens, completionTokens, totalTokens].some(token => token < 0)) throw new Error(`${provider} returned invalid usage metadata`);
    return { promptTokens, completionTokens, totalTokens };
}

type GeminiClient = { invoke: (messages: unknown, options?: unknown) => Promise<unknown> };
export interface GeminiProviderOptions { keys?: string[]; model?: string; timeoutMs?: number; clientFactory?: (apiKey: string, model: string) => GeminiClient; }
function configuredGeminiKeys(): string[] {
    const names = ['GOOGLE_API_KEY', ...Array.from({ length: 7 }, (_, index) => `GOOGLE_API_KEY_${index + 1}`)];
    const unique = new Set<string>();
    for (const name of names) { const value = process.env[name]?.trim(); if (value) unique.add(value); }
    return [...unique];
}
function invokeWithTimeout(client: GeminiClient, messages: unknown, options: GenerateOptions | undefined, defaultTimeoutMs: number): Promise<unknown> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let removeCallerListener = () => undefined;
    const invokePromise = Promise.resolve().then(() => client.invoke(messages, { signal: controller.signal }));
    const abortPromise = new Promise<never>((_, reject) => {
        const cancel = () => { controller.abort(options?.signal?.reason); reject(abortError(options?.signal?.reason ? 'Generation cancelled.' : 'Provider request timed out.')); };
        if (options?.signal?.aborted) { cancel(); return; }
        if (options?.signal) { options.signal.addEventListener('abort', cancel, { once: true }); removeCallerListener = () => { options.signal?.removeEventListener('abort', cancel); }; }
        timer = setTimeout(() => { controller.abort('timeout'); reject(abortError('Provider request timed out.')); }, timeoutMs);
    });
    return Promise.race([invokePromise, abortPromise]).finally(() => { if (timer) clearTimeout(timer); removeCallerListener(); });
}

export class GeminiProvider implements LLMProvider {
    private clients: GeminiClient[] = [];
    private currentClientIndex = 0;
    private readonly model: string;
    private readonly timeoutMs: number;
    constructor(options: GeminiProviderOptions = {}) {
        const keys = [...new Set((options.keys ?? configuredGeminiKeys()).map(key => key.trim()).filter(Boolean))];
        this.model = options.model || geminiModel(); this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const factory = options.clientFactory ?? ((apiKey: string, model: string) => new ChatGoogleGenerativeAI({ apiKey, model, temperature: 0.7, maxRetries: 0 }) as unknown as GeminiClient);
        this.clients = keys.map(key => factory(key, this.model));
        if (this.clients.length === 0) console.warn('⚠️ No GOOGLE_API_KEY found for GeminiProvider');
    }
    name(): string { return 'GeminiProvider (RoundRobin)'; }
    isAvailable(): boolean { return this.clients.length > 0; }
    async generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse> {
        if (this.clients.length === 0) throw new Error('No Gemini clients available');
        if (options?.signal?.aborted) throw abortError('Generation cancelled.');
        const startIndex = this.currentClientIndex % this.clients.length; this.currentClientIndex = (startIndex + 1) % this.clients.length;
        const messages = [...(systemPrompt ? [new SystemMessage(systemPrompt)] : []), new HumanMessage(prompt)];
        let lastError: unknown;
        for (let attempt = 0; attempt < this.clients.length; attempt++) {
            if (options?.signal?.aborted) throw abortError('Generation cancelled.');
            try {
                const response = await invokeWithTimeout(this.clients[(startIndex + attempt) % this.clients.length], messages, options, this.timeoutMs) as Record<string, unknown>;
                const metadata = response?.response_metadata as { model_name?: string } | undefined;
                return { content: toContent(response?.content, 'Gemini'), usage: usageFrom(response?.usage_metadata ?? response?.usage, 'Gemini'), modelUsed: metadata?.model_name || this.model, requestedModel: this.model, provider: 'google' };
            } catch (error) { lastError = error; if (options?.signal?.aborted) throw error; }
        }
        throw lastError instanceof Error ? lastError : new Error('All Gemini keys failed');
    }
}

export class OpenAICompatibleProvider implements LLMProvider {
    constructor(private readonly apiKey: string, private readonly baseURL: string, private readonly modelName: string, private readonly providerName: string, private readonly fetchImpl: typeof fetch = fetch, private readonly defaultTimeoutMs = DEFAULT_TIMEOUT_MS) { }
    name(): string { return this.providerName; }
    isAvailable(): boolean { return this.apiKey.trim().length > 0; }
    async generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse> {
        if (!this.isAvailable()) throw new Error(`${this.providerName} is not configured`);
        const controller = new AbortController(); const timeoutMs = timeoutFor(options) || this.defaultTimeoutMs; const cancel = () => controller.abort(options?.signal?.reason ?? 'cancelled');
        if (options?.signal?.aborted) throw abortError('Generation cancelled.'); options?.signal?.addEventListener('abort', cancel, { once: true }); const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
        try {
            const response = await this.fetchImpl(`${this.baseURL}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` }, signal: controller.signal, body: JSON.stringify({ model: this.modelName, messages: [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), { role: 'user', content: prompt }], temperature: 0.7 }) });
            const data = await response.json().catch(() => null) as Record<string, unknown> | null;
            if (!response.ok) throw new Error(`${this.providerName} API error (${response.status})`);
            if (!Array.isArray(data?.choices) || !data.choices[0] || typeof data.choices[0] !== 'object') throw new Error(`${this.providerName} returned an invalid response payload`);
            const message = (data.choices[0] as Record<string, unknown>).message;
            return { content: toContent(message && typeof message === 'object' ? (message as Record<string, unknown>).content : undefined, this.providerName), usage: usageFrom(data?.usage, this.providerName), modelUsed: typeof data?.model === 'string' ? data.model : this.modelName, requestedModel: this.modelName, provider: this.providerName };
        } catch (error) { if (controller.signal.aborted) throw abortError(options?.signal?.aborted ? 'Generation cancelled.' : 'Provider request timed out.'); throw error; }
        finally { clearTimeout(timer); options?.signal?.removeEventListener('abort', cancel); }
    }
}

export class OllamaProvider implements LLMProvider {
    constructor(private readonly model = 'llama3', private readonly baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '')) { }
    name(): string { return `Ollama (${this.model})`; }
    async generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse> {
        const controller = new AbortController(); const cancel = () => controller.abort(options?.signal?.reason ?? 'cancelled');
        if (options?.signal?.aborted) throw abortError('Generation cancelled.'); options?.signal?.addEventListener('abort', cancel, { once: true }); const timer = setTimeout(() => controller.abort('timeout'), Math.min(timeoutFor(options), 5_000));
        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model: this.model, prompt: systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}` : prompt, stream: false }) });
            const data = await response.json().catch(() => null) as Record<string, unknown> | null; if (!response.ok) throw new Error(`Ollama API error (${response.status})`); return { content: toContent(data?.response, 'Ollama'), modelUsed: this.model };
        } catch (error) { if (controller.signal.aborted) throw abortError(options?.signal?.aborted ? 'Generation cancelled.' : 'Provider request timed out.'); throw error; }
        finally { clearTimeout(timer); options?.signal?.removeEventListener('abort', cancel); }
    }
}

export class LLMFactory {
    static hasGemini(): boolean { return configuredGeminiKeys().length > 0; }
    static hasGPT4(): boolean { return Boolean(process.env.OPENAI_API_KEY?.trim()); }
    static hasDeepSeek(): boolean { return Boolean(process.env.NVIDIA_DEEPSEEK_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim()); }
    static hasGLM(): boolean { return Boolean(process.env.NVIDIA_GLM_API_KEY?.trim()); }
    static hasKimi(): boolean { return Boolean(process.env.NVIDIA_KIMI_API_KEY?.trim()); }
    static getGLM(): LLMProvider { return new OpenAICompatibleProvider(process.env.NVIDIA_GLM_API_KEY || '', 'https://integrate.api.nvidia.com/v1', process.env.NVIDIA_GLM_MODEL || 'z-ai/glm-5.3', 'NVIDIA GLM Provider'); }
    static getKimi(): LLMProvider { return new OpenAICompatibleProvider(process.env.NVIDIA_KIMI_API_KEY || '', 'https://integrate.api.nvidia.com/v1', process.env.NVIDIA_KIMI_MODEL || 'moonshotai/kimi-k3', 'NVIDIA Kimi Provider'); }
    static getGemini(): LLMProvider { return new GeminiProvider(); }
    static getGPT4(): LLMProvider { return new OpenAICompatibleProvider(process.env.OPENAI_API_KEY || '', 'https://api.openai.com/v1', 'gpt-4', 'GPT-4 Provider'); }
    static getDeepSeek(): LLMProvider {
        const nvidiaKey = process.env.NVIDIA_DEEPSEEK_API_KEY?.trim();
        return nvidiaKey
            ? new OpenAICompatibleProvider(nvidiaKey, 'https://integrate.api.nvidia.com/v1', process.env.NVIDIA_DEEPSEEK_MODEL || 'deepseek-ai/deepseek-v4.1-flash', 'NVIDIA DeepSeek Provider')
            : new OpenAICompatibleProvider(process.env.DEEPSEEK_API_KEY || '', 'https://api.deepseek.com', 'deepseek-chat', 'DeepSeek Provider');
    }
    static getOllama(model = 'llama3'): LLMProvider { return new OllamaProvider(model); }
}
