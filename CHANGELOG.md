# Changelog

All notable changes to `@coderifts/sdk` are documented here.

## [3.9.0]

**BREAKING, and deliberately so.** `preflightCheck().safe` changes from fail-open
to fail-closed. This is the last fail-open in the SDK.

### The defect

`preflightCheck` did this:

```ts
const decision = raw.decision || 'ALLOW';        // an omitted field became ALLOW
safe: decision === 'ALLOW' || decision === 'WARN'
```

A server that returned no `decision` produced `safe: true`. Callers gate on this
(`if (res.safe) deploy()`), so a silent server manufactured a permission. Unlike
the 3.8.0 helpers, which produced misleading *prose*, this produced a
permission-shaped boolean in the wrong direction.

### Why breaking rather than deprecate-and-remove

Peter's call, and the reasoning is worth recording:

1. **No evidence of an external consumer gating on `safe`.** Telemetry only
   started yesterday, so a deprecation window would be a guess dressed as
   caution.
2. **This release closes a class, not a case.** Today's work removed the
   fail-open class across the SDK. Leaving one documented exception recreates
   the "almost fixed" state that two audits already found.
3. **The failure direction is asymmetric.** A halted pipeline is repairable in
   minutes. A silently-passed deploy is not. When the two error costs are that
   unequal, the default belongs on the recoverable side.

### Changed

- **`safe` is now granted, not merely un-refused.** It is derived from
  `readDecision` and is `true` only when the response carried an explicit
  `CONTINUE`. Absent, unknown, unrecognised or unreadable input yields `false`.
- **A legacy `decision`-only response no longer grants `safe`.** `readDecision`
  may still map a legacy `decision` to an action for *reading*; it may not
  *grant* a permission. New exported predicate `hasExplicitExecutionAction`
  draws that line, and keeps `safe` byte-identical to the Python SDK.
- **The fabricated `decision` local is gone.** `decision` is now passed through
  exactly as the server sent it, so `PreflightCheckResponse.decision` is
  `string | undefined` (was `string`, always populated because it was invented).
- No new vocabulary: the closed `ExecutionAction` set and `UNREADABLE_DECISION`
  from 3.7.0/3.8.0 are reused unchanged.

### Migration

Read the decision via `readDecision` and branch on `executionAction`. `safe` now
means "we verified it is safe", not "we did not see a reason it is not" — if you
gated on `safe`, a server that omits the field will now stop you instead of
waving you through.

```ts
const read = readDecision(res);
if (read.executionAction === 'CONTINUE') deploy();
```

Parity: identical semantics and failure direction to `coderifts-sdk` 3.5.0; the
`safe` parity table is duplicated verbatim in both test suites.

## [3.8.0]

Fail-open fix — `explainDecision` and `howToUnblock` rebuilt on `readDecision`.
Mirrors Python SDK 3.4.0 semantics. `readDecision` itself was already
fail-closed; these two helpers were not (3.7.0 `else` → "safe to proceed",
`decision !== 'BLOCK'` → "no unblock needed").

### Changed
- **`explainDecision` / `howToUnblock` are prose, not gates.** Control flow
  comes from `execution_action` via `readDecision`. `decision` survives in
  the summary text only — never in a branch test.
- Unknown / absent / `null` / `undefined` input → "unrecognised — treat as
  STOP". Never "safe to proceed". `howToUnblock` never says "no unblock
  needed" for an unreadable value (that wording is only for a readable
  `CONTINUE` / `CONTINUE_WITH_MONITORING`).
- Helpers do **not** use `readDecision`'s v1 `{decision:"ALLOW"} → CONTINUE`
  arm (kept in the normaliser until 2026-09-07). They pass `response` with
  top-level `decision` stripped, or `{ execution_action }` alone.
- **`PreflightCheckResponse.execution_action`** and
  **`DiffResponse.execution_action`** — the live `/agent/preflight` and
  `/diff` endpoints emit the control field top-level; the stubs hid it.
  `preflightCheck` now passes the server value through (does not invent one).

### Added
- Optional `execution_action` / `response` on the two helper request types.
- `execution_action` + `reason` on the helper responses.
- AST guard in `test/advisory.test.js` (TypeScript compiler API, already a
  devDependency): flags the published 3.7.0 helper source, clears the fixed
  `src/client.ts`.

## [3.7.0]

Policy delivery — the canonical agent-host rule text as a one-import constant
plus a presence helper, for hosts that build their own system prompt.

### Added
- **`CODERIFTS_POLICY`** — vendored from coderifts-app
  `src/agent-host-rule.js` `getCanonicalRuleText()`. Drift-gated
  byte-equal to the app (missing checkout fails loud).
- **`POLICY_MARKER`** —
  `A receipt authorizes ONE operation: a merge receipt does not authorize a deploy.`
  Present in all six generated host formats.
- **`withPolicy(prompt | messages)`** — append the policy if the marker is
  absent. Idempotent. `injectPolicy: false` opt-out. Never mutates the
  caller in place.
- **`detectPolicyPresence` / `policyPresenceOf` / `observePolicyPresence`**
  — `detected` | `absent` | `unknown`. `unknown` (nothing supplied) never
  warns. `absent` warns once per process.

Honesty: this proves the TEXT is present, not that the model read or
obeyed it. The four guard adapters do not see the outbound request; hosts
that assemble `messages` / `system` interpolate `CODERIFTS_POLICY` or call
`withPolicy` themselves.

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
