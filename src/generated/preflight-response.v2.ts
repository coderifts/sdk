/**
 * DO NOT EDIT — generated from schemas/preflight-response.v2.producer.json
 *
 * Source of truth: coderifts-app/schemas/preflight-response.v2.producer.json (shape)
 *                  coderifts-app/schemas/preflight-response.v2.consumer.json (required-ness)
 * Generator:       coderifts-app/scripts/generate-preflight-response-types.js
 *
 *   node scripts/generate-preflight-response-types.js --out <path>
 *   node scripts/generate-preflight-response-types.js --out <path> --check
 *
 * Hand-editing this file will be overwritten. To change types, update the v2 schemas and
 * re-run the generator. This union was hand-maintained in src/types.ts until ID819 and drifted
 * from the schema by hand (ID804 class); src/types.ts now re-exports these names.
 *
 * Required-ness follows the CONSUMER schema (the SDK is a reader — over-claiming presence is
 * the bug this generation exists to prevent); the property set follows the PRODUCER schema.
 */

/* eslint-disable */
/* tslint:disable */

import type {
  Decision,
  ExecutionAction,
  DecisionEvidence,
  DecisionResultEnvelope,
} from './decision-result.v1.js';
import type { ChangeSetArtifactFinding } from '../types.js';
/**
 * CodeRifts preflight-response.v2 — discriminated on preflight_mode. Narrow on preflight_mode before reading mode-specific fields. Canonical contract; do not hand-edit the generated .ts.
 */
export type PreflightChangeSetResponse = AnalyzeChangeSetResponse | AuthorizeChangeSetResponse;

