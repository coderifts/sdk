'use strict';

/**
 * The SDK's v2 verifier and the shared core must agree — token for token, verdict for verdict.
 *
 * 1425 was the SDK returning MALFORMED / unsupported_version on a real cr.exec.v2 grant. The fix
 * is a mirror of receipt-verifier/verify-grant.js, because a published npm package cannot depend
 * on a repo with no package.json. A mirror nobody compares is a fork, so this compares it: same
 * tokens, same key, and the SDK must produce the same (valid, status, reason) as the core.
 *
 * HONEST SKIP when receipt-verifier is not checked out beside this repo — the SDK's own v2 cases
 * still run in the suite; what cannot run here is the cross-implementation comparison, and saying
 * so beats a green tick that means "the sibling repo was absent".
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const sdk = require('../dist/cjs/execution-grant.js');

const HOME = process.env.HOME || '';
const CORE = path.join(HOME, 'receipt-verifier');
const FIXTURE = path.join(HOME, 'coderifts-conformance', 'fixtures', 'recorded', 'end-to-end', 'transcript.json');

function loadCase() {
  const t = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const token = t.issuance.execution_grant;
  const keys = JSON.parse(fs.readFileSync(path.join(CORE, 'keys', 'coderifts-keys.json'), 'utf8'));
  const entry = keys.keys.find((k) => k.kid === t.issuance.grant.kid);
  return { token, pem: entry.public_key_pem, now: Date.parse(t.issuance.grant.not_before) + 1000 };
}

/** One-byte mutations, each of which must be refused identically by both implementations. */
function variants(token) {
  const flip = (s) => s.slice(0, -1) + (s[s.length - 1] === 'A' ? 'B' : 'A');
  const seg = token.split('.');
  const body = JSON.parse(Buffer.from(seg[0], 'base64url').toString('utf8'));
  const reseal = (b) => `${Buffer.from(JSON.stringify(b), 'utf8').toString('base64url')}.${seg[1]}`;
  const without = (k) => { const b = { ...body }; delete b[k]; return reseal(b); };
  return [
    ['honest', token],
    ['signature byte flipped', flip(token)],
    ['payload byte flipped', `${flip(seg[0])}.${seg[1]}`],
    ['unknown field added', reseal({ ...body, surprise: 'x' })],
    ['nonce_hash removed', without('nonce_hash')],
    ['policy_hash removed', without('policy_hash')],
    ['expected_state_token removed', without('expected_state_token')],
    ['after_payload_hash removed', without('after_payload_hash')],
    ['max_attempts made zero', reseal({ ...body, max_attempts: 0 })],
    ['target_uri made a bare id', reseal({ ...body, target_uri: 'articles' })],
    ['target_uri scheme not allowed', reseal({ ...body, target_uri: 'ftp://x/y' })],
    ['not_before unparseable', reseal({ ...body, not_before: 'yesterday' })],
  ];
}

describe('cr.exec.v2 — the SDK verifier vs the shared core', () => {
  it('the SDK accepts the real v2 grant (1425 reproduced: it returned MALFORMED)', () => {
    if (!fs.existsSync(FIXTURE)) return;
    const { token, pem, now } = loadCase();
    const r = sdk.verifyExecutionGrant(token, { publicKeyPem: pem, now });
    assert.equal(r.valid, true, `${r.status}/${r.reason}`);
    assert.equal(r.status, 'GRANT_CURRENT');
    assert.equal(r.payload.v, 'cr.exec.v2');
  });

  it('the SDK still binds v2 intent: a wrong executor_id is GRANT_UNBOUND', () => {
    if (!fs.existsSync(FIXTURE)) return;
    const { token, pem, now } = loadCase();
    const r = sdk.verifyExecutionGrant(token, {
      publicKeyPem: pem, now, intended: { executor_id: 'somebody-else' },
    });
    assert.equal(r.valid, false);
    assert.equal(r.status, 'GRANT_UNBOUND');
    assert.equal(r.reason, 'executor_mismatch');
  });

  it('every variant gets the SAME verdict from the SDK and from receipt-verifier', (t) => {
    if (!fs.existsSync(CORE) || !fs.existsSync(FIXTURE)) {
      t.skip(`receipt-verifier or the conformance fixture is not beside this repo — `
        + 'the SDK cases above ran; the cross-implementation comparison did not');
      return;
    }
    const { verifyExecutionGrant: core } = require(path.join(CORE, 'verify-grant.js'));
    const { token, pem, now } = loadCase();
    const publicKey = crypto.createPublicKey(pem);
    for (const [name, variant] of variants(token)) {
      const mine = sdk.verifyExecutionGrant(variant, { publicKeyPem: pem, now });
      const theirs = core(variant, { ctx: { publicKey, expectedKid: null }, now });
      assert.deepEqual(
        { valid: mine.valid, status: mine.status, reason: mine.reason || null },
        { valid: theirs.valid, status: theirs.status, reason: theirs.reason || null },
        `${name}: the SDK and the core disagree`,
      );
    }
  });
});
