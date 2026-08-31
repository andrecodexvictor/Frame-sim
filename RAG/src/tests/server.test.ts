import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

const previousChromaUrl = process.env.CHROMA_URL;
process.env.CHROMA_URL = 'http://127.0.0.1:1';

const { app, startupPromise } = await import('../server.js');
await startupPromise;
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
});

const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}/api`;

try {
    const statusResponse = await fetch(`${baseUrl}/status`);
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json() as any;
    assert.equal(status.ready, true);
    assert.equal(status.graph, 'langgraph-stategraph-v1');
    assert.equal(status.providerReachable, 'unknown');
    assert.equal(typeof status.providerConfigured, 'boolean');
    assert.equal(status.capabilities.simulation, true);
    assert.equal(typeof status.capabilities.generation, 'boolean');

    const invalidGenerate = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'unsupported', prompt: 'offline' })
    });
    assert.equal(invalidGenerate.status, 400);
    assert.deepEqual(await invalidGenerate.json(), {
        error: 'Unsupported generation task.',
        retryable: false,
        failureCodes: []
    });

    const invalidSimulation = await fetch(`${baseUrl}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '', stakeholders: [], config: {} })
    });
    assert.equal(invalidSimulation.status, 400);
    assert.equal((await invalidSimulation.json() as any).error, 'Missing query, stakeholders, or config');

    const invalidIngest = await fetch(`${baseUrl}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: '' })
    });
    assert.equal(invalidIngest.status, 400);
    assert.match((await invalidIngest.json() as any).error, /rawText/);

    console.log('  ✓ HTTP status and validation boundaries are integrated and sanitized');
} finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (previousChromaUrl === undefined) delete process.env.CHROMA_URL;
    else process.env.CHROMA_URL = previousChromaUrl;
}
