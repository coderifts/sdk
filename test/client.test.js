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

test('preflightChangeSet -> POST /api/v1/preflight (bearer auth, json body, required preflight_mode)', async () => {
    await withMockFetch({ decision: 'BLOCK', execution_action: 'STOP' }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        const res = await c.preflightChangeSet({
            preflight_mode: 'authorize',
            artifacts: [{ id: 'api', type: 'grpc', before: 'a', after: 'b' }],
            context: { operation: 'merge' },
            idempotency_key: 'k1',
        });
        assert.equal(cap.url, 'https://app.coderifts.com/api/v1/preflight');
        assert.equal(cap.opts.method, 'POST');
        assert.equal(cap.opts.headers.Authorization, 'Bearer cr_test_abc');
        assert.equal(cap.opts.headers['Content-Type'], 'application/json');
        const body = JSON.parse(cap.opts.body);
        assert.equal(body.preflight_mode, 'authorize');
        assert.equal(body.artifacts[0].id, 'api');
        assert.equal(body.idempotency_key, 'k1');
        assert.equal(res.decision, 'BLOCK');
    });
});

test('analyzeChangeSet injects preflight_mode analyze (no authorize/receipt meaning)', async () => {
    await withMockFetch({ analysis_outcome: 'NO_BREAK_DETECTED', may_execute: false }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        await c.analyzeChangeSet({
            artifacts: [{ id: 'api', type: 'openapi', before: 'a', after: 'b' }],
        });
        const body = JSON.parse(cap.opts.body);
        assert.equal(body.preflight_mode, 'analyze');
        assert.equal(body.artifacts[0].id, 'api');
        // Mode is fixed by the method — callers omit preflight_mode on the arg
        assert.ok(!('preflight_mode' in {
            artifacts: [{ id: 'api', type: 'openapi', before: 'a', after: 'b' }],
        }));
    });
});

test('authorizeChangeSet injects preflight_mode authorize (requires context.operation on server)', async () => {
    await withMockFetch({ decision: 'ALLOW', execution_action: 'CONTINUE' }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        await c.authorizeChangeSet({
            artifacts: [{ id: 'api', type: 'openapi', before: 'a', after: 'b' }],
            context: { operation: 'merge' },
        });
        const body = JSON.parse(cap.opts.body);
        assert.equal(body.preflight_mode, 'authorize');
        assert.equal(body.context.operation, 'merge');
    });
});

test('preflightChangeSet sends the full 10-field IntentContext (additive)', async () => {
    await withMockFetch({ decision: 'ALLOW', execution_action: 'CONTINUE' }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        await c.preflightChangeSet({
            preflight_mode: 'authorize',
            artifacts: [{ id: 'api', type: 'openapi', before: 'a', after: 'b' }],
            context: {
                operation: 'merge',
                target_id: 'svc-1',
                environment: 'production',
                fingerprint: 'sha256:abc',
                audience: 'aud-1',
                repository: 'acme/api',
                branch: 'main',
                pull_request: 42,
                base: 'base-sha-aaa',
                head: 'head-sha-bbb',
            },
        });
        const body = JSON.parse(cap.opts.body);
        assert.equal(body.context.operation, 'merge');
        assert.equal(body.context.target_id, 'svc-1');
        assert.equal(body.context.environment, 'production');
        assert.equal(body.context.fingerprint, 'sha256:abc');
        assert.equal(body.context.audience, 'aud-1');
        assert.equal(body.context.repository, 'acme/api');
        assert.equal(body.context.branch, 'main');
        assert.equal(body.context.pull_request, 42);
        assert.equal(body.context.base, 'base-sha-aaa');
        assert.equal(body.context.head, 'head-sha-bbb');
    });
});

