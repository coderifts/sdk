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
    /**
     * The governance explanation label as the server sent it, or `undefined`
     * when the server omitted it. 3.9.0 BREAKING: the SDK no longer substitutes
     * `'ALLOW'` for an absent field. Never branch on this — branch on
     * `execution_action` via `readDecision`.
     */
    decision?: string;
    /**
     * Control field emitted top-level by POST /api/v1/agent/preflight.
     * Branch on this (via `readDecision`); `decision` is the explanation label.
     * Optional: the client passes the server value through and does not invent one.
     */
    execution_action?: ExecutionAction;
    omega_api: number;
    /**
     * 3.9.0 BREAKING, fail-closed: `true` only when the response carried an
     * explicit `CONTINUE`. Absent, unknown or unrecognised input yields `false`.
     * It now means "we verified it is safe", not "we did not see a reason it is
     * not". Before 3.9.0 an omitted `decision` produced `true`.
     */
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
    /**
     * Control field emitted top-level by POST /api/v1/diff.
     * Branch on this (via `readDecision`); `omega_decision` is the explanation label.
     */
    execution_action?: ExecutionAction;
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
    /** Governance label for the prose (e.g. ALLOW). Not a gate. */
    decision: string;
    reflex_triggers?: ReflexTrigger[];
    omega_components?: Record<string, unknown>;
    /** Control input. Ignored when `response` is supplied. */
    execution_action?: string;
    /** Full API payload; preferred. Takes precedence over `execution_action`. */
    response?: unknown;
}
export interface ExplainComponent {
    name: string;
    value: number;
    description: string;
}
export interface ExplainDecisionResponse {
    summary: string;
    components: ExplainComponent[];
    execution_action: ExecutionAction;
    reason?: string;
}
export interface HowToUnblockRequest {
    /** Governance label for the prose. Not a gate. */
    decision: string;
    breaking_changes?: BreakingChange[];
    detected_patterns?: unknown[];
    reflex_triggers?: ReflexTrigger[];
    /** Control input. Ignored when `response` is supplied. */
    execution_action?: string;
    /** Full API payload; preferred. Takes precedence over `execution_action`. */
    response?: unknown;
}
export interface UnblockAction {
    step: number;
    description: string;
    code_example?: string;
}
export interface HowToUnblockResponse {
    actions: UnblockAction[];
    execution_action: ExecutionAction;
    reason?: string;
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
    type: 'openapi' | 'graphql' | 'grpc' | 'asyncapi' | 'mcp_manifest' | 'agent_tools';
    before: string;
    after: string;
}
/** SCM platform for derivation:"server" (src/server-derive-change-set.js platformFromBody). */
export type ScmPlatform = 'github' | 'gitlab' | 'bitbucket';
export interface PreflightChangeSetContext {
    operation?: string;
    environment?: string;
    repository?: string;
    branch?: string;
    pull_request?: string | number;
    policy_profile?: string;
    /** PR/commit SHA the change set was computed against. Optional — not every preflight is PR-scoped. */
    base?: string;
    /** PR/commit SHA of the proposed head. Optional — not every preflight is PR-scoped. */
    head?: string;
    /** IntentContext parity (REST/MCP accept; not folded into the bundle fingerprint). */
    target_id?: string;
    /** IntentContext parity (REST/MCP accept; not folded into the bundle fingerprint). */
    fingerprint?: string;
    /** IntentContext parity (REST/MCP accept; server-derived audience still wins on the envelope). */
    audience?: string;
    /**
     * SCM platform for derivation:"server". Taken from context.platform on the
     * server (never guessed from the repository string). Default on the server
     * is github when omitted.
     */
    platform?: ScmPlatform;
}
/**
 * Per-request SCM token for GitLab/Bitbucket Compare derivation.
 * Sent ONLY as `X-Coderifts-Scm-Token` (src/scm/index.js readScmToken).
 * Never part of the JSON body, never stored on the client.
 */
export interface PreflightRequestOptions {
    scmToken?: string;
}
/**
 * Decision Spec v2 preflight mode (top-level; required by POST /api/v1/preflight).
 * - analyze  — informational risk only (no receipt / no execution permission)
 * - authorize — operation-bound may-proceed (requires context.operation; may mint a receipt)
 */
