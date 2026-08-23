'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
    verifyExecutionAttestation,
    ATTEST_VERSION,
    ATTEST_SIGNING_PREFIX,
    ATTEST_ENVELOPE_TAG,
} = require('../dist/cjs/index.js');

test('ATTEST_VERSION / signing prefix', () => {
    assert.equal(ATTEST_VERSION, 'cr.exec.attest.v1');
    assert.equal(ATTEST_SIGNING_PREFIX, 'crexecattest.v1');
    assert.equal(ATTEST_ENVELOPE_TAG, 'cr.exec.attest.v1');
});

test('verifyExecutionAttestation: valid, bad sig, unknown kid, malformed, unbound jti', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    const kid = 'exec-k1';
    const sha256hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
    const rd = 'sha256:' + sha256hex('receipt.token');
    const sh = 'sha256:' + sha256hex('scope');
    const committed = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const body = {
        v: 'cr.exec.attest.v1',
        executor_kid: kid,
        grant_jti: 'j1',
        receipt_digest: rd,
        scope_hash: sh,
        committed_at: committed,
        state_nonce: '',
        result_digest: '',
    };
    const input = [
        'crexecattest.v1', kid, 'j1', rd, sh, '', committed, '',
    ].join('|');
    const sig = crypto.sign(null, Buffer.from(input, 'utf8'), privateKey);
    const tok = [
        'cr.exec.attest.v1',
        kid,
        Buffer.from(JSON.stringify({
            v: body.v, executor_kid: kid, grant_jti: 'j1',
            receipt_digest: rd, scope_hash: sh, committed_at: committed,
        })).toString('base64url'),
        Buffer.from(sig).toString('base64url'),
    ].join('|');
    const registry = {
        keys: [{ kid, public_key_pem: pem, status: 'active', valid_from: null, retired_at: null }],
    };
    const ok = verifyExecutionAttestation(tok, { registry });
    assert.equal(ok.status, 'ATTEST_VALID');
    assert.equal(ok.valid, true);

    const malformed = verifyExecutionAttestation('nope', { registry });
    assert.equal(malformed.status, 'ATTEST_MALFORMED');

    const unknown = verifyExecutionAttestation(tok, { registry: { keys: [] } });
    assert.equal(unknown.status, 'ATTEST_UNKNOWN_KEY');

    const parts = tok.split('|');
    const sigBuf = Buffer.from(parts[3], 'base64url');
    sigBuf[0] ^= 0xff;
    const bad = verifyExecutionAttestation([...parts.slice(0, 3), sigBuf.toString('base64url')].join('|'), { registry });
    assert.equal(bad.status, 'ATTEST_INVALID_SIGNATURE');

    const unbound = verifyExecutionAttestation(tok, {
        registry,
        intended: { grant_fields: { jti: 'other', scope_hash: sh, receipt_digest: rd } },
    });
    assert.equal(unbound.status, 'ATTEST_UNBOUND');
    assert.equal(unbound.valid, false);
});

test('retired-key-valid-at-issue PASSES as historical', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    const kid = 'exec-old';
    const committed = '2026-06-15T12:00:00Z';
    const rd = 'sha256:' + 'aa'.repeat(32);
    const sh = 'sha256:' + 'bb'.repeat(32);
    const body = {
        v: 'cr.exec.attest.v1', executor_kid: kid, grant_jti: 'j1',
        receipt_digest: rd, scope_hash: sh, committed_at: committed,
    };
    const input = ['crexecattest.v1', kid, 'j1', rd, sh, '', committed, ''].join('|');
    const sig = crypto.sign(null, Buffer.from(input, 'utf8'), privateKey);
    const tok = [
        'cr.exec.attest.v1', kid,
        Buffer.from(JSON.stringify(body)).toString('base64url'),
        Buffer.from(sig).toString('base64url'),
    ].join('|');
    const registry = {
        keys: [{
            kid, public_key_pem: pem, status: 'retired',
            valid_from: '2026-01-01T00:00:00Z', retired_at: '2026-12-01T00:00:00Z',
        }],
    };
    const r = verifyExecutionAttestation(tok, { registry, now: Date.parse('2026-07-01T00:00:00Z') });
    assert.equal(r.status, 'ATTEST_RETIRED_KEY_VALID_AT_ISSUE');
    assert.equal(r.valid, true);
});
