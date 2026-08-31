import assert from 'node:assert/strict';
import {
    GeminiProvider,
    OpenAICompatibleProvider,
    type LLMProvider,
    type LLMResponse
} from '../services/LLMProvider.js';
import { IntentType, SmartRouter } from '../services/SmartRouter.js';
import { QueryRouter } from '../services/queryRouter.js';

const factoryCalls: string[] = [];
const attempts: string[] = [];
const gemini = new GeminiProvider({
    keys: ['first', 'first', 'second', 'third'],
    model: 'offline-model',
    clientFactory(key) {
        factoryCalls.push(key);
        return {
            async invoke() {
                attempts.push(key);
                if (key !== 'third') throw new Error('offline failure');
                return {
                    content: 'ok',
                    usage_metadata: { input_tokens: 4, output_tokens: 2, total_tokens: 6 }
                };
            }
        };
    }
});
const geminiResult = await gemini.generate('fixture');
assert.deepEqual(factoryCalls, ['first', 'second', 'third'], 'duplicate keys must create one client');
assert.deepEqual(attempts, ['first', 'second', 'third'], 'provider must rotate through every configured key');
assert.equal(geminiResult.content, 'ok');
assert.deepEqual(geminiResult.usage, { promptTokens: 4, completionTokens: 2, totalTokens: 6 });

const hangingGemini = new GeminiProvider({
    keys: ['only'],
    timeoutMs: 10,
    clientFactory: () => ({ invoke: () => new Promise(() => undefined) })
});
await assert.rejects(
    hangingGemini.generate('timeout'),
    (error: unknown) => error instanceof Error && error.name === 'AbortError' && /timed out/i.test(error.message)
);

let unexpectedFetch = false;
const missingOpenAI = new OpenAICompatibleProvider('', 'https://offline.invalid', 'fixture', 'Fixture', async () => {
    unexpectedFetch = true;
    throw new Error('must not fetch');
});
await assert.rejects(missingOpenAI.generate('fixture'), /not configured/);
assert.equal(unexpectedFetch, false);

function fakeProvider(name: string, behavior: 'success' | 'failure', calls: string[]): LLMProvider {
    return {
        name: () => name,
        async generate(): Promise<LLMResponse> {
            calls.push(name);
            if (behavior === 'failure') throw new Error(`${name} unavailable`);
            return { content: name, modelUsed: name };
        }
    };
}

const routedCalls: string[] = [];
const router = new SmartRouter({
    localRouter: null,
    gpt: fakeProvider('gpt', 'failure', routedCalls),
    gemini: fakeProvider('gemini', 'success', routedCalls),
    deepseek: fakeProvider('deepseek', 'success', routedCalls)
});
assert.equal(await router.classifyIntent('Critique o ROI e faça um replan causal'), IntentType.COMPLEX_REASONING);
assert.equal(await router.classifyIntent('Valide este schema JSON'), IntentType.SIMPLE_VALIDATION);
assert.equal(await router.classifyIntent('Crie uma narrativa para esta persona'), IntentType.CREATIVE_GENERATION);

const complexChain = await router.route('critique o risco estratégico');
assert.equal((await complexChain.generate('fixture')).content, 'gemini');
assert.deepEqual(routedCalls, ['gpt', 'gemini'], 'complex chain must fail over from GPT to Gemini');

routedCalls.length = 0;
const simpleChain = await router.route('formate e valide JSON');
assert.equal((await simpleChain.generate('fixture')).content, 'deepseek');
assert.deepEqual(routedCalls, ['deepseek']);

const noPrimary = new SmartRouter({
    localRouter: null,
    gpt: null,
    gemini: fakeProvider('gemini-only', 'success', []),
    deepseek: null
});
assert.match((await noPrimary.route('planeje a estratégia')).name(), /gemini-only/);

const ragRouter = new QueryRouter();
assert.equal((await ragRouter.classify('Como o CEO reagiria à mudança?')).mode, 'PERSONA_PURA');
assert.deepEqual((await ragRouter.classify('Qual o ROI e break-even?')).filters.collections, ['metrics']);
assert.equal((await ragRouter.classify('Compare Scrum versus Kanban')).mode, 'CENARIO_COMPARATIVO');
assert.equal((await ragRouter.classify('Risco de burnout e impacto no ROI')).mode, 'HIBRIDO');

console.log('  ✓ router capabilities, deterministic intent, key retry, fallback, and timeout');
