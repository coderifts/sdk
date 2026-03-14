/**
 * @coderifts/sdk — Client
 *
 * TypeScript client for the CodeRifts API.
 * Uses native fetch (Node 18+).
 */

import type {
  CodeRiftsOptions,
  DiffRequest,
  DiffResponse,
  ReadinessRequest,
  ReadinessResponse,
  McpScoreResponse,
  StabilityRequest,
  StabilityResponse,
  PreflightRequest,
  PreflightResponse,
} from './types';

import { ApiError, AuthError, RateLimitError, TimeoutError } from './errors';

const DEFAULT_BASE_URL = 'https://app.coderifts.com';
const DEFAULT_TIMEOUT = 30_000;

export class CodeRifts {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: CodeRiftsOptions) {
    if (!options.apiKey) {
      throw new Error('apiKey is required');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
  }

  // ---------------------------------------------------------------
  // Internal HTTP helper
  // ---------------------------------------------------------------

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = await res.json() as T & { error?: string; message?: string };

      if (!res.ok) {
        const errorBody = { error: json.error || 'unknown', message: json.message || res.statusText };
        if (res.status === 401) throw new AuthError(errorBody);
        if (res.status === 429) throw new RateLimitError(errorBody);
        throw new ApiError(res.status, errorBody);
      }

      return json;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new TimeoutError(this.timeout);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------

  /**
   * Compare two OpenAPI specs and detect breaking changes.
   *
   * ```ts
   * const result = await client.diff({
   *   old_spec: oldYaml,
   *   new_spec: newYaml,
   * });
   * console.log(result.breaking_changes_count);
   * ```
   */
  async diff(req: DiffRequest): Promise<DiffResponse> {
    return this.request<DiffResponse>('POST', '/api/v1/diff', req);
  }

  /**
   * Score an OpenAPI or MCP manifest for agent readiness.
   *
   * ```ts
   * const result = await client.agentReadinessScore({
   *   spec: manifestJson,
   *   spec_type: 'mcp',
   * });
   * console.log(result.score, result.band);
   * ```
   */
  async agentReadinessScore(req: ReadinessRequest): Promise<ReadinessResponse> {
    return this.request<ReadinessResponse>('POST', '/api/v1/agent-readiness-score', req);
  }

  /**
   * Score an MCP manifest by URL (public, no auth required).
   * Note: This method does NOT use the API key.
   *
   * ```ts
   * const result = await client.scoreMcp('https://example.com/mcp.json');
   * console.log(result.score, result.band);
   * ```
   */
  async scoreMcp(url: string): Promise<McpScoreResponse> {
    const fullUrl = `${this.baseUrl}/api/v1/score-mcp?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(fullUrl, { signal: controller.signal });
      const json = await res.json() as McpScoreResponse & { error?: string; message?: string };

      if (!res.ok) {
        const errorBody = { error: json.error || 'unknown', message: json.message || res.statusText };
        throw new ApiError(res.status, errorBody);
      }

      return json;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if ((err as Error).name === 'AbortError') throw new TimeoutError(this.timeout);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get API stability analytics for a repository.
   *
   * ```ts
   * const analytics = await client.stability({
   *   repo: 'myorg/api-service',
   *   days: 30,
   * });
   * console.log(analytics.summary.block_rate);
   * ```
   */
  async stability(req: StabilityRequest): Promise<StabilityResponse> {
    const params = new URLSearchParams({ repo: req.repo });
    if (req.days) params.set('days', String(req.days));
    return this.request<StabilityResponse>('GET', `/api/v1/analytics/stability?${params}`);
  }

  /**
   * Generate agent-consumable tool schemas from an OpenAPI spec.
   *
   * ```ts
   * const preflight = await client.agentPreflight({ spec: specYaml });
   * console.log(preflight.tools);
   * ```
   */
  async agentPreflight(req: PreflightRequest): Promise<PreflightResponse> {
    return this.request<PreflightResponse>('POST', '/api/v1/agent/preflight', req);
  }
}
