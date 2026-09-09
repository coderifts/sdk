/**
 * LOCAL receipt verification — the proof, and the only thing on this surface that is one.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────
 *
 * MEASURED before it was written: this SDK's only `verifyReceipt` was
 * `client.verifyReceipt()` — an HTTP POST to `/api/v1/verify-receipt`. It answers well and it is
 * useful, and it is not an offline verification: the caller learns what CodeRifts says, over a
 * network, about bytes CodeRifts was handed. A reader told "verify offline, without us" and given
 * only that method has been told something the package could not do.
 *
 * This runs the SAME vendored core the public receipt-verifier and the conformance CLI run, in
 * process, over bytes already in memory plus a keyring the CALLER supplies. No API key, no
 * network, full Ed25519.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────────────────────
 *
 * It is not authorization. A valid signature says a holder of the named key signed these bytes and
 * that the receipt has not expired; it does not say the receipt permits the action you are about
 * to take. `client.verifyReceipt(token, intended)` answers that second question, on the server,
 * and `authorize()` answers the execution-binding one. Those are different questions and this
 * module deliberately answers only the first.
 *
 * It also cannot see REVOCATION or the issuer's clock. A key compromised five minutes ago still
 * verifies here, because nothing local can know. That is the whole reason
 * `verifyReceiptViaServer` exists beside it — as a mirror, never as the proof.
 */

import type { PinnedKeyring } from './authorize.js';
// ── A STATIC IMPORT, AND THAT IS THE POINT ──────────────────────────────────────────────────
//
// MEASURED on the built package when this module was written: `authorize()` loaded the same core
// with a bare `require(...)`, and `dist/esm/authorize.js` therefore threw `require is not defined`
// for every ESM consumer. The tests never saw it because they load the CJS source — a call-time
// `require` is invisible to the compiler in exactly the build where it cannot work.
//
// FIXED SINCE, in authorize.ts, the same way: static imports plus a default import of the vendored
// core. `test/dual-module-form.test.js` now loads dist/esm and scans it, so the defect is held
// shut as a class rather than in this one module. Past tense on purpose — a comment that keeps
// describing a live bug after it is closed sends the next reader looking for it.
//
// A static import is compiled to `require` for the CJS output and left as an import for the ESM
// one, so this module works in both — and the compiler, not a runtime, is what checks it.
//
// The DEFAULT import, not named ones. MEASURED on the built ESM package: node's cjs-module-lexer
// resolved `verifyReceipt` from the vendored CommonJS and NOT `keyringFromDocument`, so a named
// import compiled fine and threw at load time — "does not provide an export named". Taking
// `module.exports` whole and destructuring at runtime is interop that does not depend on a lexer
// guessing right about bytes this package is forbidden to edit.
import core from './vendor/receipt-verifier/verify.js';

/** The verdict, in the vocabulary the receipt-verifier and the conformance CLI already use. */
export interface LocalReceiptVerdict {
    /** True only when the signature verified against the pinned key and the receipt is current. */
    valid: boolean;
    /** VERIFIED_CURRENT · INVALID_SIGNATURE · MALFORMED · UNKNOWN_KEY · EXPIRED · … */
    status: string;
    /** Present on a refusal; the specific cause, not a class. */
    reason?: string;
    /** The decoded body, when the token decoded at all. Never evidence on its own. */
    payload?: Record<string, unknown>;
    /**
     * Said on every result, so a caller cannot read this as more than it is.
     *
     * A verdict that travels without its ceiling gets quoted without it.
     */
    does_not_prove: string[];
}

export interface VerifyReceiptLocalOptions {
    /**
     * THE KEYS YOU PIN, and the reason this is required rather than fetched.
     *
     * A verifier that downloads the key it is about to trust has not verified anything an attacker
     * on the path could not arrange. Fetching the keyring is a deployment decision — make it once,
     * pin the result, and hand it in.
     */
    keyring: PinnedKeyring;
    /** Refuse a token whose `kid` is not this one. Null (default) accepts any pinned kid. */
    expectedKid?: string | null;
    /** Clock injection. Absent = the host clock. */
    now?: number;
}

const DOES_NOT_PROVE = Object.freeze([
    'that the receipt AUTHORIZES the action you are about to take — a valid signature is '
    + 'authenticity, not authorization. Pass an intended context to the server verify, or use '
    + 'authorize() for the execution binding',
    'that the signing key is still trusted — REVOCATION and the issuer\'s clock are not visible '
    + 'to any local verifier, including this one. A key compromised a minute ago still verifies here',
    'that the bytes came from the run you think they did — this checks ONE token, and "these '
    + 'tokens are one run" is a property of a set (see cr.evidence.root.v1)',
]);

function toKeyringMap(keyring: PinnedKeyring): Map<string, unknown> {
    if (!keyring || !Array.isArray(keyring.keys) || keyring.keys.length === 0) {
        throw new TypeError('verifyReceipt: a keyring with at least one key is required — this '
            + 'verifier does not fetch keys, because a verifier that downloads the key it is about '
            + 'to trust has verified nothing an attacker on the path could not arrange');
    }
    // THE CORE'S OWN keyring parser, not a second one written here.
    //
    // `keyringFromDocument` is the function the receipt-verifier CLI and the conformance measure
    // both use. Re-implementing the parse in this file would be a second idea of what a keyring
    // is — the exact shape 1423 came from, where conformance had its own notion of checking and it
    // was weaker than prove's.
    const parsed = core.keyringFromDocument(keyring);
    // The core returns either a Map or a `{ byKid }` wrapper depending on the document shape it
    // was handed. Both are accepted here rather than the caller being told which to produce.
    const m = (parsed && (parsed as { byKid?: Map<string, unknown> }).byKid)
        || (parsed as Map<string, unknown>);
    if (!m || typeof m.get !== 'function' || m.size === 0) {
        throw new TypeError('verifyReceipt: the keyring contained no usable {kid, public_key_pem}');
    }
    return m;
}

/**
 * Verify a chain receipt LOCALLY. No network, no API key, full Ed25519.
 *
 * @example
 * import { verifyReceipt } from '@coderifts/sdk';
 * const r = verifyReceipt(token, { keyring: pinnedKeys });
 * if (!r.valid) throw new Error(`${r.status}: ${r.reason}`);
 */
export function verifyReceipt(
    token: string,
    options: VerifyReceiptLocalOptions,
): LocalReceiptVerdict {
    const ring = toKeyringMap(options && options.keyring);
    const r = core.verifyReceipt(token, {
        ctx: { keyring: ring, expectedKid: options.expectedKid ?? null },
        ...(Number.isFinite(options.now) ? { now: options.now } : {}),
    });
    return {
        valid: r.valid === true,
        status: r.status,
        ...(r.reason ? { reason: r.reason } : {}),
        ...(r.payload ? { payload: r.payload } : {}),
        does_not_prove: [...DOES_NOT_PROVE],
    };
}
