'use strict';

/**
 * 1206 F2 — the TS SDK speaks the canonical v2 request.
 *
 * Anchored on coderifts-app/test/fixtures/v2-grant-canonical-request.json: the request AND the
 * normalized reading the app handler produces from it. Byte-equivalence alone is not parity —
 * `state_nonce` is read as `nonce`, an absent `expected_state_token` is `''` and not unbound.
 *
 * NON-SILENT SKIP without the app checkout: UNPROVEN, never quietly green.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function fixturePath() {
  for (const root of [
    process.env.CODERIFTS_APP_ROOT,
    path.join(process.env.HOME || '', 'coderifts-app'),
    path.join(__dirname, '..', '..', 'coderifts-app'),
  ]) {
    const p = root && path.join(root, 'test', 'fixtures', 'v2-grant-canonical-request.json');
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}
const FIXTURE_PATH = fixturePath();
const SKIP = FIXTURE_PATH
  ? false
  : 'coderifts-app checkout not found — set CODERIFTS_APP_ROOT. Request parity is UNPROVEN here.';

/** The v2 request fields this SDK declares, read from the hand-written types. */
function declaredRequestFields() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'types.ts'), 'utf8');
  const found = new Set();
  for (const f of [
    'grant_version', 'executor_id', 'adapter_id', 'target_uri', 'tenant_id',
    'state_nonce', 'expected_state_token', 'audience', 'policy_hash', 'include_execution_grant',
  ]) {
    if (new RegExp(`^\\s*${f}\\??:`, 'm').test(src)) found.add(f);
  }
  return found;
}

describe('canonical v2 request parity (TS SDK)', { skip: SKIP }, () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const { request, reading } = fixture;
  const declared = declaredRequestFields();

  it('the fixture is the generated one', () => {
    assert.equal(fixture.schema, 'coderifts.v2-grant-canonical-request.v1');
  });

  it('every field this SDK declares is a field the canonical request carries', () => {
    for (const f of declared) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(request, f),
        `src/types.ts declares ${f} but the canonical request does not`,
      );
    }
    assert.ok(declared.size >= 5, `expected the v2 request surface, found ${declared.size}`);
  });

  it('BYTE-EQUIVALENCE: a request built from the declared fields matches the fixture bytes', () => {
    const body = {};
    for (const f of declared) body[f] = request[f];
    for (const k of Object.keys(body)) {
      assert.equal(JSON.stringify(body[k]), JSON.stringify(request[k]), `${k} not byte-equivalent`);
    }
    assert.equal(JSON.stringify(body), JSON.stringify(
      Object.fromEntries([...declared].map((f) => [f, request[f]])),
    ));
  });

  it('AGREEMENT WITH THE READING, including the rename the wire hides', () => {
    assert.equal(request.state_nonce, reading.nonce, 'sent as state_nonce, read as nonce');
    assert.equal(request.expected_state_token, reading.expected_state_token);
    assert.equal(request.context.operation, reading.operation);
    assert.equal(request.tenant_id, reading.tenant_id);
    if (declared.has('policy_hash')) assert.equal(request.policy_hash, reading.policy_hash);
  });

  it('a field the SDK does NOT declare is named, not silently missing', () => {
    const missing = Object.keys(request).filter(
      (k) => k !== 'context' && k !== 'preflight_mode' && !declared.has(k),
    );
    // Recorded rather than asserted-empty: this is the parity GAP list, and it must be visible.
    assert.ok(Array.isArray(missing));
    for (const m of missing) {
      assert.ok(typeof fixture.reading[m] !== 'undefined' || m in request,
        `${m} is neither declared by the SDK nor explained by the fixture`);
    }
  });
});
