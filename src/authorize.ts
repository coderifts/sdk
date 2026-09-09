// @ts-nocheck — this package does not ship @types/node; crypto/Buffer are Node 18+ globals.
/**
 * authorize() — the AUTHORIZATION question, as a first-class SDK surface (1463).
 *
 * ── WHY THIS IS NOT verifyExecutionGrant ────────────────────────────────────────────────────
 *
 * They answer different questions, and conflating them is how a caller ends up treating a verified
 * token as permission:
 *
 *   verifyExecutionGrant   is THIS TOKEN authentic, current and bound to what I intended?
 *                          One signature, one answer. Unchanged by this file.
 *   authorize()            may this change be treated as authorized AND committed?
 *                          Four independent authorities, and only their INTERSECTION.
 *
 * A grant can verify perfectly and still not authorize a commit: nothing attested that the commit
 * happened, or the tokens are not shown to be one run, or the provider never witnessed it. Those
 * are different facts with different remedies, and a boolean loses all of them — which is why the
 * result carries a NAMED state.
 *
 * ── IT QUOTES, IT DOES NOT RECOMPUTE ────────────────────────────────────────────────────────
 *
 * The verdict comes from the vendored `verifiedExecutionBinding` (receipt-verifier ce5fd34), the
 * same predicate the guard, Prove, conformance and the contract-gate quote. A TS caller therefore
 * reads the same vocabulary those four print. This file only SHAPES inputs: PEM strings and plain
 * objects in, the core's decision out.
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────────────────────
 *
 * No network, no key discovery, no clock beyond the one you pass. Every input is supplied by the
 * caller. And a `true` here is not a claim that the provider merged anything: `provider_witness`
 * is an unsigned readback unless you say otherwise, which is what RECORDED_UNWITNESSED names.
 */

import { createPublicKey } from 'crypto';

// ── STATIC IMPORTS, BECAUSE A CALL-TIME `require` BROKE EVERY ESM CONSUMER ──────────────────
//
// These two were loaded inside `authorize()` with a bare `require(...)`. MEASURED against the
// published 3.14.0 tarball, installed into a fresh project and imported from a real `.mjs`:
//
//   import { authorize } from '@coderifts/sdk';   ->  authorize typeof: function
//   authorize({...})                              ->  ReferenceError: require is not defined
//                                                     in ES module scope, at dist/esm/authorize.js:64
//
// So the function IMPORTED and could not be CALLED — which is why it survived: the export existed,
// the types were right, and nothing failed until an adopter ran it. The suite never saw it either,
// because the tests load the CJS build, and a call-time `require` is invisible to the compiler in
// exactly the build where it cannot work.
//
// A static import is compiled to `require` in the CJS output and left as an `import` in the ESM
// one. The module form stops being something a runtime discovers and becomes something `tsc`
// emits — which is the whole fix. `verify-receipt-local.ts` was already written this way; this is
// the same treatment applied to the path that still had the defect.
//
// The DEFAULT import for the vendored core, and its reasoning is recorded beside it in
// `verified-execution-binding.d.ts`: named imports out of vendored CommonJS depend on node's
// cjs-module-lexer surfacing each name, which it does not always do, and the failure lands at load
// time rather than at compile time.
//
// NEITHER LOAD IS CONDITIONAL AND NEITHER WAS LAZY FOR A REASON. Checked before moving them:
// `execution-attestation.ts` imports only `crypto` and `./leeway.js`, and nothing imports
// `authorize.ts` except `index.ts` and a TYPE-only import in `verify-receipt-local.ts` — so there
// is no cycle these `require`s were quietly working around.
import bindingCore from './vendor/receipt-verifier/verified-execution-binding.js';
import { verifyExecutionAttestation } from './execution-attestation.js';

const { verifiedExecutionBinding } = bindingCore;

/**
 * The shortfall vocabulary, shared with the guard, Prove, conformance and the contract-gate.
 * Ordered by severity: the state returned is the MOST serious thing that is wrong.
 */
export type AuthorizationState =
    | 'AUTHORIZED_AND_COMMITTED'
    /** The receipt or the issuer grant did not verify — nothing downstream is worth reading. */
    | 'UNAUTHORIZED'
    /** Authorized, but no executor attestation binds this grant to a commit. */
    | 'COMMIT_UNPROVEN'
    /** Authorized and committed, but the tokens are not shown to come from ONE run. */
    | 'ONE_RUN_UNPROVEN'
    /** Everything above holds, and no provider signed a witness of it. */
    | 'RECORDED_UNWITNESSED'
    /**
     * A CUSTOM authority set was satisfied — and this is deliberately NOT the global claim.
     *
     * A caller that names its own `required[]` asks a narrower question, and the core will not
     * answer a narrower question with the widest word. Read `requirements_satisfied` for "my set
     * passed"; read `authorized_and_committed` only for the closed-profile claim.
     */
    | 'CUSTOM_REQUIREMENTS_SATISFIED'
    /** The evidence is in order and the change was not committed. */
    | 'NOT_COMMITTED';

