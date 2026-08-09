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
export interface PreflightChangeSetResponse {
    decision: Decision;
    safe_for_agent: boolean;
    execution_action: ExecutionAction;
    risk_score: number;
    breaking_changes: number;
    patterns: string[];
    bundle_fingerprint: string;
    verdict_fingerprint: string;
    chain_status?: string;
    chain_receipt?: string;
    artifacts: ChangeSetArtifactFinding[];
    evidence: DecisionEvidence[];
    decision_result?: DecisionResultEnvelope;
    correlation_id: string;
    meta: Record<string, unknown>;
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
