import assert from 'node:assert/strict';
import { ProviderGateway, ProviderGatewayError } from '../services/ProviderGateway.js';
import { LLMFactory } from '../services/LLMProvider.js';

const names = ['GOOGLE_API_KEY', ...Array.from({ length: 7 }, (_, i) => `GOOGLE_API_KEY_${i + 1}`), 'VITE_API_KEY', ...Array.from({ length: 7 }, (_, i) => `VITE_API_KEY_${i + 1}`), 'OPENAI_API_KEY', 'VITE_OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'VITE_DEEPSEEK_API_KEY', 'NVIDIA_DEEPSEEK_API_KEY', 'NVIDIA_GLM_API_KEY', 'NVIDIA_KIMI_API_KEY', 'TYPESAFE_API_KEY'];
const before = new Map(names.map(name => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
try {
    names.forEach(name => delete process.env[name]);
    process.env.GOOGLE_API_KEY = 'google-fixture';
    process.env.NVIDIA_GLM_API_KEY = 'glm-fixture';
    process.env.NVIDIA_KIMI_API_KEY = 'kimi-fixture';
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
        calls.push({ url: String(input), init });
        return new Response(JSON.stringify({ model: 'z-ai/glm-5.3', choices: [{ message: { content: '{"supported":true}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } }), { status: 200 });
    };
    const gateway = new ProviderGateway();
    const explicit = await gateway.generate({ task: 'simulation', prompt: 'fixture', modelPreference: 'z-ai/glm-5.3' });
    assert.equal(explicit.provider, 'glm', 'explicit GLM must not fall through to Gemini');
    assert.equal(calls[0].url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer glm-fixture');
    assert.equal(explicit.model, 'z-ai/glm-5.3');
    assert.equal(LLMFactory.hasGLM(), true);
    assert.equal(LLMFactory.hasKimi(), true);
    await LLMFactory.getKimi().generate('fixture');
    assert.equal((calls[1].init?.headers as Record<string, string>).Authorization, 'Bearer kimi-fixture');
    assert.equal(JSON.parse(String(calls[1].init?.body)).model, 'moonshotai/kimi-k3');

    calls.length = 0;
    globalThis.fetch = async (input, init) => { calls.push({ url: String(input), init }); return new Response('{}', { status: 503 }); };
    await assert.rejects(gateway.generate({ task: 'simulation', prompt: 'fixture', modelPreference: 'z-ai/glm-5.3' }), ProviderGatewayError);
    assert.equal(calls.length, 1, 'explicit model benchmark must not silently fall back');
    assert.ok(calls.every(call => call.url.includes('nvidia.com')));

    const limited = new ProviderGateway();
    calls.length = 0;
    await assert.rejects(limited.generate({ task: 'simulation', prompt: 'fixture', maxAttempts: 1 }), ProviderGatewayError);
    assert.equal(calls.length, 1, 'global attempt cap must cover all providers');

    const deadline = new ProviderGateway();
    calls.length = 0;
    globalThis.fetch = async (input, init) => {
        calls.push({ url: String(input), init });
        return new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new DOMException('deadline', 'AbortError')), { once: true }); });
    };
    await assert.rejects(deadline.generate({ task: 'simulation', prompt: 'fixture', timeoutMs: 15 }), ProviderGatewayError);
    assert.equal(calls.length, 1, 'aggregate deadline must stop fallbacks');

    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"partial":' }, finish_reason: 'length' }] }), { status: 200 });
    await assert.rejects(new ProviderGateway().generate({ task: 'simulation', prompt: 'fixture', modelPreference: 'moonshotai/kimi-k3' }), ProviderGatewayError);
    globalThis.fetch = async () => new Response(JSON.stringify({ modelVersion: 'gemini-resolved', candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }] }), { status: 200 });
    const resolved = await new ProviderGateway().generate({ task: 'simulation', prompt: 'fixture', modelPreference: 'gemini-flash-latest' });
    assert.equal(resolved.model, 'gemini-resolved');
    assert.equal(resolved.requestedModel, 'gemini-flash-latest');
    const health = new ProviderGateway().providerStatus();
    assert.equal(health.find(provider => provider.id === 'google')?.state, 'configured');
    assert.ok(!JSON.stringify(health).includes('fixture'), 'public health must omit credentials');
    console.log('  ✓ provider selection, distinct keys, aggregate limits, valid output and honest health');
} finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of before) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
}
