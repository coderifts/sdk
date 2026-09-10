'use strict';

/**
 * authorize()'s verdict IS the core's verdict (1463).
 *
 * The SDK does not get its own opinion about authorization. `authorize` shapes a TS caller's
 * inputs — PEM strings, plain objects — and hands them to the vendored predicate; the decision
 * comes back unchanged. This asserts the PROPERTY rather than today's answers: on a shared fixture
 * set, whatever the core says, authorize says. An edit to either side that moves one and not the
 * other fails here, even if both answers look plausible alone.
 *
 * `verifyExecutionGrant` is deliberately exercised alongside, because the two answer DIFFERENT
 * questions and the point of this release is that both remain askable: a token can verify
 * perfectly while the authorization is COMMIT_UNPROVEN.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const sdk = require('../dist/cjs/index.js');
const {
  verifiedExecutionBinding,
} = require('../src/vendor/receipt-verifier/verified-execution-binding.js');

const sha = (v) => `sha256:${crypto.createHash('sha256').update(String(v), 'utf8').digest('hex')}`;
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');

const issuer = crypto.generateKeyPairSync('ed25519');
const executor = crypto.generateKeyPairSync('ed25519');
const other = crypto.generateKeyPairSync('ed25519');
const IK = 'ISS';
const EK = 'EXEC';
const JTI = 'jti-parity';
const SCOPE = sha('cs');
const RD = sha('receipt');

const KEYRING = {
  keys: [{ kid: IK, public_key_pem: issuer.publicKey.export({ type: 'spki', format: 'pem' }), status: 'active' }],
};
const REGISTRY = {
  keys: [{
    kid: EK, public_key_pem: executor.publicKey.export({ type: 'spki', format: 'pem' }),
    status: 'active', valid_from: null, retired_at: null,
  }],
};
/** The same keyring in the core's own shape, so the two calls are given equal material. */
const RING = new Map(KEYRING.keys.map((k) => [k.kid, {
  publicKey: crypto.createPublicKey(k.public_key_pem), status: 'active', retired_at: null, compromised_at: null,
}]));

function grant(over = {}, key = issuer.privateKey) {
  const body = {
    v: 'cr.exec.v1', kid: IK, receipt_digest: RD, scope_hash: SCOPE, audience: 'v:x',
    operation: 'merge', target_id: 't', jti: JTI,
    iat: '2026-01-01T00:00:00Z', exp: '2099-01-01T00:00:00Z', ...over,
  };
  const parts = ['crexec.v1', body.kid, body.receipt_digest, body.scope_hash, body.audience,
    body.operation, body.target_id, body.jti, body.iat, body.exp];
  return `${b64(body)}.${crypto.sign(null, Buffer.from(parts.join('|'), 'utf8'), key).toString('base64url')}`;
}
const REAL = grant();
const FORGED = `${REAL.split('.')[0]}.${Buffer.from('NOPE').toString('base64url')}`;
const WRONG_KEY = grant({}, other.privateKey);
const OTHER_RUN = grant({ jti: 'jti-other', scope_hash: sha('other') });

const attBody = {
  v: sdk.ATTEST_VERSION, executor_kid: EK, grant_jti: JTI, receipt_digest: RD,
  scope_hash: SCOPE, committed_at: new Date(Date.now() - 1000).toISOString(),
};
const ATTEST = [sdk.ATTEST_ENVELOPE_TAG, EK, b64(attBody),
  crypto.sign(null, Buffer.from(sdk.attestSigningInput(attBody), 'utf8'), executor.privateKey).toString('base64url'),
].join('|');

