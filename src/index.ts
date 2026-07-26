/**
 * @coderifts/sdk — Agent Governance SDK
 *
 * TypeScript/JavaScript SDK for the CodeRifts API.
 * Validates API changes before tool invocations.
 *
 * @example
 * ```ts
 * import { CodeRifts } from '@coderifts/sdk';
 *
 * const client = new CodeRifts({ apiKey: 'cr_live_...' });
 * const result = await client.diff({ before: oldSpec, after: newSpec });
 * ```
 */

export { CodeRifts } from './client';
export { CodeRiftsError, ApiError, TimeoutError, RateLimitError, AuthError } from './errors';
export type {
    CodeRiftsOptions,
    ApiErrorBody,
    PreflightCheckRequest,
    PreflightCheckResponse,
    ReflexTrigger,
    AffectedTool,
    DiffRequest,
    DiffResponse,
    BreakingChange,
    ExplainDecisionRequest,
    ExplainDecisionResponse,
    ExplainComponent,
    HowToUnblockRequest,
    HowToUnblockResponse,
    UnblockAction,
    ScoreMcpRequest,
    ScoreMcpResponse,
    GetLedgerRequest,
    GetLedgerResponse,
    LedgerEntry,
    SimulatePolicyRequest,
    SimulatePolicyResponse,
    MatchedRule,
} from './types';
