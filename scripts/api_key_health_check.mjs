#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 8_000;

const KEY_DEFINITIONS = [
  { pattern: /^VITE_API_KEY(?:_\d+)?$/, provider: 'google', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models' },
  { pattern: /^GOOGLE_API_KEY(?:_\d+)?$/, provider: 'google', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models' },
  { pattern: /^VITE_OPENAI_API_KEY$/, provider: 'openai', endpoint: 'https://api.openai.com/v1/models' },
  { pattern: /^OPENAI_API_KEY$/, provider: 'openai', endpoint: 'https://api.openai.com/v1/models' },
  { pattern: /^VITE_DEEPSEEK_API_KEY$/, provider: 'deepseek', endpoint: 'https://api.deepseek.com/models' },
  { pattern: /^DEEPSEEK_API_KEY$/, provider: 'deepseek', endpoint: 'https://api.deepseek.com/models' },
];

/** Parse dotenv-like KEY=value lines without logging values. */
export function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value.length > 0) values.set(match[1], value);
  }
  return values;
}

export function classifyKeyName(name) {
  return KEY_DEFINITIONS.find((definition) => definition.pattern.test(name)) ?? null;
}

export function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex');
}

function statusFromResponse(status, body, mode = 'authenticate') {
  if (status >= 200 && status < 300) return mode === 'generate' ? 'generation_reachable' : 'reachable';
  if (status === 429 || status === 408 || status === 425) {
    const normalized = body.toLowerCase();
    return normalized.includes('quota') ? 'quota' : 'rate_limited';
  }
  if (status === 401 || status === 403) return 'invalid_or_restricted';
  if (status === 402) return mode === 'generate' ? 'billing_required' : 'http_402';
  if (status === 404) return mode === 'generate' ? 'model_unavailable' : 'http_404';
  if (status === 400) return mode === 'generate' ? 'request_rejected' : 'invalid_or_restricted';
  if (status >= 500 && status <= 599) return 'provider_error';
  return `http_${status}`;
}

/**
 * Make one minimal authenticated, non-generation request.
 * The key is used only in the in-memory request and is never returned/logged.
 */
function requestFor(definition, key, mode) {
  if (mode !== 'generate') {
    return {
      url: definition.provider === 'google'
        ? `${definition.endpoint}?key=${encodeURIComponent(key)}`
        : definition.endpoint,
      options: {
        method: 'GET',
        headers: definition.provider === 'google' ? undefined : { Authorization: `Bearer ${key}` },
      },
    };
  }

  if (definition.provider === 'google') {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8 },
        }),
      },
    };
  }

  const openAI = definition.provider === 'openai';
  return {
    url: openAI ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions',
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: openAI ? (process.env.OPENAI_MODEL || 'gpt-4o-mini') : (process.env.DEEPSEEK_MODEL || 'deepseek-chat'),
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        temperature: 0,
        max_tokens: 8,
      }),
    },
  };
}

export async function checkKey(definition, key, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch, mode = 'authenticate') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const request = requestFor(definition, key, mode);
    const response = await fetchImpl(request.url, {
      ...request.options,
      signal: controller.signal,
    });
    // Read the body only to classify quota vs rate-limit. Never print it.
    const body = await response.text();
    return statusFromResponse(response.status, body, mode);
  } catch (error) {
    if (error?.name === 'AbortError') return 'timeout';
    return 'unreachable';
  } finally {
    clearTimeout(timeout);
  }
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return new Map();
  return parseEnv(readFileSync(filePath, 'utf8'));
}

function collectConfiguredKeys(rootDir) {
  const files = [
    { label: 'root/.env', path: resolve(rootDir, '.env') },
    { label: 'RAG/.env', path: resolve(rootDir, 'RAG', '.env') },
  ];
  const entries = [];
  for (const file of files) {
    for (const [name, value] of readEnvFile(file.path)) {
      const definition = classifyKeyName(name);
      if (!definition) continue;
      entries.push({ label: `${file.label}:${name}`, name, value, definition });
    }
  }
  return entries;
}

function timeoutFromEnv() {
  const parsed = Number.parseInt(process.env.KEY_HEALTH_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export async function runHealthCheck({ rootDir = process.cwd(), fetchImpl = fetch, timeoutMs = timeoutFromEnv(), entries: suppliedEntries, mode = 'authenticate' } = {}) {
  const entries = suppliedEntries ?? collectConfiguredKeys(rootDir);
  const byFingerprint = new Map();
  for (const entry of entries) {
    const fp = `${entry.definition.provider}:${fingerprint(entry.value)}`;
    if (!byFingerprint.has(fp)) {
      byFingerprint.set(fp, checkKey(entry.definition, entry.value, timeoutMs, fetchImpl, mode));
    }
  }
  const results = [];
  for (const entry of entries) {
    const fp = `${entry.definition.provider}:${fingerprint(entry.value)}`;
    results.push({ label: entry.label, provider: entry.definition.provider, status: await byFingerprint.get(fp) });
  }
  return results;
}

export function exitCodeFor(results, mode = 'authenticate') {
  if (results.length === 0) return 2;
  if (results.some((result) => result.status === 'invalid_or_restricted')) return 1;
  if (mode === 'generate' && results.some((result) => result.status !== 'generation_reachable')) return 2;
  if (results.some((result) => ['timeout', 'unreachable', 'provider_error', 'request_rejected'].includes(result.status))) return 2;
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv.includes('--generate') ? 'generate' : 'authenticate';
  const results = await runHealthCheck({ mode });
  for (const result of results) {
    // Labels and statuses only. Never print key values, fingerprints, response bodies, or URLs.
    console.log(`${result.label}=${result.status}`);
  }
  const code = exitCodeFor(results, mode);
  console.log(`summary=${results.length} configured key entries; mode=${mode}; exit=${code}`);
  process.exitCode = code;
}
