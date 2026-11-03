import type { LLMResponse } from '../services/LLMProvider.js';
import { SmartRouter } from '../services/SmartRouter.js';
import { applySimulationRules, loadSimulationRules, type SimulationRules } from '../services/simulationRulesLoader.js';

export interface CritiqueResult {
    modelUsed?: string;
    requestedModel?: string;
    provider?: string;
    plausibilityScore: number;
    justification: string;
    replanRequired: boolean;
    replanSuggestion?: string;
    degraded?: boolean;
}

export class CriticAgent {
    private readonly rules: SimulationRules;

    constructor(
        private readonly router: Pick<SmartRouter, 'route'> = new SmartRouter(),
        rules: SimulationRules = loadSimulationRules()
    ) {
        this.rules = rules;
    }

    async critique(simulationOutput: any, context: string, options: { signal?: AbortSignal } = {}): Promise<CritiqueResult> {
        console.log('🧐 CriticAgent: Reviewing simulation results...');

        const prompt = `
        **Role:** You are the Critic Agent (Cognitive Control). Your job is to validate business simulation results.

        **Instructions:**
        1. Analyze the 'Simulation Result' and 'Context'.
        2. Calculate a 'Plausibility_Score' (0-100).
        3. If score < ${this.rules.plausibilityThreshold}, you MUST provide a 'Replan_Suggestion' (what to change in parameters).
        4. Output JSON ONLY.

        **Versioned deterministic validation rules:**
        ${JSON.stringify(this.rules.rules)}

        **Context:**
        ${context}

        **Simulation Result:**
        ${JSON.stringify(simulationOutput, null, 2)}

        **Output Format (JSON):**
        {
          "Plausibility_Score": number,
          "Justificativa": string,
          "Replan_Necessario": boolean,
          "Replan_Suggestion": string (optional)
        }
        `;

        try {
            const llm = await this.router.route('Critique ROI plausibility, causal risk and replan requirements.');
            const response: LLMResponse = await llm.generate(prompt, undefined, { signal: options.signal });
            const content = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const json = JSON.parse(content);
            const proposedScore = Number(json.Plausibility_Score);
            const roiResult = simulationOutput?.roi_result ?? simulationOutput?.roi ?? simulationOutput;
            const validation = applySimulationRules(this.rules, roiResult || {}, proposedScore);

            console.log(`🧐 Critique Score: ${validation.score}/100`);
            if (validation.triggered.length > 0) console.warn(`⚠️ Validation rules triggered: ${validation.triggered.join(', ')}`);

            return {
                modelUsed: response.modelUsed,
                requestedModel: response.requestedModel,
                provider: response.provider,
                plausibilityScore: validation.score,
                justification: typeof json.Justificativa === 'string' ? json.Justificativa : 'Justificativa indisponível.',
                replanRequired: validation.score < this.rules.plausibilityThreshold,
                replanSuggestion: json.Replan_Suggestion
            };

        } catch (error) {
            if (options.signal?.aborted) throw error;
            console.error(`CriticAgent failed; continuing in degraded mode (${error instanceof Error ? error.name : 'Unavailable'}).`);
            // Fail open: assume it's fine if critic breaks
            return {
                plausibilityScore: 0,
                justification: "Critic failed to validate.",
                replanRequired: false,
                degraded: true
            };
        }
    }
}
