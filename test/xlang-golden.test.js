'use strict';

/**
 * HERMETIC cross-language parity (1456) — this side against a repo-internal golden oracle.
 *
 * ── WHAT WAS MEASURED, AND WHY A SKIP IS NOT A PROOF ────────────────────────────────────────
 *
 * `test/scope-hash-cross-language.test.js` compares this SDK against three sibling checkouts under
 * `$HOME`: receipt-verifier (the JS core and verify_grant.py), and capability-demo (the executor
 * middleware and the governed contract file). On a clean clone none of them exists, so the
 * comparisons skip — honestly, and the release is then gated on a check that did not run.
 *
 * ── HOW A GOLDEN SET REMOVES THE SIBLING ────────────────────────────────────────────────────
 *
 * The two languages do not need to meet. They need to agree, and agreement is transitive: if this
 * side matches the golden file and the Python side matches the SAME file, the two match each
 * other. So the oracle is committed in BOTH packages, byte-identical, pinned by sha256 — and each
 * side asserts only its own computation.
 *
 * The pin is what makes the two copies one file. `GOLDEN.sha256` holds the same digest in both
 * repos; a copy that drifts fails its own test before it can quietly diverge from the other.
 *
 * ── WHAT THE VECTORS ARE FOR ────────────────────────────────────────────────────────────────
 *
 * Every place a transcription of these rules can slip: an ABSENT field (which must hash like the
 * empty string, never be skipped), the 0x1F separator appearing INSIDE a payload, a NUL byte, CRLF
 * and trailing whitespace, multi-byte and astral-plane UTF-8, and — for the canonical input — that
 * artifacts sort by (type, id) rather than by input order, and that an object `after` is
 * JSON.stringify and NOT RFC 8785.
 *
 * RELEASE-BLOCKING. No skip path: the fixture is in this repo, so it is always there.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const sdk = require('../dist/cjs/execution-grant.js');

const DIR = path.join(__dirname, 'fixtures', 'xlang');
const FILE = path.join(DIR, 'scope-hash.golden.json');
const PIN = path.join(DIR, 'GOLDEN.sha256');

const bytes = fs.readFileSync(FILE);
const golden = JSON.parse(bytes.toString('utf8'));

describe('cross-language golden parity (hermetic)', () => {
  it('the golden file matches its pin — the same digest the Python package records', () => {
    const want = fs.readFileSync(PIN, 'utf8').trim().split(/\s+/)[0];
    assert.match(want, /^[0-9a-f]{64}$/);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), want);
  });

  it('the set is not thin, and covers the cases a transcription slips on', () => {
    assert.equal(golden.schema, 'cr.xlang.scope-hash-golden.v1');
    assert.ok(golden.scope_hash.length >= 10, `only ${golden.scope_hash.length} scope vectors`);
    assert.ok(golden.after_payload_canonical.length >= 5);
    const names = golden.scope_hash.map((v) => v.name).join(' | ');
    for (const need of ['absent', 'separator', 'UTF-8', 'NUL']) {
      assert.ok(names.includes(need), `no vector covers "${need}"`);
    }
  });

  for (const v of golden.scope_hash) {
    it(`scope_hash: ${v.name}`, () => {
      assert.equal(sdk.computeScopeHash(v.args), v.expected);
    });
  }

  for (const v of golden.after_payload_canonical) {
    it(`canonical input: ${v.name}`, () => {
      assert.equal(sdk.afterPayloadCanonical(v.artifacts), v.expected);
    });
  }

  it('THE ORACLE BITES: a wrong separator does not match the golden values', () => {
    // Without this, all sides agreeing could mean all sides are wrong in the same way — and a
    // golden file generated from one of them would enshrine the mistake.
    const wrong = (a) => {
      const pre = [a.operation ?? '', a.target_id ?? '', a.after_payload ?? ''].join('|');
      return `sha256:${crypto.createHash('sha256').update(pre, 'utf8').digest('hex')}`;
    };
    const v = golden.scope_hash[0];
    assert.notEqual(wrong(v.args), v.expected);
  });
});
