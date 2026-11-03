import assert from 'node:assert/strict';
import { LLMFactory } from '../services/LLMProvider.js';

const names = ['DEEPSEEK_API_KEY', 'NVIDIA_DEEPSEEK_API_KEY', 'NVIDIA_DEEPSEEK_MODEL'];
const originalEnvironment = new Map(names.map(name => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
try {
    for (const name of names) delete process.env[name];
    const calls: Array<{ url: string; headers?: HeadersInit; body?: BodyInit | null }> = [];
    globalThis.fetch = async (input, init) => {
        calls.push({ url: String(input), headers: init?.headers, body: init?.body });
        return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } }), { status: 200 });
    };
    process.env.NVIDIA_DEEPSEEK_API_KEY = 'nvidia-test-key';
    assert.equal(LLMFactory.hasDeepSeek(), true, 'NVIDIA DeepSeek must be available with its own key');
    const result = await LLMFactory.getDeepSeek().generate('synthetic probe');
    assert.equal(calls[0].url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.equal((calls[0].headers as Record<string, string>).Authorization, 'Bearer nvidia-test-key');
    assert.equal(result.modelUsed, 'deepseek-ai/deepseek-v4.1-flash');
    process.env.NVIDIA_DEEPSEEK_MODEL = 'deepseek-ai/test-override';
    await LLMFactory.getDeepSeek().generate('synthetic override');
    assert.equal(JSON.parse(String(calls[1].body)).model, 'deepseek-ai/test-override');
    delete process.env.NVIDIA_DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'direct-test-key';
    await LLMFactory.getDeepSeek().generate('legacy probe');
    assert.equal(calls[2].url, 'https://api.deepseek.com/chat/completions');
    assert.equal((calls[2].headers as Record<string, string>).Authorization, 'Bearer direct-test-key');
    console.log('  ✓ DeepSeek NVIDIA package adapter and legacy transport');
} finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of originalEnvironment) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
}
