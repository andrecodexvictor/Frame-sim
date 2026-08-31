import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    FrameworkConfigValidationError,
    loadFrameworkConfig,
    validateFrameworkConfig,
} from '../services/frameworkConfigLoader.js';
import {
    EconomicScenarioValidationError,
    loadEconomicScenarios,
    parseEconomicScenarios,
    selectEconomicScenario,
} from '../services/economicScenarioLoader.js';
import {
    EXTERNAL_TOOL_CONTRACT,
    ExternalToolContractError,
    ExternalToolStub,
} from '../services/externalToolStub.js';
import { HealthMonitor } from '../services/HealthMonitor.js';
import { applySimulationRules, loadSimulationRules } from '../services/simulationRulesLoader.js';
import { CriticAgent } from '../agents/CriticAgent.js';

const frameworkConfig = loadFrameworkConfig();
assert.equal(frameworkConfig.frameworks.length, 2);
assert.equal(frameworkConfig.frameworks[0].id, 'scrum');
assert.throws(() => validateFrameworkConfig({ version: '1', frameworks: [] }), FrameworkConfigValidationError);
assert.throws(() => validateFrameworkConfig({
    version: '1',
    frameworks: [frameworkConfig.frameworks[0], frameworkConfig.frameworks[0]],
}), /duplicate framework id/);

const costProfiles = loadEconomicScenarios();
assert.deepEqual(costProfiles.map(profile => profile.id), ['recession', 'base', 'expansion']);
assert.equal(selectEconomicScenario(costProfiles, 123).id, selectEconomicScenario(costProfiles, 123).id);
assert.notEqual(selectEconomicScenario(costProfiles, 123).id, selectEconomicScenario(costProfiles, 124).id);
assert.throws(() => parseEconomicScenarios(readFileSync('cost_profiles.md', 'utf8').replace('| base |', '| base |').replace(' | uncertainty |', ' | wrong |')), EconomicScenarioValidationError);

const stub = new ExternalToolStub();
const request = { tool: 'risk-check' as const, input: { sector: 'technology', size: 50 }, seed: 42 };
const first = stub.execute(request);
const second = stub.execute(request);
assert.deepEqual(first, second);
assert.equal(first.contract, EXTERNAL_TOOL_CONTRACT);
assert.equal(first.offline, true);
assert.ok(!JSON.stringify(first).includes('technology'));
assert.notDeepEqual(first.result, stub.execute({ ...request, seed: 43 }).result);
assert.throws(() => stub.execute({ tool: 'risk-check', input: [] as unknown as Record<string, unknown> }), ExternalToolContractError);

const monitor = new HealthMonitor({ maxCostUsd: 1, maxTotalTokens: 1000, maxDurationMs: 100, maxRiskIncidents: 2, maxRiskScore: 80 });
assert.deepEqual(monitor.evaluate({ costUsd: 0.2, totalTokens: 100, durationMs: 50, riskIncidents: 0, riskScore: 10 }), { healthy: true, alerts: [], degraded: false });
const unhealthy = monitor.record({ costUsd: 2, totalTokens: 2500, durationMs: 250, riskIncidents: 4, riskScore: 95 });
assert.equal(unhealthy.healthy, false);
assert.equal(unhealthy.degraded, true);
assert.equal(unhealthy.alerts.length, 5);
assert.equal(unhealthy.alerts.filter(alert => alert.severity === 'critical').length, 4);
assert.equal(unhealthy.alerts.find(alert => alert.code === 'RISK_SCORE_THRESHOLD')?.severity, 'warning');
assert.equal(monitor.history().length, 1);
assert.throws(() => new HealthMonitor({ maxCostUsd: 0 }), /maxCostUsd/);

const simulationRules = loadSimulationRules();
assert.equal(simulationRules.plausibilityThreshold, 70);
assert.deepEqual(applySimulationRules(simulationRules, { roi_final: 600 }, 95), {
    score: 20,
    triggered: ['extreme_single_run_roi']
});
const critic = new CriticAgent({
    async route() {
        return {
            name: () => 'offline-rule-test',
            async generate() {
                return {
                    content: JSON.stringify({
                        Plausibility_Score: 95,
                        Justificativa: 'fixture',
                        Replan_Necessario: false,
                        Replan_Suggestion: 'revisar ROI'
                    }),
                    modelUsed: 'offline'
                };
            }
        };
    }
}, simulationRules);
const ruledCritique = await critic.critique({ roi_result: { roi_final: 600 } }, 'offline rule test');
assert.equal(ruledCritique.plausibilityScore, 20);
assert.equal(ruledCritique.replanRequired, true);

console.log('OK config/tools tests');