export interface AnalyzeChangeSetResponse {
  preflight_mode: 'analyze';
  /**
   * Closed analysis outcome set derived from engine-visible state only.
   */
  analysis_outcome: 'NO_BREAK_DETECTED' | 'BREAKS_DETECTED' | 'ANALYSIS_FAILED';
  /**
   * Analyze never authorizes; always NONE.
   */
  authorization_effect: 'NONE';
  /**
   * Analyze never grants execute permission.
   */
  may_execute: false;
  /**
   * Analyze never mints a receipt.
   */
  receipt_kind: 'NONE';
  /**
   * Decision Spec major for this response (typically '2.0').
   */
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
  meta?: {
    [k: string]: unknown;
  };
  correlation_id?: string;
  timestamp?: string;
  operation?: unknown;
  decision_basis?: unknown;
  analysis_control?: {
    [k: string]: unknown;
  };
  /**
   * GOVERNANCE detector detail rows (src/change-patterns.js; validated by decision-spec-fields.js). Row shape measured live: name, severity, description, consequence, affected_path, af…
   */
  detected_patterns?: {
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
  }[];
  /**
   * Per-change IR/detail rows from the engine (src/blast/diff-to-change.js maps these). Measured row keys: type, path, method, field, severity, description. Distinct from breaking_chan…
   */
  breaking_changes_details?: {
    /**
     * Change kind / IR type code (e.g. response.body.property.remove).
     */
    type?: string;
    path?: string;
    method?: string;
    field?: string;
    severity?: string;
    description?: string;
    [k: string]: unknown;
  }[];
  /**
   * Bundle severity axes (src/change-set.js severity_summary). Distinct axes, not contradictory. Measured keys: diff_severity, governance_severity, policy_effect, note.
   */
  severity_summary?: {
    /**
     * Structural size of the schema change.
     */
    diff_severity?: string;
    /**
     * How the rule engine rates the change.
     */
    governance_severity?: string;
    /**
     * Resulting decision effect label.
     */
    policy_effect?: string;
    note?: string;
  };
  /**
   * Tier-2 analysis mirror (src/response-envelope.js buildAnalysisTier / attachControlSurface). Dual-write of flat analysis fields present on the verdict plus remediations[]. ANALYSIS_…
   */
  analysis?: {
    [k: string]: unknown;
  };
  /**
   * Human-readable report tier (src/response-envelope.js buildHumanReport / analyze v2 stub). Measured keys: summary, breaking_highlights, suggestions, next_steps_prose.
   */
  human_report?: {
    summary?: string;
    breaking_highlights?: unknown[];
    suggestions?: unknown[];
    next_steps_prose?: string;
  };
  /**
   * Gateway/request correlation id (attachControlSurface). Set when correlation_id is present; alias of the request id. Distinct from decision_correlation_id on authorize when the enve…
   */
  request_correlation_id?: string;
  /**
   * Fingerprint-bound scorerVersion() (observation; not permission).
   */
  scorer_version?: string | null;
  calibration_version?: string | null;
  policy_pin_status?: {
    [k: string]: unknown;
  } | null;
  /**
   * ID27 additive COUNTS (not a score). Pure function of the change-set + request graphs. Not in the verdict_fingerprint preimage.
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
export interface AuthorizeChangeSetResponse {
  preflight_mode: 'authorize';
  /**
   * Compatibility mirror of control_envelope.decision (same value). Prefer control_envelope for branching; use decision as explanation only.
   */
  decision: Decision;
  /**
   * Compatibility mirror of control_envelope.execution_action (same value). Canonical branch key; unrecognised values are not permission (fail closed).
   */
  execution_action: ExecutionAction;
  /**
   * Compatibility mirror of control_envelope.safe_for_agent (same value). Not a branch key — do not branch on safe_for_agent (use execution_action).
   */
  safe_for_agent: boolean;
  /**
   * operation_authorization when a chain receipt was issued; NONE if signer unconfigured.
   */
  receipt_kind: 'operation_authorization' | 'NONE';
  chain_receipt?: string;
  /**
   * Opt-in cr.exec.v1 execution grant (PHASE-0). Issued only when include_execution_grant is true on authorize. Short-lived mutation-bound sibling of chain_receipt; never unsigned. See…
   */
  execution_grant?: string;
  chain_status?: string;
  /**
   * Proof/receipt side: decision-result.v1 envelope when the issuance path produced one (validate with decision-result.v1.producer.json). Carries fingerprints, audience, receipt / deci…
   */
  decision_result?: DecisionResultEnvelope;
  /**
   * Decision Spec major for this response (typically '2.0').
   */
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
  meta?: {
    [k: string]: unknown;
  };
  correlation_id?: string;
  timestamp?: string;
  operation?: unknown;
  decision_basis?: unknown;
  coderifts_version?: string;
  decision_semantic_hash?: unknown;
  /**
   * Branch source (control/1.0). Machine-control surface from attachControlSurface / buildControlEnvelope. Agents and @coderifts/agent-guard branch on control_envelope.execution_action…
   */
  control_envelope?: {
    [k: string]: unknown;
  };
  /**
   * GOVERNANCE detector detail rows (src/change-patterns.js; validated by decision-spec-fields.js). Row shape measured live: name, severity, description, consequence, affected_path, af…
   */
  detected_patterns?: {
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
  }[];
  /**
   * Per-change IR/detail rows from the engine (src/blast/diff-to-change.js maps these). Measured row keys: type, path, method, field, severity, description. Distinct from breaking_chan…
   */
  breaking_changes_details?: {
    /**
     * Change kind / IR type code (e.g. response.body.property.remove).
     */
    type?: string;
    path?: string;
    method?: string;
    field?: string;
    severity?: string;
    description?: string;
    [k: string]: unknown;
  }[];
  /**
   * Bundle severity axes (src/change-set.js severity_summary). Distinct axes, not contradictory. Measured keys: diff_severity, governance_severity, policy_effect, note.
   */
  severity_summary?: {
    /**
     * Structural size of the schema change.
     */
    diff_severity?: string;
    /**
     * How the rule engine rates the change.
     */
    governance_severity?: string;
    /**
     * Resulting decision effect label.
     */
    policy_effect?: string;
    note?: string;
  };
  /**
   * Tier-2 analysis mirror (src/response-envelope.js buildAnalysisTier / attachControlSurface). Dual-write of flat analysis fields present on the verdict plus remediations[]. ANALYSIS_…
   */
  analysis?: {
    [k: string]: unknown;
  };
  /**
   * Human-readable report tier (src/response-envelope.js buildHumanReport / analyze v2 stub). Measured keys: summary, breaking_highlights, suggestions, next_steps_prose.
   */
  human_report?: {
    summary?: string;
    breaking_highlights?: unknown[];
    suggestions?: unknown[];
    next_steps_prose?: string;
  };
  /**
   * Gateway/request correlation id (attachControlSurface). Set when correlation_id is present; alias of the request id. Distinct from decision_correlation_id on authorize when the enve…
   */
  request_correlation_id?: string;
  /**
   * Decision envelope correlation id (attachControlSurface). Present on authorize when decision_result.correlation_id is set. Distinct from request_correlation_id / correlation_id (req…
   */
  decision_correlation_id?: string;
  /**
   * Fingerprint-bound scorerVersion() (same as decision_result.scorer_version / FP preimage).
   */
  scorer_version?: string | null;
  /**
   * Calibration model version when set; null until a calibrated model ships.
   */
  calibration_version?: string | null;
  /**
   * policy_pin observation (898). match null=no pin; false=drift warning (non-blocking).
   */
  policy_pin_status?: {
    [k: string]: unknown;
  } | null;
  /**
   * ID27 additive COUNTS (not a score). Pure function of the change-set + request graphs. Not in the verdict_fingerprint preimage.
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

// ── Public SDK aliases (stable names; derived from the generated branches) ──────────────────
/** @public Closed analysis outcome set (analyze only; derived from engine-visible state). */
export type AnalysisOutcome = AnalyzeChangeSetResponse['analysis_outcome'];
/** @public Receipt kind on an authorize response (`operation_authorization` when a receipt was issued). */
export type AuthorizeReceiptKind = NonNullable<AuthorizeChangeSetResponse['receipt_kind']>;
/** @public The discriminator itself, as the response side declares it. */
export type PreflightResponseMode = PreflightChangeSetResponse['preflight_mode'];