export type PreflightMode = 'analyze' | 'authorize';
/** Fields both request modes share. */
export interface PreflightChangeSetCommon {
    /**
     * Required top-level mode (server returns HTTP 400 if omitted).
     * Prefer `analyzeChangeSet` / `authorizeChangeSet` wrappers so the two meanings
     * cannot be mixed via a silent default.
     */
    preflight_mode: PreflightMode;
    previous_receipt?: string;
    idempotency_key?: string;
    /**
     * Opt-in cr.exec.v1 execution grant on authorize (PHASE-0).
     * Default omitted/false. Analyze ignores it.
     */
    include_execution_grant?: boolean;
    /** Mint cr.exec.v2 when 'v2'. Default omitted = v1 (compat window). */
    grant_version?: 'v1' | 'v2';
    executor_id?: string;
    adapter_id?: string;
    target_uri?: string;
    tenant_id?: string;
    /**
     * ATOMIC-profile nonce (cr.exec.v1). REQUEST INPUT, not a server echo: you obtain it from
     * your executor's state-challenge and pass it here; when `include_execution_grant` is true
     * and the decision is allow-class, the server copies it into the signed grant as a SEPARATE
     * signed field (deliberately NOT folded into `scope_hash` — after-payload binding and state
     * binding are independent facts). Absent => BEARER grant, today's default.
     * Server consumption: coderifts-app src/change-set.js:1256.
     */
    state_nonce?: string;
}

/**
 * MODE A — caller supplies the change set.
 *
 * `derivation` is `never` here so the compiler rejects mixing the modes: the server returns
 * 400 INVALID_INPUT for `derivation:"server"` alongside `artifacts[]`, with the reason
 * "one source of truth per request".
 */
export interface CallerArtifactsRequest extends PreflightChangeSetCommon {
    artifacts: Artifact[];
    derivation?: never;
    context?: PreflightChangeSetContext;
}

/**
 * MODE B — the server lists the change set from the repository (ID637 6b).
 *
 * `artifacts` is `never`: supplying both is a 400. `context.repository` / `base` / `head` are
 * REQUIRED — the server returns 400 `derivation_requires_base_head` without base+head, and
 * 400 INVALID_INPUT without a parseable `owner/repo`. Requires a proven tenant-repo binding,
 * else 403 `binding_not_proven`. This is the production path (docs/agents-quickstart.md).
 */
export interface ServerDerivedRequest extends PreflightChangeSetCommon {
    derivation: 'server';
    artifacts?: never;
    context: PreflightChangeSetContext & {
        repository: string;
        base: string;
        head: string;
    };
}

/**
 * The two mutually exclusive request modes. Misuse is a TYPE ERROR: `artifacts` with
 * `derivation:'server'`, or a server-derived request missing repository/base/head, will not
 * compile. The server remains the authority — this union fails fast, it does not re-implement
 * policy.
 */
export type PreflightChangeSetRequest = CallerArtifactsRequest | ServerDerivedRequest;

/** Request body for analyze/authorize wrappers (mode is fixed by the method). */
export type PreflightChangeSetBody =
    | Omit<CallerArtifactsRequest, 'preflight_mode'>
    | Omit<ServerDerivedRequest, 'preflight_mode'>;
/**
 * Resolved compare identity — present ONLY on the derivation:"server" path.
 * ABSENT (not null) on the caller-artifacts path so `body_hash` stays byte-identical.
 * Lives inside the decision_result envelope; covered by body_hash, NOT in the fingerprint.
 * Producer: coderifts-app src/change-set.js:1181.
 */
export interface DerivationEnvelope {
    source: string;
    base_sha: string;
    head_sha: string;
}

/** Completeness mode. SERVER_DERIVED is authored only when derivation:"server" ran. */
export type CompletenessMode =
    | 'SERVER_DERIVED'
    | 'BOUND_ATTESTED'
    | 'ATTESTED_UNVERIFIED'
    | 'UNBOUND'
    | 'DIVERGED'
    | 'UNESTABLISHABLE';

