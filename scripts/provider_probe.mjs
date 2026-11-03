#!/usr/bin/env node
// Explicit, bounded online smoke checks. No provider keys or error bodies are logged.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { parseEnv } from './api_key_health_check.mjs';

const root = process.cwd();
const env = parseEnv(readFileSync(resolve(root, 'RAG/.env'), 'utf8'));
const report = { schemaVersion: 1, recordedAt: new Date().toISOString(), syntheticOnly: true, results: [] };
const configuredTimeout = Number(process.env.PROBE_TIMEOUT_MS);
const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? Math.min(55_000, configuredTimeout) : 30_000;
async function request(url, options) {
  const started = performance.now();
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    const payload = await response.json().catch(() => null);
    return { status: response.status, elapsedMs: Math.round(performance.now() - started), payload };
  } catch (error) {
    return { status: null, elapsedMs: Math.round(performance.now() - started), failure: ['TimeoutError', 'AbortError'].includes(error?.name) ? 'timeout' : 'network' };
  }
}
function publicResult(label, result, fields = {}) {
  return { label, httpStatus: result.status, elapsedMs: result.elapsedMs, ...fields, ...(result.failure ? { failure: result.failure } : {}) };
}
async function probeJev(label, key, gateway = false) {
  if (!key && !gateway) return { label, state: 'not_configured' };
  const body = gateway ? {
    model: 'probe', messages: [{ role: 'user', content: 'Evaluate the employee evidence.' }],
    tools: [{ type: 'function', function: { name: 'evaluate_evidence', description: 'Evaluate supplied employee evidence', parameters: { type: 'object', properties: { source: { type: 'string', enum: ['synthetic'] } }, required: ['source'], additionalProperties: false } } }],
  } : {
    model: env.get('JEV_MODEL') || 'jev-latest',
    state: { employeeId: 'synthetic-01', planned: 5, accepted: 4, defects: 0, peerEvidence: ['Helped resolve a blocked task.'] },
    questions: {
      collaboration: { type: 'score', instructions: 'Rate evidence of collaboration only from peerEvidence.', criteria: ['No documented contribution', 'A documented helpful intervention', 'Several documented helpful interventions'] },
      evidence_present: { type: 'noul', instructions: 'Is there documented evidence of helping a peer?' },
    },
  };
  const result = await request(gateway ? 'http://127.0.0.1:8790/router/decide' : 'https://api.typesafe.ai/v1/systemone', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body),
  });
  const p = result.payload;
  return publicResult(label, result, gateway
    ? { mode: p?.mode ?? p?.decision?.mode ?? null, state: result.status === 200 ? 'decision_returned' : 'failed' }
    : { model: p?.model ?? null, state: result.status === 200 && p?.answers?.collaboration?.type === 'score' && Number.isFinite(p?.answers?.evidence_present?.noul) ? 'typed_evaluation_returned' : 'failed', usage: p?.usage ?? null });
}
async function probeGoogle(name) {
  const key = env.get(name);
  if (!key) return { label: name, state: 'not_configured' };
  const requestedModel = 'gemini-flash-latest';
  const result = await request(`https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Return exactly OK.' }] }], generationConfig: { temperature: 0, maxOutputTokens: 256 } }),
  });
  const p = result.payload;
  const nonempty = p?.candidates?.[0]?.content?.parts?.some(part => typeof part.text === 'string' && part.text.trim());
  return publicResult(name, result, { requestedModel, model: p?.modelVersion ?? null, state: result.status === 200 && nonempty ? 'generation_returned' : 'failed', finishReason: p?.candidates?.[0]?.finishReason ?? null, usage: p?.usageMetadata ?? null });
}
async function probeNvidia(name, requestedLabel, family, preferred) {
  const key = env.get(name);
  if (!key) return { label: name, state: 'not_configured' };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  const catalog = await request('https://integrate.api.nvidia.com/v1/models', { headers });
  const candidates = (catalog.payload?.data ?? []).map(entry => entry.id).filter(id => typeof id === 'string' && family.test(id));
  const exact = candidates.find(id => id.toLowerCase().includes(requestedLabel.toLowerCase()));
  const candidate = exact ?? preferred.find(id => candidates.includes(id)) ?? candidates[0];
  const details = { requestedLabel, exactRequestedModelAvailable: Boolean(exact), catalogHttpStatus: catalog.status, candidates, smokeCandidate: candidate ?? null, candidateOnly: !exact };
  if (!candidate) return publicResult(name, catalog, { ...details, state: 'no_candidate_available' });
  const result = await request('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST', headers,
    body: JSON.stringify({ model: candidate, messages: [{ role: 'user', content: 'Return exactly OK.' }], temperature: 0, max_tokens: 256, stream: false }),
  });
  const p = result.payload;
  const nonempty = typeof p?.choices?.[0]?.message?.content === 'string' && Boolean(p.choices[0].message.content.trim());
  return publicResult(name, result, { ...details, model: p?.model ?? candidate, state: result.status === 200 && nonempty ? 'generation_returned' : 'failed', usage: p?.usage ?? null });
}

const globalPath = resolve(homedir(), '.jev-gateway/.env');
const globalEnv = existsSync(globalPath) ? parseEnv(readFileSync(globalPath, 'utf8')) : new Map();
const globalBefore = existsSync(globalPath) ? createHash('sha256').update(readFileSync(globalPath)).digest('hex') : null;
const jobs = [
  ['jev_global_existing_key', () => probeJev('jev_global_existing_key', globalEnv.get('TYPESAFE_API_KEY'))],
  ['jev_gateway_local', () => probeJev('jev_gateway_local', undefined, true)],
  ['jev_framesim', () => probeJev('jev_framesim', env.get('TYPESAFE_API_KEY'))],
  ['GOOGLE_API_KEY_4', () => probeGoogle('GOOGLE_API_KEY_4')],
  ['GOOGLE_API_KEY_5', () => probeGoogle('GOOGLE_API_KEY_5')],
  ['NVIDIA_DEEPSEEK_API_KEY', () => probeNvidia('NVIDIA_DEEPSEEK_API_KEY', 'deepseek-v4.1-flash', /deepseek/i, [])],
  ['NVIDIA_GLM_API_KEY', () => probeNvidia('NVIDIA_GLM_API_KEY', 'glm-5.3', /glm/i, [])],
  ['NVIDIA_KIMI_API_KEY', () => probeNvidia('NVIDIA_KIMI_API_KEY', 'kimi-k3', /kimi/i, [])],
];
// Each provider job is independent; only request summaries are retained.
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
report.results = await Promise.all(jobs.filter(([label]) => !only || only.includes(label)).map(([, job]) => job()));
const outputPath = resolve(root, 'next_steps/provider_probe_results.json');
if (existsSync(outputPath)) {
  const previous = JSON.parse(readFileSync(outputPath, 'utf8'));
  report.previousAttempts = [...(previous.previousAttempts ?? []), { recordedAt: previous.recordedAt, results: previous.results }];
  const changed = new Set(report.results.map(item => item.label));
  report.results = [...previous.results.filter(item => !changed.has(item.label)), ...report.results];
}
report.globalJevConfigPreserved = globalBefore === (existsSync(globalPath) ? createHash('sha256').update(readFileSync(globalPath)).digest('hex') : null);
report.gatewayInstalledVersion = JSON.parse(readFileSync(resolve(homedir(), 'AppData/Roaming/npm/node_modules/jev-gateway/package.json'), 'utf8')).version;
writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
for (const item of report.results) console.log(JSON.stringify(item));
console.log(`globalJevConfigPreserved=${report.globalJevConfigPreserved}`);
