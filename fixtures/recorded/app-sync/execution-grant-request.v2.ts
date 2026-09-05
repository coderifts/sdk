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
   * Gates the whole grant path. src/change-set.js:1209 — strictly `=== true`, so any other value (including the string "true") mints no grant.
   */
  include_execution_grant: boolean;
  /**
   * src/change-set.js:1328 — `v2` selects the cr.exec.v2 issuer. 1344 MIGRATION: absent resolves through src/grant-version-default.js — cr.exec.v1 before 2026-09-18, cr.exec.v2 on and …
   */
  grant_version?: 'v1' | 'v2';
  /**
   * camelCase alias of grant_version, read at src/change-set.js:1268. Declared because the handler reads it, not because it is recommended. Same dated default as grant_version (no JSON…
   */
  grantVersion?: 'v1' | 'v2';
  /**
   * src/change-set.js:1279 — `input.tenant_id || context.tenant_id || 'default'`. The default is a real value, not an absence: an unset tenant is issued as `default`, it is not left un…
   */
  tenant_id?: string;
  /**
   * src/change-set.js:1277 — `input.executor_id || context.executor_id || 'local'`.
   */
  executor_id?: string;
  /**
   * src/change-set.js:1278 — `input.adapter_id || context.adapter_id || 'fs'`.
   */
  adapter_id?: string;
  /**
   * src/change-set.js:1276 — `input.target_uri || context.target_uri`, else a derived `git://{context.repository||'local/repo'}@{context.head_sha||'unknown'}`. The derived form is a fa…
   */
  target_uri?: string;
  /**
   * src/change-set.js:1265-1267 — non-empty string only; anything else becomes null and the grant is issued without a nonce.
   */
  state_nonce?: string;
  /**
   * src/change-set.js:1281 — `nonEmptyStr(input.expected_state_token) || ''`. Empty string is the issued value when absent; there is no unbound state.
   */
  expected_state_token?: string;
  /**
   * src/change-set.js:1120-1124 — ONLY the measured `v:<12 hex>` form is accepted; any other string is discarded to null rather than trusted as identity. A free-form caller-supplied na…
   */
  audience?: string;
  /**
   * src/change-set.js:1305 — the policy identity this request is made under, bound into the signed grant (execution-grant-v2.js:149). A value already prefixed `sha256:` is carried thro…
   */
  policy_hash?: string;
  /**
   * The request context object (src/change-set.js:806). Only the keys the grant path reads are declared; the handler reads many others for unrelated purposes and tolerates the rest, so…
   */
  context?: {
    /**
     * src/change-set.js:807-812 — REQUIRED for preflight_mode=authorize; the handler throws a typed input error without one. Authorization asks permission for a named operation.
     */
    operation?: string;
    /**
     * src/change-set.js:1159 — carried onto the envelope. Not a grant field; read by the same handler on the same request.
     */
    environment?: string;
    /**
     * src/change-set.js:1264 — v1 grant target fallback; the v2 branch uses target_uri instead.
     */
    target_id?: string;
    /**
     * src/change-set.js:1276 — fallback when input.target_uri is absent.
     */
    target_uri?: string;
    /**
     * src/change-set.js:1277 — fallback when input.executor_id is absent.
     */
    executor_id?: string;
    /**
     * src/change-set.js:1278 — fallback when input.adapter_id is absent.
     */
    adapter_id?: string;
    /**
     * src/change-set.js:1279 — fallback when input.tenant_id is absent.
     */
    tenant_id?: string;
    /**
     * src/change-set.js:1276 — feeds the DERIVED target_uri when no explicit one was supplied.
     */
    repository?: string;
    /**
     * src/change-set.js:1276 — feeds the DERIVED target_uri when no explicit one was supplied.
     */
    head_sha?: string;
    [k: string]: any;
  };
  [k: string]: any;
}
