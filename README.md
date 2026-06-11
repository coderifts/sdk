# @coderifts/sdk

TypeScript client for the [CodeRifts](https://coderifts.com) API — detect breaking changes, score API agent-readiness, and monitor API stability.

## Install

```bash
npm install @coderifts/sdk@1.0.1
```

## Quick Start

```ts
import { CodeRifts } from '@coderifts/sdk';

const client = new CodeRifts({ apiKey: 'cr_live_...' });

// Diff two OpenAPI specs
const diff = await client.diff({
  old_spec: oldYaml,
  new_spec: newYaml,
});
console.log(diff.breaking_changes_count, diff.risk_level);

// Score an MCP manifest for agent readiness
const score = await client.agentReadinessScore({
  spec: mcpManifest,
  spec_type: 'mcp',
});
console.log(score.score, score.band); // 100 STRONG

// Get API stability analytics
const analytics = await client.stability({
  repo: 'myorg/api-service',
  days: 30,
});
console.log(analytics.summary.block_rate);
```

## API Reference

### `new CodeRifts(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | *required* | Your API key (`cr_live_...` or `cr_test_...`) |
| `baseUrl` | `string` | `https://app.coderifts.com` | API base URL |
| `timeout` | `number` | `30000` | Request timeout in ms |

### Methods

| Method | Description | Auth Required |
|---|---|---|
| `diff(req)` | Compare two OpenAPI specs | Yes |
| `agentReadinessScore(req)` | Score a spec for agent readiness | Yes |
| `scoreMcp(url)` | Score an MCP manifest by URL | No |
| `stability(req)` | Get API stability analytics | Yes |
| `agentPreflight(req)` | Generate tool schemas from a spec | Yes |

### Error Handling

```ts
import { ApiError, AuthError, RateLimitError, TimeoutError } from '@coderifts/sdk';

try {
  await client.diff({ old_spec, new_spec });
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log('Rate limited, retry later');
  } else if (err instanceof AuthError) {
    console.log('Invalid API key');
  } else if (err instanceof TimeoutError) {
    console.log('Request timed out');
  } else if (err instanceof ApiError) {
    console.log(err.status, err.code, err.body);
  }
}
```

## Get an API Key

Sign up at [app.coderifts.com/api/signup](https://app.coderifts.com/api/signup) — the free tier includes 50 requests/month.

## License

MIT
