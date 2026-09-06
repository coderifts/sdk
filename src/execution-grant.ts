// @ts-nocheck — this package does not ship @types/node; crypto/Buffer are Node 18+ globals.
/**
 * cr.exec.v1 offline verifier (PHASE-0).
 *
 * Mirrors coderifts-app/src/verdict-core/execution-grant.js. Receipt v4 is not
 * involved. Pinned public key; 30s CLOCK_SKEW_LEEWAY_MS on exp.
 */
import { createHash, createPublicKey, verify as ed25519verify } from 'crypto';
import { CLOCK_SKEW_LEEWAY_MS, isReceiptExpired, isIssuedInFuture } from './leeway.js';

export const GRANT_VERSION = 'cr.exec.v1';
export const GRANT_VERSION_V2 = 'cr.exec.v2';

/** Typed cr.exec.v2 payload (Execution Plane §1B). */
export interface ExecutionGrantV2 {
    v: 'cr.exec.v2';
    kid: string;
    grant_id: string;
    receipt_hash: string;
    tenant_id: string;
    executor_id: string;
    adapter_id: string;
    operation: string;
    target_uri: string;
    expected_state_token: string;
    after_payload_hash: string;
    nonce_hash: string;
    policy_hash: string;
    audience_hash: string;
    not_before: string;
    expires_at: string;
    max_attempts: number;
}
export const GRANT_SIGNING_PREFIX = 'crexec.v1';
// 0x1F is US (Unit Separator); NUL is 0x00. This identifier is a misnomer retained to
// avoid a cross-repo rename — the BYTE (\x1f) is what is normative, not the name.
const NUL = '\x1f';
const SIGNED_FIELDS = [
    'kid', 'receipt_digest', 'scope_hash', 'audience', 'operation', 'target_id', 'jti', 'iat', 'exp',
] as const;

export type GrantStatus =
    | 'GRANT_CURRENT'
    | 'GRANT_EXPIRED'
    | 'GRANT_WRONG_AUDIENCE'
    | 'GRANT_SCOPE_MISMATCH'
    | 'GRANT_UNBOUND'
    | 'INVALID_SIGNATURE'
    | 'MALFORMED'
    | 'UNKNOWN_KEY';

export interface ExecutionGrantIntended {
    operation?: string;
    target_id?: string;
    audience?: string;
    after_payload?: string;
    scope_hash?: string;
    receipt_token?: string;
}

export interface VerifyExecutionGrantResult {
    valid: boolean;
    status: GrantStatus;
    reason: string | null;
    payload?: Record<string, string>;
}

function sha256hex(str: string): string {
    return createHash('sha256').update(String(str), 'utf8').digest('hex');
}

function specStr(v: unknown): string {
    if (v == null) return '';
    return typeof v === 'string' ? v : JSON.stringify(v);
}

export function afterPayloadCanonical(
    artifacts: Array<{ type?: string; id?: string; after?: unknown }>,
): string {
    const list = Array.isArray(artifacts) ? artifacts.slice() : [];
    list.sort((x, y) => {
        const kx = `${x?.type ?? ''}${NUL}${x?.id ?? ''}`;
        const ky = `${y?.type ?? ''}${NUL}${y?.id ?? ''}`;
        return kx < ky ? -1 : kx > ky ? 1 : 0;
    });
    return list.map((a) => specStr(a && a.after)).join(NUL);
}

export function computeScopeHash(args: {
    operation?: string;
    target_id?: string;
    after_payload?: string;
}): string {
    const preimage = [
        args.operation == null ? '' : String(args.operation),
        args.target_id == null ? '' : String(args.target_id),
        args.after_payload == null ? '' : String(args.after_payload),
    ].join(NUL);
    return `sha256:${sha256hex(preimage)}`;
}

export function receiptDigest(token: string): string {
    return `sha256:${sha256hex(String(token))}`;
}

function scalar(v: unknown): string {
    return v == null ? '' : String(v);
}

