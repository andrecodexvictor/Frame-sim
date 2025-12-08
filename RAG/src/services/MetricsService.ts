import { AgenticMetrics } from '../types/index.js';

export class MetricsService {
    private startTime: number;
    private replanCount: number = 0;
    private totalTokens: number = 0;
    private routerChoice: string = 'UNKNOWN';

    // Cost constants (approximate per 1k tokens)
    private readonly COST_GPT4_INPUT = 0.03;
    private readonly COST_GPT4_OUTPUT = 0.06;
    private readonly COST_GEMINI_INPUT = 0.000125;
    private readonly COST_GEMINI_OUTPUT = 0.000375;

    constructor() {
        this.startTime = Date.now();
    }

    startCycle() {
        this.startTime = Date.now();
        this.replanCount = 0;
        this.totalTokens = 0;
    }

    recordReplan() {
        this.replanCount++;
    }

    recordTokens(input: number, output: number, model: string) {
        this.totalTokens += (input + output);
        // TODO: accumulate cost based on model
    }

    setRouterChoice(choice: string) {
        this.routerChoice = choice;
    }

    calculateMetrics(): AgenticMetrics {
        const duration = Date.now() - this.startTime;

        // Quality Per Cycle = 100 - (15 * Replans)
        // If 0 replans -> 100% Quality
        // If 1 replan -> 85% Quality
        const qpc = Math.max(0, 100 - (this.replanCount * 15));

        return {
            quality_per_cycle: qpc,
            time_to_solve_ms: duration,
            cost_estimate_usd: 0.00, // Placeholder for now
            total_tokens: this.totalTokens,
            router_choice: this.routerChoice
        };
    }
}
