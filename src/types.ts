/**
 * @coderifts/sdk — Type definitions
 */

export interface CodeRiftsOptions {
    /** API key (cr_live_... or cr_test_...) */
    apiKey: string;
    /** Base URL override. Defaults to https://app.coderifts.com */
    baseUrl?: string;
    /** Request timeout in milliseconds. Defaults to 30000 */
    timeout?: number;
}
export interface ApiErrorBody {
    error: string;
    message: string;
}
export interface PreflightCheckRequest {
    tool_name: string;
    old_spec: string;
    new_spec: string;
}
export interface ReflexTrigger {
    rule: string;
    decision: string;
}
export interface AffectedTool {
    tool_name: string;
    status: string;
    changes?: string[];
    patterns?: string[];
}
export interface PreflightCheckResponse {
    decision: string;
    omega_api: number;
    safe: boolean;
    reflex_triggers: ReflexTrigger[];
    affected_tools: AffectedTool[];
    confidence_score?: number;
    reflex_override?: boolean;
    omega_components?: Record<string, unknown>;
    breaking_changes?: unknown[];
    stats?: Record<string, unknown>;
    mitigation_available?: boolean;
}
export interface DiffRequest {
    before: string;
    after: string;
    branch_name?: string;
    config?: Record<string, unknown>;
}
export interface BreakingChange {
    type: string;
    path: string;
    method?: string;
    field?: string;
    severity: string;
    description: string;
}
export interface DiffResponse {
    risk_score: number;
    risk_level: string;
    risk_dimensions?: Record<string, number>;
    semver_suggestion: string;
    breaking_changes: BreakingChange[];
    non_breaking_changes: unknown[];
    security_findings: unknown[];
    changelog: Record<string, string[]>;
    policy_violations: unknown[];
    should_block: boolean;
    detected_patterns: unknown[];
    compatibility_suggestions: unknown[];
    omega_api?: number;
    omega_decision?: string;
    reflex_override?: boolean;
    reflex_triggers?: ReflexTrigger[];
    confidence_score?: number;
    omega_components?: Record<string, unknown>;
    omega_audit?: Record<string, unknown>;
    stats?: Record<string, unknown>;
    pii_findings?: unknown[];
}
export interface ExplainDecisionRequest {
    omega_api: number;
    decision: string;
    reflex_triggers?: ReflexTrigger[];
    omega_components?: Record<string, unknown>;
}
export interface ExplainComponent {
    name: string;
    value: number;
    description: string;
}
export interface ExplainDecisionResponse {
    summary: string;
    components: ExplainComponent[];
}
export interface HowToUnblockRequest {
    decision: string;
    breaking_changes?: BreakingChange[];
    detected_patterns?: unknown[];
    reflex_triggers?: ReflexTrigger[];
}
export interface UnblockAction {
    step: number;
    description: string;
    code_example?: string;
}
export interface HowToUnblockResponse {
    actions: UnblockAction[];
}
export interface ScoreMcpRequest {
    manifest: {
        tools: unknown[];
        [key: string]: unknown;
    };
}
export interface ScoreMcpResponse {
    overall_score: number;
    band: string;
    label?: string;
    signals?: unknown[];
    tool_count?: number;
}
export interface GetLedgerRequest {
    repo?: string;
    decision?: string;
    from?: string;
    to?: string;
    limit?: number;
}
export interface LedgerEntry {
    id: number;
    repo: string | null;
    pr_number: number | null;
    pr_author: string | null;
    commit_sha: string | null;
    decision: string;
    omega_api: number | null;
    risk_score: number | null;
    risk_level: string | null;
    breaking_changes: number;
    reflex_override: boolean;
    reflex_triggers: ReflexTrigger[];
    policy_rule_id: string | null;
    policy_action: string | null;
    approved_by: string | null;
    approved_at: string | null;
    override_reason: string | null;
    overridden_by: string | null;
    overridden_at: string | null;
    created_at: string;
}
export interface GetLedgerResponse {
    repo: string | null;
    total: number;
    entries: LedgerEntry[];
}
export interface SimulatePolicyRequest {
    policy_yaml: string;
    old_spec: string;
    new_spec: string;
}
export interface MatchedRule {
    rule_id?: string;
    action: string;
    conditions?: Record<string, unknown>;
}
export interface SimulatePolicyResponse {
    effective_action: string;
    matched_rules: MatchedRule[];
    [key: string]: unknown;
}
/* ── decision-result.v1 envelope (ID75) ───────────────────────────────────────
 * Canonical shape is GENERATED from coderifts-app/schemas/decision-result.v1.producer.json
 * (scripts/generate-sdk-types.js). Do not hand-edit src/generated/decision-result.v1.ts.
 * Re-exported here under the stable public names used since v1.1.0.
 *
 * Drift note (ID804 class): the previous hand-written DecisionResultEnvelope lacked
 * place/source binding (repository/branch/pull_request/base/head/srcmode), preflight_mode,
 * pattern_sources, required_action_core, completeness_* fields, Decision Spec scalars
 * (risk_score/breaking_changes/patterns), and closed enums on NextAction/Evidence.
 * Generated types restore schema parity. Receipt.expires_at was hand-added on the SDK
 * but is NOT in producer $defs.receipt (optional convenience on live tokens only).
 */
