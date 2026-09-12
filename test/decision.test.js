'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readDecision } = require('../dist/cjs/index.js');

test('envelope-first: reads execution_action + receipt from decision_result', () => {
    const r = readDecision({
        decision: 'BLOCK',
        decision_result: {
            execution_action: 'STOP',
            decision: 'BLOCK',
            receipt: { token: 'tok', format_version: 'crchain.v1', key_id: 'k1', issued_at: 'ts' },
        },
    });
    assert.equal(r.executionAction, 'STOP');
    assert.equal(r.decision, 'BLOCK');
    assert.ok(r.envelope);
    assert.equal(r.receipt.token, 'tok');
    assert.equal(r.reason, undefined);
});

test('top-level execution_action (legacy REST, no envelope)', () => {
    const r = readDecision({ decision: 'WARN', execution_action: 'CONTINUE_WITH_MONITORING' });
    assert.equal(r.executionAction, 'CONTINUE_WITH_MONITORING');
    assert.equal(r.decision, 'WARN');
    assert.equal(r.envelope, undefined);
    assert.equal(r.receipt, undefined);
});

test('legacy decision-only maps via deriveExecutionAction — ONLY on an explicit spec-1.0 body', () => {
    const v1 = (decision) => ({ decision, decision_spec_version: '1.0' });
    assert.equal(readDecision(v1('ALLOW')).executionAction, 'CONTINUE');
    assert.equal(readDecision(v1('WARN')).executionAction, 'CONTINUE_WITH_MONITORING');
    assert.equal(readDecision(v1('REQUIRE_APPROVAL')).executionAction, 'REQUEST_APPROVAL');
    assert.equal(readDecision(v1('BLOCK')).executionAction, 'STOP');
});

test('1565 — a bare decision WITHOUT an explicit spec-1.0 version never grants permission', () => {
    // The measured leak: every one of these resolved to CONTINUE before the gate. A missing
    // version is not legacy; a 2.x version is not legacy; an unrecognised action is not a
    // licence to fall back to the decision label.
    for (const body of [
        { decision: 'ALLOW' },                                              // version missing
        { decision: 'ALLOW', decision_spec_version: '2.0' },                // v2 body
        { decision: 'ALLOW', execution_action: 'DEFINITELY_GO' },           // action present, unrecognised
        { decision: 'ALLOW', decision_spec_version: '1.0', preflight_mode: 'authorize' }, // v2 by preflight_mode
    ]) {
        const r = readDecision(body);
        assert.equal(r.executionAction, 'STOP', `input ${JSON.stringify(body)}`);
        assert.equal(r.reason, 'UNREADABLE_DECISION', `input ${JSON.stringify(body)}`);
    }
});

test('garbage / unknown -> fail-closed STOP with reason (never throws)', () => {
    for (const g of [null, undefined, {}, 'nope', 42, [], { decision: 'WEIRD' }, { execution_action: 'MAYBE' }]) {
        const r = readDecision(g);
        assert.equal(r.executionAction, 'STOP', `input ${JSON.stringify(g)}`);
        assert.equal(r.reason, 'UNREADABLE_DECISION');
    }
});

test('malformed envelope execution_action fails closed — it does NOT fall through to the decision map', () => {
    // This test previously asserted CONTINUE and named the fall-through as the contract.
    // 1565 measured what that bought: a wrapped body whose action is garbage granted permission
    // from the `decision` label. A body carrying a decision_result IS a v2 body, so the legacy
    // arm is unavailable to it no matter what the label says.
    const r = readDecision({ decision: 'ALLOW', decision_result: { execution_action: 'BOGUS', decision: 'ALLOW' } });
    assert.equal(r.executionAction, 'STOP');
    assert.equal(r.reason, 'UNREADABLE_DECISION');
    assert.equal(r.envelope, undefined);
});
