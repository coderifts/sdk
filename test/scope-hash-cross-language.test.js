'use strict';

/**
 * ONE scope_hash, four implementations.
 *
 * `scope_hash = sha256(operation ⨝ target_id ⨝ after_payload)` joined by 0x1F. Every byte of that
 * sentence is load-bearing — the separator, the empty-string coercion of an absent field, the
 * order — and it is written out independently in TypeScript, in the shared JS core, in Python and
 * in the executor's middleware. Four transcriptions of one rule is four chances to differ, and a
 * disagreement here does not look like a bug: it looks like GRANT_SCOPE_MISMATCH on a grant that
 * was correct all along.
 *
 * The vectors deliberately include the cases where a transcription slips: empty and absent fields
 * (an absent one must hash like `''`, never be skipped), a payload containing the separator itself,
 * multi-byte UTF-8, and the real governed contract from the end-to-end capture.
 *
 * Python and the executor are compared when they are present beside this repo; absent, the test
 * SAYS so rather than passing quietly.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const sdk = require('../dist/cjs/execution-grant.js');

const HOME = process.env.HOME || '';
const CORE = path.join(HOME, 'receipt-verifier');
const PY = path.join(CORE, 'verify_grant.py');
const EXECUTOR = path.join(HOME, 'capability-demo', 'packages', 'middleware', 'src', 'verify-grant.js');
const CONTRACT = path.join(HOME, 'capability-demo', 'demo', 'contracts', 'openapi.yaml');

function vectors() {
  const v = [
    { name: 'all three present', operation: 'publish', target_id: 'sha256:abc', after_payload: '{"a":1}' },
    { name: 'empty target_id', operation: 'publish', target_id: '', after_payload: 'body' },
    { name: 'absent target_id must hash like empty', operation: 'publish', after_payload: 'body' },
    { name: 'absent after_payload', operation: 'deploy', target_id: '42' },
    { name: 'all absent', },
    { name: 'payload contains the separator byte', operation: 'publish', target_id: '', after_payload: 'a\x1fb' },
    { name: 'payload contains a newline and a pipe', operation: 'publish', target_id: '', after_payload: 'a\n|b' },
    { name: 'multi-byte UTF-8', operation: 'publish', target_id: 'ő', after_payload: '日本語 — em dash' },
    { name: 'empty string payload', operation: 'publish', target_id: 'x', after_payload: '' },
  ];
  if (fs.existsSync(CONTRACT)) {
    // The real governed object: the bytes an authorize actually scoped in the end-to-end capture.
    const raw = fs.readFileSync(CONTRACT, 'utf8');
    const canonical = `${raw.replace(/\r/g, '').replace(/[ \t]+$/gm, '').replace(/\n+$/, '')}\n`;
    v.push({ name: 'the governed contract bytes', operation: 'publish', target_id: '', after_payload: canonical });
  }
  return v;
}

const VECTORS = vectors();

describe('scope_hash — one rule, four transcriptions', () => {
  it('the vectors exercise the places a transcription slips', () => {
    assert.ok(VECTORS.length >= 9);
    assert.ok(VECTORS.some((x) => x.target_id === undefined), 'an absent field must be a vector');
    assert.ok(VECTORS.some((x) => String(x.after_payload || '').includes('\x1f')),
      'the separator inside a payload must be a vector');
  });

  it('TS SDK === shared JS core', (t) => {
    // 1435 — the ONE cross-repo require in this file that had no existence check. Every other
    // comparison here skips honestly when its sibling is absent; this one threw MODULE_NOT_FOUND,
    // so a clean clone of the SDK failed a test about a repo it does not contain. A missing
    // sibling is "not compared", never "compared and wrong".
    const file = path.join(CORE, 'verify-grant.js');
    if (!fs.existsSync(file)) {
      t.skip(`receipt-verifier is not checked out beside this repo (${CORE}) — `
        + 'the SDK vectors above ran; core parity was not compared');
      return;
    }
    const { computeScopeHash: core } = require(file);
    for (const v of VECTORS) {
      assert.equal(sdk.computeScopeHash(v), core(v), `${v.name}: SDK and core differ`);
    }
  });

  it('TS SDK === executor middleware', (t) => {
    if (!fs.existsSync(EXECUTOR)) {
      t.skip('capability-demo is not checked out beside this repo — executor parity not compared');
      return;
    }
    const { computeScopeHash: exec } = require(EXECUTOR);
    for (const v of VECTORS) {
      assert.equal(sdk.computeScopeHash(v), exec(v), `${v.name}: SDK and executor differ`);
    }
  });

  it('TS SDK === Python', (t) => {
    if (!fs.existsSync(PY)) {
      t.skip('receipt-verifier/verify_grant.py is not present — Python parity not compared');
      return;
    }
    const probe = 'import json,sys\n'
      + `sys.path.insert(0, ${JSON.stringify(CORE)})\n`
      + 'from verify_grant import compute_scope_hash\n'
      + 'out=[]\n'
      + 'for v in json.load(sys.stdin):\n'
      + '    out.append(compute_scope_hash(v.get("operation"), v.get("target_id"), v.get("after_payload")))\n'
      + 'print(json.dumps(out))\n';
    const r = spawnSync('python3', ['-c', probe], {
      input: JSON.stringify(VECTORS), encoding: 'utf8',
    });
    assert.equal(r.status, 0, `the Python probe failed:\n${r.stdout}${r.stderr}`);
    const got = JSON.parse(r.stdout.trim().split('\n').pop());
    VECTORS.forEach((v, i) => {
      assert.equal(got[i], sdk.computeScopeHash(v), `${v.name}: SDK and Python differ`);
    });
  });

  it('THE ORACLE BITES: a changed separator would be caught', () => {
    // Without this, all four agreeing could mean all four are wrong in the same way. A rule
    // written four times can be transcribed four times identically-wrongly; what this asserts is
    // that the comparison above is capable of failing at all.
    const wrong = (a) => {
      const crypto = require('node:crypto');
      const pre = [a.operation ?? '', a.target_id ?? '', a.after_payload ?? ''].join('|');
      return `sha256:${crypto.createHash('sha256').update(pre, 'utf8').digest('hex')}`;
    };
    const v = VECTORS[0];
    assert.notEqual(sdk.computeScopeHash(v), wrong(v), 'the separator is not load-bearing?');
  });
});
