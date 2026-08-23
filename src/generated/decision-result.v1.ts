/**
 * DO NOT EDIT — generated from schemas/decision-result.v1.producer.json
 *
 * Source of truth: coderifts-app/schemas/decision-result.v1.producer.json
 * Generator:       coderifts-app/scripts/generate-sdk-types.js
 *
 *   node scripts/generate-sdk-types.js --out <path>
 *   node scripts/generate-sdk-types.js --out <path> --check
 *
 * Hand-editing this file will be overwritten. To change types, update the producer
 * schema and re-run the generator. Public SDK names (DecisionResultEnvelope, …)
 * are re-exported from src/types.ts for stable import paths.
 */

/* eslint-disable */
/* tslint:disable */
/**
 * CodeRifts decision-result.v1 envelope (PRODUCER schema → TypeScript). Canonical contract; do not hand-edit the generated .ts.
 */
export interface DecisionResultEnvelope {
  spec_version: string;
  decision: 'ALLOW' | 'WARN' | 'REQUIRE_APPROVAL' | 'BLOCK';
  /**
   * DEPRECATED for control flow/branching. Exists solely for backward-compatible dashboards and legacy monitors. Autonomous agents MUST branch exclusively on execution_action: false he…
   */
  safe_for_agent: boolean;
  /**
   * Single canonical machine directive. STOP means stop THIS attempt (remediate, then request a NEW decision), not abandon forever. CONTINUE_WITH_MONITORING obliges the consumer to emi…
   */
  execution_action: 'CONTINUE' | 'CONTINUE_WITH_MONITORING' | 'REQUEST_APPROVAL' | 'STOP';
  /**
   * Unique identifier of THIS decision (idempotency, dedup, audit joins, approval callbacks).
   */
  decision_id: string;
  correlation_id: string;
  /**
   * Policy evaluation time, UTC Z, second precision.
   */
  evaluated_at: string;
  /**
   * Hard validity bound (authorization time-window), UTC Z. Producer: evaluated_at + per-operation TTL (closed map: tool_call=15m; merge/deploy/publish=4h; unknown/null=15m fail-safe s…
   */
  expires_at: string;
  summary: string;
  /**
   * @maxItems 50
   */
  blocking_reasons: Reason[];
  /**
   * @maxItems 50
   */
  warnings: Reason[];
  /**
   * Human-readable rendering of the required next step. DISPLAY ONLY — never a control source; next_actions is authoritative. Schema-enforced null on ALLOW.
   */
  required_action: string | null;
  /**
   * Recommendations unless individually marked required. A signed decision never authorizes executing an arbitrary remediation; remediate, then request a NEW decision (REEVALUATE).
   *
   * @maxItems 25
   */
  next_actions: NextAction[];
  /**
   * DECISION fingerprint (deterministic verdict identity on the oasdiff-1.11.11 pinned path for the main OpenAPI preflight surface; matches the REST v1 verdict fingerprint). Same input…
   */
  fingerprint: string;
  /**
   * Canonical hash of the evaluated change-set input. Consumers MUST verify it matches the request they hold before acting.
   */
  input_fingerprint: string;
  /**
   * sha256 of the RFC 8785 (JCS) canonicalized envelope EXCLUDING receipt and decision_body_hash itself. Covered by the receipt signature from the next receipt format version onward (P…
   */
  decision_body_hash: string | null;
  receipt: Receipt;
  /**
   * Human report link. HTTPS-only, display-only, never an instruction source.
   */
  report_url: string | null;
  /**
   * Quality of the INPUTS examined, not confidence in the verdict. LOW evidence never relaxes execution_action.
   */
  evidence_quality: 'LOW' | 'MEDIUM' | 'HIGH';
  /**
   * Calibrated probability that the decision is correct (event: DECISION_CORRECT). null until a holdout-calibrated model ships. Neither confidence nor evidence_quality may override exe…
   */
  confidence: number | null;
  calibration_version?: string | null;
  /**
   * @maxItems 100
   */
  evidence: Evidence[];
  /**
   * false when any analysis dependency was unavailable or timed out. 'Could not look' (this) vs 'looked and evidence is weak' (evidence_quality).
   */
  analysis_complete: boolean;
  /**
   * @maxItems 20
   */
  degraded_reasons?:
    | []
    | [Reason]
    | [Reason, Reason]
    | [Reason, Reason, Reason]
    | [Reason, Reason, Reason, Reason]
    | [Reason, Reason, Reason, Reason, Reason]
    | [Reason, Reason, Reason, Reason, Reason, Reason]
    | [Reason, Reason, Reason, Reason, Reason, Reason, Reason]
    | [Reason, Reason, Reason, Reason, Reason, Reason, Reason, Reason]
    | [Reason, Reason, Reason, Reason, Reason, Reason, Reason, Reason, Reason]
    | [Reason, Reason, Reason, Reason, Reason, Reason, Reason, Reason, Reason, Reason]
    | [Reason, Reason, Reason, Reason, Reason, Reason, Reason, Reason, Reason, Reason, Reason]
    | [
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
      ]
    | [
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
      ]
    | [
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
      ]
    | [
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
      ]
    | [
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
      ]
    | [
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
      ]
    | [
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
      ]
    | [
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
      ]
    | [
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
        Reason,
      ];
  /**
   * Additive v1.1. Issuance-path type: 'bundle_preflight' | 'spec_preflight'. null on paths that do not set it.
   */
  receipt_type?: string | null;
  /**
   * Additive v1.1. Caller-declared change operation (bundle context). null when absent.
   */
  operation?: string | null;
  /**
   * Additive v1.1. Caller-declared target environment (bundle context). null when absent.
   */
  environment?: string | null;
  /**
   * Additive. Place binding: caller-declared repository (bundle context.repository). Present only when supplied — never invent a placeholder. Covered by decision_body_hash when set. nu…
   */
  repository?: string | null;
  /**
   * Additive. Place binding: caller-declared branch (bundle context.branch). Present only when supplied. null = unbound.
   */
  branch?: string | null;
  /**
   * Additive. Place binding: caller-declared pull request id (bundle context.pull_request, stringified). Present only when supplied. null = unbound.
   */
  pull_request?: string | null;
  /**
   * Additive (ID686 v5). Source binding: base commit/ref the change set was computed against (context.base). Present only when supplied — never invent. Covered by decision_body_hash. n…
   */
  base?: string | null;
  /**
   * Additive (ID686 v5). Source binding: head commit/ref the change set was computed against (context.head). Present only when supplied — never invent. Covered by decision_body_hash. n…
   */
  head?: string | null;
  /**
   * Additive (ID686 v5). Source-binding mode: 'declared' when the caller supplied at least one of repository/branch/pull_request/base/head; 'unbound' when none were supplied. Under unb…
   */
  srcmode?: 'declared' | 'unbound' | null;
  /**
   * Additive (ID686 v5 / audit 4.1). Decision Spec preflight_mode at issuance. Must live on the envelope (not only the live response) so body_hash covers it and replay/retrieval return…
   */
  preflight_mode?: 'analyze' | 'authorize' | null;
  /**
   * Additive v1.1. sha256 over the bundle's per-artifact before/after content digests. null on non-bundle paths.
   */
  artifact_digest?: string | null;
  /**
   * Additive v1.1. Scorer-config hash (NOT a governance-policy hash — no policy-object hash producer exists yet). null when unavailable.
   */
  policy_hash?: string | null;
  /**
   * Additive v1.1. Scorer-config ruleset hash (same caveat as policy_hash). null when unavailable.
   */
  ruleset_hash?: string | null;
  /**
   * Additive. Decision Spec version this envelope was issued under (e.g. '1.0' legacy pin or '2.0' current). Decision Spec 2.0 mode discrimination (preflight_mode analyze|authorize, an…
   */
  decision_spec_version?: string | null;
  /**
   * Additive v1.1. Intended audience of the decision: server-derived authenticated requester identity ('v:' + sha256(utf8(apiKey)).hex.slice(0, 12) via velocity-monitor.decisionAudienc…
   */
  audience?: string | null;
  /**
   * Additive v1.1. Hash of the caller's authorization scope. No producer yet; null until org/installation scope is decided (ID747). Producer awaits the org-scope decision. Never invent…
   */
  authorization_scope_hash?: string | null;
  /**
   * Additive v1.1. Build/commit id of the engine. No producer yet; null until a build-id env/source is wired. Never invented.
   */
  engine_build_id?: string | null;
  /**
   * Additive v1.1. VCS commit sha of the change (webhook-scoped). null on API/MCP paths.
   */
  commit_sha?: string | null;
  /**
   * Additive v1.1. Deployment identifier. No producer on the decision_result envelope; null until that producer is wired. Never invented.
   */
  deployment_id?: string | null;
  /**
   * Additive. Decision Spec risk score (0-100) for retrieval parity. null when the issuance path did not supply a score. REQUIRED-CANDIDATE for a future major (retrieval parity) — not …
   */
  risk_score?: number | null;
  /**
   * Additive. Integer COUNT of breaking changes (never an array). null when the path did not supply a count. REQUIRED-CANDIDATE for a future major — not required in v1.
   */
  breaking_changes?: number | null;
  /**
   * Additive. REQUIRED-CANDIDATE for a future major (not required in v1). Short name list from TWO detectors: (1) governance names from change-patterns.js (same set as detected_pattern…
   */
  patterns?: string[] | null;
  /**
   * Additive. Per-name epistemic provenance for patterns[]. Present when the issuance path supplied it (and covered by decision_body_hash). null/absent on pre-provenance stored envelop…
   */
  pattern_sources?:
    | {
        /**
         * Pattern name; must appear in patterns when both are carried.
         */
        name: string;
        /**
         * Where the name came from. Closed set; unknown = fail closed for control flow.
         */
        source: 'contract_diff' | 'agent_heuristic' | 'artifact_signal';
        /**
         * measured = contract/artifact measurement with optional row refs; derived = agent heuristic with basis. Closed set; unknown = fail closed for control flow.
         */
        evidence_kind: 'measured' | 'derived';
        /**
         * Indices into same-response detected_patterns for measured records. Absent or empty when no detail rows.
         */
        detected_pattern_indices?: number[];
        /**
         * Derived only: change-engine codes that triggered the heuristic. Untranslated engine ids (e.g. response.body.scope.add). Parallel human labels live in basis_code_labels — do not rep…
         */
        basis_codes?: string[];
        /**
         * Derived only: parallel to basis_codes. Plain-text sentences from the single CODE_MAP (src/diff-code-labels.js) — no presentation markers (the PR comment renderer adds those separat…
         */
        basis_code_labels?: (string | null)[];
        /**
         * Derived only: OpenAPI location inspected when no change-engine code applies (e.g. info.version). Not our rule_id.
         */
        basis_rule_id?: string;
        /**
         * Derived only: stable versioned identifier of OUR agent rule that decided this pattern applies (e.g. agent.tool_result.shape_drift.v1). Sourced from the agent detector table — not c…
         */
        rule_id?: string;
      }[]
    | null;
  /**
   * Additive. GOVERNANCE detector detail rows (src/change-patterns.js) — the array pattern_sources[].detected_pattern_indices indexes into, so those indices resolve against a declared …
   */
  detected_patterns?:
    | {
        /**
         * Governance pattern name; appears in patterns when both are carried.
         */
        name: string;
        /**
         * Row severity from the pattern catalog (observed set: CRITICAL, HIGH, MEDIUM). NOT a closed control enum — branch on execution_action, never on this.
         */
        severity: string;
        /**
         * What the detector matched. Untrusted free text.
         */
        description: string;
        /**
         * What breaks for a consumer if this ships. Untrusted free text.
         */
        consequence: string;
        /**
         * Contract path this row is about. Empty string when the detector had none — the key is always emitted.
         */
        affected_path: string;
        /**
         * Field within affected_path. Empty string when the detector had none — the key is always emitted.
         */
        affected_field: string;
        /**
         * Optional; currently set on ENUM_NARROWING only. Request-side narrowing is agent-breaking (threaded so safe_for_agent can distinguish it). Absent when the detector did not set it.
         */
        side?: 'request' | 'response';
      }[]
    | null;
  /**
   * Additive (ID637 v5 slice 4; ID811 BOUND_ATTESTED). SERVER-authored change-set completeness claim level. Never caller-authored; never a boolean completeness:true. ATTESTED_UNVERIFIE…
   */
  completeness_mode?:
    | 'UNBOUND'
    | 'ATTESTED_UNVERIFIED'
    | 'BOUND_ATTESTED'
    | 'SERVER_DERIVED'
    | 'CROSS_VERIFIED'
    | 'DIVERGED'
    | 'UNESTABLISHABLE'
    | null;
  /**
   * Additive (ID637). Host change-set commitment (sha256: sorted-leaf root over claimed FULL changed-file set, crcs.v1). Covered by decision_body_hash. null when unbound.
   */
  change_set_commitment?: string | null;
  /**
   * Additive (ID637). Commitment algorithm id (currently 'crcs.v1'). null when unbound.
   */
  change_set_commitment_alg?: string | null;
  /**
   * Additive (ID637). Hash of the contract-discovery profile (types + globs) — shared universe so channels do not false-diverge on classification drift. Load-bearing. null when unbound…
   */
  contract_selector_hash?: string | null;
  /**
   * Additive (ID637). Claimed full changed-file count bound with the commitment. null when unbound.
   */
  completeness_count?: number | null;
  /**
   * Additive (ID637). Server-computed digest of artifacts actually submitted (always recomputed; never host-trusted). Present whenever authorize issues an envelope.
   */
  submitted_set_digest?: string | null;
  /**
   * Additive (ID637). What would upgrade a non-terminal mode (e.g. webhook_full_file_list for ATTESTED_UNVERIFIED). null when not applicable.
   */
  completeness_expected_channel?: string | null;
  /**
   * Additive (ID811). Proven key↔repo binding for the calling tenant. Context, not verdict input: does not enter the verdict_fingerprint preimage. proven:true only after POST /api/v1/b…
   */
  binding?: {
    /**
     * true only when a challenge-response bind was recorded for this tenant×repository. Never caller-authored.
     */
    proven?: boolean;
    /**
     * ISO-8601 UTC timestamp when the tenant↔repo binding was proven. null when proven is absent.
     */
    proven_at?: string | null;
  } | null;
  /**
   * Additive (ID963). Authority statement about WHO was authorized: the existing audience (key identity) plus whether the mint happened under a tenant with proven repo control. Covered…
   */
  authority?: {
    /**
     * Copy of envelope.audience ('v:' + sha256(utf8(apiKey)).hex.slice(0, 12) or null). Identifies the KEY, not the tenant.
     */
    audience: string | null;
    /**
     * bound iff a proven tenant↔repo binding existed for (tenant, context.repository) at decision time. unbound otherwise (no repo, or unproven).
     */
    tenant_scope: 'bound' | 'unbound';
    /**
     * ISO-8601 UTC timestamp of the proven binding. Present only when tenant_scope is bound. null/absent when unbound.
     */
    binding_proven_at?: string | null;
  } | null;
  /**
   * Additive (RT-P-20). SERVER-authored: whether fingerprint rebind is EXPECTED for this verdict at the merge/deploy gate. true = case-split hard-fails expected_but_absent / expected_b…
   */
  fingerprint_binding_expected?: boolean | null;
  /**
   * Additive. Branchable control core (type/reason_code/recheck_required/choices ids) frozen at issuance without receipt-authz overlay. null when not supplied. Never fabricate type=non…
   */
  required_action_core?: {
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
    /**
     * Choice ids only (not labels/outcomes), in builder order. Absent on pre-change cores; empty array only for type=none.
     */
    choices?: (
      | 'continue_monitor'
      | 're_preflight'
      | 'obtain_human_approval'
      | 'revert'
      | 'migrate'
      | 'fix_input'
      | 'escalate'
      | 'verify_receipt'
      | 're_preflight_deploy'
    )[];
  } | null;
  /**
   * Additive (ID850 v1). BLOCK-only safe-path-forward block: aggregated from remediation-taxonomy required_changes, REEVALUATE/INPUT_CHANGED next-preflight, and human_review escalation…
   */
  remediation_transaction?: {
    /**
     * Per-change remediations from remediation-taxonomy.buildRemediations (reused, not reinvented).
     */
    required_changes: {
      [k: string]: any;
    }[];
    resubmission: {
      /**
       * Same reference_fingerprint material → the same BLOCK (a fact within fingerprint_profile coverage).
       */
      unchanged_input: 'deterministic_block';
      /**
       * Changed input is eligible for a fresh preflight — NOT authorization.
       */
      modified_input: 'preflight_required';
      reference_fingerprint: string;
      /**
       * Honest name of what reference_fingerprint covers (e.g. crbundle.v1 or verdict_fp_v1). deterministic_block binds only to that coverage.
       */
      fingerprint_profile: string;
      /**
       * Explicit: modified_input never grants authorization; execution_action remains STOP until a new authorize receipt.
       */
      modified_is_not_permission?: true;
    };
    /**
     * Aligned with REEVALUATE + precondition:INPUT_CHANGED on the BLOCK next_actions path.
     */
    next_preflight_required: true;
    /**
     * Precise re-preflight scope derived from affected targets/artifacts — not the whole task.
     */
    recheck_scope: {
      [k: string]: any;
    };
    escalation: {
      path: 'human_review';
      when: 'changes_infeasible_or_disputed';
    };
  } | null;
  /**
   * User-visible scorer identity bound into the verdict fingerprint preimage (core/verdict-fingerprint scorerVersion = getPatternConfigHash():OMEGA_MODE). Single source — same string a…
   */
  scorer_version?: string | null;
  /**
   * Roadmap 898: optional policy_pin observation. match=true pin equals current; match=false real drift (non-blocking POLICY_PIN_DRIFT warning); match=null no pin set. Does not freeze …
   */
  policy_pin_status?: {
    pinned?: string | null;
    current?: string;
    match?: boolean | null;
    note?: string;
    scope?: string;
  } | null;
  /**
   * ID27 additive COUNTS (not a score). Pure function of the change-set + request graphs. Not in the verdict_fingerprint preimage (before_norm+after_norm+policy+scorer_version). Zeros …
   */
  blast_radius?: {
    endpoints: number;
    fields: number;
    params: number;
    consumers_declared: number;
    consumers_observed: number;
    graph_source: 'none' | 'declared' | 'observed' | 'declared+observed';
  };
}
/**
 * This interface was referenced by `DecisionResultEnvelope`'s JSON-Schema
 * via the `definition` "reason".
 */
