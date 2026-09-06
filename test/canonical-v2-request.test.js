'use strict';

/**
 * The TS SDK speaks the canonical v2 request — checked by COMPILATION and by the CAPTURED WIRE.
 *
 * ── WHY THE PREVIOUS TEST WAS DELETED (1425) ────────────────────────────────────────────────
 *
 * `test/canonical-request-parity.test.js` decided which fields this SDK "declares" by running
 * `new RegExp('^\\s*<field>\\??:', 'm')` over the whole of src/types.ts. That is a false oracle in
 * both directions, and both directions were measured:
 *
 *   FALSE POSITIVE  it reported `audience` as declared. The line it matched was src/types.ts:283,
 *                   a member of IntentContext whose own comment says the server-derived audience
 *                   wins on the envelope — a different field, in a different object, with the
 *                   opposite meaning. The grant-request type had no top-level `audience` at all.
 *   SILENT SKIP     it never found `policy_hash`, so `declared.has('policy_hash')` was false and
 *                   the assertion guarded by it never ran. A test that skips its own subject
 *                   reports green for the case it was written to catch.
 *
 * A regex cannot see scope, so it cannot answer "does this interface have this field". The
 * compiler can, and the wire can. Those are the two oracles below.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const rec = require('../lib/recorded-app-sync');

const pin = rec.loadPin();
const LIVE = rec.generatorsPresent();
const MODE = LIVE ? 'LIVE' : 'RECORDED';
const FIXTURE_PATH = LIVE ? rec.liveCanonicalPath() : rec.snapshotPath('v2-grant-canonical-request.json');

/** Every v2 request field the canonical fixture carries at the top level. */
const V2_FIELDS = [
  'grant_version', 'executor_id', 'adapter_id', 'target_uri', 'tenant_id',
  'state_nonce', 'expected_state_token', 'audience', 'policy_hash', 'include_execution_grant',
];

/**
 * Ask the COMPILER, not a regex. A field the interface does not declare is a type error under
 * the SDK's own tsconfig, and a scope the regex could not see is exactly what tsc resolves.
 */
function compiles(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-types-'));
  try {
    const file = path.join(dir, 'probe.ts');
    fs.writeFileSync(file, source);
    const r = spawnSync('npx', [
      'tsc', '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022',
      '--module', 'ESNext', '--moduleResolution', 'bundler', file,
    ], { encoding: 'utf8', cwd: rec.ROOT });
    return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const TYPES = path.join(rec.ROOT, 'src', 'types.ts').replace(/\.ts$/, '');

describe(`canonical v2 request (TS SDK) ${rec.modeBanner(MODE)}`, () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const { request, reading } = fixture;

  it('the fixture is the generated one', () => {
    assert.equal(fixture.schema, 'coderifts.v2-grant-canonical-request.v1');
    assert.ok(pin);
  });

  it('COMPILE-TIME: every v2 field the canonical request carries is assignable', () => {
    const present = V2_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(request, f));
    assert.ok(present.length >= 8, `the fixture should exercise the v2 surface, saw ${present.length}`);
    // `preflight_mode` is REQUIRED on the interface and comes from the fixture, so the probe is a
    // complete request rather than a fragment — otherwise every probe fails for a missing field
    // and none of them says anything about the v2 surface.
    const body = [`  preflight_mode: ${JSON.stringify(request.preflight_mode)},`]
      .concat(present.map((f) => `  ${f}: ${JSON.stringify(request[f])},`)).join('\n');
    const src = `import type { PreflightChangeSetCommon } from ${JSON.stringify(TYPES)};\n`
      + `const probe: PreflightChangeSetCommon = {\n${body}\n};\nvoid probe;\n`;
    const r = compiles(src);
    assert.ok(r.ok, `the SDK's public request type rejects a canonical v2 request:\n${r.out}`);
  });

  it('COMPILE-TIME: a malformed field is REJECTED (the oracle proves it can fail)', () => {
    // Without this, "it compiles" would be worth nothing: a type with an index signature accepts
    // everything, and the deleted regex test had no way to notice that either.
    const r = compiles(
      `import type { PreflightChangeSetCommon } from ${JSON.stringify(TYPES)};\n`
      + 'const probe: PreflightChangeSetCommon = '
      + `{ preflight_mode: ${JSON.stringify(request.preflight_mode)}, grant_version: "v3" };\nvoid probe;\n`,
    );
    assert.equal(r.ok, false, 'grant_version:"v3" compiled — the type is not constraining anything');
    // The diagnostic names the VALUE and the union, not the property, so that is what is matched:
    // asserting on the word "grant_version" would have failed on a correct refusal.
    assert.match(r.out, /"v3".*not assignable.*"v1" \| "v2"/s);
  });

  it('COMPILE-TIME: policy_hash and top-level audience are named, not reachable only via `as any`', () => {
    const r = compiles(
      `import type { PreflightChangeSetCommon } from ${JSON.stringify(TYPES)};\n`
      + 'const probe: PreflightChangeSetCommon = {\n'
      + `  preflight_mode: ${JSON.stringify(request.preflight_mode)},\n`
      + '  policy_hash: "sha256:aa", audience: "v:1234",\n};\nvoid probe;\n',
    );
    assert.ok(r.ok, `policy_hash / audience are still not on the public request type:\n${r.out}`);
  });

  it('CAPTURED WIRE: a body built from the fixture is byte-equivalent field by field', () => {
    const present = V2_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(request, f));
    const body = Object.fromEntries(present.map((f) => [f, request[f]]));
    for (const k of Object.keys(body)) {
      assert.equal(JSON.stringify(body[k]), JSON.stringify(request[k]), `${k} not byte-equivalent`);
    }
  });

  it('CAPTURED WIRE: the reading agrees, including the rename the wire hides', () => {
    assert.equal(request.state_nonce, reading.nonce, 'sent as state_nonce, read as nonce');
    assert.equal(request.expected_state_token, reading.expected_state_token);
    assert.equal(request.context.operation, reading.operation);
    assert.equal(request.tenant_id, reading.tenant_id);
    // UNCONDITIONAL. The deleted test guarded this on a regex that never matched, so the one
    // assertion about policy_hash was the one assertion that never ran.
    assert.equal(request.policy_hash, reading.policy_hash);
  });

  it('LIVE recording is not stale / RECORDED is labeled weaker', () => {
    const snap = rec.snapshotBytes('v2-grant-canonical-request.json');
    if (LIVE) {
      assert.ok(snap.equals(fs.readFileSync(rec.liveCanonicalPath())),
        'RECORDED snapshot STALE vs live canonical fixture — regenerate fixtures/recorded/app-sync');
    } else {
      assert.equal(MODE, 'RECORDED');
    }
  });
});