/** The SAME evidence, asked twice: once through the SDK, once through the core directly. */
function bothWays({ token = REAL, keyring = KEYRING, committed = true, attest = ATTEST, required } = {}) {
  const viaSdk = sdk.authorize({
    receipt: { verified: true },
    grant: { token, keyring },
    attestation: { token: attest, registry: REGISTRY },
    committed,
    ...(required ? { required } : {}),
  });
  const viaCore = verifiedExecutionBinding({
    receipt: { verified: true },
    grant: { token, keyring: keyring ? RING : null, expectedKid: null },
    attestation: { token: attest, registry: REGISTRY, verify: sdk.verifyExecutionAttestation },
    committed,
    ...(required ? { required } : { required: ['issuer_grant', 'executor_attestation'] }),
  });
  return { sdk: viaSdk, core: viaCore };
}

const CASES = {
  'a real issuer grant': {},
  'a forged signature': { token: FORGED },
  'a grant signed by the wrong key': { token: WRONG_KEY },
  'a real grant from another run': { token: OTHER_RUN },
  'no grant at all': { token: '' },
  'a real grant with no keyring': { keyring: null },
  'a real grant, not committed': { committed: false },
  'no attestation': { attest: null },
  'one_run_root demanded but absent': { required: ['issuer_grant', 'one_run_root'] },
  'provider_witness demanded but absent': { required: ['issuer_grant', 'provider_witness'] },
};

describe('authorize() quotes the core predicate', () => {
  for (const [name, over] of Object.entries(CASES)) {
    it(`PARITY: ${name}`, () => {
      const r = bothWays(over);
      assert.equal(r.sdk.authorized_and_committed, r.core.authorized_and_committed,
        `verdicts differ on "${name}"`);
      assert.equal(r.sdk.state, r.core.state, `states differ on "${name}"`);
      assert.deepEqual(r.sdk.shortfalls, r.core.shortfalls, `shortfalls differ on "${name}"`);
    });
  }

  it('the positive control is TRUE, so parity is not agreement on refusing everything', () => {
    // A CUSTOM authority set, so the field to read is `requirements_satisfied`. The core no longer
    // lets a custom set reach `authorized_and_committed` — and the receipt here is a caller's
    // `verified: true` with no token, which is the second reason it cannot be the global claim.
    const r = bothWays();
    assert.equal(r.sdk.requirements_satisfied, true, JSON.stringify(r.sdk.shortfalls));
    assert.equal(r.sdk.state, 'CUSTOM_REQUIREMENTS_SATISFIED');
    assert.equal(r.sdk.authorized_and_committed, false,
      'a custom set with an unverified receipt must not read as the global claim');
  });

  it('the named states are reachable and distinct — a boolean would lose all of this', () => {
    assert.equal(bothWays({ token: FORGED }).sdk.state, 'UNAUTHORIZED');
    assert.equal(bothWays({ attest: null }).sdk.state, 'COMMIT_UNPROVEN');
    assert.equal(bothWays({ committed: false }).sdk.state, 'NOT_COMMITTED');
    assert.equal(bothWays({ required: ['issuer_grant', 'one_run_root'] }).sdk.state, 'ONE_RUN_UNPROVEN');
    assert.equal(bothWays({ required: ['issuer_grant', 'provider_witness'] }).sdk.state, 'RECORDED_UNWITNESSED');
  });

  it('ADDITIVE: verifyExecutionGrant still answers its OWN question, unchanged', () => {
    // A token can verify perfectly while the authorization is COMMIT_UNPROVEN. That the two
    // answers differ on the same bytes is the reason both surfaces exist.
    const v = sdk.verifyExecutionGrant(REAL, {
      publicKeyPem: KEYRING.keys[0].public_key_pem,
    });
    assert.equal(v.valid, true, `${v.status}/${v.reason}`);
    assert.equal(v.status, 'GRANT_CURRENT');
    assert.equal(bothWays({ attest: null }).sdk.state, 'COMMIT_UNPROVEN');
  });

  it('the exported state constants match the states the core actually returns', () => {
    const seen = new Set(Object.values(CASES).map((o) => bothWays(o).sdk.state));
    for (const s of seen) {
      assert.ok(Object.values(sdk.AUTHORIZATION_STATE).includes(s), `${s} is not exported`);
    }
  });
});

