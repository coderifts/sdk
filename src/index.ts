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
// ── THE AUTHORIZATION QUESTION (1463) ────────────────────────────────────────────────────────
//
// ADDITIVE. `verifyExecutionGrant` below is unchanged and still answers "is this token authentic,
// current and bound to what I intended". `authorize` answers a different question — "may this be
// treated as authorized AND committed" — by quoting the shared core predicate, so a TS caller
// reads the same named states the guard, Prove, conformance and the contract-gate print.
export { authorize, AUTHORIZATION_STATE } from './authorize.js';
// ── THE OFFLINE PROOF ───────────────────────────────────────────────────────────────────────
//
// `verifyReceipt` here is LOCAL: the vendored receipt-verifier core, in process, over bytes
// already in memory plus a keyring the caller pinned. No network, no API key, full Ed25519.
//
// It is exported from the package ROOT deliberately. The only `verifyReceipt` this SDK had was a
// method on the client that POSTs to CodeRifts — useful, and not a verification the caller
// performed. A reader told "verify offline, without us" and handed that method has been told
// something the package could not do, and a NAME is read more often than a docstring.
// `client.verifyReceiptViaServer()` is the mirror, and says so.
export { verifyReceipt } from './verify-receipt-local.js';
export type { LocalReceiptVerdict, VerifyReceiptLocalOptions } from './verify-receipt-local.js';
export type {
    AuthorizeInput,
    AuthorizeResult,
    AuthorizationState,
    AuthorityName,
    AuthorityResult,
    PinnedKeyring,
} from './authorize.js';

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
    ScmPlatform,
    PreflightChangeSetContext,
    PreflightRequestOptions,
    PreflightChangeSetRequest,
    PreflightChangeSetBody,
    ChangeSetArtifactFinding,
    AnalysisOutcome,
    AuthorizeReceiptKind,
    AnalyzeChangeSetResponse,
    AuthorizeChangeSetResponse,
    PreflightChangeSetResponse,
    // control_envelope (control/1.0) — hand-written mirror of the app's
    // control-envelope.v1 PRODUCER schema; see src/types.ts for why it is not generated.
    ControlEnvelope,
    ControlEnforcement,
    ReceiptView,
    ReceiptViewBindsTo,
    RequiredActionObject,
    RequiredActionChoice,
    NextAgentStep,
    NextAgentStepAction,
    VerifyReceiptIntendedContext,
    VerifyReceiptResponse,
    DecisionLookupRequest,
    DecisionLookupResponse,
} from './types.js';
