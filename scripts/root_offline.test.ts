import assert from 'node:assert/strict';
import type { SimulationConfig } from '../types.ts';

// providerClient uses window timers because it is shared with the browser bundle.
// Install only the timer surface needed by these Node-only, offline tests.
(globalThis as any).window = globalThis;

const { enrichArchetypesToTeam } = await import('../services/personaEnricher.ts');
const { runEnhancedBatchSimulation } = await import('../services/batchService.ts');
const { generateProviderContent, ProviderGatewayError } = await import('../services/providerClient.ts');
const { calculateFrameworkFit, calculateMonthlyMetrics, calculateSurpriseFactor, getCostConstants } = await import('../services/metricsCalculator.ts');

const baseConfig: SimulationConfig = {
  frameworks: [{ id: 'fixture', name: 'Offline Framework', text: 'offline fixture' }],
  frameworkCategory: 'development',
  companySize: 50,
  currentMaturity: 2,
  sector: 'technology',
  budgetLevel: 'medium',
  employeeArchetypes: ['cto', 'skeptic'],
  techDebtLevel: 'low',
  operationalVelocity: 'agile',
  previousFailures: false,
  scenarioMode: 'recommended',
  selectedScenarioId: 'recommended',
  durationMonths: 4,
};

// A tiny deterministic RandomSource for testing every stochastic branch without
// touching Math.random or any provider. The seed controls the first value.
const seededRandom = (seed: number): (() => number) => {
  let state = ((seed % 100) + 100) % 100;
  return () => {
    state = (state + 1) % 100;
    return state / 100;
  };
};

const exceptionalRawData = {
  month: 1,
  teamSize: 10,
  featuresDelivered: 10,
  bugsGenerated: 1,
  criticalIncidents: 1,
  teamMood: 90,
  learningCurveFactor: 1.2,
  efficiency: 95,
  compliance: 90,
};

const surpriseA = calculateSurpriseFactor(exceptionalRawData, baseConfig, seededRandom(0));
const surpriseB = calculateSurpriseFactor(exceptionalRawData, baseConfig, seededRandom(0));
assert.deepEqual(surpriseA, surpriseB);
assert.equal(surpriseA.triggered, true);
assert.ok(Math.abs(surpriseA.multiplier - 1.205) < 1e-12);
assert.equal(calculateSurpriseFactor(exceptionalRawData, baseConfig, seededRandom(90)).triggered, false);
assert.deepEqual(
  calculateSurpriseFactor(exceptionalRawData, baseConfig),
  calculateSurpriseFactor(exceptionalRawData, baseConfig),
  'the default stochastic path must also be replayable',
);

const fitA = calculateFrameworkFit('Scrum', 50, 'medium', 'development', seededRandom(10));
const fitB = calculateFrameworkFit('Scrum', 50, 'medium', 'development', seededRandom(10));
assert.deepEqual(fitA, fitB);
assert.equal(fitA.fitLevel, 'EXCELENTE');
assert.ok(Math.abs(fitA.multiplier - 1.2165) < 1e-12);
const poorFit = calculateFrameworkFit('SAFe', 50, 'low', 'governance', seededRandom(0));
assert.equal(poorFit.fitLevel, 'PÉSSIMO');
assert.ok(Math.abs(poorFit.multiplier - 0.601) < 1e-12);
assert.deepEqual(
  calculateFrameworkFit('Scrum', 50, 'medium', 'development'),
  calculateFrameworkFit('Scrum', 50, 'medium', 'development'),
);