function hasStateNonce(body: Record<string, string>): boolean {
    return typeof body.state_nonce === 'string' && body.state_nonce.length > 0;
}

function signingInput(body: Record<string, string>): string {
    const parts = [
        GRANT_SIGNING_PREFIX,
        scalar(body.kid),
        scalar(body.receipt_digest),
        scalar(body.scope_hash),
        scalar(body.audience),
        scalar(body.operation),
        scalar(body.target_id),
        scalar(body.jti),
        scalar(body.iat),
        scalar(body.exp),
    ];
    // ATOMIC: append only when non-empty so BEARER signing input stays byte-identical.
    if (hasStateNonce(body)) parts.push(scalar(body.state_nonce));
    return parts.join('|');
}

/** Required v2 strings, in the canonical core's order (receipt-verifier verify-grant.js:56). */
const V2_REQUIRED_STRINGS = [
    'v', 'kid', 'grant_id', 'receipt_hash', 'tenant_id', 'executor_id', 'adapter_id',
    'operation', 'target_uri', 'expected_state_token', 'after_payload_hash',
    'nonce_hash', 'policy_hash', 'audience_hash', 'not_before', 'expires_at',
] as const;

const TARGET_SCHEMES = ['fs', 'git', 'api', 'db', 'registry', 'deploy'];

const sha256pref = (v: unknown): string => `sha256:${sha256hex(String(v))}`;

/**
 * RFC 8785-shaped canonical JSON: sorted keys, no whitespace. v2 signs the WHOLE body under this
 * encoding, so a key-order difference here is a signature failure there — which is exactly why
 * this is not `JSON.stringify`.
 */
function canonicalJson(value: unknown): string {
    if (value === null) return 'null';
    const t = typeof value;
    if (t === 'boolean' || t === 'string') return JSON.stringify(value);
    if (t === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('canonicalJson: non-finite number');
        return JSON.stringify(value);
    }
    if (t === 'undefined') throw new TypeError('canonicalJson: undefined');
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (t === 'object') {
        const keys = Object.keys(value as object).sort();
        return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as any)[k])}`).join(',')}}`;
    }
    throw new TypeError(`canonicalJson: unsupported type ${t}`);
}

function signingInputV2(body: unknown): string {
    return `crexec.v2|${canonicalJson(body)}`;
}

/**
 * A target_uri is `scheme://rest` over a closed scheme list. The check exists because v2's target
 * lives in a different namespace from v1's `target_id`: a bare row id is not a target_uri, and
 * accepting one would let a grant bind to something no executor addresses that way.
 */
