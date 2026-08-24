# Changelog

All notable changes to `@coderifts/sdk` are documented here.

## [3.6.0]

Audit P1-2 — the shipped server-derivation and ATOMIC-grant features are now reachable from the
SDK. Additive: existing caller-artifacts code compiles and behaves unchanged.

### Added
- **`PreflightChangeSetRequest` is now a discriminated union** of `CallerArtifactsRequest`
  (`artifacts` required, `derivation?: never`) and `ServerDerivedRequest`
  (`derivation: 'server'`, `artifacts?: never`, `context.repository`/`base`/`head` required).
  Mixing the modes is a **compile error**, mirroring the server's 400s: `INVALID_INPUT`
  ("one source of truth per request") for artifacts + derivation, and
  `derivation_requires_base_head` for a derived request without base and head.
- **`state_nonce?: string` on the request** — the ATOMIC-profile nonce is a REQUEST INPUT, not a
  server echo. Obtain it from your executor's state-challenge; with `include_execution_grant`
  the server copies it into the signed grant as a separate signed field (not folded into
  `scope_hash`). Absent => BEARER grant.
- **Response types** `DerivationEnvelope` (`source`/`base_sha`/`head_sha`, present only on the
  derived path), `AuthorityEnvelope` (`audience`/`tenant_scope`/`binding_proven_at`), and
  `CompletenessMode` including `SERVER_DERIVED`.
- `test/types/preflight-request-modes.types.ts` — 9 `@ts-expect-error` assertions; each fails the
  build if a negative case ever starts compiling.

### Notes
- No new HTTP behaviour and no client-side validation: the server remains the authority. The
  union exists to fail fast at compile time, not to duplicate policy.

## [3.5.0]

Additive — `cr.monitor.attest.v1` offline verifier. Existing callers unchanged.

### Added
- **`verifyMonitoringAttestation(token, { registry, intended? })`** — customer-pinned
  monitoring-key registry (required; no default fetch). Statuses
  `MON_ATTEST_VALID` | `MON_ATTEST_INVALID_SIGNATURE` | `MON_ATTEST_UNKNOWN_KEY` |
  `MON_ATTEST_RETIRED_KEY_VALID_AT_ISSUE` | `MON_ATTEST_MALFORMED` |
  `MON_ATTEST_UNBOUND`. Retired-key rule is receipt class (historical).
- **`monitorAttestSigningInput`**, **`MONITOR_ATTEST_VERSION`**
  (`cr.monitor.attest.v1`). Mirrors app kernel
  `src/verdict-core/monitoring-attestation.js`.

## [3.2.0]

Additive — optional `base` / `head` (PR/commit SHAs) on the typed preflight
context and verify-receipt intended-context. Existing callers unchanged.

### Added
- **`PreflightChangeSetContext.base?` / `.head?`** — source SHAs folded into
  the change-set fingerprint / signed envelope when supplied.
- **`VerifyReceiptIntendedContext.base?` / `.head?`** — intended source SHAs
  for signed-wins authorization (`head_mismatch` / `base_mismatch`).

## [2.0.0]

**Breaking** — Decision Spec v2 alignment. The live server requires top-level
`preflight_mode` on `POST /api/v1/preflight` (HTTP 400 if omitted). SDK 1.2.0 did
not send it, so every `preflightChangeSet` call 400ed (P0).

### Breaking
- **`PreflightChangeSetRequest.preflight_mode` is required** (`'analyze' | 'authorize'`).
  Callers of `preflightChangeSet` must pass it; TypeScript now fails at compile time
  instead of HTTP 400 at runtime. Not nested under `context`.

### Added
- **`PreflightMode`** — `'analyze' | 'authorize'`.
- **`analyzeChangeSet(req)`** — thin wrapper that sets `preflight_mode: 'analyze'`
  (informational risk only; not permission).
- **`authorizeChangeSet(req)`** — thin wrapper that sets `preflight_mode: 'authorize'`.
  Requires non-empty `context.operation` on the server (400 otherwise).
- **`PreflightChangeSetBody`** — `Omit<PreflightChangeSetRequest, 'preflight_mode'>`
  for the wrappers.

## [1.1.1]

Patch — build fix only. No API, type, or runtime-behavior changes (additive-safe; the public
surface is identical to 1.1.0).

### Fixed
- **ESM build now runs under pure Node ESM.** The `dist/esm` output failed with
  `ERR_MODULE_NOT_FOUND` (e.g. `.../dist/esm/client`) when imported by a Node ESM consumer
  (`import`/`.mjs`), because Node's ESM loader requires explicit file extensions on relative
  imports and the `tsc` output omitted them. Added explicit `.js` extensions to all relative
  imports in `src/*.ts`, so both `dist/esm` (ESM) and `dist/cjs` (CJS, which already resolved
  extensionless) emit fully-specified specifiers. `import('@coderifts/sdk')` and
  `require('@coderifts/sdk')` both resolve.
- **Dual per-directory `package.json` type markers** (`dist/esm/package.json` `{"type":"module"}`
  and `dist/cjs/package.json` `{"type":"commonjs"}`), written by a post-build step. The root
  `package.json` has no top-level `"type"`, so without these markers Node 18/20 (which lack ESM
  syntax-detection) would parse `dist/esm/*.js` as CommonJS and throw `SyntaxError` on `export`.
  The markers make each tree's module system explicit, honestly satisfying `engines.node >= 18`
  on every supported Node — not just Node ≥ 22.7.

## [1.1.0] — unreleased

Additive release — the existing 1.0.1 methods and types are unchanged (frozen public API).

### Added
- **`preflightChangeSet(request)`** — multi-artifact bundle preflight (`POST /api/v1/preflight`),
  returning one aggregated decision, a bundle fingerprint, per-artifact findings, and a
  `decision-result.v1.1` envelope + chain receipt.
- **`verifyReceipt(token)`** — verify a chain receipt's signature/integrity (`POST /api/v1/verify-receipt`,
  no API key required); returns `{ valid, status, reason, payload? }` with the 12-status taxonomy.
- **`getDecisionDetails(request)`** — look up a stored decision by `decision_id` or `fingerprint`
  (`POST /api/v1/decisions/lookup`).
- **`readDecision(response)`** — pure, fail-closed helper that reads `execution_action` from an
  envelope-or-top-level response (envelope-first → top-level → `decision`-map → `STOP`). Never throws.
- Envelope types: `DecisionResultEnvelope`, `ExecutionAction`, `Decision`, `ReceiptStatus`,
  `DecisionReceipt`, `DecisionEvidence`, `DecisionReason`, `NextAction`, `Artifact`,
  `PreflightChangeSetRequest`/`Response`, `VerifyReceiptResponse`, `DecisionLookupRequest`/`Response`,
  `ReadDecisionResult`.
- First test suite (`node --test`): `readDecision` matrix + client request-shape (mock fetch).

## [1.0.1]

Agent Governance SDK — `preflightCheck`, `diff`, `explainDecision`, `howToUnblock`, `scoreMcp`,
`getLedger`, `simulatePolicy`. Dual ESM + CJS build. (Source of truth restored from the published
dist; see the reconstruction commit.)