/** The four independent authorities. Only their intersection yields success. */
export type AuthorityName =
    | 'issuer_grant'
    | 'executor_attestation'
    | 'one_run_root'
    | 'provider_witness';

export interface AuthorityResult {
    ok: boolean;
    /** Whether THIS call demanded it — an authority you did not require cannot fail you. */
    required: boolean;
    detail: string;
}

export interface AuthorizeResult {
    /** True only when every REQUIRED authority holds and the change was committed. */
    authorized_and_committed: boolean;
    /**
     * Did the set THIS CALLER asked for pass? True for a satisfied closed profile and for a
     * satisfied custom aggregation alike — so a caller that only wants its own answer never has
     * to reach for the global one because it was the only boolean available.
     */
    requirements_satisfied: boolean;
    state: AuthorizationState;
    authorities: Record<AuthorityName, AuthorityResult>;
    /** One line per unmet required authority, in the core's words. */
    shortfalls: string[];
    /** Carried verbatim from the core, so a caller cannot read success as more than it is. */
    does_not_prove: string[];
}

/** A pinned issuer key registry, in the shape `.well-known/coderifts-keys.json` uses. */
export interface PinnedKeyring {
    keys: Array<{
        kid: string;
        public_key_pem: string;
        status?: string;
    }>;
}

export interface AuthorizeInput {
    /**
     * The decision receipt's verification result. `verified` is YOUR determination — this call
     * does not re-verify it, and passing `true` for an unverified receipt is the one way to make
     * this function lie for you.
     */
    receipt: {
        /**
         * YOUR determination, accepted only as a custom caller's own. Supplying this alone can no
         * longer produce `authorized_and_committed`: the core marks the result caller-asserted.
         */
        verified: boolean;
        /** The receipt's exact bytes. With a key source below, THE CORE verifies them. */
        token?: string;
        keyring?: PinnedKeyring | null;
        publicKeyPem?: string;
        expectedKid?: string | null;
        now?: number;
    };
    /**
     * THE EXACT BYTES THE ISSUER SIGNED. Not a grant read back out of a tool result: a caller who
     * lets the executed tool hand back its own authorization has already lost.
     */
    grant: {
        token: string;
        keyring?: PinnedKeyring | null;
        publicKeyPem?: string;
        expectedKid?: string | null;
        intended?: Record<string, unknown>;
        now?: number;
    };
    /** The executor's commit attestation, and the customer-pinned executor registry. */
    attestation?: {
        token: string | null;
        registry?: unknown;
    };
    /** A cr.prove.artifact.v1 carrying a cr.evidence.root.v1, and the executor key it is signed with. */
    evidenceRoot?: {
        artifact: Record<string, unknown>;
        executorPublicKeyPem: string;
        sidecars?: Record<string, string>;
    } | null;
    /** Only `signed: true` makes this authority hold; an unsigned readback never does. */
    providerReadback?: { signed: boolean } | null;
    committed: boolean;
    /**
     * A CLOSED, VERSIONED assurance profile — the only way to reach `authorized_and_committed`.
     *
     * ── THE MEASURED GAP THIS CLOSES ────────────────────────────────────────────────────────
     *
     * The core reserves the global claim for a profile whose authority set the caller cannot
     * shorten. This surface did not pass `profile` through AT ALL, so an SDK caller holding a
     * complete capture — grant, attestation and a one-run evidence root — could not ask for that
     * claim by any means. Every answer was `CUSTOM_REQUIREMENTS_SATISFIED`, which is the honest
     * name for a narrower question, and here it was the only name available.
     *
     * A profile's set is NOT editable: passing `profile` and `required` together is refused by the
     * core rather than resolved by precedence, because that asks two different questions at once.
     */
    profile?: string;
    /**
     * Which authorities this caller demands, when it is aggregating its own set. Defaults to
     * issuer_grant + executor_attestation — the pair a holder of a grant and an attestation can
     * actually establish. Ask for more only when you hold the evidence for it, or the answer will
     * name a shortfall about evidence you were never going to supply.
     *
     * A satisfied custom set reads `CUSTOM_REQUIREMENTS_SATISFIED`, never the global claim. That
     * is not a downgrade: it is the difference between "the set I chose passed" and "this run is
     * authorized and committed", and only a closed profile can say the second.
     */
    required?: AuthorityName[];
}

