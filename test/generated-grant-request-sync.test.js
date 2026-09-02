'use strict';

/**
 * Drift gate: `src/generated/execution-grant-request.v2.ts` must be exactly what the app's
 * generator produces from its producer schema.
 *
 * The file carries a DO-NOT-EDIT header, which is a request. This is the check that makes it a
 * rule: a hand-edit here, or a schema change in the app that nobody regenerated for, fails the
 * SDK suite instead of shipping a type that describes a request the server does not read.
 *
 * Checkout resolution and the no-skip stance follow test/policy-vendored-sync.test.js: a missing
 * app checkout FAILS. A drift gate that skips when it cannot find the other side reports "no
 * drift" for the one situation where it has not looked.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const GENERATED = path.join(__dirname, '..', 'src', 'generated', 'execution-grant-request.v2.ts');

function resolveAppRoot() {
  const fromEnv = process.env.CODERIFTS_APP_DIR && String(process.env.CODERIFTS_APP_DIR).trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(process.env.HOME || os.homedir(), 'coderifts-app');
}

function appRootOrFail() {
  const abs = path.resolve(resolveAppRoot());
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    assert.fail(
      `coderifts-app checkout missing at ${abs}. Set CODERIFTS_APP_DIR or clone it at `
      + '$HOME/coderifts-app. This drift gate must NOT skip when the app repo is unavailable.',
    );
  }
  return abs;
}

describe('generated grant-request type — drift gate', () => {
  it('the generated file exists and declares its provenance', () => {
    assert.ok(fs.existsSync(GENERATED), `${GENERATED} is missing — run the app generator with --out`);
    const src = fs.readFileSync(GENERATED, 'utf8');
    assert.match(src, /DO NOT EDIT — generated from schemas\/execution-grant-request\.v2\.producer\.json/);
    assert.match(src, /Generator:\s+coderifts-app\/scripts\/generate-grant-request-types\.js/);
  });

  it('regenerating into a temp file reproduces it byte-for-byte', () => {
    const app = appRootOrFail();
    const script = path.join(app, 'scripts', 'generate-grant-request-types.js');
    assert.ok(fs.existsSync(script), `generator missing at ${script}`);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grant-req-drift-'));
    const out = path.join(tmp, 'execution-grant-request.v2.ts');
    execFileSync(process.execPath, [script, '--out', out], { cwd: app, stdio: ['ignore', 'ignore', 'pipe'] });

    assert.equal(
      fs.readFileSync(GENERATED, 'utf8'),
      fs.readFileSync(out, 'utf8'),
      'src/generated/execution-grant-request.v2.ts differs from what the generator produces — '
      + 'either it was hand-edited, or the producer schema moved and nobody regenerated.',
    );
  });

  it('the type names the fields the client is able to send', () => {
    // Behavioural tie to the SDK surface: a field the generated type declares and the hand-written
    // request body cannot carry is a field a TypeScript caller cannot pass.
    const src = fs.readFileSync(GENERATED, 'utf8');
    const types = fs.readFileSync(path.join(__dirname, '..', 'src', 'types.ts'), 'utf8');
    for (const field of ['expected_state_token', 'state_nonce', 'executor_id']) {
      if (!new RegExp(`\\b${field}\\??:`).test(src)) continue;
      assert.match(
        types, new RegExp(`\\b${field}\\?:`),
        `${field} is in the generated request type but not on the SDK request body`,
      );
    }
  });
});
