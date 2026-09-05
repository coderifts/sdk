'use strict';

/**
 * Drift gate: `src/generated/execution-grant-request.v2.ts` must be exactly what the app's
 * generator produces from its producer schema.
 *
 * LIVE when the app checkout exists: regenerate into a temp file and byte-compare (still
 * fails on real drift; fails if the recording is stale). RECORDED against
 * fixtures/recorded/app-sync when it does not (weaker, named). Missing/corrupt snapshot
 * fails — never a silent skip.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const rec = require('../lib/recorded-app-sync');

const GENERATED = path.join(rec.ROOT, 'src', 'generated', 'execution-grant-request.v2.ts');
const pin = rec.loadPin();
const LIVE = rec.generatorsPresent();
const MODE = LIVE ? 'LIVE' : 'RECORDED';

describe(`generated grant-request type — drift gate ${rec.modeBanner(MODE)}`, () => {
  it('the generated file exists and declares its provenance', () => {
    assert.ok(fs.existsSync(GENERATED), `${GENERATED} is missing — run the app generator with --out`);
    const src = fs.readFileSync(GENERATED, 'utf8');
    assert.match(src, /DO NOT EDIT — generated from schemas\/execution-grant-request\.v2\.producer\.json/);
    assert.match(src, /Generator:\s+coderifts-app\/scripts\/generate-grant-request-types\.js/);
    assert.ok(pin);
  });

  it('matches LIVE regeneration or the RECORDED snapshot', () => {
    const published = fs.readFileSync(GENERATED, 'utf8');
    const snap = rec.snapshotText('execution-grant-request.v2.ts');
    if (LIVE) {
      const script = rec.liveGeneratorPath();
      assert.ok(fs.existsSync(script), `generator missing at ${script}`);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grant-req-drift-'));
      const out = path.join(tmp, 'execution-grant-request.v2.ts');
      execFileSync(process.execPath, [script, '--out', out], {
        cwd: rec.appRoot(),
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      const live = fs.readFileSync(out, 'utf8');
      assert.equal(
        published,
        live,
        'src/generated/execution-grant-request.v2.ts differs from what the generator produces — '
        + 'either it was hand-edited, or the producer schema moved and nobody regenerated. '
        + rec.modeBanner('LIVE'),
      );
      assert.equal(
        snap,
        live,
        'RECORDED snapshot STALE vs live generation — regenerate fixtures/recorded/app-sync',
      );
    } else {
      assert.equal(
        published,
        snap,
        'src/generated/execution-grant-request.v2.ts differs from the RECORDED snapshot. '
        + rec.modeBanner('RECORDED'),
      );
    }
  });

  it('the type names the fields the client is able to send', () => {
    // Behavioural tie to the SDK surface: a field the generated type declares and the hand-written
    // request body cannot carry is a field a TypeScript caller cannot pass.
    const src = fs.readFileSync(GENERATED, 'utf8');
    const types = fs.readFileSync(path.join(rec.ROOT, 'src', 'types.ts'), 'utf8');
    for (const field of ['expected_state_token', 'state_nonce', 'executor_id']) {
      if (!new RegExp(`\\b${field}\\??:`).test(src)) continue;
      assert.match(
        types, new RegExp(`\\b${field}\\?:`),
        `${field} is in the generated request type but not on the SDK request body`,
      );
    }
  });
});
