# @coderifts/sdk

Agent Governance SDK for the [CodeRifts](https://coderifts.com) API. Validate API changes before tool invocations in AI agent infrastructure (LangChain, AutoGen, Copilot, Claude, Grok, etc.).

## Installation

```bash
npm install @coderifts/sdk
```

Current package: **3.8.0**.

## Quick Start

`authorizeChangeSet` is the operation-bound entry point: it fixes
`preflight_mode: 'authorize'`, so `decision`, `execution_action` and `safe_for_agent`
are present without narrowing, and it may mint a signed receipt.

```typescript
import { CodeRifts } from '@coderifts/sdk';

const client = new CodeRifts({ apiKey: 'cr_live_...' });

const result = await client.authorizeChangeSet({
  artifacts: [
    { id: 'api', type: 'openapi', before: oldYaml, after: newYaml },
  ],
  context: { operation: 'merge' },   // required on authorize (HTTP 400 without it)
});

// Branch on execution_action only. It is a closed set:
// CONTINUE | CONTINUE_WITH_MONITORING | REQUEST_APPROVAL | STOP.
// Anything unrecognised is not permission — fail closed.
if (result.execution_action !== 'CONTINUE') {
  console.error('Halted:', result.execution_action, result.decision);
  process.exit(1);
}
```

### Two request modes

**Server-derived (the production path)** — the server lists the change set from the repository,
so you never assemble `artifacts[]`:

```typescript
const result = await client.authorizeChangeSet({
  derivation: 'server',
  context: { repository: 'owner/repo', base: 'main', head: 'feature', operation: 'merge' },
});
```

**Caller-supplied artifacts** — you assemble the complete base→head set yourself:

```typescript
const result = await client.authorizeChangeSet({
  artifacts: [{ id: 'api', type: 'openapi', before: oldYaml, after: newYaml }],
  context: { operation: 'merge' },
});
```

The two are mutually exclusive and the types enforce it: passing `artifacts` alongside
`derivation: 'server'`, or omitting `repository`/`base`/`head` from a derived request, is a
**compile error** rather than a 400 at runtime.

For an ATOMIC-profile grant, pass the nonce from your executor's state-challenge:

```typescript
await client.authorizeChangeSet({
  derivation: 'server',
  context: { repository: 'owner/repo', base: 'main', head: 'feature', operation: 'deploy' },
  include_execution_grant: true,
  state_nonce: nonceFromStateChallenge,
});
```

For risk inspection that is explicitly **not** permission, use `analyzeChangeSet`: the
analyze branch carries no `decision` / `execution_action` / `safe_for_agent` by protocol.

## Methods

### `preflightCheck(options)` — legacy single-spec path

Still shipped and supported. It takes one `old_spec` / `new_spec` pair plus a `tool_name`
and calls `POST /api/v1/agent/preflight`.

For new integrations prefer `authorizeChangeSet` / `analyzeChangeSet`: they take a
multi-artifact change set (OpenAPI, GraphQL, gRPC, AsyncAPI, MCP manifest) in one call and
carry the Decision Spec v2 mode discriminator, so risk inspection cannot be mistaken for
permission.

```typescript
const result = await client.preflightCheck({
  tool_name: 'get_refund_status',
  old_spec: '...',
  new_spec: '...',
});
// result.execution_action: 'CONTINUE' | 'CONTINUE_WITH_MONITORING' | 'REQUEST_APPROVAL' | 'STOP'
// result.decision?: 'BLOCK' | 'REQUIRE_APPROVAL' | 'WARN' | 'ALLOW'  // prose; absent if the server omitted it
// result.omega_api: number
// result.safe: boolean  // 3.9.0 fail-closed: true ONLY on an explicit CONTINUE.
//                       // Means "we verified it is safe", not "we saw no reason it is not".
//                       // Not the control input — branch on execution_action via readDecision.
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

### `explainDecision` / `howToUnblock` — prose, not gates

See [Reading a decision](#reading-a-decision-start-here). These two helpers
render copy from `execution_action`. They are not permission checks.

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

### `preflightChangeSet(request)` / `analyzeChangeSet` / `authorizeChangeSet`

Preflight a multi-artifact change set (`POST /api/v1/preflight`). **Required** top-level
`preflight_mode: 'analyze' | 'authorize'` (Decision Spec v2; server returns 400 if omitted).

Prefer the wrappers so the two meanings cannot be mixed:

```typescript
// Risk-only (informational — not permission)
const risk = await client.analyzeChangeSet({
  artifacts: [{ id: 'payments', type: 'openapi', before: oldSpec, after: newSpec }],
});

// Operation-bound authorize (requires context.operation; may mint a receipt)
const auth = await client.authorizeChangeSet({
  artifacts: [{ id: 'payments', type: 'openapi', before: oldSpec, after: newSpec }],
  context: { operation: 'merge', environment: 'production' },
  idempotency_key: 'pr-1234',
});

// Or set the mode explicitly:
const res = await client.preflightChangeSet({
  preflight_mode: 'authorize',
  artifacts: [{ id: 'payments', type: 'openapi', before: oldSpec, after: newSpec }],
  context: { operation: 'merge' },
});
```

### `verifyReceipt(token)`

Verify a chain receipt's signature and integrity. **No API key required** (public endpoint).
`POST /api/v1/verify-receipt`. Expiry uses 30s clock-skew leeway
(`CLOCK_SKEW_LEEWAY_MS`); 0s for destructive operations in production when the
intended context declares them. The SDK does not compare expiry locally — the
server does. Unknown intended-context keys are dropped by the REST route (not 400).

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

## Reading a decision (start here)

`readDecision(response)` is the one correct entry point for turning any
CodeRifts response into a go / no-go. It is fail-closed.

```typescript
import { CodeRifts, readDecision } from '@coderifts/sdk';

const client = new CodeRifts({ apiKey: 'cr_live_...' });
const response = await client.authorizeChangeSet({
  artifacts,
  context: { operation: 'deploy' },
});

const read = readDecision(response);
if (read.executionAction === 'CONTINUE') {
  deploy();
} else if (read.executionAction === 'CONTINUE_WITH_MONITORING') {
  deployWithMonitoring();
} else {
  // REQUEST_APPROVAL, STOP, or anything unreadable
  halt(read.decision, read.reason);
}
```

**`execution_action` is the control input.** `decision` (`ALLOW` / `WARN` /
`REQUIRE_APPROVAL` / `BLOCK`) is the governance *explanation* label: log it,
print it, put it in a PR comment — never branch on it. That is the agent-host
rule `not_for_control_flow_use_execution_action`, and `@coderifts/conformance`
ships a deliberately-wrong `branch-on-decision` subject that the suite fails.

Resolution order, and what falls closed:

| Input | Result |
|-------|--------|
| `decision_result.execution_action` (envelope) | that action, plus `envelope` / `receipt` |
| top-level `execution_action` | that action |
| unknown / misspelled / lowercase action | `STOP`, `reason: 'UNREADABLE_DECISION'` |
| `{}`, `null`, a string, an error body | `STOP`, `reason: 'UNREADABLE_DECISION'` |
| `decision` only (v1 compatibility arm, sunset 2026-09-07) | mapped action (`ALLOW` → `CONTINUE`, …) |
| an **analyze** response | `STOP` — analyze is informational, not permission |

`readDecision` never throws, so a guard may call it on any value.

**What it does not do: it does not verify a receipt.** A returned `receipt` is
transported, not validated.

The v1 `{decision:"ALLOW"} → CONTINUE` arm stays in the **normaliser** until
the 2026-09-07 sunset. The two advisory helpers do **not** use it: they pass
`execution_action` (or a `response` with top-level `decision` stripped) so
the forbidden field cannot drive their sentences.

### `explainDecision` / `howToUnblock` are prose, not gates

Both render human-readable copy. Neither is a permission check — always gate on
`readDecision`. Their control input is `execution_action`, passed either as a
full payload (preferred) or as the scalar:

```typescript
await client.explainDecision({ omega_api: 0.62, decision: 'BLOCK', response });
await client.howToUnblock({ decision: 'BLOCK', breaking_changes: bcs, response });
```

Given an unreadable or absent execution action they say the action is
unrecognised and must be treated as STOP. `explainDecision` never reports a
change as "safe to proceed", and `howToUnblock` never says "no unblock
needed" for an unreadable value — that wording is reserved for a readable
`CONTINUE` / `CONTINUE_WITH_MONITORING`.

## Policy delivery

File-based hosts (Claude / Cursor / Copilot / Gemini) load the CodeRifts
rule file automatically. A host that **builds its own system prompt** does
not — unless it interpolates the constant:

```typescript
import { CODERIFTS_POLICY, withPolicy, detectPolicyPresence } from '@coderifts/sdk';

const yourPrompt = 'You are a coding agent.';
const content = `${yourPrompt}\n\n${CODERIFTS_POLICY}`;

// or one line, idempotent, no in-place mutation:
const messages = withPolicy([{ role: 'system', content: yourPrompt }, { role: 'user', content: '…' }]);

const presence = detectPolicyPresence(content); // 'detected' | 'absent' | 'unknown'
```

Three layers (the guard ships the same constant and a `systemPrompt`
observation on the outcome):

1. **`withPolicy`** — append if the marker is not already present.
2. **`CODERIFTS_POLICY`** — one import, one interpolation.
3. **`detectPolicyPresence`** — last net. Nothing supplied → `unknown`, no
   warn. Marker absent → once-per-process warn. Marker found → silent.

This proves the **text is present**, not that the model read or obeyed it.

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
