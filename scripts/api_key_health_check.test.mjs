import assert from 'node:assert/strict';
import { classifyKeyName, exitCodeFor, parseEnv, runHealthCheck } from './api_key_health_check.mjs';

const parsed = parseEnv('A=one\nEMPTY=\nQUOTED="two"\n# ignored\n');
assert.equal(parsed.get('A'), 'one');
assert.equal(parsed.get('QUOTED'), 'two');
assert.equal(parsed.has('EMPTY'), false);

assert.equal(classifyKeyName('VITE_API_KEY_7').provider, 'google');
assert.equal(classifyKeyName('OPENAI_API_KEY').provider, 'openai');
assert.equal(classifyKeyName('DEEPSEEK_API_KEY').provider, 'deepseek');
assert.equal(classifyKeyName('NOT_A_KEY'), null);

const calls = [];
const fakeFetch = async (url, options) => {
  calls.push({ url, options });
  return { status: 200, text: async () => '{"data":[]}' };
};
const googleDefinition = classifyKeyName('VITE_API_KEY');
const results = await runHealthCheck({
  entries: [
    { label: 'fixture:google-a', value: 'same-fixture-key', definition: googleDefinition },
    { label: 'fixture:google-b', value: 'same-fixture-key', definition: googleDefinition },
    { label: 'fixture:google-c', value: 'other-fixture-key', definition: googleDefinition },
  ],
  fetchImpl: fakeFetch,
  timeoutMs: 100,
});
assert.equal(results.length, 3);
// Deduplication must ensure one network call per fingerprint while preserving one result
// per labeled entry.
assert.equal(calls.length, 2);
for (const call of calls) {
  assert.equal(typeof call.url, 'string');
  assert.equal(call.options.method, 'GET');
}
const generationCalls = [];
const generationResults = await runHealthCheck({
  entries: [{ label: 'fixture:google-generate', value: 'fixture-key', definition: googleDefinition }],
  fetchImpl: async (url, options) => {
    generationCalls.push({ url, options });
    return { status: 200, text: async () => '{"candidates":[]}' };
  },
  timeoutMs: 100,
  mode: 'generate',
});
assert.equal(generationCalls.length, 1);
assert.equal(generationCalls[0].options.method, 'POST');
assert.equal(generationResults[0].status, 'generation_reachable');
assert.equal(exitCodeFor([{ status: 'reachable' }]), 0);
assert.equal(exitCodeFor([{ status: 'generation_reachable' }]), 0);
assert.equal(exitCodeFor([{ status: 'quota' }]), 0);
assert.equal(exitCodeFor([{ status: 'quota' }], 'generate'), 2);
assert.equal(exitCodeFor([{ status: 'generation_reachable' }], 'generate'), 0);
assert.equal(exitCodeFor([{ status: 'invalid_or_restricted' }]), 1);
assert.equal(exitCodeFor([{ status: 'unreachable' }]), 2);
console.log('OK api key health checker tests');
