'use strict';

/**
 * The attestation cross-check speaks BOTH grant versions (1425 follow-up).
 *
 * ── WHAT WAS MEASURED ───────────────────────────────────────────────────────────────────────
 *
 * The cross-check read `gf.jti`, `gf.scope_hash` and `gf.receipt_digest` — cr.exec.v1 names. A
 * cr.exec.v2 grant carries `grant_id`, `after_payload_hash` and `receipt_hash`, so all three read
 * `undefined`. Reproduced against the REAL server grant from the end-to-end capture, paired with
 * an attestation that genuinely names it:
 *
 *     ATTEST_UNBOUND / grant_jti_mismatch
 *
 * A correct pair, refused. Functional, not a security hole — but it is the v2 path the
 * authorization-continuity chain runs on, so nothing on that path could cross-check at all.
 *
 * ── THE NONCE IS THE ONE THAT IS NOT A RENAME ───────────────────────────────────────────────
 *
 * v1 signs the RAW state_nonce. v2 signs `nonce_hash` and never carries a preimage. The
 * attestation holds the raw value, so v2 compares hash-to-hash. The tempting shortcut — "v2 has no
 * state_nonce, skip it" — would have dropped a binding while looking like a rename, so the bite
 * cases below pin it in both directions.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const att = require('../dist/cjs/execution-attestation.js');

const NONCE = 'a-real-state-nonce';
const GRANT_ID = '11111111-2222-4333-8444-555555555555';
const sha = (v) => `sha256:${crypto.createHash('sha256').update(String(v), 'utf8').digest('hex')}`;

function canonicalJson(v) {
  if (v === null) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
}

const issuer = crypto.generateKeyPairSync('ed25519');
const executor = crypto.generateKeyPairSync('ed25519');
const EXEC_KID = 'TEST-EXECUTOR';
const registry = {
  keys: [{
    kid: EXEC_KID,
    public_key_pem: executor.publicKey.export({ type: 'spki', format: 'pem' }),
    status: 'active',
    valid_from: null,
    retired_at: null,
  }],
};

/** A genuinely signed cr.exec.v2 grant. */
function mintV2(over = {}) {
  const now = Date.now();
  const body = {
    v: 'cr.exec.v2', kid: 'TEST-ISSUER', grant_id: GRANT_ID,
    receipt_hash: sha('receipt'), tenant_id: 'default', executor_id: 'demo',
    adapter_id: 'postgres.atomic', operation: 'publish', target_uri: 'db://demo/articles',
    expected_state_token: sha('state'), after_payload_hash: sha('body'),
    nonce_hash: sha(NONCE), policy_hash: sha(''), audience_hash: sha(''),
    not_before: new Date(now - 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    expires_at: new Date(now + 300000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    max_attempts: 1,
    ...over,
  };
  const sig = crypto.sign(null, Buffer.from(`crexec.v2|${canonicalJson(body)}`, 'utf8'), issuer.privateKey);
  return `${Buffer.from(JSON.stringify(body), 'utf8').toString('base64url')}.${sig.toString('base64url')}`;
}

/** A genuinely signed cr.exec.v1 grant, for the unchanged-behaviour cases. */
function mintV1(over = {}) {
  const now = Date.now();
  const body = {
    v: 'cr.exec.v1', kid: 'TEST-ISSUER', receipt_digest: sha('receipt'), scope_hash: sha('body'),
    audience: 'v:test', operation: 'publish', target_id: '', jti: GRANT_ID,
    iat: new Date(now - 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    exp: new Date(now + 300000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    state_nonce: NONCE,
    ...over,
  };
  const parts = ['crexec.v1', body.kid, body.receipt_digest, body.scope_hash, body.audience,
    body.operation, body.target_id, body.jti, body.iat, body.exp];
  if (body.state_nonce) parts.push(body.state_nonce);
  const sig = crypto.sign(null, Buffer.from(parts.join('|'), 'utf8'), issuer.privateKey);
  return `${Buffer.from(JSON.stringify(body), 'utf8').toString('base64url')}.${sig.toString('base64url')}`;
}

function mintAttest(over = {}) {
  const body = {
    v: att.ATTEST_VERSION, executor_kid: EXEC_KID, grant_jti: GRANT_ID,
    receipt_digest: sha('receipt'), scope_hash: sha('body'), state_nonce: NONCE,
    committed_at: new Date(Date.now() - 1000).toISOString(),
    ...over,
  };
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  const sig = crypto.sign(null, Buffer.from(att.attestSigningInput(body), 'utf8'), executor.privateKey)
    .toString('base64url');
  return [att.ATTEST_ENVELOPE_TAG, EXEC_KID,
    Buffer.from(JSON.stringify(body), 'utf8').toString('base64url'), sig].join('|');
}

const cross = (attestation, grant) =>
  att.verifyExecutionAttestation(attestation, { registry, intended: { grant } });

describe('attestation cross-check — cr.exec.v2', () => {
  it('the attestation alone is valid, so every result below is about the GRANT', () => {
    const r = att.verifyExecutionAttestation(mintAttest(), { registry });
    assert.equal(r.valid, true, `${r.status}/${r.reason}`);
  });

  it('REPRODUCED THEN FIXED: a matching v2 ATOMIC grant cross-checks', () => {
    const r = cross(mintAttest(), mintV2());
    assert.equal(r.valid, true, `${r.status}/${r.reason}`);
    assert.equal(r.status, 'ATTEST_VALID');
  });

  it('NOT A BYPASS: every v2 field mismatch still fails, and by its own name', () => {
    const cases = [
      ['grant_id', mintV2({ grant_id: '99999999-2222-4333-8444-555555555555' }), 'grant_jti_mismatch'],
      ['after_payload_hash', mintV2({ after_payload_hash: sha('OTHER') }), 'scope_hash_mismatch'],
      ['nonce_hash', mintV2({ nonce_hash: sha('OTHER-NONCE') }), 'state_nonce_mismatch'],
      ['receipt_hash', mintV2({ receipt_hash: sha('OTHER-RECEIPT') }), 'receipt_digest_mismatch'],
    ];
    for (const [name, grant, reason] of cases) {
      const r = cross(mintAttest(), grant);
      assert.equal(r.valid, false, `${name} passed`);
      assert.equal(r.status, 'ATTEST_UNBOUND');
      assert.equal(r.reason, reason, `${name} failed for the wrong reason`);
    }
  });

  it('THE NONCE IS A REAL BINDING, hashed rather than skipped', () => {
    // The attestation holds the preimage; the grant holds only its sha256.
    assert.equal(cross(mintAttest({ state_nonce: 'OTHER-NONCE' }), mintV2()).reason, 'state_nonce_mismatch');
    // An ATOMIC grant paired with an attestation carrying no nonce is a mismatch, as in v1.
    assert.equal(cross(mintAttest({ state_nonce: undefined }), mintV2()).reason, 'state_nonce_mismatch');
  });

  it('BEARER v2 (nonce_hash = sha256("")): both empty passes, one empty does not', () => {
    const bearer = mintV2({ nonce_hash: sha('') });
    assert.equal(cross(mintAttest({ state_nonce: undefined }), bearer).valid, true);
    assert.equal(cross(mintAttest(), bearer).reason, 'state_nonce_mismatch');
  });

  it('cr.exec.v1 is UNCHANGED — the version default is v1, absent marker included', () => {
    assert.equal(cross(mintAttest(), mintV1()).valid, true);
    assert.equal(cross(mintAttest(), mintV1({ jti: 'other' })).reason, 'grant_jti_mismatch');
    assert.equal(cross(mintAttest(), mintV1({ scope_hash: sha('OTHER') })).reason, 'scope_hash_mismatch');
    assert.equal(cross(mintAttest({ state_nonce: 'OTHER' }), mintV1()).reason, 'state_nonce_mismatch');
    // grant_fields is a hand-built object with v1 names and NO version marker: it must stay v1.
    const r = att.verifyExecutionAttestation(mintAttest(), {
      registry,
      intended: { grant_fields: { jti: GRANT_ID, scope_hash: sha('body'), state_nonce: NONCE } },
    });
    assert.equal(r.valid, true, `${r.status}/${r.reason}`);
  });

  it('the REAL server v2 grant is refused only for a reason that is TRUE of it', (t) => {
    const F = path.join(process.env.HOME || '', 'coderifts-conformance',
      'fixtures', 'recorded', 'end-to-end', 'transcript.json');
    if (!fs.existsSync(F)) {
      t.skip('the conformance end-to-end fixture is not beside this repo');
      return;
    }
    const g = JSON.parse(fs.readFileSync(F, 'utf8')).issuance;
    const body = JSON.parse(Buffer.from(g.execution_grant.split('.')[0], 'base64url').toString('utf8'));
    // An attestation naming its ids but carrying no nonce: BEFORE the fix this said
    // grant_jti_mismatch (the ids were invisible); now it says the one thing that is actually
    // wrong — the grant is ATOMIC and this attestation is not.
    const a = mintAttest({
      grant_jti: body.grant_id,
      receipt_digest: body.receipt_hash,
      scope_hash: body.after_payload_hash,
      state_nonce: undefined,
    });
    const r = att.verifyExecutionAttestation(a, { registry, intended: { grant: g.execution_grant } });
    assert.equal(r.reason, 'state_nonce_mismatch');
  });
});
