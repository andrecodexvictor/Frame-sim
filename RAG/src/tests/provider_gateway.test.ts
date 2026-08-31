import assert from 'node:assert/strict';
import {
    ProviderGateway,
    ProviderGatewayError,
    type GatewayRequest,
} from '../services/ProviderGateway.js';

type FetchCall = {
    url: string;
    init?: RequestInit;
};

const providerEnvNames = [
    'GOOGLE_API_KEY',
    ...Array.from({ length: 7 }, (_, index) => `GOOGLE_API_KEY_${index + 1}`),
    'VITE_API_KEY',
    ...Array.from({ length: 7 }, (_, index) => `VITE_API_KEY_${index + 1}`),
    'OPENAI_API_KEY',
    'VITE_OPENAI_API_KEY',
    'DEEPSEEK_API_KEY',
    'VITE_DEEPSEEK_API_KEY',
    'GEMINI_MODEL',
    'OPENAI_MODEL',
    'DEEPSEEK_MODEL',
];

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalEnvironment = new Map(providerEnvNames.map(name => [name, process.env[name]]));

function clearProviderEnvironment(): void {
    for (const name of providerEnvNames) delete process.env[name];
}

function response(payload: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
    } as Response;
}

function errorStatus(error: unknown, status: number, message: string): boolean {
    return error instanceof ProviderGatewayError
        && error.status === status
        && error.message === message;
}

