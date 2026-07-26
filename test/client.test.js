'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CodeRifts } = require('../dist/cjs/index.js');

/** Run fn with global.fetch stubbed; captures the last request; always restores fetch. */
function withMockFetch(responseBody, fn) {
    const cap = {};
    const orig = global.fetch;
    global.fetch = async (url, opts) => {
        cap.url = url;
        cap.opts = opts;
        return { ok: true, status: 200, statusText: 'OK', json: async () => responseBody };
    };
    return Promise.resolve()
        .then(() => fn(cap))
        .finally(() => { global.fetch = orig; });
}

test('preflightChangeSet -> POST /api/v1/preflight (bearer auth, json body)', async () => {
    await withMockFetch({ decision: 'BLOCK', execution_action: 'STOP' }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        const res = await c.preflightChangeSet({
            artifacts: [{ id: 'api', type: 'grpc', before: 'a', after: 'b' }],
            idempotency_key: 'k1',
        });
        assert.equal(cap.url, 'https://app.coderifts.com/api/v1/preflight');
        assert.equal(cap.opts.method, 'POST');
        assert.equal(cap.opts.headers.Authorization, 'Bearer cr_test_abc');
        assert.equal(cap.opts.headers['Content-Type'], 'application/json');
        const body = JSON.parse(cap.opts.body);
        assert.equal(body.artifacts[0].id, 'api');
        assert.equal(body.idempotency_key, 'k1');
        assert.equal(res.decision, 'BLOCK');
    });
});

test('verifyReceipt -> POST /api/v1/verify-receipt with { token }', async () => {
    await withMockFetch({ valid: true, status: 'VERIFIED_CURRENT', reason: null }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        const res = await c.verifyReceipt('the-token');
        assert.equal(cap.url, 'https://app.coderifts.com/api/v1/verify-receipt');
        assert.equal(cap.opts.method, 'POST');
        assert.deepEqual(JSON.parse(cap.opts.body), { token: 'the-token' });
        assert.equal(res.status, 'VERIFIED_CURRENT');
    });
});

test('getDecisionDetails -> POST /api/v1/decisions/lookup', async () => {
    await withMockFetch({ decision: 'ALLOW', decision_result: {}, meta: {} }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        await c.getDecisionDetails({ decision_id: 'dec_1' });
        assert.equal(cap.url, 'https://app.coderifts.com/api/v1/decisions/lookup');
        assert.deepEqual(JSON.parse(cap.opts.body), { decision_id: 'dec_1' });
    });
});

test('baseUrl override applies; existing diff() is unchanged (frozen)', async () => {
    await withMockFetch({ risk_score: 0 }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc', baseUrl: 'https://example.test/' });
        await c.diff({ before: 'x', after: 'y' });
        assert.equal(cap.url, 'https://example.test/api/v1/diff');
        assert.equal(cap.opts.headers.Authorization, 'Bearer cr_test_abc');
    });
});
