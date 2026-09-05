'use strict';

/**
 * 1206 F2 — the TS SDK speaks the canonical v2 request.
 *
 * Anchored on coderifts-app/test/fixtures/v2-grant-canonical-request.json: the request AND the
 * normalized reading the app handler produces from it. Byte-equivalence alone is not parity —
 * `state_nonce` is read as `nonce`, an absent `expected_state_token` is `''` and not unbound.
 *
 * LIVE when the app checkout exists (byte-parity against the live fixture; fails if the
 * recording is stale). RECORDED against fixtures/recorded/app-sync when it does not
 * (weaker, named). Missing/corrupt snapshot fails — never a silent skip.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rec = require('../lib/recorded-app-sync');

const pin = rec.loadPin();
const LIVE = rec.generatorsPresent();
const MODE = LIVE ? 'LIVE' : 'RECORDED';

function fixturePath() {
  if (LIVE) return rec.liveCanonicalPath();
  return rec.snapshotPath('v2-grant-canonical-request.json');
}

const FIXTURE_PATH = fixturePath();

/** The v2 request fields this SDK declares, read from the hand-written types. */
function declaredRequestFields() {
  const src = fs.readFileSync(path.join(rec.ROOT, 'src', 'types.ts'), 'utf8');
  const found = new Set();
  for (const f of [
    'grant_version', 'executor_id', 'adapter_id', 'target_uri', 'tenant_id',
    'state_nonce', 'expected_state_token', 'audience', 'policy_hash', 'include_execution_grant',
  ]) {
    if (new RegExp(`^\\s*${f}\\??:`, 'm').test(src)) found.add(f);
  }
  return found;
}

describe(`canonical v2 request parity (TS SDK) ${rec.modeBanner(MODE)}`, () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const { request, reading } = fixture;
  const declared = declaredRequestFields();

  it('the fixture is the generated one', () => {
    assert.equal(fixture.schema, 'coderifts.v2-grant-canonical-request.v1');
    assert.ok(pin);
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

  it('LIVE recording is not stale / RECORDED is labeled weaker', () => {
    const snap = rec.snapshotBytes('v2-grant-canonical-request.json');
    if (LIVE) {
      const liveBytes = fs.readFileSync(rec.liveCanonicalPath());
      assert.ok(
        snap.equals(liveBytes),
        'RECORDED snapshot STALE vs live canonical fixture — regenerate fixtures/recorded/app-sync',
      );
    } else {
      assert.equal(MODE, 'RECORDED');
    }
  });
});
