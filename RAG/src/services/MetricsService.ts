import { AgenticMetrics } from '../types/index.js';

export class MetricsService {
    private startTime: number;
    private replanCount: number = 0;
    private totalTokens: number = 0;
    private inputTokens: number = 0;
    private outputTokens: number = 0;
    private costEstimateUsd: number = 0;
    private routerChoices: string[] = [];
    private incidentCount: number = 0;
    private cycleCount: number = 0;
    private degraded = false;

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
        this.inputTokens = 0;
        this.outputTokens = 0;
        this.costEstimateUsd = 0;
        this.routerChoices = [];
        this.incidentCount = 0;
        this.cycleCount = 0;
        this.degraded = false;
    }

    recordReplan() {
        this.replanCount++;
    }

    recordTokens(input = 0, output = 0, model = '') {
        const safeInput = Number.isFinite(input) && input > 0 ? input : 0;
        const safeOutput = Number.isFinite(output) && output > 0 ? output : 0;
        this.inputTokens += safeInput;
        this.outputTokens += safeOutput;
        this.totalTokens += safeInput + safeOutput;
        const isGpt = /gpt|openai/i.test(model);
        const inputRate = isGpt ? this.COST_GPT4_INPUT : this.COST_GEMINI_INPUT;
        const outputRate = isGpt ? this.COST_GPT4_OUTPUT : this.COST_GEMINI_OUTPUT;
        this.costEstimateUsd += (safeInput * inputRate + safeOutput * outputRate) / 1000;
    }

    setRouterChoice(choice: string) {
        if (choice && !this.routerChoices.includes(choice)) this.routerChoices.push(choice);
    }

    recordIncident(count = 1) {
        if (Number.isFinite(count) && count > 0) this.incidentCount += Math.floor(count);
    }

    recordCycle() {
        this.cycleCount++;
    }

    markDegraded() {
        this.degraded = true;
    }

    calculateMetrics(): AgenticMetrics {
        const duration = Date.now() - this.startTime;

        const qpc = Math.max(0, 100 - (this.replanCount * 15));
        const tir = this.cycleCount > 0
            ? Math.round((this.incidentCount / this.cycleCount) * 10000) / 100
            : 0;
        const routerChoice = this.routerChoices.length > 0 ? this.routerChoices.join(' → ') : 'UNKNOWN';

        return {
            quality_per_cycle: qpc,
            time_to_solve_ms: duration,
            cost_estimate_usd: Math.round(this.costEstimateUsd * 1000000) / 1000000,
            total_tokens: this.totalTokens,
            router_choice: routerChoice,
            input_tokens: this.inputTokens,
            output_tokens: this.outputTokens,
            replan_count: this.replanCount,
            risk_incidents: this.incidentCount,
            tir,
            degraded: this.degraded
        };
    }
}