export interface Reason {
  /**
   * Stable machine code from an append-only registry: codes may be added, meanings never change, codes are never renamed. Branch on this, never on message.
   */
  code: string;
  message: string;
}
/**
 * This interface was referenced by `DecisionResultEnvelope`'s JSON-Schema
 * via the `definition` "nextAction".
 */
export interface NextAction {
  /**
   * Closed on the producer side; consumer schema treats unknown types as opaque (honour the required flag).
   */
  type:
    | 'RESTORE_FIELD'
    | 'DEPRECATE_FIELD'
    | 'RELAX_CONSTRAINT'
    | 'BUMP_MAJOR'
    | 'APPLY_MIGRATION'
    | 'ROLLBACK_CHANGE'
    | 'NOTIFY_CONSUMERS'
    | 'REQUEST_APPROVAL'
    | 'REQUEST_WAIVER'
    | 'SUPPLY_MISSING_INPUT'
    | 'REEVALUATE';
  instruction: string;
  target?: string | null;
  /**
   * required=true is only emitted under REQUIRE_APPROVAL/BLOCK (schema-enforced). It gates obtaining a future ALLOW; it never authorizes autonomous execution of the action itself.
   */
  required: boolean;
  /**
   * For REEVALUATE: the machine-checkable condition that must change before re-requesting a decision. Never an immediate retry loop.
   */
  precondition?: 'INPUT_CHANGED' | 'POLICY_CHANGED' | 'APPROVAL_GRANTED' | 'WAIVER_GRANTED' | null;
}
/**
 * Deliberately OPEN: the receipt format versions independently (format_version), and Phase-1D authorization-context claims will appear here without breaking v1 validators. Unknown fo…
 *
 * This interface was referenced by `DecisionResultEnvelope`'s JSON-Schema
 * via the `definition` "receipt".
 */
