// @ts-nocheck — this package does not ship @types/node; crypto/Buffer are Node 18+ globals.
/**
 * cr.monitor.attest.v1 offline verifier.
 *
 * Mirrors coderifts-app/src/verdict-core/monitoring-attestation.js.
 * Customer-pinned registry; CodeRifts never holds monitoring keys.
 */
import { createPublicKey, verify as ed25519verify } from 'crypto';
import { CLOCK_SKEW_LEEWAY_MS, isIssuedInFuture } from './leeway.js';

export const MONITOR_ATTEST_VERSION = 'cr.monitor.attest.v1';
export const MONITOR_ATTEST_SIGNING_PREFIX = 'crmonattest.v1';
export const MONITOR_ATTEST_ENVELOPE_TAG = 'cr.monitor.attest.v1';

export type MonAttestStatus =
    | 'MON_ATTEST_VALID'
    | 'MON_ATTEST_INVALID_SIGNATURE'
    | 'MON_ATTEST_UNKNOWN_KEY'
    | 'MON_ATTEST_RETIRED_KEY_VALID_AT_ISSUE'
    | 'MON_ATTEST_MALFORMED'
    | 'MON_ATTEST_UNBOUND';

export interface MonitoringKeyEntry {
    kid: string;
    public_key_pem: string;
    status?: 'active' | 'retired' | string;
    valid_from?: string | null;
    retired_at?: string | null;
}

export interface MonitoringKeyRegistry {
    keys: MonitoringKeyEntry[];
}

export interface MonitoringAttestationIntended {
    decision_id?: string;
    receipt_digest?: string;
}

export interface VerifyMonitoringAttestationResult {
    valid: boolean;
    status: MonAttestStatus;
    reason: string | null;
    payload?: Record<string, unknown>;
}

const REQUIRED_FIELDS = [
    'kid', 'decision_id', 'receipt_digest', 'delivery_status', 'sink_kind', 'observed_at',
] as const;
const DELIVERY_STATUSES = ['delivered_acked', 'sent_unacked', 'not_delivered'] as const;
const SINK_KINDS = ['callback', 'http'] as const;
const OPTIONAL_STRINGS = ['ack_digest'] as const;
const ALLOWED_KEYS = new Set(['v', ...REQUIRED_FIELDS, ...OPTIONAL_STRINGS, 'attempt_count', 'meta']);

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

