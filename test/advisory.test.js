'use strict';

/**
 * Fail-open fix (3.8.0): explainDecision / howToUnblock rebuilt on readDecision.
 * Control input is execution_action. decision is prose only.
 * AST guard mirrors @coderifts/conformance subjects/branch-on-decision.js
 * and Python 3.4.0 tests/test_read_decision.py — proven non-vacuous against
 * the published 3.7.0 helper source.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { CodeRifts, readDecision } = require('../dist/cjs/index.js');

const CANONICAL_ACTIONS = [
    'CONTINUE',
    'CONTINUE_WITH_MONITORING',
    'REQUEST_APPROVAL',
    'STOP',
];

const UNREADABLE_INPUTS = [
    ['empty_object', {}],
    ['null', null],
    ['undefined', undefined],
    ['string', 'nope'],
    ['integer', 7],
    ['array', []],
    ['unknown_action', { execution_action: 'BANANA' }],
    ['misspelled_action', { execution_action: 'CONTINUE_WITH_MONITORNG' }],
    ['lowercase_action', { execution_action: 'continue' }],
    ['null_action', { execution_action: null }],
    ['unknown_decision', { decision: 'MAYBE' }],
    ['legacy_allow_decision_only', { decision: 'ALLOW' }],
    ['analyze_response', { receipt_kind: 'NONE', may_execute: false }],
    ['error_body', { error: 'unauthorized' }],
    ['envelope_without_action', { decision_result: { decision: 'ALLOW' } }],
    ['envelope_not_an_object', { decision_result: 'ALLOW' }],
];

function client() {
    return new CodeRifts({ apiKey: 'cr_test_advisory' });
}

// ── AST guard (TypeScript compiler API — already a devDependency; no new dep) ──

const VALUE_OPS = new Set([
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.InKeyword,
]);

function isDecisionRef(node) {
    if (ts.isIdentifier(node) && node.text === 'decision') return true;
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name) && node.name.text === 'decision') return true;
    if (ts.isElementAccessExpression(node)
        && ts.isStringLiteral(node.argumentExpression)
        && node.argumentExpression.text === 'decision') return true;
    if (ts.isStringLiteral(node) && node.text === 'decision' && node.parent && ts.isBinaryExpression(node.parent)) {
        // `x === 'decision'` as a field-name compare is not a value-of-decision branch; skip.
        return false;
    }
    return false;
}

function nodeContainsDecisionRef(node) {
    let hit = false;
    function walk(n) {
        if (isDecisionRef(n)) hit = true;
        ts.forEachChild(n, walk);
    }
    walk(node);
    return hit;
}

function testHasDecisionValueCompare(test) {
    let hit = false;
    function walk(n) {
        if (ts.isBinaryExpression(n) && VALUE_OPS.has(n.operatorToken.kind)) {
            if (nodeContainsDecisionRef(n.left) || nodeContainsDecisionRef(n.right)) hit = true;
        }
        ts.forEachChild(n, walk);
    }
    walk(test);
    return hit;
}

function functionName(node) {
    if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
    if (ts.isFunctionExpression(node) && node.name) return node.name.text;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
        && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
        return node.name.text;
    }
    return null;
}

function functionsWithDecisionValueBranch(sourceText, fileName = 'fixture.ts') {
    const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const offenders = [];
    function visitFunctionBody(name, body) {
        if (!body) return;
        function walk(n) {
            if (ts.isIfStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) {
                if (testHasDecisionValueCompare(n.expression)) offenders.push(name);
            }
            if (ts.isConditionalExpression(n)) {
                if (testHasDecisionValueCompare(n.condition)) offenders.push(name);
            }
            if (ts.isSwitchStatement(n) && nodeContainsDecisionRef(n.expression)) {
                offenders.push(name);
            }
            ts.forEachChild(n, walk);
        }
        walk(body);
    }
    function visit(node) {
        const name = functionName(node);
        if (name) {
            if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node)) {
                visitFunctionBody(name, node.body);
            } else if (ts.isVariableDeclaration(node) && node.initializer
                && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
                visitFunctionBody(name, node.initializer.body);
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sf);
    return [...new Set(offenders)].sort();
}

/**
 * Published @coderifts/sdk 3.7.0 helper source (HEAD 315f14f, src/client.ts).
 * The guard MUST report explainDecision and howToUnblock against this text or it
 * proves nothing. Do not "fix" this fixture — it is the pre-fix subject.
 */
const PRE_FIX_3_7_0_HELPERS = `
export class CodeRifts {
    async explainDecision(req: { decision: string; omega_api: number }) {
        const triggers = req.reflex_triggers || [];
        let summary = \`Decision: \${req.decision} (Ω_API = \${req.omega_api}).\`;
        if (triggers.length > 0) {
            summary += \` \${triggers.length} reflex rule(s) triggered.\`;
        }
        if (req.decision === 'BLOCK') {
            summary += ' This change is blocked due to high risk.';
        }
        else if (req.decision === 'REQUIRE_APPROVAL') {
            summary += ' This change requires manual approval before merging.';
        }
        else if (req.decision === 'WARN') {
            summary += ' This change has warnings but can proceed.';
        }
        else {
            summary += ' This change is safe to proceed.';
        }
        return { summary, components: [] };
    }
    async howToUnblock(req: { decision: string }) {
        const actions = [];
        let step = 1;
        if (req.decision !== 'BLOCK') {
            actions.push({
                step: step++,
                description: \`Current decision is "\${req.decision}" — no unblock needed.\`,
            });
            return { actions };
        }
        return { actions };
    }
}
`;

