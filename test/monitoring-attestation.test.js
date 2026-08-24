'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
    verifyMonitoringAttestation,
    monitorAttestSigningInput,
    MONITOR_ATTEST_VERSION,
    MONITOR_ATTEST_SIGNING_PREFIX,
    MONITOR_ATTEST_ENVELOPE_TAG,
} = require('../dist/cjs/index.js');

test('MONITOR_ATTEST_VERSION / signing prefix', () => {
    assert.equal(MONITOR_ATTEST_VERSION, 'cr.monitor.attest.v1');
    assert.equal(MONITOR_ATTEST_SIGNING_PREFIX, 'crmonattest.v1');
    assert.equal(MONITOR_ATTEST_ENVELOPE_TAG, 'cr.monitor.attest.v1');
});

function issue(over = {}) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    const kid = over.kid || 'mon-k1';
    const sha256hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
    const rd = over.receipt_digest || ('sha256:' + sha256hex('receipt.token'));
    const observed = over.observed_at || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const body = {
        v: 'cr.monitor.attest.v1',
        kid,
        decision_id: over.decision_id || 'dec_1',
        receipt_digest: rd,
        delivery_status: over.delivery_status || 'delivered_acked',
        sink_kind: over.sink_kind || 'callback',
        observed_at: observed,
    };
    if (over.ack_digest) body.ack_digest = over.ack_digest;
    const input = monitorAttestSigningInput(body);
    const sig = crypto.sign(null, Buffer.from(input, 'utf8'), privateKey);
    const tok = [
        'cr.monitor.attest.v1',
        kid,
        Buffer.from(JSON.stringify(body)).toString('base64url'),
        Buffer.from(sig).toString('base64url'),
    ].join('|');
    return { tok, registry: { keys: [{ kid, public_key_pem: pem, status: 'active', valid_from: null, retired_at: null }] }, rd, kid };
}

test('verifyMonitoringAttestation: valid, bad sig, unknown kid, malformed, unbound, not_delivered', () => {
    const { tok, registry, rd } = issue();
    const ok = verifyMonitoringAttestation(tok, { registry });
    assert.equal(ok.valid, true);
    assert.equal(ok.status, 'MON_ATTEST_VALID');

    const parts = tok.split('|');
    const sigBuf = Buffer.from(parts[3], 'base64url');
    sigBuf[0] ^= 0xff;
    const bad = [...parts.slice(0, 3), sigBuf.toString('base64url')].join('|');
    const badR = verifyMonitoringAttestation(bad, { registry });
    assert.equal(badR.status, 'MON_ATTEST_INVALID_SIGNATURE');

    const unknown = verifyMonitoringAttestation(tok, { registry: { keys: [] } });
    assert.equal(unknown.status, 'MON_ATTEST_UNKNOWN_KEY');

    const malformed = verifyMonitoringAttestation('nope', { registry });
    assert.equal(malformed.status, 'MON_ATTEST_MALFORMED');

    const unbound = verifyMonitoringAttestation(tok, {
        registry,
        intended: { decision_id: 'other', receipt_digest: rd },
    });
    assert.equal(unbound.status, 'MON_ATTEST_UNBOUND');

    const nd = issue({ delivery_status: 'not_delivered' });
    const ndR = verifyMonitoringAttestation(nd.tok, { registry: nd.registry });
    assert.equal(ndR.valid, true);
    assert.equal(ndR.payload.delivery_status, 'not_delivered');
});