function toKeyringMap(keyring: PinnedKeyring | null | undefined): Map<string, unknown> | null {
    if (!keyring || !Array.isArray(keyring.keys) || keyring.keys.length === 0) return null;
    const m = new Map<string, unknown>();
    for (const k of keyring.keys) {
        if (!k || typeof k.kid !== 'string' || typeof k.public_key_pem !== 'string') continue;
        m.set(k.kid, {
            publicKey: createPublicKey(k.public_key_pem),
            status: k.status || 'active',
            retired_at: null,
            compromised_at: null,
        });
    }
    return m.size > 0 ? m : null;
}

/**
 * Decide whether a change may be treated as authorized and committed.
 *
 * @example
 * const r = authorize({
 *   receipt: { verified: true },
 *   grant: { token: grantToken, keyring: issuerKeys },
 *   attestation: { token: attestToken, registry: executorKeys },
 *   committed: true,
 * });
 * if (!r.authorized_and_committed) throw new Error(`${r.state}: ${r.shortfalls.join('; ')}`);
 */
export function authorize(input: AuthorizeInput): AuthorizeResult {
    const g = input.grant || ({} as AuthorizeInput['grant']);
    const att = input.attestation;
    const root = input.evidenceRoot;

    return verifiedExecutionBinding({
        // ── THE RECEIPT, VERIFIED BY THE CORE WHEN THE CALLER SUPPLIES IT ────────────────
        //
        // `receipt: { verified: true }` was the caller's word, and this function's own doc-comment
        // called it "the one way to make this function lie for you". The core now refuses to build
        // the global claim on it: with a token and a keyring it verifies the receipt itself, and
        // without them the result is marked caller-asserted and cannot reach
        // AUTHORIZED_AND_COMMITTED.
        //
        // Both shapes are still accepted, because a caller that genuinely verified elsewhere is
        // entitled to say so — what changed is that saying so no longer buys the strongest word.
        receipt: input.receipt && input.receipt.token
            ? {
                token: input.receipt.token,
                keyring: toKeyringMap(input.receipt.keyring),
                ...(input.receipt.publicKeyPem
                    ? { publicKey: createPublicKey(input.receipt.publicKeyPem) } : {}),
                expectedKid: input.receipt.expectedKid ?? null,
                ...(Number.isFinite(input.receipt.now) ? { now: input.receipt.now } : {}),
            }
            : { verified: !!(input.receipt && input.receipt.verified === true) },
        grant: {
            token: g.token || '',
            keyring: toKeyringMap(g.keyring),
            ...(g.publicKeyPem ? { publicKey: createPublicKey(g.publicKeyPem) } : {}),
            expectedKid: g.expectedKid ?? null,
            ...(g.intended ? { intended: g.intended } : {}),
            ...(Number.isFinite(g.now) ? { now: g.now } : {}),
        },
        ...(att
            ? {
                attestation: {
                    token: att.token,
                    registry: att.registry,
                    // Handed in rather than reimplemented: the core holds no attestation format
                    // knowledge of its own, and this SDK already owns that verifier.
                    verify: verifyExecutionAttestation,
                },
            }
            : {}),
        ...(root
            ? {
                evidenceRoot: {
                    artifact: root.artifact,
                    executorKey: createPublicKey(root.executorPublicKeyPem),
                    sidecars: root.sidecars,
                },
            }
            : {}),
        ...(input.providerReadback ? { providerReadback: input.providerReadback } : {}),
        committed: input.committed === true,
        ...(input.profile ? { profile: input.profile } : {}),
        ...(input.required ? { required: input.required } : {}),
    }) as AuthorizeResult;
}

/** The states, as values, for callers that switch on them. */
export const AUTHORIZATION_STATE: Record<string, AuthorizationState> = Object.freeze({
    AUTHORIZED_AND_COMMITTED: 'AUTHORIZED_AND_COMMITTED',
    UNAUTHORIZED: 'UNAUTHORIZED',
    COMMIT_UNPROVEN: 'COMMIT_UNPROVEN',
    ONE_RUN_UNPROVEN: 'ONE_RUN_UNPROVEN',
    RECORDED_UNWITNESSED: 'RECORDED_UNWITNESSED',
    CUSTOM_REQUIREMENTS_SATISFIED: 'CUSTOM_REQUIREMENTS_SATISFIED',
    NOT_COMMITTED: 'NOT_COMMITTED',
});