import type {
    DecisionResultEnvelope,
    Decision,
    ExecutionAction,
    DecisionReason,
    DecisionReceipt,
    DecisionEvidence,
    NextAction,
    Reason,
    Receipt,
    Evidence,
} from './generated/decision-result.v1.js';
export type {
    DecisionResultEnvelope,
    Decision,
    ExecutionAction,
    DecisionReason,
    DecisionReceipt,
    DecisionEvidence,
    NextAction,
    Reason,
    Receipt,
    Evidence,
};
export type ReceiptStatus =
    | 'VERIFIED_CURRENT'
    | 'VERIFIED_EXPIRED'
    | 'VERIFIED_WRONG_AUDIENCE'
    | 'VERIFIED_WRONG_ENVIRONMENT'
    | 'VERIFIED_SUPERSEDED'
    | 'VERIFIED_SCOPE_MISMATCH'
    | 'UNKNOWN_KEY'
    | 'RETIRED_KEY_VALID_AT_ISSUE'
    | 'INVALID_SIGNATURE'
    | 'MALFORMED'
    | 'UNSUPPORTED_VERSION'
    | 'REGISTRY_UNREACHABLE';
export interface Artifact {
    id: string;
    type: 'openapi' | 'graphql' | 'grpc' | 'asyncapi' | 'mcp_manifest';
    before: string;
    after: string;
}
export interface PreflightChangeSetContext {
    operation?: string;
    environment?: string;
    repository?: string;
    branch?: string;
    pull_request?: string | number;
    policy_profile?: string;
}
/**
 * Decision Spec v2 preflight mode (top-level; required by POST /api/v1/preflight).
 * - analyze  — informational risk only (no receipt / no execution permission)
 * - authorize — operation-bound may-proceed (requires context.operation; may mint a receipt)
 */