try {
    clearProviderEnvironment();

    // Validation happens before any provider call and does not reveal request data.
    const validationGateway = new ProviderGateway();
    let fetchCalls = 0;
    globalThis.fetch = async () => {
        fetchCalls++;
        return response({ candidates: [{ content: { parts: [{ text: 'unexpected' }] } }] });
    };
    await assert.rejects(
        validationGateway.generate({ task: 'unknown-task' as GatewayRequest['task'], prompt: 'fixture' }),
        (error: unknown) => errorStatus(error, 400, 'Unsupported generation task.')
            && (error as ProviderGatewayError).retryable === false,
    );
    await assert.rejects(
        validationGateway.generate({ task: 'simulation', prompt: '   ' }),
        (error: unknown) => errorStatus(error, 400, 'Prompt must be a non-empty string.'),
    );
    const oversizedPrompt = 'x'.repeat(220_001);
    await assert.rejects(
        validationGateway.generate({ task: 'simulation', prompt: oversizedPrompt }),
        (error: unknown) => error instanceof ProviderGatewayError
            && error.status === 413
            && !error.message.includes(oversizedPrompt),
    );
    assert.equal(fetchCalls, 0, 'invalid requests must not invoke fetch');
    assert.deepEqual(validationGateway.capabilities(), { google: false, openai: false, deepseek: false });

    // Google keys rotate between requests while duplicate/empty entries are ignored by the gateway.
    clearProviderEnvironment();
    process.env.GOOGLE_API_KEY_1 = 'google-one';
    process.env.GOOGLE_API_KEY_2 = 'google-two';
    process.env.GEMINI_MODEL = 'gemini-offline';
    const rotationCalls: FetchCall[] = [];
    globalThis.fetch = async (input, init) => {
        rotationCalls.push({ url: String(input), init });
        return response({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
    };
    const rotationGateway = new ProviderGateway();
    const rotationRequest: GatewayRequest = {
        task: 'simulation',
        prompt: 'Return a JSON fixture.',
        responseSchema: { type: 'OBJECT' },
        temperature: 2,
        seed: -1,
        agentPersona: 'A'.repeat(200),
    };
    const firstRotation = await rotationGateway.generate(rotationRequest);
    const secondRotation = await rotationGateway.generate(rotationRequest);
    assert.equal(firstRotation.provider, 'google');
    assert.equal(firstRotation.model, 'gemini-offline');
    assert.equal(firstRotation.attempts, 1);
    assert.equal(firstRotation.degraded, false);
    assert.equal(secondRotation.attempts, 1);
    assert.equal(decodeURIComponent(rotationCalls[0].url).includes('key=google-one'), true);
    assert.equal(decodeURIComponent(rotationCalls[1].url).includes('key=google-two'), true);
    const rotationBody = JSON.parse(String(rotationCalls[0].init?.body)) as {
        generationConfig: {
            temperature: number;
            seed: number;
            responseMimeType: string;
            responseSchema: unknown;
            maxOutputTokens: number;
            thinkingConfig?: { thinkingBudget: number };
        };
        systemInstruction: { parts: Array<{ text: string }> };
    };
    assert.equal(rotationBody.generationConfig.temperature, 1.5, 'temperature must be clamped');
    assert.equal(rotationBody.generationConfig.seed, 2_147_483_647, 'seed must fit the provider int32 range');
    assert.equal(rotationBody.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(rotationBody.generationConfig.responseSchema, { type: 'OBJECT' });
    assert.equal(rotationBody.generationConfig.maxOutputTokens, 8_192);
    assert.equal(rotationBody.generationConfig.thinkingConfig, undefined, 'unknown/offline models must not receive 2.5-only options');
    assert.equal(rotationBody.systemInstruction.parts[0].text.endsWith(`${'A'.repeat(120)}.`), true);

    // A retryable Google failure falls back to OpenAI-compatible generation and marks the result degraded.
    clearProviderEnvironment();
    process.env.GOOGLE_API_KEY = 'google-failing-secret';
    process.env.OPENAI_API_KEY = 'openai-fallback-secret';
    process.env.OPENAI_MODEL = 'openai-offline';
    const fallbackCalls: FetchCall[] = [];
    globalThis.fetch = async (input, init) => {
        fallbackCalls.push({ url: String(input), init });
        return fallbackCalls.length === 1
            ? response({ error: 'body must never escape: google-failing-secret' }, 429)
            : response({ choices: [{ message: { content: '{"fallback":true}' } }] });
    };
    const fallbackResult = await new ProviderGateway().generate({ task: 'simulation', prompt: 'fallback fixture' });
    assert.deepEqual(fallbackResult, {
        content: '{"fallback":true}',
        provider: 'openai',
        model: 'openai-offline',
        degraded: true,
        attempts: 2,
    });
    assert.match(fallbackCalls[0].url, /generativelanguage\.googleapis\.com/);
    assert.match(fallbackCalls[1].url, /api\.openai\.com\/v1\/chat\/completions/);
    assert.equal(fallbackCalls[1].init?.headers && (fallbackCalls[1].init.headers as Record<string, string>).Authorization, 'Bearer openai-fallback-secret');
    const fallbackBody = JSON.parse(String(fallbackCalls[1].init?.body)) as { response_format?: unknown };
    assert.deepEqual(fallbackBody.response_format, { type: 'json_object' });

    // Structured serialization on Gemini 2.5 Flash skips a redundant dynamic
    // thinking pass while keeping the output bounded.
    clearProviderEnvironment();
    process.env.GOOGLE_API_KEY = 'google-fast-structured';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    let fastBody: Record<string, any> | undefined;
    globalThis.fetch = async (_input, init) => {
        fastBody = JSON.parse(String(init?.body));
        return response({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
    };
    await new ProviderGateway().generate({ task: 'simulation', prompt: 'serialize fixture' });
    assert.deepEqual(fastBody?.generationConfig?.thinkingConfig, { thinkingBudget: 0 });
    assert.equal(fastBody?.generationConfig?.maxOutputTokens, 8_192);

    // Provider details and response bodies are deliberately sanitized at the gateway boundary.
    clearProviderEnvironment();
    process.env.GOOGLE_API_KEY = 'sensitive-google-key';
    globalThis.fetch = async () => response({ error: 'sensitive response body' }, 503);
    await assert.rejects(
        new ProviderGateway().generate({ task: 'document-digest', prompt: 'sanitized error fixture' }),
        (error: unknown) => error instanceof ProviderGatewayError
            && error.status === 503
            && error.message === 'No configured provider completed the request.'
            && !error.message.includes('sensitive-google-key')
            && !error.message.includes('sensitive response body'),
    );

    // Caller cancellation aborts an in-flight fetch and is not converted into a fallback request.
    clearProviderEnvironment();
    process.env.GOOGLE_API_KEY = 'cancel-key';
    let cancellationFetchAborted = false;
    globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
            cancellationFetchAborted = true;
            reject(new DOMException('cancelled', 'AbortError'));
        }, { once: true });
    });
    const cancellationController = new AbortController();
    const cancellation = new ProviderGateway().generate({ task: 'query-classification', prompt: 'cancel fixture', signal: cancellationController.signal });
    await new Promise<void>(resolve => originalSetTimeout(resolve, 0));
    cancellationController.abort('test-cancellation');
    await assert.rejects(
        cancellation,
        (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
    );
    assert.equal(cancellationFetchAborted, true);

    // Exercise the fixed 90-second gateway timeout without waiting for it in the test suite.
    clearProviderEnvironment();
    process.env.GOOGLE_API_KEY = 'timeout-key';
    let timeoutFetchAborted = false;
    globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
            timeoutFetchAborted = true;
            reject(new DOMException('timed out', 'AbortError'));
        }, { once: true });
    });
    globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
        if (timeout === 90_000) return originalSetTimeout(handler, 0, ...args);
        return originalSetTimeout(handler, timeout, ...args);
    }) as typeof setTimeout;
    await assert.rejects(
        new ProviderGateway().generate({ task: 'document-digest', prompt: 'timeout fixture' }),
        (error: unknown) => errorStatus(error, 503, 'No configured provider completed the request.'),
    );
    assert.equal(timeoutFetchAborted, true);

    console.log('  ✓ provider gateway validation, rotation, fallback, timeout, cancellation, and sanitized errors');
} finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    for (const [name, value] of originalEnvironment) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
}
