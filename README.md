# @coderifts/sdk

Agent Governance SDK for the [CodeRifts](https://coderifts.com) API. Validate API changes before tool invocations in AI agent infrastructure (LangChain, AutoGen, Copilot, Claude, Grok, etc.).

## Installation

```bash
npm install @coderifts/sdk@1.0.1
```

## Quick Start

```typescript
import { CodeRifts } from '@coderifts/sdk';

const client = new CodeRifts({ apiKey: 'cr_live_...' });

const result = await client.preflightCheck({
  tool_name: 'get_refund_status',
  old_spec: oldYaml,
  new_spec: newYaml,
});

if (!result.safe) {
  console.error('Blocked:', result.decision, result.reflex_triggers);
  process.exit(1);
}
```

## Methods

### `preflightCheck(options)`

Check whether it is safe to proceed with a tool invocation.

```typescript
const result = await client.preflightCheck({
  tool_name: 'get_refund_status',
  old_spec: '...',
  new_spec: '...',
});
// result.decision: 'BLOCK' | 'REQUIRE_APPROVAL' | 'WARN' | 'ALLOW'
// result.omega_api: number
// result.safe: boolean
// result.reflex_triggers: Array<{ rule: string; decision: string }>
// result.affected_tools: Array<{ tool_name: string; status: string }>
```

### `diff(options)`

Full analysis of two OpenAPI specs.

```typescript
const result = await client.diff({
  before: '...',
  after: '...',
});
// result.omega_decision: string
// result.risk_score: number
// result.breaking_changes: BreakingChange[]
// result.should_block: boolean
```

### `explainDecision(options)`

Human-readable explanation of why a decision was made.

```typescript
const explanation = await client.explainDecision({
  omega_api: 43.95,
  decision: 'BLOCK',
  reflex_triggers: [...],
});
// explanation.summary: string
// explanation.components: Array<{ name: string; value: number; description: string }>
```

### `howToUnblock(options)`

Actionable steps to resolve a BLOCK decision.

```typescript
const steps = await client.howToUnblock({
  decision: 'BLOCK',
  breaking_changes: [...],
  detected_patterns: [...],
});
// steps.actions: Array<{ step: number; description: string; code_example?: string }>
```

### `scoreMcp(manifest)`

Score an MCP manifest for agent safety.

```typescript
const score = await client.scoreMcp({
  manifest: { tools: [...] },
});
// score.overall_score: number (0-100)
// score.band: 'STRONG' | 'GOOD' | 'NEEDS_WORK' | 'POOR' | 'CRITICAL'
```

### `getLedger(options)`

Query compliance ledger entries.

```typescript
const ledger = await client.getLedger({
  repo: 'owner/repo',
  decision: 'BLOCK',
  limit: 10,
});
// ledger.entries: LedgerEntry[]
// ledger.total: number
```

### `simulatePolicy(options)`

Test a YAML policy against two OpenAPI specs.

```typescript
const result = await client.simulatePolicy({
  policy_yaml: '...',
  old_spec: '...',
  new_spec: '...',
});
// result.effective_action: string
// result.matched_rules: MatchedRule[]
```

## Envelope-aware methods (v1.1.0)

These return the `decision-result.v1.1` envelope with a top-level `execution_action`
(`CONTINUE` | `CONTINUE_WITH_MONITORING` | `REQUEST_APPROVAL` | `STOP`) and a signed chain receipt.

### `preflightChangeSet(request)`

Preflight a multi-artifact change set in one call — one aggregated decision (strictest-wins) plus a
bundle fingerprint, per-artifact findings, and a `decision_result` envelope. `POST /api/v1/preflight`.

```typescript
const res = await client.preflightChangeSet({
  artifacts: [{ id: 'payments', type: 'openapi', before: oldSpec, after: newSpec }],
  context: { operation: 'merge', environment: 'production' },
  idempotency_key: 'pr-1234',
});
// res.decision, res.execution_action, res.bundle_fingerprint, res.decision_result, res.artifacts[]
```

### `verifyReceipt(token)`

Verify a chain receipt's signature and integrity. **No API key required** (public endpoint).
`POST /api/v1/verify-receipt`.

```typescript
const v = await client.verifyReceipt(receiptToken);
// v.valid (boolean), v.status ('VERIFIED_CURRENT' | 'VERIFIED_EXPIRED' | ...), v.payload?
```

### `getDecisionDetails(request)`

Look up a stored decision by `decision_id` or `fingerprint`; returns the stored envelope + meta.
`POST /api/v1/decisions/lookup`.

```typescript
const d = await client.getDecisionDetails({ decision_id: 'dec_...' });
// d.decision_result (DecisionResultEnvelope), d.meta
```

### `readDecision(response)`

Pure helper (no network) to read a governance decision from **any** CodeRifts response, fail-closed.
Envelope-first, then top-level `execution_action`, then a `decision`→action map, else `STOP`. Never throws.

```typescript
import { readDecision } from '@coderifts/sdk';

const { executionAction, decision, envelope, receipt } = readDecision(res);
if (executionAction === 'STOP' || executionAction === 'REQUEST_APPROVAL') {
  // block or gate the tool call
}
```

## Error Handling

All methods throw a typed `CodeRiftsError` on non-2xx responses:

```typescript
import { CodeRifts, CodeRiftsError } from '@coderifts/sdk';

try {
  const result = await client.preflightCheck({ ... });
} catch (err) {
  if (err instanceof CodeRiftsError) {
    console.error(err.code, err.message);
  }
}
```

## Documentation

Full API documentation: [https://coderifts.com/docs](https://coderifts.com/docs)

## License

MIT
