// @ts-nocheck — this package does not ship @types/node; crypto/Buffer are Node 18+ globals.
/**
 * cr.exec.attest.v1 offline verifier.
 *
 * Mirrors coderifts-app/src/verdict-core/execution-attestation.js.
 * Customer-pinned registry; CodeRifts never holds executor keys.
 */
import { createPublicKey, verify as ed25519verify } from 'crypto';
import { CLOCK_SKEW_LEEWAY_MS, isIssuedInFuture } from './leeway.js';

export const ATTEST_VERSION = 'cr.exec.attest.v1';
export const ATTEST_SIGNING_PREFIX = 'crexecattest.v1';
export const ATTEST_ENVELOPE_TAG = 'cr.exec.attest.v1';

export type AttestStatus =
    | 'ATTEST_VALID'
    | 'ATTEST_INVALID_SIGNATURE'
    | 'ATTEST_UNKNOWN_KEY'
    | 'ATTEST_RETIRED_KEY_VALID_AT_ISSUE'
    | 'ATTEST_MALFORMED'
    | 'ATTEST_UNBOUND';

export interface ExecutorKeyEntry {
    kid: string;
    public_key_pem: string;
    status?: 'active' | 'retired' | string;
    valid_from?: string | null;
    retired_at?: string | null;
}

export interface ExecutorKeyRegistry {
    keys: ExecutorKeyEntry[];
}

export interface ExecutionAttestationIntended {
    grant?: string;
    grant_fields?: {
        jti?: string;
        scope_hash?: string;
        state_nonce?: string;
        receipt_digest?: string;
    };
    receipt_digest?: string;
    environment?: string;
}

export interface VerifyExecutionAttestationResult {
    valid: boolean;
    status: AttestStatus;
    reason: string | null;
    payload?: Record<string, unknown>;
}

const REQUIRED_FIELDS = [
    'executor_kid', 'grant_jti', 'receipt_digest', 'scope_hash', 'committed_at',
] as const;

function scalar(v: unknown): string {
    return v == null ? '' : String(v);
}

function canonicalMeta(meta: Record<string, unknown>): string {
    const keys = Object.keys(meta).sort();
    const o: Record<string, unknown> = {};
    for (const k of keys) o[k] = meta[k];
    return JSON.stringify(o);
}

function metaOk(meta: unknown): boolean {
    if (meta == null) return true;
    if (typeof meta !== 'object' || Array.isArray(meta)) return false;
    const obj = meta as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length > 8) return false;
    for (const k of keys) {
        if (k.length === 0 || k.length > 64 || k.includes('|')) return false;
        const v = obj[k];
        const t = typeof v;
        if (t !== 'string' && t !== 'number' && t !== 'boolean') return false;
        if (t === 'string' && ((v as string).length > 256 || (v as string).includes('|'))) return false;
    }
    return true;
}

export function attestSigningInput(body: Record<string, unknown>): string {
    const parts = [
        ATTEST_SIGNING_PREFIX,
        scalar(body.executor_kid),
        scalar(body.grant_jti),
        scalar(body.receipt_digest),
        scalar(body.scope_hash),
        body.state_nonce != null && String(body.state_nonce).length > 0 ? String(body.state_nonce) : '',
        scalar(body.committed_at),
        body.result_digest != null && String(body.result_digest).length > 0 ? String(body.result_digest) : '',
    ];
    if (body.meta && typeof body.meta === 'object') {
        parts.push(canonicalMeta(body.meta as Record<string, unknown>));
    }
    return parts.join('|');
}

function isIssueTimeWithinKeyWindow(
    ts: string,
    keyMeta: { status?: string; valid_from?: string | null; retired_at?: string | null },
): boolean {
    if (!keyMeta || keyMeta.status === 'active') return true;
    if (keyMeta.status !== 'retired') return false;
    if (typeof keyMeta.retired_at !== 'string' || keyMeta.retired_at.length === 0) return false;
    if (typeof ts !== 'string' || ts.length === 0) return false;
    const issueMs = Date.parse(ts);
    if (!Number.isFinite(issueMs)) return false;
    if (keyMeta.valid_from) {
        const fromMs = Date.parse(keyMeta.valid_from);
        if (Number.isFinite(fromMs) && issueMs < fromMs) return false;
    }
    const retiredMs = Date.parse(keyMeta.retired_at);
    if (!Number.isFinite(retiredMs)) return false;
    if (issueMs >= retiredMs) return false;
    return true;
}

function resolveExecutorKey(registry: ExecutorKeyRegistry | undefined, kid: string) {
    if (!registry || !Array.isArray(registry.keys) || !kid) return null;
    const matches = registry.keys.filter((k) => k && k.kid === kid && typeof k.public_key_pem === 'string');
    if (matches.length === 0) return null;
    const entry = matches.find((k) => k.status === 'active') || matches[0];
    try {
        return {
            publicKey: createPublicKey(entry.public_key_pem),
            status: entry.status === 'retired' ? 'retired' : 'active',
            valid_from: entry.valid_from || null,
            retired_at: entry.retired_at || null,
        };
    } catch {
        return null;
    }
}

function parseGrantFields(token: string): Record<string, string> | { unparseable: true } | null {
    if (typeof token !== 'string' || !token) return null;
    const segments = token.split('.');
    if (segments.length !== 2 || segments.some((s) => !s)) return { unparseable: true };
    try {
        const payload = JSON.parse(Buffer.from(segments[0], 'base64url').toString('utf8'));
        if (!payload || typeof payload !== 'object') return { unparseable: true };
        return payload;
    } catch {
        return { unparseable: true };
    }
}

