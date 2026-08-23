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

export function verifyExecutionGrant(
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