export type PreflightMode = 'analyze' | 'authorize';
export interface PreflightChangeSetRequest {
    /**
     * Required top-level mode (server returns HTTP 400 if omitted).
     * Prefer `analyzeChangeSet` / `authorizeChangeSet` wrappers so the two meanings
     * cannot be mixed via a silent default.
     */
    preflight_mode: PreflightMode;
    artifacts: Artifact[];
    context?: PreflightChangeSetContext;
    previous_receipt?: string;
    idempotency_key?: string;
}
/** Request body for analyze/authorize wrappers (mode is fixed by the method). */
export type PreflightChangeSetBody = Omit<PreflightChangeSetRequest, 'preflight_mode'>;
export interface ChangeSetArtifactFinding {
    id: string;
    type: string;
    status: string;
    decision: Decision;
    risk_score: number;
    breaking_changes: number;
    patterns: string[];
    safe_for_agent: boolean;
    error?: string;
    reason?: string;
}
/* ── preflight-response.v2 (discriminated on preflight_mode) ──────────────────
 * Mirrors the oneOf in coderifts-app/schemas/preflight-response.v2.{consumer,producer}.json.
 *
 * The two branches are NOT one shape with optional fields. `analyze` is informational and
 * STRUCTURALLY omits decision / execution_action / safe_for_agent (the producer schema encodes
 * this as `not: { anyOf: [required decision|execution_action|safe_for_agent] }`) — an analyze
 * response never carries a decision, so the type must not offer one. Reading `res.safe_for_agent`
 * without first narrowing on `preflight_mode` is a compile error, which is the point: the previous
 * single rigid interface declared both as always-present and let callers branch on a decision that
 * the analyze protocol never returns.
 *
 * Required-field policy: the SDK is a CONSUMER, so required-ness follows the *consumer* schema
 * (the deliberately permissive view) — only the discriminating minimum is required; every other
 * property either branch defines is optional. The producer additionally requires risk_score and
 * breaking_changes today, but the consumer contract does not promise them, and over-claiming
 * presence is the exact class of bug this change fixes.
 *
 * Decision / ExecutionAction / DecisionResultEnvelope are REUSED from the generated
 * decision-result.v1 types rather than re-declared as string unions, so the enums cannot drift.
 */
/** Closed analysis outcome set (analyze only; derived from engine-visible state). */
export type AnalysisOutcome =
    | 'NO_BREAK_DETECTED'
    | 'BREAKS_DETECTED'
    | 'ANALYSIS_FAILED';
/** Receipt kind on an authorize response (`operation_authorization` when a chain receipt was issued). */
export type AuthorizeReceiptKind = 'operation_authorization' | 'NONE';
/**
 * `preflight_mode: 'analyze'` — informational risk only. NOT permission: it never authorizes,
 * never grants execute, and never mints a receipt (hence the three literal-typed constants).
 */
export interface AnalyzeChangeSetResponse {
    preflight_mode: 'analyze';
    analysis_outcome: AnalysisOutcome;
    /** Analyze never authorizes. */
    authorization_effect: 'NONE';
    /** Analyze never grants execute permission. */
    may_execute: false;
    /** Analyze never mints a receipt. */
    receipt_kind: 'NONE';
    /** Decision Spec major for this response (typically '2.0'). */
    decision_spec_version: string;
    risk_score?: number;
    breaking_changes?: number;
    requires_migration?: boolean;
    evidence_quality?: string;
    patterns?: string[];
    pattern_sources?: unknown[];
    bundle_fingerprint?: string;
    verdict_fingerprint?: string;
    artifacts?: ChangeSetArtifactFinding[];
    evidence?: DecisionEvidence[];
    correlation_id?: string;
    timestamp?: string;
    operation?: unknown;
    decision_basis?: unknown;
    analysis_control?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}
/**
 * `preflight_mode: 'authorize'` — operation-bound may-proceed. Carries the decision, the machine
 * directive (`execution_action`), and `safe_for_agent`; may carry a chain receipt.
 *
 * Note: `chain_receipt` is required by the schema *conditionally* (when
 * `receipt_kind === 'operation_authorization'`). TypeScript cannot express that if/then, so it is
 * typed optional here — check `receipt_kind` before relying on it.
 */
export interface AuthorizeChangeSetResponse {
    preflight_mode: 'authorize';
    decision: Decision;
    execution_action: ExecutionAction;
    /**
     * DEPRECATED for control flow — branch on `execution_action`. Kept because the schema
     * requires it on this branch.
     */
    safe_for_agent: boolean;
    /** Decision Spec major for this response (typically '2.0'). */
    decision_spec_version: string;
    receipt_kind?: AuthorizeReceiptKind;
    chain_receipt?: string;
    chain_status?: string;
    decision_result?: DecisionResultEnvelope;
    risk_score?: number;
    breaking_changes?: number;
    requires_migration?: boolean;
    evidence_quality?: string;
    patterns?: string[];
    pattern_sources?: unknown[];
    bundle_fingerprint?: string;
    verdict_fingerprint?: string;
    artifacts?: ChangeSetArtifactFinding[];
    evidence?: DecisionEvidence[];
    correlation_id?: string;
    timestamp?: string;
    operation?: unknown;
    decision_basis?: unknown;
    coderifts_version?: string;
    decision_semantic_hash?: unknown;
    control_envelope?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}