export interface Receipt {
  token: string;
  format_version: string;
  key_id: string;
  /**
   * UTC Z only; optional millisecond fraction (matches the live receipt timestamp form).
   */
  issued_at: string;
}
/**
 * This interface was referenced by `DecisionResultEnvelope`'s JSON-Schema
 * via the `definition` "evidence".
 */
export interface Evidence {
  type:
    | 'CONTRACT_DIFF'
    | 'MIGRATION_ANALYSIS'
    | 'AUTH_SURFACE'
    | 'WORKFLOW_DIFF'
    | 'POLICY_RULE'
    | 'REGISTRY_CHECK'
    | 'CROSS_ARTIFACT';
  source: string;
  finding: string;
  /**
   * Consumer fallback for unknown values: treat as highest known.
   */
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}


// ── Public SDK aliases (stable names; map schema $defs → published surface) ─────────────────
/** @public Alias of schema Reason — keep import { DecisionReason } from '@coderifts/sdk'. */
export type DecisionReason = Reason;
/** @public Alias of schema Receipt — keep import { DecisionReceipt } from '@coderifts/sdk'. */
export type DecisionReceipt = Receipt;
/** @public Alias of schema Evidence — keep import { DecisionEvidence } from '@coderifts/sdk'. */
export type DecisionEvidence = Evidence;
/** Closed governance decision enum (from envelope.decision). */
export type Decision = DecisionResultEnvelope['decision'];
/** Closed execution_action enum (from envelope.execution_action). */
export type ExecutionAction = DecisionResultEnvelope['execution_action'];
