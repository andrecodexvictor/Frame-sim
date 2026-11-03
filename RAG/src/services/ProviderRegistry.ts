export type ProviderId = 'google' | 'openai' | 'deepseek' | 'glm' | 'kimi' | 'jev';
export type ProviderRole = 'generation' | 'critique' | 'longitudinal-review' | 'typed-evaluation';
export type ProviderHealth = 'configured' | 'catalog_verified' | 'generation_verified' | 'unavailable';
export interface ProviderDescriptor {
    id: ProviderId;
    configured: boolean;
    model: string;
    baseURL: string;
    roles: ProviderRole[];
    state: ProviderHealth;
    resolvedModel?: string;
    lastFailure?: string;
}

/** Server-only registry. Public descriptors contain no credential values. */
export class ProviderRegistry {
    private readonly observations = new Map<ProviderId, Pick<ProviderDescriptor, 'state' | 'resolvedModel' | 'lastFailure'>>();
    private readonly cooldowns = new Map<string, number>();
    constructor(private readonly environment: () => NodeJS.ProcessEnv = () => process.env, private readonly now = () => Date.now()) {}

    keys(id: ProviderId): string[] {
        const env = this.environment();
        const pool = (prefix: string) => [prefix, ...Array.from({ length: 7 }, (_, i) => `${prefix}_${i + 1}`)].map(name => env[name]?.trim()).filter((key): key is string => Boolean(key));
        if (id === 'google') return [...new Set([...pool('GOOGLE_API_KEY'), ...pool('VITE_API_KEY')])];
        const key = id === 'openai' ? env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
            : id === 'deepseek' ? env.NVIDIA_DEEPSEEK_API_KEY?.trim() || env.DEEPSEEK_API_KEY || env.VITE_DEEPSEEK_API_KEY
                : id === 'glm' ? env.NVIDIA_GLM_API_KEY : id === 'kimi' ? env.NVIDIA_KIMI_API_KEY : env.TYPESAFE_API_KEY;
        return key?.trim() ? [key.trim()] : [];
    }

    list(): ProviderDescriptor[] {
        const env = this.environment();
        const nvidia = Boolean(env.NVIDIA_DEEPSEEK_API_KEY?.trim());
        const descriptors: Array<Omit<ProviderDescriptor, 'configured' | 'state'>> = [
            { id: 'google', model: env.GEMINI_MODEL || 'gemini-2.5-flash', baseURL: 'https://generativelanguage.googleapis.com/v1beta', roles: ['generation'] },
            { id: 'openai', model: env.OPENAI_MODEL || 'gpt-4o-mini', baseURL: 'https://api.openai.com/v1', roles: ['generation', 'critique'] },
            { id: 'deepseek', model: nvidia ? env.NVIDIA_DEEPSEEK_MODEL || 'deepseek-ai/deepseek-v4.1-flash' : env.DEEPSEEK_MODEL || 'deepseek-chat', baseURL: nvidia ? 'https://integrate.api.nvidia.com/v1' : 'https://api.deepseek.com', roles: ['generation'] },
            { id: 'glm', model: env.NVIDIA_GLM_MODEL || 'z-ai/glm-5.3', baseURL: 'https://integrate.api.nvidia.com/v1', roles: ['critique'] },
            { id: 'kimi', model: env.NVIDIA_KIMI_MODEL || 'moonshotai/kimi-k3', baseURL: 'https://integrate.api.nvidia.com/v1', roles: ['longitudinal-review'] },
            { id: 'jev', model: env.JEV_MODEL || 'jev-latest', baseURL: 'https://api.typesafe.ai/v1', roles: ['typed-evaluation'] },
        ];
        return descriptors.map(item => {
            const configured = this.keys(item.id).length > 0;
            return { ...item, configured, state: configured ? 'configured' : 'unavailable', ...(configured ? this.observations.get(item.id) : {}) };
        });
    }

    get(id: ProviderId): ProviderDescriptor { return this.list().find(item => item.id === id)!; }
    forModel(model: string): ProviderId | undefined {
        const configured = this.list().find(item => item.model === model);
        if (configured) return configured.id;
        if (/^gemini-[a-z0-9.-]+$/i.test(model)) return 'google';
        if (/^z-ai\/glm[a-z0-9.-]+$/i.test(model)) return 'glm';
        if (/^moonshotai\/kimi[a-z0-9.-]+$/i.test(model)) return 'kimi';
        if (/^(deepseek-ai\/deepseek[a-z0-9.-]+|deepseek-[a-z0-9.-]+)$/i.test(model)) return 'deepseek';
        if (/^(gpt-|o[1-9])[a-z0-9.-]+$/i.test(model)) return 'openai';
        return undefined;
    }
    markSuccess(id: ProviderId, resolvedModel: string): void {
        this.observations.set(id, { state: 'generation_verified', resolvedModel });
    }
    markCatalog(id: ProviderId): void { this.observations.set(id, { state: 'catalog_verified' }); }
    markFailure(id: ProviderId, code: string): void { this.observations.set(id, { state: 'unavailable', lastFailure: code }); }
    canAttempt(id: ProviderId, key: string): boolean {
        return this.now() >= (this.cooldowns.get(id) ?? 0) && this.now() >= (this.cooldowns.get(`${id}:${key}`) ?? 0);
    }
    coolDown(id: ProviderId, key: string, status: number, retryAfterMs = 0): void {
        if (status === 401 || status === 403) this.cooldowns.set(`${id}:${key}`, Number.POSITIVE_INFINITY);
        else if (status === 429) this.cooldowns.set(id, this.now() + Math.max(retryAfterMs, 60_000));
        else if (status >= 500) this.cooldowns.set(`${id}:${key}`, this.now() + Math.max(retryAfterMs, 3_000));
    }
}