const economicRawData = { ...exceptionalRawData, teamSize: 10 };
const interiorConfig = { ...baseConfig, economicProfileId: 'br_interior' };
const pmeConfig = { ...baseConfig, economicProfileId: 'br_pme' };
const startupConfig = { ...baseConfig, economicProfileId: 'br_startup' };
const interiorMetrics = calculateMonthlyMetrics(economicRawData, interiorConfig, 0, 0, 0, seededRandom(0));
const interiorMetricsRepeat = calculateMonthlyMetrics(economicRawData, interiorConfig, 0, 0, 0, seededRandom(0));
assert.deepEqual(interiorMetrics, interiorMetricsRepeat);
const pmeMetrics = calculateMonthlyMetrics(economicRawData, pmeConfig, 0, 0, 0, seededRandom(0));
const startupMetrics = calculateMonthlyMetrics(economicRawData, startupConfig, 0, 0, 0, seededRandom(0));
assert.equal(getCostConstants('br_interior').DEV_DAY_COST, 200);
assert.equal(getCostConstants('br_pme').DEV_DAY_COST, 300);
assert.equal(getCostConstants('br_startup').DEV_DAY_COST, 450);
assert.deepEqual(
  [interiorMetrics.opEx, pmeMetrics.opEx, startupMetrics.opEx],
  [44_000, 66_000, 99_000],
);
assert.deepEqual(
  [interiorMetrics.conq, pmeMetrics.conq, startupMetrics.conq],
  [3_150, 5_250, 8_400],
);
assert.ok(interiorMetrics.valueDelivered < pmeMetrics.valueDelivered);
assert.ok(pmeMetrics.valueDelivered < startupMetrics.valueDelivered);
assert.deepEqual(
  calculateMonthlyMetrics(economicRawData, baseConfig),
  calculateMonthlyMetrics(economicRawData, baseConfig),
);
const recessionMetrics = calculateMonthlyMetrics(
  economicRawData,
  { ...baseConfig, economicScenarioId: 'recession' },
  0, 0, 0, seededRandom(50),
);
const expansionMetrics = calculateMonthlyMetrics(
  economicRawData,
  { ...baseConfig, economicScenarioId: 'expansion' },
  0, 0, 0, seededRandom(50),
);
assert.ok(expansionMetrics.valueDelivered > recessionMetrics.valueDelivered);
assert.ok(expansionMetrics.opEx > recessionMetrics.opEx);

// Persona selection is seeded and must not depend on Math.random().
const personasA = enrichArchetypesToTeam(['cto', 'skeptic'], 50, 0x12345678);
const personasB = enrichArchetypesToTeam(['cto', 'skeptic'], 50, 0x12345678);
assert.deepEqual(personasA.team.map((persona) => persona.id), personasB.team.map((persona) => persona.id));
assert.deepEqual(personasA.keyStakeholders.map((persona) => persona.id), personasB.keyStakeholders.map((persona) => persona.id));
assert.equal(new Set(personasA.team.map((persona) => persona.id)).size, personasA.team.length);
assert.notDeepEqual(
  personasA.keyStakeholders.map((persona) => persona.id),
  enrichArchetypesToTeam(['cto', 'skeptic'], 50, 0x87654321).keyStakeholders.map((persona) => persona.id),
);

const calls: Array<{ body: any; startedAt: number; finishedAt?: number }> = [];
let inFlight = 0;
let maxInFlight = 0;
const personaScores: Record<string, number> = {
  CFO_Conservador: 30,
  CTO_Otimista: 95,
  COO_Pragmatico: 80,
  CEO_Visionario: 65,
  HR_Cauteloso: 45,
};

function fixtureOutput(body: any) {
  const score = personaScores[body.agentPersona] ?? 90;
  return {
    frameworkName: 'Offline Framework',
    summary: {
      finalAdoption: 50 + score / 2,
      totalRoi: score * 2,
      maturityScore: 6,
      monthsToComplete: 4,
      scenarioValidity: score,
    },
    implementationNarrative: 'offline',
    sentimentBreakdown: [
      { group: 'Promotores', value: 40 },
      { group: 'Neutros', value: 40 },
      { group: 'Detratores', value: 20 },
    ],
    resourceAllocation: [],
    timeline: [{
      month: 1,
      adoptionRate: 20,
      roi: -5,
      compliance: 50,
      efficiency: 80,
      rawData: {
        featuresDelivered: 2,
        bugsGenerated: 1,
        criticalIncidents: 0,
        teamSize: 10,
        learningCurveFactor: 0.8,
      },
    }],
    keyPersonas: [],
    risks: [],
    recommendations: [],
    departmentReadiness: [],
  };
}