/**
 * WHO was authorized (ID963). Under body_hash; not in the verdict fingerprint.
 * Producer: coderifts-app src/change-set.js:752.
 */
export interface AuthorityEnvelope {
    audience: string | null;
    tenant_scope: 'bound' | 'unbound';
    /** Present only when tenant_scope is 'bound'. */
    binding_proven_at?: string | null;
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

/* ── control_envelope (control/1.0) — HAND-WRITTEN mirror ─────────────────────
 *
 * Source: coderifts-app `schemas/control-envelope.v1.producer.json` (the strict
 * PRODUCER schema for the surface `attachControlSurface` / `buildControlEnvelope`
 * emits). Read-only transcription, field for field.
 *
 * WHY IT IS NOT GENERATED. `scripts/generate-preflight-response-types.js` follows
 * `preflight-response.v2.{producer,consumer}.json`, where `control_envelope` is an
 * OPEN object with no `$ref` to the control-envelope schema. Generation therefore
 * produces `{ [k: string]: unknown }`. Wiring that `$ref` is an app-side change; this
 * mirror closes the reader-facing gap without touching `src/generated`, which stays
 * generator-owned.
 *
 * DRIFT IS THE KNOWN COST of a hand-written mirror (the ID804 class this package has
 * been bitten by before). Two things bound it: the schema is the contract and this is
 * explicitly the copy, and every field carries the producer's own optionality — the
 * three the schema requires are required here, the six it leaves optional are optional
 * here, and nothing has been promoted.
 *
 * NOT PERMISSION, and worth restating because this block is the branch source:
 * `execution_action` is the machine directive. `decision` is the explanation label and
 * `safe_for_agent` is not a branch key. `next_agent_step` says HOW to remediate, never
 * WHETHER to act.
 */

/** Closed set (producer `$defs.nextAgentStepObject.action`). */
export type NextAgentStepAction =
    | 're_preflight'
    | 'revert'
    | 'migrate'
    | 'escalate'
    | 'await_approval';

/**
 * The decision's own remediation SUGGESTION, projected from `execution_action` +
 * `required_action`. `null` on the allow class (CONTINUE / CONTINUE_WITH_MONITORING)
 * — a value, not a missing measurement.
 *
 * The same projection is also signed INSIDE `decision_result.next_agent_step`, where
 * `decision_body_hash` covers it. Prefer the signed copy when you hold a verified
 * receipt; this one is the live surface and is not itself signed.
 */
export interface NextAgentStep {
    /** Closed set. An unrecognised value is not permission — it is not a control field at all. */
    action: NextAgentStepAction;
    /** `required_action` reason_code / type, or the display string when that is all the path had. */
    reason: string;
    /** What must hold before the caller retries. Empty string when the path supplied none. */
    resume_condition: string;
    /** Tool to call after the step, or null when the next move is a human one. */
    then_call: 'preflight_change_set' | 'verify_receipt' | null;
}

/** One remediation choice. Fresh path emits objects; a stored core emits ids only. */
export type RequiredActionChoice =
    | string
    | { id: string; label: string; outcome: string };

/**
 * Branchable control core. The producer types this as a UNION on purpose: the fresh
 * path emits this object, a stored envelope may carry the core (choices as string ids),
 * a legacy envelope carries a bare string, and it is omitted when neither is present.
 */
export interface RequiredActionObject {
    type:
        | 'none'
        | 'proceed_with_note'
        | 're_preflight'
        | 'fix_coverage'
        | 'remediate_or_revert'
        | 'revert'
        | 'request_approval';
    reason_code: string;
    recheck_required: boolean;
    choices?: RequiredActionChoice[];
    resume_condition?: string;
    /** Structured resume hint. Shape is NOT closed — fields vary by `type`. */
    resume?: Record<string, unknown>;
}

/**
 * What the receipt (if any) is bound to. Every slot is nullable: `null` means UNBOUND —
 * the issuance path did not supply it. That is not a mismatch and not an error.
 */
export interface ReceiptViewBindsTo {
    operation?: string | null;
    target_id?: string | null;
    change_fp?: string | null;
    repository?: string | null;
    branch?: string | null;
    pull_request?: string | null;
    base?: string | null;
    head?: string | null;
    srcmode?: string | null;
    preflight_mode?: string | null;
    completeness_mode?: string | null;
    change_set_commitment?: string | null;
    submitted_set_digest?: string | null;
    fingerprint_binding_expected?: boolean | null;
    authority?: Record<string, unknown> | null;
}

/**
 * Compact VIEW of a held receipt — NOT the token. The token lives at
 * `decision_result.receipt` / `chain_receipt`. Always present on both builders: an
 * absent receipt yields `present: false` with nulls, never an omitted block.
 */
export interface ReceiptView {
    present: boolean;
    /** `null` = not evaluated here. Distinct from `false` = evaluated and not verified. */
    verified: boolean | null;
    binds_to: ReceiptViewBindsTo | null;
    expires_at: string | null;
    /** `null` = authorization could not be evaluated. Not authorized and not unauthorized. */
    currently_authorized: boolean | null;
}

/**
 * Static, honest descriptor of WHERE enforcement is decided. Always present.
 * NOT a branch-protection probe result: both fields currently read
 * `'not_evaluated_here'` from `buildEnforcementDescriptor`, and they are typed as open
 * strings because the producer leaves room for a future static answer.
 */
export interface ControlEnforcement {
    agent_runtime: string;
    merge_path: string;
    note: string;
}

/**
 * The machine-control surface. Three fields are guaranteed; the rest are present only
 * when the path that built the envelope had them (the stored-retrieval builder omits
 * what the stored envelope did not carry — it never invents a value).
 */
export interface ControlEnvelope {
    /** Producers currently emit the const `'control/1.0'`. */
    control_version: string;
    /** Compact view of a held receipt. Always present. */
    receipt_view: ReceiptView;
    /** Where enforcement is decided. Always present. */
    enforcement: ControlEnforcement;
    /** Explanation label. NOT a branch key. Omitted when the stored envelope lacked it. */
    decision?: Decision;
    /**
     * DEPRECATED for control flow — branch on `execution_action`. May be forced false
     * under coverage/degraded on the fresh path.
     */
    safe_for_agent?: boolean;
    /**
     * THE branch key. Omitted when the stored envelope does not carry it — never
     * invented. An unrecognised value is not permission (fail closed).
     */
    execution_action?: ExecutionAction;
    /** Byte-identical copy of the decision fingerprint. */
    verdict_fingerprint?: string;
    /** Union by design — see RequiredActionObject. Do not collapse to object-only. */
    required_action?: RequiredActionObject | string | null;
    /** The decision's remediation suggestion. `null` on the allow class. */
    next_agent_step?: NextAgentStep | null;
}

/* ── preflight-response.v2 (discriminated on preflight_mode) ──────────────────
 * GENERATED from coderifts-app/schemas/preflight-response.v2.{producer,consumer}.json by
 * scripts/generate-preflight-response-types.js (ID819). Do not hand-edit
 * src/generated/preflight-response.v2.ts — and do not re-declare these shapes here.
 *
 * Until ID819 this union was hand-written in this file and drifted from the schema by hand
 * (ID804 class), which is exactly what the v1 envelope generation had already fixed next door.
 * Schema split, unchanged by generation: the PRODUCER supplies the property set (it enumerates
 * everything that can appear); the CONSUMER supplies required-ness (the SDK is a reader — the
 * producer additionally requires risk_score + breaking_changes, but the consumer contract does
 * not promise them, and over-claiming presence to a reader is the bug this prevents).
 *
 * Decision / ExecutionAction / DecisionResultEnvelope on the authorize branch are bound to the
 * generated decision-result.v1 names rather than re-emitted as string unions, so the enums
 * cannot drift; the app-side test asserts the v2 schema enums stay byte-equal to v1's.
 */
import type {
    AnalyzeChangeSetResponse as GeneratedAnalyzeChangeSetResponse,
    AuthorizeChangeSetResponse as GeneratedAuthorizeChangeSetResponse,
} from './generated/preflight-response.v2.js';
export type { AnalysisOutcome, AuthorizeReceiptKind } from './generated/preflight-response.v2.js';
/**
 * `preflight_mode: 'analyze'` — informational risk only. NOT permission: it never authorizes,
 * never grants execute, and never mints a receipt (hence the three literal-typed constants).
 *
 * The two branches are NOT one shape with optional fields. `analyze` STRUCTURALLY omits
 * decision / execution_action / safe_for_agent — the producer schema encodes this as
 * `not: { anyOf: [required decision|execution_action|safe_for_agent] }`, so an analyze response
 * never carries a decision and the type must not offer one. Reading `res.safe_for_agent`
 * without first narrowing on `preflight_mode` is a compile error, which is the point.
 */
export type AnalyzeChangeSetResponse = GeneratedAnalyzeChangeSetResponse;
/**
 * `preflight_mode: 'authorize'` — operation-bound may-proceed. Carries the decision, the machine
 * directive (`execution_action`), and `safe_for_agent`; may carry a chain receipt.
 *
 * Two caveats the schema cannot express in TypeScript:
 * - `safe_for_agent` is DEPRECATED for control flow — branch on `execution_action`. It stays
 *   because the schema requires it on this branch.
 * - `chain_receipt` is required by the schema *conditionally* (when
 *   `receipt_kind === 'operation_authorization'`). TypeScript has no if/then, so it is typed
 *   optional — check `receipt_kind` before relying on it.
 */
export type AuthorizeChangeSetResponse = GeneratedAuthorizeChangeSetResponse & {
    /**
     * Typed here rather than generated. The v2 producer schema declares
     * `control_envelope` as an open object, so generation can only emit
     * `{ [k: string]: unknown }` — every field reads as `unknown` and the branch key
     * agents are told to use is the one field the types do not describe.
     *
     * The real shape is a separate published document,
     * `schemas/control-envelope.v1.producer.json`, which generation does not follow
     * (`control_envelope` carries no `$ref` to it). Until it does, this hand-written
     * mirror is the honest place for it — and it is a MIRROR: every field below is
     * transcribed from that schema, and none is invented here.
     */
    control_envelope?: ControlEnvelope;
};
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
export type PreflightChangeSetResponse = AnalyzeChangeSetResponse | AuthorizeChangeSetResponse;
/**
 * The union is rebuilt from the two local branch names rather than aliased to
 * `GeneratedPreflightChangeSetResponse`, so that narrowing on `preflight_mode` lands on
 * the authorize branch WITH the typed `control_envelope` above. Aliasing the generated
 * union re-introduced the opaque `{ [k: string]: unknown }` after the narrow — the field
 * was typed everywhere except the one place a reader actually gets to it.
 *
 * `GeneratedAnalyzeChangeSetResponse` / `GeneratedAuthorizeChangeSetResponse` remain the
 * source of every other field; only `control_envelope` is added.
 */
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
 *
 * Expiry (server): 30s clock-skew leeway on `expires_at` (`CLOCK_SKEW_LEEWAY_MS`); 0s for
 * destructive operations in production when the intended context declares them. IntentContext
 * has `environment` but no `destructive` / `operation_class` — the 0s branch is not guessed
 * from operation labels. Unknown body keys are dropped by the REST route (not 400).
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
    /** Source binding: intended base commit/ref SHA the receipt must match. */
    base?: string;
    /** Source binding: intended head commit/ref SHA the receipt must match. */
    head?: string;
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
    /**
     * Signed receipt payload when the signature is authentic. Omitted when unverifiable
     * (route omits the key; runtime may be undefined). Present on successful authentic verifies.
     */
    payload?: Record<string, unknown>;
    /**
     * Whether this receipt is authorized right now for the evaluated context.
     * `true` / `false` are answers; `null` means authorization could not be evaluated
     * (not unauthorized and not authorized). Distinct from `valid` (signature/integrity).
     */
    currently_authorized: boolean | null;
    authz_note: string;
    /**
     * Request/trace correlation id. Always present: the verify-receipt route sets it via
     * buildVerifyReceiptResponse from req.correlationId (ID828) — route-owned, not dependent
     * on the global correlationId middleware body injection. Matches X-Correlation-ID when middleware runs.
     */
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
