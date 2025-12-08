import { LLMFactory, LLMProvider, LLMModel } from './LLMProvider.js';

export enum IntentType {
    COMPLEX_REASONING = 'COMPLEX_REASONING',
    CREATIVE_GENERATION = 'CREATIVE_GENERATION',
    SIMPLE_VALIDATION = 'SIMPLE_VALIDATION',
    UNKNOWN = 'UNKNOWN'
}

export class SmartRouter {
    private localRouter: LLMProvider;
    private primaryLLM: LLMProvider; // GPT-4 or Gemini
    private workerLLM: LLMProvider;  // Gemini or DeepSeek

    constructor() {
        // We use Ollama (Llama 3 or Phi3) as the "Router Brain" because it's free
        this.localRouter = LLMFactory.getOllama('llama3');

        // These can be instantiated lazily or here
        this.primaryLLM = LLMFactory.getGPT4();
        this.workerLLM = LLMFactory.getGemini();
    }

    async route(prompt: string): Promise<LLMProvider> {
        console.log('🔄 SmartRouter: Analyzing intent...');

        try {
            const intent = await this.classifyIntent(prompt);
            console.log(`🎯 Intent Classified: ${intent}`);

            switch (intent) {
                case IntentType.COMPLEX_REASONING:
                    console.log('🚀 Routing to Primary LLM (GPT-4/Gemini Pro)');
                    return this.primaryLLM; // Or fallback to Gemini if GPT is costly

                case IntentType.CREATIVE_GENERATION:
                    console.log('🎨 Routing to Worker LLM (Gemini)');
                    return this.workerLLM;

                case IntentType.SIMPLE_VALIDATION:
                    console.log('⚡ Routing to Worker LLM (DeepSeek/Gemini)');
                    return LLMFactory.getDeepSeek(); // Efficient for simple tasks

                default:
                    return this.workerLLM;
            }
        } catch (error) {
            console.error('⚠️ Router failed, falling back to Gemini:', error);
            return this.workerLLM;
        }
    }

    private async classifyIntent(prompt: string): Promise<IntentType> {
        const routerPrompt = `
        Classify the following user prompt into one of these categories:
        - COMPLEX_REASONING: Requires deep thought, planning, or critique.
        - CREATIVE_GENERATION: Requires storytelling, personas, or brainstorming.
        - SIMPLE_VALIDATION: JSON formatting, data extraction, or simple checks.

        User Prompt: "${prompt.substring(0, 500)}..."

        Respond ONLY with the category name.
        `;

        try {
            const response = await this.localRouter.generate(routerPrompt);
            const content = response.content.trim().toUpperCase();

            if (content.includes('COMPLEX')) return IntentType.COMPLEX_REASONING;
            if (content.includes('CREATIVE')) return IntentType.CREATIVE_GENERATION;
            if (content.includes('SIMPLE')) return IntentType.SIMPLE_VALIDATION;

            return IntentType.UNKNOWN;
        } catch (e) {
            console.warn('⚠️ Router inference failed (Ollama offline?), falling back to default route.');
            // Return UNKNOWN to trigger default switch case (Worker LLM)
            return IntentType.UNKNOWN;
        }
    }
}
