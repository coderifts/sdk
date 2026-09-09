'use strict';

/**
 * THE OFFLINE PROOF — and the measurement that made it necessary.
 *
 * ── WHAT WAS MEASURED ───────────────────────────────────────────────────────────────────────
 *
 * This SDK's only `verifyReceipt` was `client.verifyReceipt()`: `POST /api/v1/verify-receipt`. It
 * answers well, and it is not an offline verification — the caller learns what CodeRifts says,
 * over a network, about bytes CodeRifts was handed. Any README sentence about verifying "without
 * CodeRifts" was, on this package, unsupported.
 *
 * The vendored core was already here and already byte-identical to receipt-verifier's. What was
 * missing was a surface that used it. That is the whole change.
 *
 * ── WHY "NO NETWORK" IS ASSERTED AND NOT ASSUMED ────────────────────────────────────────────
 *
 * "It does not call out" is exactly the kind of claim that is true when written and false three
 * refactors later, because nothing fails when it stops being true. The traps below make the
 * failure loud: any network entry point reached during a verify throws.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { verifyReceipt } = require('../src/verify-receipt-local.ts');

const FIXTURE = path.join(process.env.HOME || '', 'coderifts-conformance',
    'fixtures', 'recorded', 'end-to-end');
const KEYS = path.join(process.env.HOME || '', 'coderifts-conformance',
    'lib', 'vendor', 'receipt-verifier', 'keys', 'coderifts-keys.json');
const have = fs.existsSync(path.join(FIXTURE, 'transcript.json')) && fs.existsSync(KEYS);

/** The receipt this package must be able to verify without asking anyone. */
function load() {
    const a = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'transcript.json'), 'utf8'));
    return {
        token: a.issuance.chain_receipt,
        keyring: JSON.parse(fs.readFileSync(KEYS, 'utf8')),
        now: Date.parse(a.issuance.grant.not_before) + 1000,
    };
}

/**
 * Flip ONE BIT of the decoded signature, and refuse to return if that changed nothing.
 *
 * Not `s.slice(0, -1) + 'A'`: an Ed25519 signature is 64 bytes in 86 base64url characters, so the
 * final character carries four bits that decode to nothing. That mutation is a NO-OP for 16 of 64
 * possible last characters — measured, and it was live in this repository's own controls once.
 */
function flipSignatureByte(token) {
    const sep = token.includes('|') ? '|' : '.';
    const i = token.lastIndexOf(sep);
    const sig = Buffer.from(token.slice(i + 1), 'base64url');
    const out = Buffer.from(sig);
    out[0] ^= 0x01;
    assert.ok(!out.equals(sig), 'the mutation did not change the signature bytes');
    const flipped = token.slice(0, i + 1) + out.toString('base64url');
    assert.equal(flipped.split(sep).length, token.split(sep).length,
        'this mangled the token instead of flipping one signature bit');
    return flipped;
}

describe('verifyReceipt runs LOCALLY', { skip: have ? false : 'the conformance capture is not beside this repo — NOT RUN, not passed' }, () => {
    it('a valid receipt verifies, with no key discovery and no network', () => {
        const { token, keyring, now } = load();
        const r = verifyReceipt(token, { keyring, now });
        assert.equal(r.valid, true, `${r.status}: ${r.reason}`);
        assert.equal(r.status, 'VERIFIED_CURRENT');
    });

    it('a TAMPERED receipt is refused — the signature, not the shape', () => {
        // The direction that matters. A verifier that refused everything would pass a test that
        // only asserted "not valid", so the STATUS is pinned: this failed on the signature, not
        // because the token stopped parsing.
        const { token, keyring, now } = load();
        const r = verifyReceipt(flipSignatureByte(token), { keyring, now });
        assert.equal(r.valid, false);
        assert.equal(r.status, 'INVALID_SIGNATURE');
        assert.equal(r.reason, 'signature_mismatch');
    });

    it('a receipt signed by a key NOT in the pinned keyring is refused', () => {
        const { token, now } = load();
        const { publicKey } = crypto.generateKeyPairSync('ed25519');
        const stranger = {
            keys: [{
                kid: 'SOMEONE-ELSE',
                public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
            }],
        };
        const r = verifyReceipt(token, { keyring: stranger, now });
        assert.equal(r.valid, false);
    });

    it('an EMPTY keyring is a TypeError, not a pass — this verifier does not fetch keys', () => {
        // A verifier that downloads the key it is about to trust has verified nothing an attacker
        // on the path could not arrange. Refusing to run is the honest answer.
        const { token, now } = load();
        assert.throws(() => verifyReceipt(token, { keyring: { keys: [] }, now }), /keyring/);
        assert.throws(() => verifyReceipt(token, {}), /keyring/);
    });

    it('the verdict carries its ceiling — authorization, revocation, one-run', () => {
        const { token, keyring, now } = load();
        const r = verifyReceipt(token, { keyring, now });
        const text = r.does_not_prove.join('\n');
        assert.match(text, /authenticity, not authorization/i);
        assert.match(text, /REVOCATION/);
        assert.match(text, /property of a set/i);
    });
});

