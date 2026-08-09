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

export { CodeRifts } from './client.js';
export { CodeRiftsError, ApiError, TimeoutError, RateLimitError, AuthError } from './errors.js';
export { readDecision } from './decision.js';
export type { ReadDecisionResult } from './decision.js';
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
    Decision,
    ExecutionAction,
    ReceiptStatus,
    DecisionReason,
    NextAction,
    DecisionReceipt,
    DecisionEvidence,
    DecisionResultEnvelope,
    Artifact,
    PreflightMode,
    PreflightChangeSetContext,
    PreflightChangeSetRequest,
    PreflightChangeSetBody,
    ChangeSetArtifactFinding,
    PreflightChangeSetResponse,
    VerifyReceiptResponse,
    DecisionLookupRequest,
    DecisionLookupResponse,
} from './types.js';
