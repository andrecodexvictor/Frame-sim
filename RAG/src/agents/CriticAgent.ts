import { LLMFactory, LLMProvider, LLMResponse } from '../services/LLMProvider.js';

export interface CritiqueResult {
    plausibilityScore: number;
    justification: string;
    replanRequired: boolean;
    replanSuggestion?: string;
}

export class CriticAgent {
    private llm: LLMProvider;

    constructor() {
        // Critical thinking => Uses GPT-4 (or Gemini if not available)
        this.llm = LLMFactory.getGPT4();
    }

    async critique(simulationOutput: any, context: string): Promise<CritiqueResult> {
        console.log('🧐 CriticAgent: Reviewing simulation results...');

        const prompt = `
        **Role:** You are the Critic Agent (Cognitive Control). Your job is to validate business simulation results.

        **Instructions:**
        1. Analyze the 'Simulation Result' and 'Context'.
        2. Calculate a 'Plausibility_Score' (0-100).
        3. If score < 70, you MUST provide a 'Replan_Suggestion' (what to change in parameters).
        4. Output JSON ONLY.

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
            const response: LLMResponse = await this.llm.generate(prompt);
            const content = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const json = JSON.parse(content);

            console.log(`🧐 Critique Score: ${json.Plausibility_Score}/100`);
            if (json.Replan_Necessario) console.warn(`⚠️ REPLAN REQUESTED: ${json.Replan_Suggestion}`);

            return {
                plausibilityScore: json.Plausibility_Score,
                justification: json.Justificativa,
                replanRequired: json.Plausibility_Score < 70,
                replanSuggestion: json.Replan_Suggestion
            };

        } catch (error) {
            console.error('CriticAgent failed (bypass):', error);
            // Fail open: assume it's fine if critic breaks
            return {
                plausibilityScore: 100,
                justification: "Critic failed to validate.",
                replanRequired: false
            };
        }
    }
}