describe('the vendored core is receipt-verifier\'s, byte for byte', () => {
  const DIR = path.join(__dirname, '..', 'src', 'vendor', 'receipt-verifier');
  const pinned = () => fs.readFileSync(path.join(DIR, 'VENDOR.sha256'), 'utf8').split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const [sha256, file] = l.trim().split(/\s+/); return { sha256, file }; });

  it('every vendored file matches its pinned digest', () => {
    const rows = pinned();
    assert.ok(rows.length >= 7, 'the pin must cover the whole module closure');
    for (const { sha256, file } of rows) {
      const bytes = fs.readFileSync(path.join(DIR, file));
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha256, file);
    }
  });

  it('the pin names a revision per file, and nothing reaches outside the vendor dir', () => {
    const header = fs.readFileSync(path.join(DIR, 'VENDOR.sha256'), 'utf8');
    for (const { file } of pinned()) {
      // WORKING-TREE is an allowed token for a file vendored ahead of its upstream commit — a
      // named state, and the next test compares those bytes against the sibling working tree
      // rather than skipping them.
      assert.match(header, new RegExp(`#\\s+${file.replace(/[./]/g, '\\$&')}\\s+([0-9a-f]{40}|WORKING-TREE)`),
        `${file} has no revision in the pin header`);
      const src = fs.readFileSync(path.join(DIR, file), 'utf8');
      for (const m of src.matchAll(/require\('(\.[^']*)'\)/g)) {
        assert.ok(!m[1].startsWith('../'), `${file} requires outside the vendor dir: ${m[1]}`);
      }
    }
  });

  it('the vendored bytes equal their pinned upstream revision, when the source repo is present', (t) => {
    const SOURCE = path.join(process.env.HOME || '', 'receipt-verifier');
    if (!fs.existsSync(SOURCE)) {
      t.skip('receipt-verifier is not checked out beside this repo — the pin was verified, '
        + 'upstream parity was not');
      return;
    }
    // ── THE TAG, NOT A WORKING TREE ────────────────────────────────────────────────────────
    //
    // This read a per-file revision out of the pin header and, where it said WORKING-TREE,
    // compared against whatever was in the sibling checkout. A working tree is not a provenance
    // anyone else can resolve: "the vendored bytes match upstream" then meant "they match whatever
    // is on this machine right now", which is a sentence rather than a check.
    //
    // The sibling is still where the bytes come from — nothing here reaches a network — but the
    // comparison is against v1.0.0, so a sibling on another branch, or with uncommitted edits,
    // can no longer make this pass.
    const { spawnSync } = require('node:child_process');
    const TAG = 'v1.0.2';
    const peeled = spawnSync('git', ['-C', SOURCE, 'rev-parse', `${TAG}^{commit}`], { encoding: 'utf8' });
    assert.equal(peeled.status, 0,
      `receipt-verifier has no ${TAG} tag — the vendored core cannot be traced to a release`);
    assert.equal(peeled.stdout.trim(), 'ac683b16c19662c9124c8cdab785223b28d2d0c6',
      `${TAG} points somewhere other than the commit this pin names`);

    // ── THE TAG IS VERIFIED, NOT MERELY RESOLVED ────────────────────────────────────────────
    //
    // `rev-parse` proves the tag points where the pin says. It does not prove the tag is the one
    // the releaser cut: an unsigned tag is a name anyone with push access can move, and this check
    // would keep passing after it moved, as long as the bytes moved with it.
    //
    // v1.0.1 is annotated and SSH-signed, so the pin resolves to an IDENTITY. This asserts that
    // the signature verifies AND that it verifies against the fingerprint recorded in the pin —
    // "signed" alone would accept a signature by anyone at all.
    //
    // MEASURED: `git tag -v` exits 0 and writes its verdict to STDERR, not stdout. A check reading
    // stdout finds nothing there and can be written to "pass" on a tag it never verified.
    const SIGNER_FPR = 'SHA256:7yRXTm9zKGicfFpzL+7lpwFoPaoSwxAJlabB3jwxw2Y';
    const sig = spawnSync('git', ['-C', SOURCE, 'tag', '-v', TAG], { encoding: 'utf8' });
    const verdict = `${sig.stdout || ''}${sig.stderr || ''}`;
    assert.equal(sig.status, 0, `${TAG} does not verify as a signed tag:\n${verdict}`);
    assert.match(verdict, /Good .*signature/,
      `${TAG} carries no good signature — the vendored core cannot be traced to a signed release`);
    assert.ok(verdict.includes(SIGNER_FPR),
      `${TAG} is signed, but NOT by the key this pin records (${SIGNER_FPR}):\n${verdict}`);

    let compared = 0;
    for (const { file } of pinned()) {
      const r = spawnSync('git', ['-C', SOURCE, 'show', `${TAG}:${file}`], { maxBuffer: 1 << 24 });
      // Not every vendored file comes from the core; the header says which. One absent at the tag
      // is skipped here and still covered by its own digest row.
      if (r.status !== 0) continue;
      compared += 1;
      assert.ok(fs.readFileSync(path.join(DIR, file)).equals(r.stdout),
        `${file} has drifted from receipt-verifier@${TAG}`);
    }
    assert.ok(compared >= 3, `only ${compared} file(s) compared against ${TAG}`);
  });
});

