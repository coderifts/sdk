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

/**
 * Flip ONE BIT of a token's DECODED signature, and refuse to return if that changed nothing.
 *
 * ── WHY NOT `s.slice(0, -1) + 'A'` ──────────────────────────────────────────────────────────
 *
 * An Ed25519 signature is 64 bytes and base64url-encodes to 86 characters. 86 x 6 = 516 bits
 * against 512 real ones, so the FINAL CHARACTER CARRIES FOUR BITS THAT DECODE TO NOTHING. Two
 * characters whose top two bits agree encode the same signature, and 'A'..'P' all have top bits
 * 00 — so the classic "flip the last character to A/B" mutation is a NO-OP whenever the signature
 * ends in one of those sixteen. MEASURED: 16 of 64 characters, one capture in four.
 *
 * When it happens nothing is broken, the verifier accepts, and a control that names the signature
 * path passes without exercising it. It is silent, it depends on which capture is vendored, and it
 * moves on its own the next time a fixture is re-cut.
 *
 * ── SEPARATOR-AWARE, AND THAT IS NOT A DETAIL ───────────────────────────────────────────────
 *
 * Two token shapes live here: `payload.signature` (grants, receipts) and
 * `PREFIX|KID|payload|signature` (prove transcripts, posture receipts). A helper that always split
 * on '.' cut the pipe-joined transcript at the dot inside `cr.prove.transcript.v1` and rebuilt
 * everything after it as one blob — the signature did change, but so did the whole token, so the
 * case proved "a wrecked token is refused" rather than "one flipped signature bit is refused".
 * MEASURED on the vendored capture: 4 pipe-segments in, 1 out.
 *
 * A bare signature (no separator) is handled too: the whole string is the signature.
 */
function flipSignatureByte(token) {
  const sep = token.includes('|') ? '|' : (token.includes('.') ? '.' : null);
  const i = sep === null ? -1 : token.lastIndexOf(sep);
  const sig = Buffer.from(token.slice(i + 1), 'base64url');
  const out = Buffer.from(sig);
  out[0] ^= 0x01;
  // THE SELF-CHECK. A negative control whose mutation might do nothing is not a control, and this
  // is inside the helper so no future case can inherit the defect quietly.
  if (out.equals(sig)) throw new Error('flipSignatureByte: the mutation did not change the signature bytes');
  const flipped = token.slice(0, i + 1) + out.toString('base64url');
  // THE STRUCTURE GUARD, and it counts BOTH separators rather than the one chosen above. Checking
  // only the chosen separator would be the check agreeing with the decision it is meant to audit:
  // pick '.' for a pipe-joined token and the dot-count still matches while the four pipe-segments
  // collapse into one. Measured that way round, on the vendored transcript, before it was written.
  for (const s of ['|', '.']) {
    if (flipped.split(s).length !== token.split(s).length) {
      throw new Error(`flipSignatureByte: the token's ${s}-segment count changed — this mangled the `
        + 'token instead of flipping one signature bit');
    }
  }
  return flipped;
}

/** Flip one bit of a base64url SEGMENT that is not a signature — the payload. */
function flipPayloadByte(segment) {
  const raw = Buffer.from(segment, 'base64url');
  const out = Buffer.from(raw);
  out[0] ^= 0x01;
  if (out.equals(raw)) throw new Error('flipPayloadByte: the mutation did not change the payload bytes');
  return out.toString('base64url');
}

/**
 * One-byte mutations, each of which must be refused identically by both implementations.
 *
 * `MUST_BE_REFUSED` names the ones whose whole purpose is a refusal. Parity alone does not carry
 * that: two implementations agreeing that a mutated grant is GRANT_CURRENT is perfect parity and a
 * useless control — which is exactly the state the signature case was in. MEASURED: the vendored
 * grant's signature ends in 'A', the old character flip decoded to the identical 64 bytes, both
 * sides accepted, and the case passed while testing nothing.
 */
function variants(token) {
  const seg = token.split('.');
  const body = JSON.parse(Buffer.from(seg[0], 'base64url').toString('utf8'));
  const reseal = (b) => `${Buffer.from(JSON.stringify(b), 'utf8').toString('base64url')}.${seg[1]}`;
  const without = (k) => { const b = { ...body }; delete b[k]; return reseal(b); };
  return [
    ['honest', token],
    ['signature byte flipped', flipSignatureByte(token)],
    ['payload byte flipped', `${flipPayloadByte(seg[0])}.${seg[1]}`],
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

/** Every variant except the honest one is a refusal case; naming them keeps the intent explicit. */
const MUST_BE_REFUSED = new Set([
  'signature byte flipped', 'payload byte flipped', 'unknown field added', 'nonce_hash removed',
  'policy_hash removed', 'expected_state_token removed', 'after_payload_hash removed',
  'max_attempts made zero', 'target_uri made a bare id', 'target_uri scheme not allowed',
  'not_before unparseable',
]);

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
      // AND THE VERDICT ITSELF, for the cases that exist to be refused. Added together with the
      // byte-level flip because without it the fix would be invisible: a no-op mutation and a real
      // one both satisfy parity, so the suite could not tell them apart.
      if (MUST_BE_REFUSED.has(name)) {
        assert.equal(mine.valid, false,
          `${name}: agreed on, but ACCEPTED by both — the control proves nothing`);
      } else {
        assert.equal(mine.valid, true, 'the honest grant must still verify');
      }
    }
  });
});