const offlineFetch = async (_url: string, init: RequestInit = {}) => {
  const body = JSON.parse(String(init.body || '{}'));
  assert.equal(body.task, 'simulation');
  assert.equal(typeof body.prompt, 'string');
  assert.equal('apiKey' in body, false);
  const call: { body: any; startedAt: number; finishedAt?: number } = { body, startedAt: Date.now() };
  calls.push(call);
  inFlight++;
  maxInFlight = Math.max(maxInFlight, inFlight);
  await new Promise((resolve) => setTimeout(resolve, 15));
  inFlight--;
  call.finishedAt = Date.now();
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: JSON.stringify(fixtureOutput(body)),
      provider: 'offline-fixture',
      model: body.modelPreference || 'offline-model',
      degraded: false,
      attempts: 1,
    }),
  } as Response;
};

globalThis.fetch = offlineFetch as typeof fetch;

const runBatch = (iterations: number) => runEnhancedBatchSimulation(
  baseConfig,
  { iterations, enableWarmup: false, enableRacing: false },
  () => undefined,
);

const firstBatch = await runBatch(7);
assert.equal(firstBatch.outputs.length, 7);
assert.ok(maxInFlight >= 2 && maxInFlight <= 3, `expected batch concurrency 2-3, got ${maxInFlight}`);
const firstSeeds = calls.map((call) => call.body.seed);
assert.equal(new Set(firstSeeds).size, firstSeeds.length);

calls.length = 0;
inFlight = 0;
maxInFlight = 0;
const secondBatch = await runBatch(7);
assert.deepEqual(calls.map((call) => call.body.seed), firstSeeds);
assert.deepEqual(secondBatch.outputs.map((output) => output.execution?.seed), firstSeeds);

const race = async (selectionStrategy: 'best' | 'ensemble' | 'weighted') => runEnhancedBatchSimulation(
  baseConfig,
  {
    iterations: 1,
    enableWarmup: false,
    enableRacing: true,
    racingConfig: { numAgents: 5, selectionStrategy, timeout: 2_000, diversityMode: 'full' },
  },
  () => undefined,
);

const bestResult = await race('best');
assert.equal(bestResult.outputs.length, 1);
assert.equal(bestResult.outputs[0].summary.scenarioValidity, 95);
assert.equal((bestResult.outputs[0] as any).racingMetrics.agentsCompleted, 5);

const ensembleResult = await race('ensemble');
assert.ok((ensembleResult.outputs[0] as any).racingMetrics);
assert.equal(ensembleResult.outputs[0].summary.scenarioValidity, 95);

const weightedResult = await race('weighted');
assert.ok((weightedResult.outputs[0] as any).racingMetrics);
assert.ok(Number.isFinite(weightedResult.outputs[0].summary.totalRoi));

const timeoutFetch = (_url: string, init: RequestInit = {}) => new Promise<Response>((_resolve, reject) => {
  init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
});
globalThis.fetch = timeoutFetch as typeof fetch;
await assert.rejects(
  generateProviderContent({ task: 'simulation', prompt: 'timeout fixture', timeoutMs: 1, }),
  (error: unknown) => error instanceof ProviderGatewayError && error.message.includes('timed out') && error.retryable,
);
// A caller cancellation is distinct from a gateway timeout and is not retryable.
const callerController = new AbortController();
const cancelled = generateProviderContent({ task: 'simulation', prompt: 'cancel fixture', signal: callerController.signal, timeoutMs: 1_000 });
callerController.abort();
await assert.rejects(
  cancelled,
  (error: unknown) => error instanceof ProviderGatewayError && error.message.includes('cancelled') && !error.retryable,
);

console.log('OK root offline tests: seeds, personas, batch concurrency, strategies, timeouts');
