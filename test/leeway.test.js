'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    CLOCK_SKEW_LEEWAY_MS,
    expiryLeewayMs,
    declaresDestructiveProduction,
    isReceiptExpired,
    isIssuedInFuture,
} = require('../dist/cjs/index.js');

test('CLOCK_SKEW_LEEWAY_MS is 30_000', () => {
    assert.equal(CLOCK_SKEW_LEEWAY_MS, 30_000);
});

test('exp 10s past + 30s leeway is not expired (VERIFIED_CURRENT)', () => {
    const now = 1_000_000_000_000;
    assert.equal(isReceiptExpired(now - 10_000, now), false);
});

test('exp 40s past is expired (VERIFIED_EXPIRED)', () => {
    const now = 1_000_000_000_000;
    assert.equal(isReceiptExpired(now - 40_000, now), true);
});

test('destructive+prod is not guessed: production+deploy 1s past is not expired', () => {
    const now = 1_000_000_000_000;
    const ctx = { environment: 'production', operation: 'deploy' };
    assert.equal(declaresDestructiveProduction(ctx), false);
    assert.equal(expiryLeewayMs(ctx), CLOCK_SKEW_LEEWAY_MS);
    assert.equal(isReceiptExpired(now - 1_000, now, ctx), false);
});

test('non-destructive same 1s past is not expired', () => {
    const now = 1_000_000_000_000;
    assert.equal(isReceiptExpired(now - 1_000, now, { environment: 'staging', operation: 'merge' }), false);
});

test('iat 10s ahead is within leeway; 40s ahead is future (no nbf)', () => {
    const now = 1_000_000_000_000;
    assert.equal(isIssuedInFuture(now + 10_000, now), false);
    assert.equal(isIssuedInFuture(now + 40_000, now), true);
});
