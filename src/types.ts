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
/* ── v1.1.0 — envelope-aware governance (decision-result.v1.1) ──────────────────
 * Interfaces are closed by design. TS structural typing already lets consumers pass
 * objects carrying ADDITIONAL fields (the app may append forward-compatible envelope
 * fields), so a wider server payload never breaks an SDK build. */
export type Decision = 'ALLOW' | 'WARN' | 'REQUIRE_APPROVAL' | 'BLOCK';
export type ExecutionAction = 'CONTINUE' | 'CONTINUE_WITH_MONITORING' | 'REQUEST_APPROVAL' | 'STOP';
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
export interface DecisionReason {
    code: string;
    message: string;
}
export interface NextAction {
    type: string;
    instruction: string;
    target: string | null;
    required: boolean;
    precondition: string | null;
}
export interface DecisionReceipt {
    token: string;
    format_version: string;
    key_id: string;
    issued_at: string;
    expires_at?: string;
}
export interface DecisionEvidence {
    type: string;
    source: string;
    finding: string;
    severity: string;
}
export interface DecisionResultEnvelope {
    spec_version: string;
    decision: Decision;
    safe_for_agent: boolean;
    execution_action: ExecutionAction;
    decision_id: string;
    correlation_id: string;
    evaluated_at: string;
    expires_at: string;
    summary: string;
    blocking_reasons: DecisionReason[];
    warnings: DecisionReason[];
    required_action: string | null;
    next_actions: NextAction[];
    fingerprint: string;
    input_fingerprint: string;
    decision_body_hash: string | null;
    receipt: DecisionReceipt;
    report_url: string | null;
    evidence_quality: string;
    confidence: number | null;
    calibration_version?: string | null;
    evidence: DecisionEvidence[];
    analysis_complete: boolean;
    degraded_reasons?: DecisionReason[];
    /** v1.1 additive fields (null / absent when not covered on a given path). */
    receipt_type?: string | null;
    operation?: string | null;
    environment?: string | null;
    artifact_digest?: string | null;
    decision_spec_version?: string | null;
    policy_hash?: string | null;
    ruleset_hash?: string | null;
    audience?: string | null;
    authorization_scope_hash?: string | null;
    engine_build_id?: string | null;
    deployment_id?: string | null;
}
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
export interface PreflightChangeSetRequest {
    artifacts: Artifact[];
    context?: PreflightChangeSetContext;
    previous_receipt?: string;
    idempotency_key?: string;
}
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
    payload?: Record<string, unknown>;
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