export function monitorAttestSigningInput(body: Record<string, unknown>): string {
    const parts = [
        MONITOR_ATTEST_SIGNING_PREFIX,
        scalar(body.kid),
        scalar(body.decision_id),
        scalar(body.receipt_digest),
        scalar(body.delivery_status),
        body.ack_digest != null && String(body.ack_digest).length > 0 ? String(body.ack_digest) : '',
        scalar(body.sink_kind),
        scalar(body.observed_at),
        body.attempt_count != null ? String(body.attempt_count) : '',
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

function resolveMonitoringKey(registry: MonitoringKeyRegistry | undefined, kid: string) {
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

export function verifyMonitoringAttestation(
    token: string,
    opts: {
        registry: MonitoringKeyRegistry;
        intended?: MonitoringAttestationIntended;
        now?: number;
    },
): VerifyMonitoringAttestationResult {
    const fail = (status: MonAttestStatus, reason: string, payload?: Record<string, unknown>): VerifyMonitoringAttestationResult =>
        ({ valid: false, status, reason, payload });

    if (typeof token !== 'string' || token.length === 0) {
        return fail('MON_ATTEST_MALFORMED', 'malformed_structure');
    }
    const segments = token.split('|');
    if (segments.length !== 4 || segments.some((s) => !s)) {
        return fail('MON_ATTEST_MALFORMED', 'malformed_structure');
    }
    if (segments[0] !== MONITOR_ATTEST_ENVELOPE_TAG) {
        return fail('MON_ATTEST_MALFORMED', 'unsupported_version');
    }
    let payload: Record<string, unknown>;
    try {
        payload = JSON.parse(Buffer.from(segments[2], 'base64url').toString('utf8'));
    } catch {
        return fail('MON_ATTEST_MALFORMED', 'bad_json');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return fail('MON_ATTEST_MALFORMED', 'bad_json');
    }
    if (payload.v !== MONITOR_ATTEST_VERSION) {
        return fail('MON_ATTEST_MALFORMED', 'unsupported_version', payload);
    }
    for (const k of REQUIRED_FIELDS) {
        if (typeof payload[k] !== 'string' || !(payload[k] as string).length) {
            return fail('MON_ATTEST_MALFORMED', 'missing_field', payload);
        }
    }
    if (!DELIVERY_STATUSES.includes(payload.delivery_status as typeof DELIVERY_STATUSES[number])) {
        return fail('MON_ATTEST_MALFORMED', 'bad_delivery_status', payload);
    }
    if (!SINK_KINDS.includes(payload.sink_kind as typeof SINK_KINDS[number])) {
        return fail('MON_ATTEST_MALFORMED', 'bad_sink_kind', payload);
    }
    for (const k of OPTIONAL_STRINGS) {
        if (payload[k] != null && typeof payload[k] !== 'string') {
            return fail('MON_ATTEST_MALFORMED', 'bad_optional', payload);
        }
    }
    if (payload.attempt_count != null && typeof payload.attempt_count !== 'number') {
        return fail('MON_ATTEST_MALFORMED', 'bad_attempt_count', payload);
    }
    if (payload.kid !== segments[1]) {
        return fail('MON_ATTEST_MALFORMED', 'kid_mismatch', payload);
    }
    for (const k of Object.keys(payload)) {
        if (!ALLOWED_KEYS.has(k)) return fail('MON_ATTEST_MALFORMED', 'unknown_field', payload);
    }
    if (!metaOk(payload.meta)) return fail('MON_ATTEST_MALFORMED', 'meta_bounds', payload);
    if (typeof payload.ack_digest === 'string' && payload.ack_digest.length > 0
        && !payload.ack_digest.startsWith('sha256:')) {
        return fail('MON_ATTEST_MALFORMED', 'bad_ack_digest', payload);
    }
    if (typeof payload.receipt_digest === 'string' && !payload.receipt_digest.startsWith('sha256:')) {
        return fail('MON_ATTEST_MALFORMED', 'bad_receipt_digest', payload);
    }
    for (const k of [...REQUIRED_FIELDS, ...OPTIONAL_STRINGS] as const) {
        if (typeof payload[k] === 'string' && (payload[k] as string).includes('|')) {
            return fail('MON_ATTEST_INVALID_SIGNATURE', 'delimiter_in_field', payload);
        }
    }

    const resolved = resolveMonitoringKey(opts.registry, String(payload.kid));
    if (!resolved) return fail('MON_ATTEST_UNKNOWN_KEY', 'unknown_kid', payload);

    let sigOk = false;
    try {
        sigOk = ed25519verify(
            null,
            Buffer.from(monitorAttestSigningInput(payload), 'utf8'),
            resolved.publicKey,
            Buffer.from(segments[3], 'base64url'),
        );
    } catch {
        return fail('MON_ATTEST_INVALID_SIGNATURE', 'signature_error', payload);
    }
    if (!sigOk) return fail('MON_ATTEST_INVALID_SIGNATURE', 'signature_mismatch', payload);

    const now = Number.isFinite(opts.now) ? (opts.now as number) : Date.now();
    const observedMs = Date.parse(String(payload.observed_at));
    if (!Number.isFinite(observedMs)) return fail('MON_ATTEST_MALFORMED', 'bad_timestamp', payload);
    if (isIssuedInFuture(observedMs, now, opts.intended)) {
        return fail('MON_ATTEST_MALFORMED', 'observed_at_in_future', payload);
    }

    let retiredHistorical = false;
    if (resolved.status === 'retired') {
        if (!isIssueTimeWithinKeyWindow(String(payload.observed_at), resolved)) {
            return fail('MON_ATTEST_UNKNOWN_KEY', 'retired_key_outside_window', payload);
        }
        retiredHistorical = true;
    }

    const intended = opts.intended;
    const wantsCross = !!(intended && (intended.decision_id || intended.receipt_digest));
    if (wantsCross && intended) {
        if (intended.decision_id && intended.decision_id !== payload.decision_id) {
            return fail('MON_ATTEST_UNBOUND', 'decision_id_mismatch', payload);
        }
        if (intended.receipt_digest && intended.receipt_digest !== payload.receipt_digest) {
            return fail('MON_ATTEST_UNBOUND', 'receipt_digest_mismatch', payload);
        }
    }

    if (retiredHistorical) {
        return { valid: true, status: 'MON_ATTEST_RETIRED_KEY_VALID_AT_ISSUE', reason: null, payload };
    }
    return { valid: true, status: 'MON_ATTEST_VALID', reason: null, payload };
}

export { CLOCK_SKEW_LEEWAY_MS };