describe('NO NETWORK — asserted, not assumed', { skip: have ? false : 'capture absent' }, () => {
    const traps = [];
    let tripped = [];

    before(() => {
        // Every JavaScript-level way out. The residual is stated rather than hidden: a native
        // addon or a pre-opened socket would evade this, and a `node:crypto` verify over bytes in
        // memory plus one caller-supplied object reaches neither.
        const trap = (obj, name) => {
            if (!obj || typeof obj[name] !== 'function') return;
            const original = obj[name];
            traps.push(() => { obj[name] = original; });
            // eslint-disable-next-line no-param-reassign
            obj[name] = (...args) => { tripped.push(name); return original.apply(obj, args); };
        };
        trap(globalThis, 'fetch');
        const http = require('node:http');
        const https = require('node:https');
        const net = require('node:net');
        for (const [mod, fn] of [[http, 'request'], [http, 'get'], [https, 'request'],
            [https, 'get'], [net, 'connect'], [net, 'createConnection']]) trap(mod, fn);
    });
    after(() => { for (const undo of traps) undo(); });

    it('a local verify trips no network entry point', () => {
        tripped = [];
        const { token, keyring, now } = load();
        const r = verifyReceipt(token, { keyring, now });
        assert.equal(r.valid, true);
        assert.deepEqual(tripped, [], `the local verify reached the network: ${tripped.join(', ')}`);
    });

    it('the traps are LIVE — proved before they are trusted', () => {
        // A trap that never fires and a trap that is not installed look identical.
        tripped = [];
        try { require('node:net').connect({ host: '127.0.0.1', port: 1 }).destroy(); } catch (_) { /* refused is fine */ }
        assert.ok(tripped.includes('connect'), 'the network trap did not fire on a real attempt');
    });
});

describe('the vendored core is receipt-verifier\'s, byte for byte', () => {
    it('verify.js matches its pinned digest', () => {
        const dir = path.join(__dirname, '..', 'src', 'vendor', 'receipt-verifier');
        const pin = fs.readFileSync(path.join(dir, 'VENDOR.sha256'), 'utf8');
        const row = pin.split('\n').map((l) => l.trim())
            .find((l) => /^[0-9a-f]{64}\s+verify\.js$/.test(l));
        assert.ok(row, 'verify.js is not pinned');
        const [digest] = row.split(/\s+/);
        const bytes = fs.readFileSync(path.join(dir, 'verify.js'));
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), digest);
    });

    it('and is byte-identical to the source repo when it is present', (t) => {
        const upstream = path.join(process.env.HOME || '', 'receipt-verifier', 'verify.js');
        if (!fs.existsSync(upstream)) {
            t.skip('receipt-verifier is not beside this repo — the pin was checked, upstream parity was NOT');
            return;
        }
        const dir = path.join(__dirname, '..', 'src', 'vendor', 'receipt-verifier');
        assert.ok(fs.readFileSync(path.join(dir, 'verify.js')).equals(fs.readFileSync(upstream)),
            'the vendored verify.js has drifted from receipt-verifier');
    });
});

describe('the server verify is a MIRROR, and the names say so', () => {
    it('the client method is verifyReceiptViaServer, and it is the one that POSTs', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'client.ts'), 'utf8');
        assert.match(src, /async verifyReceiptViaServer\(/);
        const method = src.slice(src.indexOf('async verifyReceiptViaServer('));
        assert.match(method.slice(0, 1200), /\/api\/v1\/verify-receipt/);
    });

    it('its docstring calls itself a mirror and points at the local proof', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'client.ts'), 'utf8');
        const doc = src.slice(src.indexOf('─── 9. verifyReceiptViaServer'),
            src.indexOf('async verifyReceiptViaServer('));
        assert.match(doc, /NOT the offline proof/);
        assert.match(doc, /verifyReceipt\(\)` from the package root/);
    });

    it('the local verify is exported from the package ROOT', () => {
        const idx = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');
        assert.match(idx, /export \{ verifyReceipt \} from '\.\/verify-receipt-local\.js';/);
    });
});

describe('the README does not claim offline it cannot deliver', () => {
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  /**
   * The same prose with runs of whitespace collapsed.
   *
   * The README WRAPS. A regex with a literal space fails on "about to\ntrust" while the sentence
   * is right there — and the assertion then reports a missing statement the doc makes, which
   * teaches a reader to distrust the gate. (The same fix the RECEIPT_FORMAT drift gate needed.)
   */
  const flat = readme.replace(/\s+/g, ' ');

  it('every offline claim points at the LOCAL verify, never at the server one', () => {
    // The failure this guards: a sentence about verifying "without CodeRifts" beside a method
    // that POSTs to CodeRifts. That was the state before this change — and no test could fail,
    // because the sentence and the method were in different files.
    for (const line of readme.split('\n')) {
      if (!/offline/i.test(line)) continue;
      assert.doesNotMatch(line, /verifyReceiptViaServer/,
        `an offline claim names the server mirror: ${line}`);
    }
  });

  it('the mirror is named as one wherever it appears', () => {
    assert.match(flat, /MIRROR, not the proof/);
    assert.match(flat, /not a verification you performed/);
  });

  it('the local verify is documented as requiring a pinned keyring, never fetching', () => {
    assert.match(flat, /never fetched/);
    assert.match(flat, /downloads the key it is about to trust/);
  });

  it('the ceiling is in the README, not only in the code', () => {
    for (const limit of [/not authorization/i, /not revocation/i, /not one run/i]) {
      assert.match(flat, limit, `the README omits: ${limit}`);
    }
  });
});
