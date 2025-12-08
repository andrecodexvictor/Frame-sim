import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export enum LLMModel {
    GPT4 = 'gpt-4',
    GEMINI_PRO = 'gemini-pro',
    DEEPSEEK_CODER = 'deepseek-coder',
    OLLAMA_LLAMA3 = 'llama3',
    OLLAMA_PHI3 = 'phi3'
}

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    modelUsed: string;
}

export interface LLMProvider {
    generate(prompt: string, systemPrompt?: string): Promise<LLMResponse>;
    name(): string;
}

// --- Gemini Provider with Rotation ---
export class GeminiProvider implements LLMProvider {
    private clients: ChatGoogleGenerativeAI[] = [];
    private currentClientIndex = 0;

    constructor() {
        const keys = [
            process.env.GOOGLE_API_KEY,
            process.env.GOOGLE_API_KEY_2,
            process.env.GOOGLE_API_KEY_3
        ].filter(k => !!k);

        if (keys.length === 0) {
            console.warn('⚠️ No GOOGLE_API_KEY found for GeminiProvider');
        }

        keys.forEach(key => {
            this.clients.push(new ChatGoogleGenerativeAI({
                apiKey: key,
                model: 'gemini-1.5-pro',
                temperature: 0.7,
                maxRetries: 1
            }));
        });
    }

    name(): string { return 'GeminiProvider (RoundRobin)'; }

    async generate(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
        if (this.clients.length === 0) throw new Error("No Gemini clients available");

        // Round Robin
        const client = this.clients[this.currentClientIndex];
        this.currentClientIndex = (this.currentClientIndex + 1) % this.clients.length;

        try {
            const messages = [];
            if (systemPrompt) messages.push(new SystemMessage(systemPrompt));
            messages.push(new HumanMessage(prompt));

            const response = await client.invoke(messages);
            return {
                content: response.content as string,
                modelUsed: 'gemini-1.5-pro'
            };
        } catch (error) {
            console.error('Gemini Error (Rotating key...):', error);
            // Simple retry logic could be added here, currently just fails to next
            throw error;
        }
    }
}

// --- OpenAI / DeepSeek Provider (Fetch based to avoid deps) ---
export class OpenAICompatibleProvider implements LLMProvider {
    constructor(
        private apiKey: string,
        private baseURL: string,
        private modelName: string,
        private providerName: string
    ) { }

    name(): string { return this.providerName; }

    async generate(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.modelName,
                messages: messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`${this.providerName} API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            usage: data.usage,
            modelUsed: this.modelName
        };
    }
}

// --- Ollama Provider ---
export class OllamaProvider implements LLMProvider {
    private baseUrl: string;
    private model: string;

    constructor(model: string = 'llama3') {
        this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.model = model;
    }

    name(): string { return `Ollama (${this.model})`; }

    async generate(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
        const p = systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}` : prompt;

        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                prompt: p,
                stream: false
            })
        });

        if (!response.ok) throw new Error("Ollama Connection Error");

        const data = await response.json();
        return {
            content: data.response,
            modelUsed: this.model
        };
    }
}

// --- Factory ---
export class LLMFactory {
    static getGemini(): LLMProvider { return new GeminiProvider(); }

    static getGPT4(): LLMProvider {
        return new OpenAICompatibleProvider(
            process.env.OPENAI_API_KEY || '',
            'https://api.openai.com/v1',
            'gpt-4',
            'GPT-4 Provider'
        );
    }

    static getDeepSeek(): LLMProvider {
        return new OpenAICompatibleProvider(
            process.env.DEEPSEEK_API_KEY || '',
            'https://api.deepseek.com', // Check actual base URL
            'deepseek-chat',
            'DeepSeek Provider'
        );
    }

    static getOllama(model: string = 'llama3'): LLMProvider {
        return new OllamaProvider(model);
    }
}