/**
 * Union of the two preflight branches, discriminated on `preflight_mode`. Narrow before reading
 * mode-specific fields:
 *
 * ```ts
 * const res = await client.preflightChangeSet(req);
 * if (res.preflight_mode === 'authorize') {
 *     if (res.execution_action === 'STOP') return;   // decision fields available here
 * } else {
 *     report(res.analysis_outcome);                  // analyze has no decision
 * }
 * ```
 */
export type PreflightChangeSetResponse =
    | AnalyzeChangeSetResponse
    | AuthorizeChangeSetResponse;
/**
 * Intended context for a verify-receipt call — the "what are you about to do?" half of the question.
 *
 * WITHOUT it the endpoint answers a signature question only: `valid` / `status` reflect
 * authenticity and expiry, and `currently_authorized` comes back **null** — not authorized and not
 * unauthorized, simply not evaluated. WITH it the server binds the receipt against the stated
 * intent and `currently_authorized` becomes a real `true` / `false`.
 *
 * So: a valid signature is not authorization. If you are about to act on a receipt, supply the
 * context you are about to act under — otherwise the only honest reading of the answer is
 * "authentic token, authorization unknown".
 *
 * Every field is optional and any subset may be sent; the server evaluates what it was given.
 * This list mirrors exactly what `POST /api/v1/verify-receipt` reads — nothing here is invented.
 */
export interface VerifyReceiptIntendedContext {
    /** Operation the receipt must authorize (e.g. merge | deploy | publish | tool_call). */
    operation?: string;
    /** Apply-site target the receipt must bind. */
    target_id?: string;
    /** Environment the receipt must match (e.g. production). */
    environment?: string;
    /** Change fingerprint that must equal the receipt's. */
    fingerprint?: string;
    /** Audience the receipt must match. */
    audience?: string;
    /** Place binding: repository the receipt must be bound to. */
    repository?: string;
    /** Place binding: branch the receipt must be bound to. */
    branch?: string;
    /** Place binding: pull request the receipt must be bound to. */
    pull_request?: string | number;
    /**
     * The body_hash-bound decision envelope. Required for a meaningful scope evaluation — with
     * intent fields but no envelope the server fails closed (`currently_authorized: false`) rather
     * than guessing.
     */
    decision_result?: DecisionResultEnvelope | Record<string, unknown>;
    /** Optional lifecycle indices (supersede / revocation) the server consults when provided. */
    indices?: Record<string, unknown>;
}
export interface VerifyReceiptResponse {
    valid: boolean;
    reason: string | null;
    status: ReceiptStatus;
    /** Always present on the live endpoint (measured with and without intent context). */
    payload: Record<string, unknown>;
    /**
     * Whether this receipt is authorized right now for the evaluated context.
     * `true` / `false` are answers; `null` means authorization could not be evaluated
     * (not unauthorized and not authorized). Distinct from `valid` (signature/integrity).
     */
    currently_authorized: boolean | null;
    authz_note: string;
    correlation_id: string;
    /** Present when intent context (e.g. operation/environment) was supplied on the request. */
    authz_status?: string;
    /** Present when intent context (e.g. operation/environment) was supplied on the request. */
    authz_reason?: string;
    /** Lifecycle state from the authorization evaluation; omitted when currently_authorized is null. */
    authz_state?: string;
    /** How tightly the receipt was bound for this evaluation (e.g. content-only vs place-bound). */
    binding_level?: string;
}
export interface DecisionLookupRequest {
    decision_id?: string;
    fingerprint?: string;
}
export interface DecisionLookupResponse {
    decision: Decision;
    decision_result: DecisionResultEnvelope;
    meta: Record<string, unknown>;
}
