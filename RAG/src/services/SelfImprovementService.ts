/**
 * SelfImprovementService - Auto-calibração de parâmetros antes do batch
 * 
 * Implementa warmup iterativo para encontrar parâmetros ótimos usando
 * o CriticAgent como função de scoring.
 */

import type {
    WarmupConfig,
    WarmupResult,
    OptimizedParameters,
    ConvergencePoint,
    ParameterSpace
} from '../types/index.js';
import { CriticAgent } from '../agents/CriticAgent.js';

export class SelfImprovementService {
    private criticAgent: CriticAgent;
    private bestParams: OptimizedParameters | null = null;
    private bestScore: number = 0;

    constructor() {
        this.criticAgent = new CriticAgent();
    }

    /**
     * Executa ciclo de auto-aprimoramento
     */
    async runWarmup(
        testFn: (params: OptimizedParameters) => Promise<any>,
        warmupConfig: WarmupConfig,
        onProgress?: (iteration: number, score: number, params: OptimizedParameters) => void
    ): Promise<WarmupResult> {
        console.log('🔥 WARMUP: Iniciando auto-aprimoramento...');
        console.log(`   Target: ${warmupConfig.targetPlausibility}% plausibility`);
        console.log(`   Max iterations: ${warmupConfig.maxIterations}`);

        const history: ConvergencePoint[] = [];
        this.bestParams = null;
        this.bestScore = 0;

        for (let i = 0; i < warmupConfig.maxIterations; i++) {
            console.log(`\n📍 Iteration ${i + 1}/${warmupConfig.maxIterations}`);

            // 1. SAMPLE: Escolher combinação de parâmetros
            const candidateParams = this.sampleParameters(
                warmupConfig.parameterSpace,
                i,
                history
            );
            console.log(`   Params: T=${candidateParams.temperature}, TopK=${candidateParams.topK}, RAG=${candidateParams.ragMode}`);

            // 2. EXECUTE: Mini-simulação com esses parâmetros
            const miniResult = await testFn(candidateParams);

            // 3. CRITIQUE: CriticAgent avalia
            const critique = await this.criticAgent.critique(
                miniResult,
                `Warmup iteration ${i + 1}. Testing params: ${JSON.stringify(candidateParams)}`
            );

            console.log(`   Score: ${critique.plausibilityScore}/100`);

            // 4. RECORD: Guardar no histórico
            history.push({
                iteration: i + 1,
                params: candidateParams,
                plausibilityScore: critique.plausibilityScore,
                timestamp: Date.now()
            });

            // 5. UPDATE BEST: Se melhorou
            if (critique.plausibilityScore > this.bestScore) {
                this.bestScore = critique.plausibilityScore;
                this.bestParams = candidateParams;
                console.log(`   ✅ New best! Score=${this.bestScore}`);
            }

            // Callback de progresso
            onProgress?.(i + 1, critique.plausibilityScore, candidateParams);

            // 6. CONVERGENCE CHECK: Se atingiu target, para
            if (this.bestScore >= warmupConfig.targetPlausibility) {
                console.log(`\n🎯 Converged at iteration ${i + 1}!`);
                break;
            }

            // 7. ADAPT: Se CriticAgent sugeriu mudanças, log
            if (critique.replanRequired && critique.replanSuggestion) {
                console.log(`   ⚠️ Critic suggests: ${critique.replanSuggestion}`);
            }
        }

        const result: WarmupResult = {
            optimalParams: this.bestParams || this.getDefaultParams(),
            iterationsUsed: history.length,
            finalScore: this.bestScore,
            convergenceHistory: history
        };

        console.log(`\n🔥 WARMUP COMPLETE:`);
        console.log(`   Optimal: T=${result.optimalParams.temperature}, TopK=${result.optimalParams.topK}`);
        console.log(`   Final Score: ${result.finalScore}%`);
        console.log(`   Iterations: ${result.iterationsUsed}`);

        return result;
    }

    /**
     * Amostra parâmetros do espaço de busca
     * Usa estratégia exploration → exploitation
     */
    private sampleParameters(
        space: ParameterSpace,
        iteration: number,
        history: ConvergencePoint[]
    ): OptimizedParameters {
        // Primeiras iterações: exploração aleatória
        if (iteration < 2 || history.length === 0) {
            return {
                temperature: space.temperatures[Math.floor(Math.random() * space.temperatures.length)],
                topK: space.topKValues[Math.floor(Math.random() * space.topKValues.length)],
                ragMode: space.ragModes[Math.floor(Math.random() * space.ragModes.length)]
            };
        }

        // Iterações posteriores: perturbação do melhor
        if (this.bestParams) {
            return this.perturbParams(this.bestParams, space);
        }

        // Fallback
        return this.getDefaultParams();
    }

    /**
     * Perturba parâmetros do melhor resultado
     */
    private perturbParams(
        base: OptimizedParameters,
        space: ParameterSpace
    ): OptimizedParameters {
        const tempIdx = space.temperatures.indexOf(base.temperature);
        const topKIdx = space.topKValues.indexOf(base.topK);

        // Pequena variação (±1 no índice)
        const newTempIdx = Math.max(0, Math.min(
            space.temperatures.length - 1,
            tempIdx + (Math.random() > 0.5 ? 1 : -1)
        ));
        const newTopKIdx = Math.max(0, Math.min(
            space.topKValues.length - 1,
            topKIdx + (Math.random() > 0.5 ? 1 : -1)
        ));

        return {
            temperature: space.temperatures[newTempIdx],
            topK: space.topKValues[newTopKIdx],
            ragMode: Math.random() > 0.8
                ? space.ragModes[Math.floor(Math.random() * space.ragModes.length)]
                : base.ragMode
        };
    }

    private getDefaultParams(): OptimizedParameters {
        return {
            temperature: 0.6,
            topK: 5,
            ragMode: 'selective'
        };
    }
}

// Export singleton
export const selfImprovementService = new SelfImprovementService();
