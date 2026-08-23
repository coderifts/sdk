/**
 * ID104 — clock-skew leeway for VERIFICATION verdicts.
 *
 * The SDK is an HTTP client: `verifyReceipt` does not compare expiry locally;
 * the server applies this policy. This helper is the same named constant and
 * predicate so callers (and tests) can reason about VERIFIED_EXPIRED without
 * inventing a second number.
 *
 * `exp + leeway < now` → expired. Default 30_000 ms. 0 ms when the intended
 * context declares destructive AND environment production. Measured
 * IntentContext has `environment` but no `destructive` / `operation_class` —
 * never guess from operation labels.
 *
 * Does not enter the decision fingerprint/preimage (server-side).
 */

/** Default expiry leeway (ms). `exp + leeway < now` → VERIFIED_EXPIRED. */
export const CLOCK_SKEW_LEEWAY_MS = 30_000;

export interface ExpiryLeewayContext {
    environment?: string;
    operation?: string;
}

/**
 * 0s grace only when intended context DECLARES destructive AND production.
 * No such destructive field exists on IntentContext — always the default.
 */
export function declaresDestructiveProduction(context?: ExpiryLeewayContext | null): boolean {
    if (!context || typeof context !== 'object') return false;
    if (context.environment !== 'production') return false;
    return false;
}

export function expiryLeewayMs(context?: ExpiryLeewayContext | null): number {
    if (declaresDestructiveProduction(context)) return 0;
    return CLOCK_SKEW_LEEWAY_MS;
}

export function isReceiptExpired(
    expiresAtMs: number,
    nowMs: number,
    context?: ExpiryLeewayContext | null,
): boolean {
    // Non-finite timestamps cannot be judged (same as the server Date.parse miss → not EXPIRED).
    if (!Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs)) return false;
    return expiresAtMs + expiryLeewayMs(context) < nowMs;
}

/** Future-dated iat (`ts`): same 30s leeway on the other side. No nbf concept. */
export function isIssuedInFuture(
    issuedAtMs: number,
    nowMs: number,
    context?: ExpiryLeewayContext | null,
): boolean {
    if (!Number.isFinite(issuedAtMs) || !Number.isFinite(nowMs)) return false;
    return issuedAtMs > nowMs + expiryLeewayMs(context);
}