describe('explainDecision — advisory prose, not a gate', () => {
    it('unknown/absent/null/undefined → treat as STOP, never "safe to proceed"', async () => {
        const c = client();
        for (const [label, payload] of UNREADABLE_INPUTS) {
            const out = await c.explainDecision({ omega_api: 0.5, decision: 'ALLOW', response: payload });
            assert.match(out.summary, /treat as STOP/, label);
            assert.equal(out.summary.includes('safe to proceed'), false, label);
            assert.equal(out.execution_action, 'STOP', label);
            assert.equal(out.reason, 'UNREADABLE_DECISION', label);
        }
    });

    it('no control input at all (decision-only, the 3.7.0 call shape) → treat as STOP', async () => {
        const out = await client().explainDecision({ omega_api: 0.5, decision: 'ALLOW' });
        assert.match(out.summary, /treat as STOP/);
        assert.equal(out.summary.includes('safe to proceed'), false);
    });

    it('never says "safe to proceed" for any decision label', async () => {
        const c = client();
        for (const label of ['ALLOW', 'WARN', 'REQUIRE_APPROVAL', 'BLOCK', 'BOGUS', '']) {
            const out = await c.explainDecision({ omega_api: 0.1, decision: label });
            assert.equal(out.summary.includes('safe to proceed'), false, label);
        }
    });

    it('each canonical action renders its own sentence', async () => {
        const c = client();
        for (const action of CANONICAL_ACTIONS) {
            const out = await c.explainDecision({
                omega_api: 0.1,
                decision: 'ALLOW',
                execution_action: action,
            });
            assert.ok(out.summary.includes(action), action);
            assert.equal(out.execution_action, action);
            assert.equal(out.reason, undefined);
        }
    });

    it('CONTINUE does not borrow the old "safe to proceed" wording', async () => {
        const out = await client().explainDecision({
            omega_api: 0.1,
            decision: 'ALLOW',
            execution_action: 'CONTINUE',
        });
        assert.match(out.summary, /may proceed/);
        assert.equal(out.summary.includes('safe to proceed'), false);
    });

    it('prose may still mention decision', async () => {
        const out = await client().explainDecision({
            omega_api: 0.42,
            decision: 'REQUIRE_APPROVAL',
            execution_action: 'REQUEST_APPROVAL',
        });
        assert.match(out.summary, /REQUIRE_APPROVAL/);
        assert.match(out.summary, /0\.42/);
    });

    it('response payload takes precedence over the scalar (legacy arm not used)', async () => {
        const out = await client().explainDecision({
            omega_api: 0.1,
            decision: 'ALLOW',
            execution_action: 'CONTINUE',
            response: { execution_action: 'STOP', decision: 'BLOCK' },
        });
        assert.equal(out.execution_action, 'STOP');
        assert.match(out.summary, /STOP/);
    });

    it('decision-only response does not ride the readDecision legacy arm', async () => {
        // If helpers passed the raw body to readDecision, {decision:'ALLOW'} → CONTINUE.
        const out = await client().explainDecision({
            omega_api: 0.1,
            decision: 'ALLOW',
            response: { decision: 'ALLOW' },
        });
        assert.equal(out.execution_action, 'STOP');
        assert.equal(out.reason, 'UNREADABLE_DECISION');
        assert.match(out.summary, /treat as STOP/);
        // The normaliser still has the arm — helpers must not consume it.
        assert.equal(readDecision({ decision: 'ALLOW' }).executionAction, 'CONTINUE');
    });

    it('components and trigger count still rendered', async () => {
        const out = await client().explainDecision({
            omega_api: 0.7,
            decision: 'BLOCK',
            reflex_triggers: [{ rule: 'r1' }, { rule: 'r2' }],
            omega_components: { breaking_changes: 3.0, ignored: 'text' },
            execution_action: 'STOP',
        });
        assert.match(out.summary, /2 reflex rule\(s\) triggered/);
        assert.equal(out.components.length, 1);
    });
});

