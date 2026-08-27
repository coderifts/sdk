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
export {
    CODERIFTS_POLICY,
    POLICY_MARKER,
    POLICY_ABSENT_WARN,
    withPolicy,
    policyPresenceOf,
    detectPolicyPresence,
    observePolicyPresence,
    warnPolicyAbsentOnce,
    resetPolicyWarnForTests,
} from './policy.js';
export type {
    PolicyPresence,
    PolicyMessage,
    WithPolicyOptions,
} from './policy.js';
export { CodeRiftsError, ApiError, TimeoutError, RateLimitError, AuthError } from './errors.js';
export { readDecision } from './decision.js';
export type { ReadDecisionResult } from './decision.js';
export {
    CLOCK_SKEW_LEEWAY_MS,
    expiryLeewayMs,
    declaresDestructiveProduction,
    isReceiptExpired,
    isIssuedInFuture,
} from './leeway.js';
export type { ExpiryLeewayContext } from './leeway.js';
export {
    verifyExecutionGrant,
    computeScopeHash,
    afterPayloadCanonical,
    receiptDigest,
    GRANT_VERSION,
    GRANT_VERSION_V2,
    GRANT_SIGNING_PREFIX,
} from './execution-grant.js';
export type {
    ExecutionGrantIntended,
    VerifyExecutionGrantResult,
    GrantStatus,
    ExecutionGrantV2,
} from './execution-grant.js';
export {
    verifyExecutionAttestation,
    attestSigningInput,
    ATTEST_VERSION,
    ATTEST_SIGNING_PREFIX,
    ATTEST_ENVELOPE_TAG,
} from './execution-attestation.js';
export type {
    AttestStatus,
    ExecutorKeyEntry,
    ExecutorKeyRegistry,
    ExecutionAttestationIntended,
    VerifyExecutionAttestationResult,
} from './execution-attestation.js';
export {
    verifyMonitoringAttestation,
    monitorAttestSigningInput,
    MONITOR_ATTEST_VERSION,
    MONITOR_ATTEST_SIGNING_PREFIX,
    MONITOR_ATTEST_ENVELOPE_TAG,
} from './monitoring-attestation.js';
export type {
    MonAttestStatus,
    MonitoringKeyEntry,
    MonitoringKeyRegistry,
    MonitoringAttestationIntended,
    VerifyMonitoringAttestationResult,
} from './monitoring-attestation.js';
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
    AnalysisOutcome,
    AuthorizeReceiptKind,
    AnalyzeChangeSetResponse,
    AuthorizeChangeSetResponse,
    PreflightChangeSetResponse,
    VerifyReceiptIntendedContext,
    VerifyReceiptResponse,
    DecisionLookupRequest,
    DecisionLookupResponse,
} from './types.js';
