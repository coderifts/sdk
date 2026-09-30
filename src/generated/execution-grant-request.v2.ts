/**
 * DO NOT EDIT — generated from schemas/execution-grant-request.v2.producer.json
 *
 * Source of truth: coderifts-app/schemas/execution-grant-request.v2.producer.json
 * Generator:       coderifts-app/scripts/generate-grant-request-types.js
 *
 *   node scripts/generate-grant-request-types.js --out <path>
 *   node scripts/generate-grant-request-types.js --out <path> --check
 *
 * The fields the authorize handler READS when minting a cr.exec.v2 grant
 * (coderifts-app src/change-set.js:1209-1300). Two things this type deliberately
 * does NOT describe:
 *   - issuer-minted fields (jti, expires_at, after_payload_digest, …) — they are
 *     derived from the signed receipt, never sent;
 *   - policy_hash / audience_hash — sent by some clients today, not read by the
 *     server; the index signature keeps them assignable while that stays undecided.
 */

/* eslint-disable */
/* tslint:disable */
/**
 * CodeRifts execution-grant REQUEST v2 (PRODUCER schema → TypeScript). Fields the authorize handler reads; do not hand-edit the generated .ts.
 */
export interface ExecutionGrantRequestV2 {
  /**
   * Gates the whole grant path. Strictly the boolean `true`: any other value (including the string "true") mints no grant.
   */
  include_execution_grant: boolean;
  /**
   * `v2` selects the cr.exec.v2 issuer. 1344 MIGRATION: absent resolves through the dated grant-version default — cr.exec.v1 before 2026-09-18, cr.exec.v2 on and after. An explicit val…
   */
  grant_version?: 'v1' | 'v2';
  /**
   * camelCase alias of grant_version, read by the same handler. Declared because the handler reads it, not because it is recommended. Same dated default as grant_version (no JSON Schem…
   */
  grantVersion?: 'v1' | 'v2';
  /**
   * Read from the request, else `context.tenant_id`, else `default`. The default is a real value, not an absence: an unset tenant is issued as `default`, it is not left unbound.
   */
  tenant_id?: string;
  /**
   * Read from the request, else `context.executor_id`, else `local`.
   */
  executor_id?: string;
  /**
   * Read from the request, else `context.adapter_id`, else `fs`.
   */
  adapter_id?: string;
  /**
   * Read from the request, else `context.target_uri`, else a derived `git://{context.repository||'local/repo'}@{context.head_sha||'unknown'}`. The derived form is a fallback, not a bin…
   */
  target_uri?: string;
  /**
   * Non-empty string only; anything else becomes null and the grant is issued without a nonce.
   */
  state_nonce?: string;
  /**
   * A non-empty string, else the empty string. Empty string is the issued value when absent; there is no unbound state.
   */
  expected_state_token?: string;
  /**
   * ONLY the measured `v:<12 hex>` form is accepted; any other string is discarded to null rather than trusted as identity. A free-form caller-supplied name is never an audience.
   */
  audience?: string;
  /**
   * The policy identity this request is made under, bound into the signed grant. A value already prefixed `sha256:` is carried through; anything else is hashed. Absent → the issuer's s…
   */
  policy_hash?: string;
  /**
   * The request context object. Only the keys the grant path reads are declared; the handler reads many others for unrelated purposes and tolerates the rest, so additionalProperties st…
   */
  context?: {
    /**
     * REQUIRED for preflight_mode=authorize; the handler throws a typed input error without one. Authorization asks permission for a named operation.
     */
    operation?: string;
    /**
     * Carried onto the envelope. Not a grant field; read by the same handler on the same request.
     */
    environment?: string;
    /**
     * v1 grant target fallback; the v2 branch uses target_uri instead.
     */
    target_id?: string;
    /**
     * Fallback when input.target_uri is absent.
     */
    target_uri?: string;
    /**
     * Fallback when input.executor_id is absent.
     */
    executor_id?: string;
    /**
     * Fallback when input.adapter_id is absent.
     */
    adapter_id?: string;
    /**
     * Fallback when input.tenant_id is absent.
     */
    tenant_id?: string;
    /**
     * Feeds the DERIVED target_uri when no explicit one was supplied.
     */
    repository?: string;
    /**
     * Feeds the DERIVED target_uri when no explicit one was supplied.
     */
    head_sha?: string;
    [k: string]: any;
  };
  [k: string]: any;
}
