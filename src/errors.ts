/**
 * @coderifts/sdk — Error classes
 */

import type { ApiErrorBody } from './types';

/**
 * Base error for all CodeRifts API errors.
 */
export class CodeRiftsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodeRiftsError';
  }
}

/**
 * Thrown when the API returns a non-2xx status code.
 */
export class ApiError extends CodeRiftsError {
  public readonly status: number;
  public readonly code: string;
  public readonly body: ApiErrorBody;

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