describe('howToUnblock — advisory prose, not a gate', () => {
    it('unknown/absent/null/undefined never says "no unblock needed"', async () => {
        const c = client();
        for (const [label, payload] of UNREADABLE_INPUTS) {
            const out = await c.howToUnblock({ decision: 'ALLOW', response: payload });
            const rendered = out.actions.map((a) => a.description).join(' ');
            assert.equal(rendered.includes('no unblock needed'), false, label);
            assert.match(rendered, /treat as STOP/, label);
            assert.equal(out.execution_action, 'STOP', label);
        }
    });

    it('no control input at all never says "no unblock needed"', async () => {
        const out = await client().howToUnblock({ decision: 'ALLOW' });
        const rendered = out.actions.map((a) => a.description).join(' ');
        assert.equal(rendered.includes('no unblock needed'), false);
        assert.match(rendered, /treat as STOP/);
    });

    it('unreadable value still renders the fix steps', async () => {
        const out = await client().howToUnblock({
            decision: 'BOGUS',
            breaking_changes: [{ type: 'removed', path: '/u', description: 'gone' }],
            reflex_triggers: [{ rule: 'r1' }],
            response: { execution_action: 'BANANA' },
        });
        const rendered = out.actions.map((a) => a.description).join(' ');
        assert.match(rendered, /Fix 1 breaking change/);
        assert.match(rendered, /Resolve reflex rule: r1/);
        assert.match(rendered, /override/);
    });

    it('STOP renders the fix steps, never "no unblock needed"', async () => {
        const out = await client().howToUnblock({
            decision: 'BLOCK',
            breaking_changes: [{ type: 'removed', path: '/u', description: 'gone' }],
            execution_action: 'STOP',
        });
        const rendered = out.actions.map((a) => a.description).join(' ');
        assert.match(rendered, /Fix 1 breaking change/);
        assert.equal(rendered.includes('no unblock needed'), false);
    });

    it('REQUEST_APPROVAL asks for approval, not "no unblock needed"', async () => {
        const out = await client().howToUnblock({
            decision: 'REQUIRE_APPROVAL',
            execution_action: 'REQUEST_APPROVAL',
        });
        const rendered = out.actions.map((a) => a.description).join(' ');
        assert.equal(rendered.includes('no unblock needed'), false);
        assert.match(rendered, /manual approval is required/);
    });

    it('"no unblock needed" only for readable CONTINUE / CONTINUE_WITH_MONITORING', async () => {
        for (const action of ['CONTINUE', 'CONTINUE_WITH_MONITORING']) {
            const out = await client().howToUnblock({ decision: 'ALLOW', execution_action: action });
            const rendered = out.actions.map((a) => a.description).join(' ');
            assert.match(rendered, /no unblock needed/, action);
            assert.equal(out.execution_action, action);
        }
    });

    it('prose may still mention decision', async () => {
        const out = await client().howToUnblock({ decision: 'ALLOW', execution_action: 'CONTINUE' });
        assert.match(out.actions[0].description, /ALLOW/);
    });

    it('steps are numbered consecutively', async () => {
        const out = await client().howToUnblock({
            decision: 'BLOCK',
            breaking_changes: [{ type: 'removed', path: '/u', description: 'gone' }],
            reflex_triggers: [{ rule: 'r1' }],
            execution_action: 'STOP',
        });
        assert.deepEqual(
            out.actions.map((a) => a.step),
            out.actions.map((_, i) => i + 1),
        );
    });
});

describe('AST guard — branch-on-decision (non-vacuous)', () => {
    it('flags the published 3.7.0 helper source (explainDecision, howToUnblock)', () => {
        const offenders = functionsWithDecisionValueBranch(PRE_FIX_3_7_0_HELPERS, 'client-3.7.0.ts');
        assert.deepEqual(offenders, ['explainDecision', 'howToUnblock']);
    });

    it('flags the conformance fixture shapes (===, !==, in, ternary, switch)', () => {
        const subjects = [
            `function decide(r: { decision: string }) {
                const decision = r.decision;
                if (decision === 'ALLOW') return 'proceed';
                return 'halt';
            }`,
            `function decide(decision: string) {
                if (decision !== 'BLOCK') return 'no unblock needed';
                return 'steps';
            }`,
            `function decide(decision: string) {
                if (decision in { ALLOW: 1, WARN: 1 }) return 'safe';
                return 'halt';
            }`,
            `function decide(r: { decision: string }) {
                return r.decision === 'ALLOW' ? 'proceed' : 'halt';
            }`,
            `function decide(r: { decision: string }) {
                switch (r.decision) {
                    case 'ALLOW': return 'proceed';
                    default: return 'halt';
                }
            }`,
        ];
        for (const source of subjects) {
            assert.deepEqual(functionsWithDecisionValueBranch(source), ['decide'], source.slice(0, 40));
        }
    });

    it('does not flag a query-filter presence check (if (req.decision))', () => {
        const benign = `
            function getLedger(req: { decision?: string }) {
                const params: Record<string, string> = {};
                if (req.decision) params['decision'] = req.decision;
                return params;
            }
        `;
        assert.deepEqual(functionsWithDecisionValueBranch(benign), []);
    });

    it('live src/client.ts helpers are clean (post-fix)', () => {
        const src = fs.readFileSync(path.join(__dirname, '../src/client.ts'), 'utf8');
        const offenders = functionsWithDecisionValueBranch(src, 'src/client.ts');
        assert.equal(offenders.includes('explainDecision'), false, String(offenders));
        assert.equal(offenders.includes('howToUnblock'), false, String(offenders));
    });
});
