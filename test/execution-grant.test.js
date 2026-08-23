'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
    verifyExecutionGrant,
    computeScopeHash,
    GRANT_VERSION,
} = require('../dist/cjs/index.js');

test('computeScopeHash is stable; GRANT_VERSION is cr.exec.v1', () => {
    assert.equal(GRANT_VERSION, 'cr.exec.v1');
    const a = computeScopeHash({ operation: 'merge', target_id: 't', after_payload: '{"ok":true}' });
    const b = computeScopeHash({ operation: 'merge', target_id: 't', after_payload: '{"ok":true}' });
    assert.equal(a, b);
    assert.match(a, /^sha256:[a-f0-9]{64}$/);
});

test('verifyExecutionGrant rejects malformed tokens', () => {
    const r = verifyExecutionGrant('not-a-grant', { publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA\n-----END PUBLIC KEY-----' });
    assert.equal(r.valid, false);
    assert.equal(r.status, 'MALFORMED');
});

test('offline verify: valid grant GRANT_CURRENT; 1-byte after change SCOPE_MISMATCH', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    // Sign a grant body with the same pipe input as the app kernel.
    const NUL = '\x1f';
    const sha256hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
    const scope = 'sha256:' + sha256hex(['merge', 'tgt', '{"ok":true}'].join(NUL));
    const digest = 'sha256:' + sha256hex('receipt.token');
    const now = new Date();
    const iat = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const exp = new Date(now.getTime() + 300000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const body = {
        v: 'cr.exec.v1', kid: 'k1', receipt_digest: digest, scope_hash: scope,
        audience: '', operation: 'merge', target_id: 'tgt', jti: 'j1', iat, exp,
    };
    const input = ['crexec.v1', body.kid, body.receipt_digest, body.scope_hash, body.audience,
        body.operation, body.target_id, body.jti, body.iat, body.exp].join('|');
    const sig = crypto.sign(null, Buffer.from(input, 'utf8'), privateKey);
    const tok = `${Buffer.from(JSON.stringify(body)).toString('base64url')}.${Buffer.from(sig).toString('base64url')}`;
    const ok = verifyExecutionGrant(tok, {
        publicKeyPem: pem,
        intended: { operation: 'merge', target_id: 'tgt', after_payload: '{"ok":true}' },
    });
    assert.equal(ok.status, 'GRANT_CURRENT');
    assert.equal(ok.valid, true);
    const bad = verifyExecutionGrant(tok, {
        publicKeyPem: pem,
        intended: { operation: 'merge', target_id: 'tgt', after_payload: '{"ok":true}x' },
    });
    assert.equal(bad.status, 'GRANT_SCOPE_MISMATCH');
    const unbound = verifyExecutionGrant(tok, {
        publicKeyPem: pem,
        intended: { receipt_token: 'unrelated.token' },
    });
    assert.equal(unbound.status, 'GRANT_UNBOUND');
    assert.equal(unbound.valid, false);
});
