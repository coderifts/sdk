'use strict';

/**
 * 1380 — RECORDED fallback for the three app-sync gates.
 *
 * Bite 1: clean-room (no coderifts-app) exits 0 in RECORDED mode.
 * Bite 2: LIVE still catches a real generated-file drift when the app checkout exists.
 * Bite 3: a corrupt vendored snapshot exits 1 — no silent skip.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const rec = require('../lib/recorded-app-sync');

const GATES = [
  'canonical-request-parity.test.js',
  'generated-grant-request-sync.test.js',
  'policy-vendored-sync.test.js',
];

function childEnv(base) {
  // node:test sets NODE_TEST_CONTEXT; a nested `node --test` then skips the files.
  const env = { ...base };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function cleanRoomEnv() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-sdk-home-'));
  const env = childEnv({ ...process.env, HOME: home });
  delete env.CODERIFTS_APP_DIR;
  delete env.CODERIFTS_APP_ROOT;
  return { home, env };
}

function runGates(env) {
  return spawnSync(
    process.execPath,
    ['--test', ...GATES.map((g) => path.join(ROOT, 'test', g))],
    { encoding: 'utf8', env: childEnv(env), cwd: ROOT },
  );
}

describe('1380 — clean-room RECORDED (no coderifts-app)', () => {
  it('the three sync-gates exit 0 and print [RECORDED — weaker than LIVE]', () => {
    const { env } = cleanRoomEnv();
    const r = runGates(env);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /\[RECORDED — weaker than LIVE\]/);
    assert.equal(/\[LIVE\]/.test(r.stdout), false);
  });
});

describe('1380 — LIVE still catches a real drift', () => {
  it('grant-request LIVE fails when the published generated file is mutated', (t) => {
    if (!rec.generatorsPresent()) {
      t.skip('no coderifts-app generators — LIVE bite needs the app');
      return;
    }
    const generated = path.join(ROOT, 'src', 'generated', 'execution-grant-request.v2.ts');
    const orig = fs.readFileSync(generated);
    try {
      fs.writeFileSync(generated, Buffer.concat([orig, Buffer.from('\n// drift-bite\n')]));
      const r = spawnSync(
        process.execPath,
        ['--test', path.join(ROOT, 'test', 'generated-grant-request-sync.test.js')],
        { encoding: 'utf8', env: childEnv(process.env), cwd: ROOT },
      );
      assert.notEqual(r.status, 0, 'LIVE must fail on a mutated generated file');
      assert.match(r.stdout + r.stderr, /differs from what the generator produces|not equal|AssertionError|fail/i);
    } finally {
      fs.writeFileSync(generated, orig);
    }
  });
});

describe('1380 — corrupt snapshot exits 1', () => {
  it('pin mismatch on policy.txt is FAIL, not skip', () => {
    const snap = rec.snapshotPath('policy.txt');
    const orig = fs.readFileSync(snap);
    try {
      fs.writeFileSync(snap, Buffer.from('CORRUPT-SNAPSHOT\n'));
      const { env } = cleanRoomEnv();
      const r = spawnSync(
        process.execPath,
        ['--test', path.join(ROOT, 'test', 'policy-vendored-sync.test.js')],
        { encoding: 'utf8', env: childEnv(env), cwd: ROOT },
      );
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout + r.stderr, /corrupt|STALE_RECORDED|RECORDED snapshot/);
    } finally {
      fs.writeFileSync(snap, orig);
    }
  });

  it('missing pin.json exits 1', () => {
    const pin = rec.PIN_PATH;
    const orig = fs.readFileSync(pin);
    try {
      fs.rmSync(pin);
      const { env } = cleanRoomEnv();
      const r = spawnSync(
        process.execPath,
        ['--test', path.join(ROOT, 'test', 'canonical-request-parity.test.js')],
        { encoding: 'utf8', env: childEnv(env), cwd: ROOT },
      );
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout + r.stderr, /RECORDED snapshot missing/);
    } finally {
      fs.writeFileSync(pin, orig);
    }
  });
});
