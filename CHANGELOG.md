# Changelog

All notable changes to `@coderifts/sdk` are documented here.

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
