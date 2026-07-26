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

test('legacy decision-only maps via deriveExecutionAction', () => {
    assert.equal(readDecision({ decision: 'ALLOW' }).executionAction, 'CONTINUE');
    assert.equal(readDecision({ decision: 'WARN' }).executionAction, 'CONTINUE_WITH_MONITORING');
    assert.equal(readDecision({ decision: 'REQUIRE_APPROVAL' }).executionAction, 'REQUEST_APPROVAL');
    assert.equal(readDecision({ decision: 'BLOCK' }).executionAction, 'STOP');
});

test('garbage / unknown -> fail-closed STOP with reason (never throws)', () => {
    for (const g of [null, undefined, {}, 'nope', 42, [], { decision: 'WEIRD' }, { execution_action: 'MAYBE' }]) {
        const r = readDecision(g);
        assert.equal(r.executionAction, 'STOP', `input ${JSON.stringify(g)}`);
        assert.equal(r.reason, 'UNREADABLE_DECISION');
    }
});

test('malformed envelope execution_action falls through to the decision map', () => {
    const r = readDecision({ decision: 'ALLOW', decision_result: { execution_action: 'BOGUS', decision: 'ALLOW' } });
    assert.equal(r.executionAction, 'CONTINUE');
    assert.equal(r.envelope, undefined);
});