function nonceOf(obj: Record<string, unknown> | null | undefined): string {
    if (!obj) return '';
    return typeof obj.state_nonce === 'string' && obj.state_nonce.length > 0 ? obj.state_nonce : '';
}

export function verifyExecutionAttestation(
    token: string,
    opts: {
        registry: ExecutorKeyRegistry;
        intended?: ExecutionAttestationIntended;
        now?: number;
    },
): VerifyExecutionAttestationResult {
    const fail = (status: AttestStatus, reason: string, payload?: Record<string, unknown>): VerifyExecutionAttestationResult =>
        ({ valid: false, status, reason, payload });

    if (typeof token !== 'string' || token.length === 0) {
        return fail('ATTEST_MALFORMED', 'malformed_structure');
    }
    const segments = token.split('|');
    if (segments.length !== 4 || segments.some((s) => !s)) {
        return fail('ATTEST_MALFORMED', 'malformed_structure');
    }
    if (segments[0] !== ATTEST_ENVELOPE_TAG) {
        return fail('ATTEST_MALFORMED', 'unsupported_version');
    }
    let payload: Record<string, unknown>;
    try {
        payload = JSON.parse(Buffer.from(segments[2], 'base64url').toString('utf8'));
    } catch {
        return fail('ATTEST_MALFORMED', 'bad_json');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return fail('ATTEST_MALFORMED', 'bad_json');
    }
    if (payload.v !== ATTEST_VERSION) {
        return fail('ATTEST_MALFORMED', 'unsupported_version', payload);
    }
    for (const k of REQUIRED_FIELDS) {
        if (typeof payload[k] !== 'string' || !(payload[k] as string).length) {
            return fail('ATTEST_MALFORMED', 'missing_field', payload);
        }
    }
    if (payload.executor_kid !== segments[1]) {
        return fail('ATTEST_MALFORMED', 'kid_mismatch', payload);
    }
    const allowed = new Set(['v', ...REQUIRED_FIELDS, 'state_nonce', 'result_digest', 'meta']);
    for (const k of Object.keys(payload)) {
        if (!allowed.has(k)) return fail('ATTEST_MALFORMED', 'unknown_field', payload);
    }
    if (!metaOk(payload.meta)) return fail('ATTEST_MALFORMED', 'meta_bounds', payload);
    for (const k of [...REQUIRED_FIELDS, 'state_nonce', 'result_digest'] as const) {
        if (typeof payload[k] === 'string' && (payload[k] as string).includes('|')) {
            return fail('ATTEST_INVALID_SIGNATURE', 'delimiter_in_field', payload);
        }
    }

    const resolved = resolveExecutorKey(opts.registry, String(payload.executor_kid));
    if (!resolved) return fail('ATTEST_UNKNOWN_KEY', 'unknown_kid', payload);

    let sigOk = false;
    try {
        sigOk = ed25519verify(
            null,
            Buffer.from(attestSigningInput(payload), 'utf8'),
            resolved.publicKey,
            Buffer.from(segments[3], 'base64url'),
        );
    } catch {
        return fail('ATTEST_INVALID_SIGNATURE', 'signature_error', payload);
    }
    if (!sigOk) return fail('ATTEST_INVALID_SIGNATURE', 'signature_mismatch', payload);

    const now = Number.isFinite(opts.now) ? (opts.now as number) : Date.now();
    const committedMs = Date.parse(String(payload.committed_at));
    if (!Number.isFinite(committedMs)) return fail('ATTEST_MALFORMED', 'bad_timestamp', payload);
    if (isIssuedInFuture(committedMs, now, opts.intended)) {
        return fail('ATTEST_MALFORMED', 'committed_at_in_future', payload);
    }

    let retiredHistorical = false;
    if (resolved.status === 'retired') {
        if (!isIssueTimeWithinKeyWindow(String(payload.committed_at), resolved)) {
            return fail('ATTEST_UNKNOWN_KEY', 'retired_key_outside_window', payload);
        }
        retiredHistorical = true;
    }

    const intended = opts.intended;
    const wantsCross = !!(intended && (intended.grant || intended.grant_fields || intended.receipt_digest));
    if (wantsCross && intended) {
        let gf: Record<string, unknown> | { unparseable: true } | null = null;
        if (intended.grant_fields) gf = intended.grant_fields as Record<string, unknown>;
        else if (intended.grant) gf = parseGrantFields(intended.grant);
        if (gf && 'unparseable' in gf && gf.unparseable) {
            return fail('ATTEST_UNBOUND', 'grant_unparseable', payload);
        }
        if (gf && !('unparseable' in gf)) {
            if (String(gf.jti || '') !== payload.grant_jti) {
                return fail('ATTEST_UNBOUND', 'grant_jti_mismatch', payload);
            }
            if (String(gf.scope_hash || '') !== payload.scope_hash) {
                return fail('ATTEST_UNBOUND', 'scope_hash_mismatch', payload);
            }
            if (nonceOf(gf) !== nonceOf(payload)) {
                return fail('ATTEST_UNBOUND', 'state_nonce_mismatch', payload);
            }
            if (gf.receipt_digest && gf.receipt_digest !== payload.receipt_digest) {
                return fail('ATTEST_UNBOUND', 'receipt_digest_mismatch', payload);
            }
        }
        if (intended.receipt_digest && intended.receipt_digest !== payload.receipt_digest) {
            return fail('ATTEST_UNBOUND', 'receipt_digest_mismatch', payload);
        }
    }

    if (retiredHistorical) {
        return { valid: true, status: 'ATTEST_RETIRED_KEY_VALID_AT_ISSUE', reason: null, payload };
    }
    return { valid: true, status: 'ATTEST_VALID', reason: null, payload };
}

export { CLOCK_SKEW_LEEWAY_MS };
