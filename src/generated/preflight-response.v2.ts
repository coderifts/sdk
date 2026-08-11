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
}
export interface AuthorizeChangeSetResponse {
  preflight_mode: 'authorize';
  decision: Decision;
  execution_action: ExecutionAction;
  safe_for_agent: boolean;
  /**
   * operation_authorization when a chain receipt was issued; NONE if signer unconfigured.
   */
  receipt_kind?: 'operation_authorization' | 'NONE';
  chain_receipt?: string;
  chain_status?: string;
  /**
   * decision-result.v1 envelope when issuance path produced one (validate with decision-result.v1.producer.json).
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
  control_envelope?: {
    [k: string]: unknown;
  };
}

// ── Public SDK aliases (stable names; derived from the generated branches) ──────────────────
/** @public Closed analysis outcome set (analyze only; derived from engine-visible state). */
export type AnalysisOutcome = AnalyzeChangeSetResponse['analysis_outcome'];
/** @public Receipt kind on an authorize response (`operation_authorization` when a receipt was issued). */
export type AuthorizeReceiptKind = NonNullable<AuthorizeChangeSetResponse['receipt_kind']>;
/** @public The discriminator itself, as the response side declares it. */
export type PreflightResponseMode = PreflightChangeSetResponse['preflight_mode'];