test('preflightChangeSet sends optional context.base/head (PR/commit SHAs)', async () => {
    await withMockFetch({ decision: 'ALLOW', execution_action: 'CONTINUE' }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        await c.preflightChangeSet({
            preflight_mode: 'authorize',
            artifacts: [{ id: 'api', type: 'openapi', before: 'a', after: 'b' }],
            context: {
                operation: 'merge',
                repository: 'acme/api',
                base: 'base-sha-aaa',
                head: 'head-sha-bbb',
            },
        });
        const body = JSON.parse(cap.opts.body);
        assert.equal(body.context.base, 'base-sha-aaa');
        assert.equal(body.context.head, 'head-sha-bbb');
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

/**
 * Intended context (audit part 7 #4). Without it the endpoint answers a signature question only and
 * currently_authorized comes back null; the SDK previously sent { token } and nothing else, so a
 * caller could never reach a real true/false through it — while the published snippets already
 * showed an operation-bearing call. These pin that the context now reaches the wire, and that an
 * absent field stays ABSENT rather than becoming a null the server would read as a stated intent.
 */
test('verifyReceipt sends the supplied intended context alongside the token', async () => {
    await withMockFetch({ valid: true, status: 'VERIFIED_CURRENT', reason: null, currently_authorized: true }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        const res = await c.verifyReceipt('the-token', { operation: 'merge', environment: 'production' });
        assert.deepEqual(JSON.parse(cap.opts.body), {
            token: 'the-token',
            operation: 'merge',
            environment: 'production',
        });
        assert.equal(res.currently_authorized, true);
    });
});

test('verifyReceipt carries every field the REST endpoint reads', async () => {
    await withMockFetch({ valid: true, status: 'VERIFIED_CURRENT', reason: null }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        const intended = {
            operation: 'deploy',
            target_id: 'svc-1',
            environment: 'production',
            fingerprint: 'sha256:abc',
            audience: 'aud-1',
            repository: 'owner/repo',
            branch: 'main',
            pull_request: 42,
            base: 'base-sha-aaa',
            head: 'head-sha-bbb',
            decision_result: { spec_version: 'decision-result.v1.1' },
            indices: { revoked: [] },
        };
        await c.verifyReceipt('the-token', intended);
        assert.deepEqual(JSON.parse(cap.opts.body), { token: 'the-token', ...intended });
    });
});

test('verifyReceipt omits undefined context fields — absent stays absent, never null', async () => {
    await withMockFetch({ valid: true, status: 'VERIFIED_CURRENT', reason: null }, async (cap) => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        await c.verifyReceipt('the-token', { operation: 'merge', environment: undefined, target_id: undefined });
        const body = JSON.parse(cap.opts.body);
        assert.deepEqual(body, { token: 'the-token', operation: 'merge' });
        assert.equal('environment' in body, false, 'undefined must not be sent');
        assert.equal('target_id' in body, false, 'undefined must not be sent');
    });
});

test('verifyReceipt(token) alone is unchanged — the widening is backward compatible', async () => {
    for (const second of [undefined, {}]) {
        // eslint-disable-next-line no-await-in-loop
        await withMockFetch({ valid: true, status: 'VERIFIED_CURRENT', reason: null }, async (cap) => {
            const c = new CodeRifts({ apiKey: 'cr_test_abc' });
            await (second === undefined ? c.verifyReceipt('t') : c.verifyReceipt('t', second));
            assert.deepEqual(
                JSON.parse(cap.opts.body), { token: 't' },
                `body must stay { token } for second arg ${JSON.stringify(second)}`,
            );
        });
    }
});

/**
 * Pins VerifyReceiptResponse to the live POST /api/v1/verify-receipt body.
 * Why this exists: the type previously declared only signature fields (valid/reason/status/payload?),
 * while the endpoint returns authorization fields too. The contract drifted because nothing measured
 * it — same class of failure as unpinned MCP output schemas. Fixtures are built from two live
 * measurements (no invented response shapes).
 *
 * Without intent context, keys were:
 *   valid, reason, status, payload, currently_authorized, authz_note, correlation_id
 * With { operation: 'merge', environment: 'production' }:
 *   the same seven plus authz_status and authz_reason
 *   (currently_authorized false, authz_status 'VERIFIED_SCOPE_MISMATCH',
 *    authz_reason 'receipt_context_required')
 */