describe('the closed profile is REACHABLE from this surface (1504)', () => {
  /**
   * ── THE MEASURED GAP ────────────────────────────────────────────────────────────────────
   *
   * `authorize()` did not pass `profile` through at all. A caller holding a complete capture —
   * grant, attestation and a one-run evidence root — could not ask for `authorized_and_committed`
   * by any means: every answer was `CUSTOM_REQUIREMENTS_SATISFIED`, the honest name for a narrower
   * question, and here the ONLY name available.
   *
   * That is the failure mode this file has to catch, because it is invisible from inside: the
   * surface kept answering, the answers kept being true, and the strongest claim was unreachable.
   */
  const core = require('../src/vendor/receipt-verifier/verified-execution-binding.js');

  it('the input type accepts `profile`, and the call forwards it', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'authorize.ts'), 'utf8');
    assert.match(src, /profile\?: string;/, 'AuthorizeInput has no `profile`');
    assert.match(src.slice(src.indexOf('verifiedExecutionBinding(')), /\.\.\.\(input\.profile \?/,
      'the core call does not forward `profile`');
  });

  it('a caller that names the profile without the evidence is refused, not upgraded', () => {
    // The direction that matters: naming a profile must not be a way to ASK for the claim, only
    // a way to have it judged against a set nobody can shorten.
    const r = core.verifiedExecutionBinding({
      receipt: { verified: true },
      grant: { token: '', keyring: null, expectedKid: null },
      committed: true,
      profile: 'TRUSTED_EXECUTOR_INTEGRITY_V1',
    });
    assert.equal(r.authorized_and_committed, false);
    assert.equal(r.profile, 'TRUSTED_EXECUTOR_INTEGRITY_V1');
  });

  it('profile + required together is REFUSED — the set is not editable', () => {
    const r = core.verifiedExecutionBinding({
      receipt: { verified: true },
      grant: { token: '', keyring: null, expectedKid: null },
      committed: true,
      profile: 'TRUSTED_EXECUTOR_INTEGRITY_V1',
      required: ['issuer_grant'],
    });
    assert.equal(r.authorized_and_committed, false);
    assert.ok(r.shortfalls[0].includes('not editable'), r.shortfalls.join('; '));
  });

  it('NEGATIVE CONTROL: receipt {verified:true} with no token cannot be the global claim', () => {
    const r = core.verifiedExecutionBinding({
      receipt: { verified: true },
      grant: { token: '', keyring: null, expectedKid: null },
      committed: true,
      profile: 'TRUSTED_EXECUTOR_INTEGRITY_V1',
    });
    assert.equal(r.receipt_caller_asserted, true);
    assert.equal(r.authorized_and_committed, false);
  });
});
