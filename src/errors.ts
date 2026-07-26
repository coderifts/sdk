/**
 * @coderifts/sdk — Error classes
 */

import type { ApiErrorBody } from './types';
/**
 * Base error for all CodeRifts API errors.
 */
export class CodeRiftsError extends Error {
    readonly code: string;
    constructor(message: string, code = 'unknown') {
        super(message);
        this.name = 'CodeRiftsError';
        this.code = code;
    }
}
/**
 * Thrown when the API returns a non-2xx status code.
 */
export class ApiError extends CodeRiftsError {
    readonly status: number;
    readonly code: string;
    readonly body: ApiErrorBody;
    constructor(status: number, body: ApiErrorBody) {
        super(`[${status}] ${body.error}: ${body.message}`);
        this.name = 'ApiError';
        this.status = status;
        this.code = body.error;
        this.body = body;
    }
}
/**
 * Thrown when the request times out.
 */
export class TimeoutError extends CodeRiftsError {
    constructor(timeoutMs: number) {
        super(`Request timed out after ${timeoutMs}ms`);
        this.name = 'TimeoutError';
    }
}
/**
 * Thrown when rate limited (429).
 */
export class RateLimitError extends ApiError {
    constructor(body: ApiErrorBody) {
        super(429, body);
        this.name = 'RateLimitError';
    }
}
/**
 * Thrown when authentication fails (401).
 */
export class AuthError extends ApiError {
    constructor(body: ApiErrorBody) {
        super(401, body);
        this.name = 'AuthError';
    }
}
