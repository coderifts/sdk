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

test('1087 scmToken is X-Coderifts-Scm-Token only — never body, never client, never error text', async () => {
    const SECRET = 'scm-secret-do-not-leak';
    const orig = global.fetch;
    const cap = {};
    global.fetch = async (url, opts) => {
        cap.url = url;
        cap.opts = opts;
        return {
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            json: async () => ({ error: 'repo_inaccessible', message: 'Could not fetch bind file.' }),
        };
    };
    const logs = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...a) => { logs.push(a.map(String).join(' ')); };
    console.error = (...a) => { logs.push(a.map(String).join(' ')); };
    try {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        let thrown;
        try {
            await c.preflightChangeSet({
                preflight_mode: 'authorize',
                derivation: 'server',
                context: {
                    operation: 'merge',
                    repository: 'group/proj',
                    base: 'main',
                    head: 'feat',
                    platform: 'gitlab',
                },
            }, { scmToken: SECRET });
        } catch (e) {
            thrown = e;
        }
        assert.ok(thrown, 'expected 403 to throw');
        assert.equal(cap.opts.headers['X-Coderifts-Scm-Token'], SECRET);
        const body = JSON.parse(cap.opts.body);
        assert.equal(body.context.platform, 'gitlab');
        assert.equal(body.derivation, 'server');
        assert.equal(body.scmToken, undefined);
        assert.equal(body.scm_token, undefined);
        assert.equal(Object.prototype.hasOwnProperty.call(c, 'scmToken'), false);
        const hay = [String(thrown), JSON.stringify(thrown), logs.join('\n')].join('\n');
        assert.equal(hay.includes(SECRET), false, `token leaked: ${hay}`);
    } finally {
        global.fetch = orig;
        console.log = origLog;
        console.error = origErr;
    }
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

// ── 3.9.0 fail-closed `safe` (BREAKING) ────────────────────────────────────
// The parity table below is duplicated verbatim in the Python SDK
// (tests/test_client.py, SAFE_PARITY_TABLE). Same ids, same inputs, same
// expected `safe`. If one side changes, the two tables stop matching.
const SAFE_PARITY_TABLE = [
    ['absent-decision-and-action', { omega_api: 0 }, false],
    ['legacy-decision-only-allow', { decision: 'ALLOW' }, false],
    ['action-continue', { execution_action: 'CONTINUE' }, true],
    ['action-continue-with-monitoring', { execution_action: 'CONTINUE_WITH_MONITORING' }, false],
    ['action-request-approval', { execution_action: 'REQUEST_APPROVAL' }, false],
    ['action-stop', { execution_action: 'STOP' }, false],
    ['unrecognised-action', { execution_action: 'PROBABLY_FINE', decision: 'ALLOW' }, false],
];

test('preflightCheck: an absent decision field yields safe:false (3.9.0 regression guard — the fail-open)', async () => {
    // The exact pre-3.9.0 defect: the server omits `decision`, the SDK
    // manufactured 'ALLOW', and `safe` came back true. Permanent guard.
    await withMockFetch({ omega_api: 0, reflex_triggers: [], affected_tools: [] }, async () => {
        const c = new CodeRifts({ apiKey: 'cr_test_abc' });
        const res = await c.preflightCheck({ tool_name: 't', old_spec: 'a', new_spec: 'b' });
        assert.equal(res.safe, false);
        assert.equal(res.decision, undefined, 'no decision may be manufactured');
    });
});

test('preflightCheck: pre-3.9.0 fail-open behaviour is gone (absent decision no longer yields safe:true)', async () => {
    for (const raw of [{}, { omega_api: 0 }, { reflex_triggers: [] }, { decision: null }, { decision: '' }]) {
        await withMockFetch(raw, async () => {
            const c = new CodeRifts({ apiKey: 'cr_test_abc' });
            const res = await c.preflightCheck({ tool_name: 't', old_spec: 'a', new_spec: 'b' });
            assert.notEqual(res.safe, true, `must not grant safe for ${JSON.stringify(raw)}`);
        });
    }
});

test('preflightCheck: each canonical execution_action maps to the correct safe value', async () => {
    const expected = {
        CONTINUE: true,
        CONTINUE_WITH_MONITORING: false,
        REQUEST_APPROVAL: false,
        STOP: false,
    };
    for (const [action, want] of Object.entries(expected)) {
        await withMockFetch({ execution_action: action }, async () => {
            const c = new CodeRifts({ apiKey: 'cr_test_abc' });
            const res = await c.preflightCheck({ tool_name: 't', old_spec: 'a', new_spec: 'b' });
            assert.equal(res.safe, want, `${action} -> safe:${want}`);
        });
    }
});

test('preflightCheck: an unrecognised execution_action yields safe:false', async () => {
    for (const action of ['PROBABLY_FINE', 'continue', 'CONTINUE_WITH_MONITORNG', null, 7, {}]) {
        await withMockFetch({ execution_action: action, decision: 'ALLOW' }, async () => {
            const c = new CodeRifts({ apiKey: 'cr_test_abc' });
            const res = await c.preflightCheck({ tool_name: 't', old_spec: 'a', new_spec: 'b' });
            assert.equal(res.safe, false, `unrecognised ${JSON.stringify(action)} must not grant safe`);
        });
    }
});

test('preflightCheck: a legacy decision-only response does not grant safe (decision never grants permission)', async () => {
    for (const d of ['ALLOW', 'WARN', 'REQUIRE_APPROVAL', 'BLOCK']) {
        await withMockFetch({ decision: d }, async () => {
            const c = new CodeRifts({ apiKey: 'cr_test_abc' });
            const res = await c.preflightCheck({ tool_name: 't', old_spec: 'a', new_spec: 'b' });
            assert.equal(res.safe, false, `decision:${d} alone must not grant safe`);
            assert.equal(res.decision, d, 'the server label is still passed through');
        });
    }
});

test('preflightCheck: safe parity table (identical to the Python SDK table)', async () => {
    for (const [id, raw, want] of SAFE_PARITY_TABLE) {
        await withMockFetch(raw, async () => {
            const c = new CodeRifts({ apiKey: 'cr_test_abc' });
            const res = await c.preflightCheck({ tool_name: 't', old_spec: 'a', new_spec: 'b' });
            assert.equal(res.safe, want, `${id} -> safe:${want}`);
        });
    }
});
