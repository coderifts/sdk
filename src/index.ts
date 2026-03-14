/**
 * @coderifts/sdk
 *
 * TypeScript client for the CodeRifts API.
 *
 * @example
 * ```ts
 * import { CodeRifts } from '@coderifts/sdk';
 *
 * const client = new CodeRifts({ apiKey: 'cr_live_...' });
 * const result = await client.diff({ old_spec: oldYaml, new_spec: newYaml });
 * ```
 */

export { CodeRifts } from './client';
export { CodeRiftsError, ApiError, AuthError, RateLimitError, TimeoutError } from './errors';
export type {
  CodeRiftsOptions,
  DiffRequest,
  DiffResponse,
  BreakingChange,
  ReadinessRequest,
  ReadinessResponse,
  ReadinessSignal,
  McpScoreResponse,
  StabilityRequest,
  StabilityResponse,
  StabilitySummary,
  TrendPoint,
  PatternEntry,
  OmegaDistribution,
  PreflightRequest,
  PreflightResponse,
  PreflightTool,
  ApiErrorBody,
} from './types';
