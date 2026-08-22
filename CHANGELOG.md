# Changelog

All notable changes to `@coderifts/sdk` are documented here.

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
