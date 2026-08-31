const DEFAULT_API_BASE_URL = 'http://localhost:3002/api';
const DEFAULT_TIMEOUT_MS = 120_000;

export type ProviderTask = 'simulation' | 'document-digest' | 'query-classification';

export interface ProviderGenerateRequest {
  task: ProviderTask;
  prompt: string;
  responseSchema?: unknown;
  temperature?: number;
  seed?: number;
  modelPreference?: string;
  agentPersona?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ProviderGenerateResponse {
  content: string;
  provider: string;
  model: string;
  degraded: boolean;
  attempts: number;
}

export class ProviderGatewayError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
    public readonly failureCodes: string[] = []
  ) {
    super(message);
    this.name = 'ProviderGatewayError';
  }
}

function apiBaseUrl(): string {
  // Vite injects import.meta.env in the browser; Node-based tests/SSR may not.
  const configured = import.meta.env?.VITE_API_URL?.trim();
  return (configured || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

/**
 * Calls the server-side provider gateway. Provider credentials intentionally
 * never cross the browser boundary.
 */
export async function generateProviderContent(
  request: ProviderGenerateRequest
): Promise<ProviderGenerateResponse> {
  const timeoutController = new AbortController();
  const timeoutMs = Math.max(1_000, request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const timeoutId = window.setTimeout(() => timeoutController.abort('timeout'), timeoutMs);
  const abortFromCaller = () => timeoutController.abort(request.signal?.reason ?? 'cancelled');

  if (request.signal?.aborted) abortFromCaller();
  request.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(`${apiBaseUrl()}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: timeoutController.signal,
      body: JSON.stringify({
        task: request.task,
        prompt: request.prompt,
        responseSchema: request.responseSchema,
        temperature: request.temperature,
        seed: request.seed,
        modelPreference: request.modelPreference,
        agentPersona: request.agentPersona
      })
    });

    const payload = await response.json().catch(() => ({})) as Partial<ProviderGenerateResponse> & {
      error?: string;
      retryable?: boolean;
      failureCodes?: string[];
    };

    if (!response.ok || typeof payload.content !== 'string') {
      throw new ProviderGatewayError(
        payload.error || `Provider gateway returned HTTP ${response.status}`,
        response.status,
        Boolean(payload.retryable) || response.status === 429 || response.status >= 500,
        Array.isArray(payload.failureCodes) ? payload.failureCodes.slice(0, 12) : []
      );
    }

    return {
      content: payload.content,
      provider: payload.provider || 'unknown',
      model: payload.model || 'unknown',
      degraded: Boolean(payload.degraded),
      attempts: Number.isFinite(payload.attempts) ? Number(payload.attempts) : 1
    };
  } catch (error) {
    if (error instanceof ProviderGatewayError) throw error;
    if (timeoutController.signal.aborted) {
      throw new ProviderGatewayError(
        request.signal?.aborted ? 'Simulation request was cancelled.' : 'Provider gateway timed out.',
        undefined,
        !request.signal?.aborted
      );
    }
    throw new ProviderGatewayError(
      error instanceof Error ? error.message : 'Provider gateway is unavailable.',
      undefined,
      true
    );
  } finally {
    window.clearTimeout(timeoutId);
    request.signal?.removeEventListener('abort', abortFromCaller);
  }
}