function canonicalizeTargetUri(raw: unknown): string | null {
    if (typeof raw !== 'string' || raw.length === 0) return null;
    const m = raw.match(/^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^?#]*)$/);
    if (!m) return null;
    const scheme = m[1].toLowerCase();
    if (!TARGET_SCHEMES.includes(scheme)) return null;
    let rest = m[2];
    if (/^[^\s/]*:/.test(rest) && rest.includes('@') && scheme !== 'git') return null;
    if (rest.includes('..')) return null;
    if (rest.includes('//')) return null;
    if (/\s/.test(rest)) return null;
    if (rest.endsWith('/') && rest.length > 1) rest = rest.replace(/\/+$/, '');
    return `${scheme}://${rest}`;
}

/**
 * cr.exec.v2 — canonical-JSON preimage; the bound fields are HASHES.
 *
 * v2 signs `after_payload_hash` / `audience_hash` / `nonce_hash` rather than the values, so an
 * `intended` check compares the hash the caller computes with the hash the issuer signed. A caller
 * that states nothing gets signature + expiry only: an unstated intent is never treated as a match.
 */
function verifyExecutionGrantV2(
    payload: Record<string, any>,
    sigB64: string,
    opts: { intended?: ExecutionGrantIntended; now?: number; publicKeyPem?: string } = {},
): VerifyExecutionGrantResult {
    for (const k of V2_REQUIRED_STRINGS) {
        if (typeof payload[k] !== 'string' || payload[k].length === 0) {
            return { valid: false, status: 'MALFORMED', reason: 'missing_field', payload };
        }
    }
    if (!Number.isInteger(payload.max_attempts) || payload.max_attempts < 1) {
        return { valid: false, status: 'MALFORMED', reason: 'bad_max_attempts', payload };
    }
    // CLOSED SET, matching the core exactly. An unknown key is refused rather than ignored: v2
    // signs the whole body, so a field this verifier does not know about is a field it cannot say
    // anything true about.
    const allowed = new Set<string>([...V2_REQUIRED_STRINGS, 'max_attempts']);
    for (const k of Object.keys(payload)) {
        if (!allowed.has(k)) {
            return { valid: false, status: 'MALFORMED', reason: 'unknown_field', payload };
        }
    }
    if (!canonicalizeTargetUri(payload.target_uri)) {
        return { valid: false, status: 'MALFORMED', reason: 'bad_target_uri', payload };
    }
    if (!opts.publicKeyPem) {
        return { valid: false, status: 'UNKNOWN_KEY', reason: 'unknown_kid', payload };
    }

    let ok = false;
    try {
        const key = createPublicKey(opts.publicKeyPem);
        ok = ed25519verify(
            null,
            Buffer.from(signingInputV2(payload), 'utf8'),
            key,
            Buffer.from(sigB64, 'base64url'),
        );
    } catch {
        return { valid: false, status: 'INVALID_SIGNATURE', reason: 'signature_error', payload };
    }
    if (!ok) {
        return { valid: false, status: 'INVALID_SIGNATURE', reason: 'signature_mismatch', payload };
    }

    const now = Number.isFinite(opts.now) ? (opts.now as number) : Date.now();
    const expMs = Date.parse(payload.expires_at);
    const nbfMs = Date.parse(payload.not_before);
    if (!Number.isFinite(expMs) || !Number.isFinite(nbfMs)) {
        return { valid: false, status: 'MALFORMED', reason: 'bad_timestamp', payload };
    }
    const intended = (opts.intended || {}) as Record<string, any>;
    if (isReceiptExpired(expMs, now, intended)) {
        return { valid: false, status: 'GRANT_EXPIRED', reason: 'expired', payload };
    }
    if (isIssuedInFuture(nbfMs, now, intended)) {
        return { valid: false, status: 'GRANT_EXPIRED', reason: 'nbf_in_future', payload };
    }

    if (intended.executor_id && payload.executor_id !== String(intended.executor_id)) {
        return { valid: false, status: 'GRANT_UNBOUND', reason: 'executor_mismatch', payload };
    }
    if (intended.adapter_id && payload.adapter_id !== String(intended.adapter_id)) {
        return { valid: false, status: 'GRANT_UNBOUND', reason: 'adapter_mismatch', payload };
    }
    if (intended.target_uri) {
        const want = canonicalizeTargetUri(String(intended.target_uri)) || String(intended.target_uri);
        if (payload.target_uri !== want) {
            return { valid: false, status: 'GRANT_UNBOUND', reason: 'target_mismatch', payload };
        }
    }
    if (intended.audience && payload.audience_hash !== sha256pref(intended.audience)) {
        return { valid: false, status: 'GRANT_UNBOUND', reason: 'audience_mismatch', payload };
    }
    if (intended.audience_hash && payload.audience_hash !== String(intended.audience_hash)) {
        return { valid: false, status: 'GRANT_UNBOUND', reason: 'audience_mismatch', payload };
    }
    if (intended.after_payload != null
        && payload.after_payload_hash !== sha256pref(intended.after_payload)) {
        return { valid: false, status: 'GRANT_UNBOUND', reason: 'after_payload_mismatch', payload };
    }
    if (intended.operation && payload.operation !== String(intended.operation)) {
        return { valid: false, status: 'GRANT_UNBOUND', reason: 'operation_mismatch', payload };
    }
    if (intended.receipt_token
        && sha256pref(intended.receipt_token) !== payload.receipt_hash) {
        return { valid: false, status: 'GRANT_UNBOUND', reason: 'receipt_hash_mismatch', payload };
    }
    return { valid: true, status: 'GRANT_CURRENT', payload };
}

/**
 * DUAL-ACCEPT ENTRY POINT. Dispatches on the token's own `v` and nothing else — no option, no
 * guess, no default.
 *
 * ── WHAT WAS MEASURED (1425 / P0.3) ─────────────────────────────────────────────────────────
 *
 * This function was v1-only. A REAL, correctly-signed cr.exec.v2 grant — the one in the
 * conformance end-to-end fixture, kid 2026-07-k1 — came back:
 *
 *     valid: false, status: MALFORMED, reason: unsupported_version
 *
 * `ExecutionGrantV2` and `GRANT_VERSION_V2` were already declared above. The TYPE for v2 shipped;
 * the VERIFICATION did not. A caller reading the exports would reasonably conclude this package
 * understood v2, and would get MALFORMED on the grant their own server had just minted.
 *
 * ── WHY IT MIRRORS receipt-verifier RATHER THAN REQUIRING IT ────────────────────────────────
 *
 * The shared core (receipt-verifier/verify-grant.js) is not an npm package — the repo has no
 * package.json — so a published SDK cannot depend on it. The v2 path below is a deliberate
 * line-for-line mirror, and test/execution-grant-v2-core-parity.test.js runs BOTH against the same
 * tokens and requires identical (valid, status, reason). A mirror nobody compares is a fork.
 */
export function verifyExecutionGrant(
    token: string,
    opts: {
        intended?: ExecutionGrantIntended;
        now?: number;
        publicKeyPem?: string;
    } = {},
): VerifyExecutionGrantResult {
    if (typeof token === 'string' && token.length > 0) {
        const seg = token.split('.');
        if (seg.length === 2 && seg[0]) {
            try {
                const peek = JSON.parse(Buffer.from(seg[0], 'base64url').toString('utf8'));
                if (peek && peek.v === GRANT_VERSION_V2) {
                    return verifyExecutionGrantV2(peek, seg[1], opts);
                }
            } catch {
                // fall through to v1, which reports the malformed reason in its own vocabulary
            }
        }
    }
    return verifyExecutionGrantV1(token, opts);
}

function verifyExecutionGrantV1(
    token: string,
    opts: {
        intended?: ExecutionGrantIntended;
        now?: number;
        publicKeyPem?: string;
    } = {},
): VerifyExecutionGrantResult {
    if (typeof token !== 'string' || token.length === 0) {
        return { valid: false, status: 'MALFORMED', reason: 'malformed_structure' };
    }
    const segments = token.split('.');
    if (segments.length !== 2 || segments.some((s) => !s)) {
        return { valid: false, status: 'MALFORMED', reason: 'malformed_structure' };
    }
    let payload: Record<string, string>;
    try {
        payload = JSON.parse(Buffer.from(segments[0], 'base64url').toString('utf8'));
    } catch {
        return { valid: false, status: 'MALFORMED', reason: 'bad_json' };
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, status: 'MALFORMED', reason: 'bad_json', payload };
    }
    if (payload.v !== GRANT_VERSION) {
        return { valid: false, status: 'MALFORMED', reason: 'unsupported_version', payload };
    }
    for (const k of SIGNED_FIELDS) {
        if (typeof payload[k] !== 'string') {
            return { valid: false, status: 'MALFORMED', reason: 'missing_field', payload };
        }
    }
    if (payload.state_nonce != null && typeof payload.state_nonce !== 'string') {
        return { valid: false, status: 'MALFORMED', reason: 'bad_state_nonce', payload };
    }
    const allowed = new Set(['v', ...SIGNED_FIELDS, 'state_nonce']);
    for (const k of Object.keys(payload)) {
        if (!allowed.has(k)) {
            return { valid: false, status: 'MALFORMED', reason: 'unknown_field', payload };
        }
    }
    for (const k of SIGNED_FIELDS) {
        if (payload[k].includes('|')) {
            return { valid: false, status: 'INVALID_SIGNATURE', reason: 'delimiter_in_field', payload };
        }
    }
    if (hasStateNonce(payload) && payload.state_nonce.includes('|')) {
        return { valid: false, status: 'INVALID_SIGNATURE', reason: 'delimiter_in_field', payload };
    }
    if (!opts.publicKeyPem) {
        return { valid: false, status: 'UNKNOWN_KEY', reason: 'unknown_kid', payload };
    }
    let ok = false;
    try {
        const key = createPublicKey(opts.publicKeyPem);
        ok = ed25519verify(
            null,
            Buffer.from(signingInput(payload), 'utf8'),
            key,
            Buffer.from(segments[1], 'base64url'),
        );
    } catch {
        return { valid: false, status: 'INVALID_SIGNATURE', reason: 'signature_error', payload };
    }
    if (!ok) {
        return { valid: false, status: 'INVALID_SIGNATURE', reason: 'signature_mismatch', payload };
    }

    const now = Number.isFinite(opts.now) ? (opts.now as number) : Date.now();
    const expMs = Date.parse(payload.exp);
    const iatMs = Date.parse(payload.iat);
    if (!Number.isFinite(expMs) || !Number.isFinite(iatMs)) {
        return { valid: false, status: 'MALFORMED', reason: 'bad_timestamp', payload };
    }
    if (isReceiptExpired(expMs, now, opts.intended)) {
        return { valid: false, status: 'GRANT_EXPIRED', reason: 'expired', payload };
    }
    if (isIssuedInFuture(iatMs, now, opts.intended)) {
        return { valid: false, status: 'GRANT_EXPIRED', reason: 'iat_in_future', payload };
    }
    if (!payload.receipt_digest || !payload.receipt_digest.startsWith('sha256:')) {
        return { valid: false, status: 'GRANT_UNBOUND', reason: 'missing_receipt_digest', payload };
    }
    const intended = opts.intended || {};
    if (intended.receipt_token) {
        if (receiptDigest(intended.receipt_token) !== payload.receipt_digest) {
            return { valid: false, status: 'GRANT_UNBOUND', reason: 'receipt_digest_mismatch', payload };
        }
    }
    if (intended.audience != null && intended.audience !== '' && payload.audience !== String(intended.audience)) {
        return { valid: false, status: 'GRANT_WRONG_AUDIENCE', reason: 'audience_mismatch', payload };
    }
    if (intended.operation != null && intended.operation !== '' && payload.operation !== String(intended.operation)) {
        return { valid: false, status: 'GRANT_SCOPE_MISMATCH', reason: 'operation_mismatch', payload };
    }
    if (intended.target_id != null && intended.target_id !== '' && payload.target_id !== String(intended.target_id)) {
        return { valid: false, status: 'GRANT_SCOPE_MISMATCH', reason: 'target_mismatch', payload };
    }
    let expectedScope: string | null = null;
    if (intended.scope_hash) expectedScope = String(intended.scope_hash);
    else if (intended.after_payload != null) {
        expectedScope = computeScopeHash({
            operation: intended.operation != null ? intended.operation : payload.operation,
            target_id: intended.target_id != null ? intended.target_id : payload.target_id,
            after_payload: intended.after_payload,
        });
    }
    if (expectedScope != null && expectedScope !== payload.scope_hash) {
        return { valid: false, status: 'GRANT_SCOPE_MISMATCH', reason: 'scope_hash_mismatch', payload };
    }
    return { valid: true, status: 'GRANT_CURRENT', reason: null, payload };
}

export { CLOCK_SKEW_LEEWAY_MS };