test('VerifyReceiptResponse shape — required keys + currently_authorized null (live-measured contract)', async () => {
    // Keys always present (both measurements). Value content for signature fields is not fully
    // quoted in the measurement dump; keys and the quoted authz triple are what we pin.
    const withoutIntent = {
        valid: true,
        reason: null,
        status: 'VERIFIED_CURRENT',
        payload: {},
        currently_authorized: false,
        authz_note: '',
        correlation_id: '',
    };
    const withIntent = {
        ...withoutIntent,
        currently_authorized: false,
        authz_status: 'VERIFIED_SCOPE_MISMATCH',
        authz_reason: 'receipt_context_required',
    };
    const authzUnevaluated = {
        ...withoutIntent,
        currently_authorized: null, // null ≠ unauthorized; evaluation did not complete
    };

    const REQUIRED = [
        'valid',
        'reason',
        'status',
        'payload',
        'currently_authorized',
        'authz_note',
        'correlation_id',
    ];
    for (const key of REQUIRED) {
        assert.ok(Object.prototype.hasOwnProperty.call(withoutIntent, key), `without-intent must have ${key}`);
        assert.ok(Object.prototype.hasOwnProperty.call(withIntent, key), `with-intent must have ${key}`);
        assert.ok(Object.prototype.hasOwnProperty.call(authzUnevaluated, key), `null-authz fixture must have ${key}`);
    }
    assert.equal(withoutIntent.currently_authorized, false);
    assert.equal(authzUnevaluated.currently_authorized, null);
    assert.equal(typeof withoutIntent.authz_note, 'string');
    assert.equal(typeof withoutIntent.correlation_id, 'string');
    assert.equal(typeof withoutIntent.payload, 'object');
    assert.ok(withoutIntent.payload !== null);

    // Conditional pair only on the with-intent measurement
    assert.equal(withIntent.authz_status, 'VERIFIED_SCOPE_MISMATCH');
    assert.equal(withIntent.authz_reason, 'receipt_context_required');
    assert.equal(Object.prototype.hasOwnProperty.call(withoutIntent, 'authz_status'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(withoutIntent, 'authz_reason'), false);

    // Round-trip: client passes the full body through (no narrowing) — pin that the measured
    // fields survive on the returned object, including currently_authorized: null.
    await withMockFetch(authzUnevaluated, async () => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        const res = await c.verifyReceipt('the-token');
        for (const key of REQUIRED) {
            assert.ok(Object.prototype.hasOwnProperty.call(res, key), `client return must surface ${key}`);
        }
        assert.equal(res.currently_authorized, null);
        assert.equal(res.valid, true);
        assert.equal(res.status, 'VERIFIED_CURRENT');
    });

    await withMockFetch(withIntent, async () => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        const res = await c.verifyReceipt('the-token');
        assert.equal(res.currently_authorized, false);
        assert.equal(res.authz_status, 'VERIFIED_SCOPE_MISMATCH');
        assert.equal(res.authz_reason, 'receipt_context_required');
    });
});

test('preflightCheck passes through top-level execution_action (does not invent one)', async () => {
    await withMockFetch({
        decision: 'BLOCK',
        execution_action: 'STOP',
        omega_api: 1,
        reflex_triggers: [],
        affected_tools: [],
    }, async () => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        const res = await c.preflightCheck({ tool_name: 't', old_spec: 'a', new_spec: 'b' });
        assert.equal(res.execution_action, 'STOP');
        assert.equal(res.decision, 'BLOCK');
    });
    await withMockFetch({
        decision: 'BLOCK',
        omega_api: 1,
        reflex_triggers: [],
        affected_tools: [],
    }, async () => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        const res = await c.preflightCheck({ tool_name: 't', old_spec: 'a', new_spec: 'b' });
        assert.equal(res.execution_action, undefined);
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
