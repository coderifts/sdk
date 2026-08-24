/**
 * Audit P1-2 — compile-time contract test for the two /v1/preflight request modes.
 *
 * Run by `npm run test:types` (tsc --noEmit -p tsconfig.typetest.json). Nothing here executes;
 * every `@ts-expect-error` is a live assertion in both directions — if a negative case starts
 * compiling, tsc fails with "Unused '@ts-expect-error' directive", so this cannot rot silently.
 *
 * Server truth (coderifts-app, read-only reference):
 *   mode A  artifacts[]            derivation absent
 *   mode B  derivation:"server"    artifacts REJECTED (400 INVALID_INPUT, "one source of truth
 *                                  per request"); context.repository + base + head REQUIRED
 *                                  (400 derivation_requires_base_head without base AND head;
 *                                  400 INVALID_INPUT without a parseable owner/repo)
 */
import type {
    Artifact,
    PreflightChangeSetRequest,
    CallerArtifactsRequest,
    ServerDerivedRequest,
    DerivationEnvelope,
    AuthorityEnvelope,
    CompletenessMode,
} from '../../src/types';

/** One well-typed artifact reused everywhere; `type` is a closed union, so pin it once. */
const OPENAPI: Artifact = { id: 'api', type: 'openapi', before: 'a', after: 'b' };

// ── mode A — caller-supplied artifacts ───────────────────────────────────────
const modeA: CallerArtifactsRequest = {
    preflight_mode: 'authorize',
    artifacts: [OPENAPI],
    context: { operation: 'merge' },
};
void modeA;

const modeAUnion: PreflightChangeSetRequest = {
    preflight_mode: 'analyze',
    artifacts: [OPENAPI],
};
void modeAUnion;

// ── mode B — server-derived change set (the production path) ─────────────────
const modeB: ServerDerivedRequest = {
    preflight_mode: 'authorize',
    derivation: 'server',
    context: { repository: 'owner/repo', base: 'main', head: 'feature', operation: 'merge' },
};
void modeB;

const modeBUnion: PreflightChangeSetRequest = {
    preflight_mode: 'authorize',
    derivation: 'server',
    context: { repository: 'o/r', base: 'a', head: 'b' },
};
void modeBUnion;

// ── misuse is a TYPE ERROR (each mirrors a server 400) ───────────────────────

// artifacts + derivation together → server 400 INVALID_INPUT
// Typed as the UNION: assignment fails as a whole, so the directive sits on the declaration
// (unlike the ServerDerivedRequest cases below, where the error lands on the property).
// @ts-expect-error artifacts is `never` on ServerDerivedRequest — one source of truth per request
const bothSources: PreflightChangeSetRequest = {
    preflight_mode: 'authorize',
    derivation: 'server',
    artifacts: [OPENAPI],
    context: { repository: 'o/r', base: 'a', head: 'b' },
};
void bothSources;

// missing base → server 400 derivation_requires_base_head
const noBase: ServerDerivedRequest = {
    preflight_mode: 'authorize',
    derivation: 'server',
    // @ts-expect-error context.base is required on ServerDerivedRequest
    context: { repository: 'o/r', head: 'b' },
};
void noBase;

// missing head → server 400 derivation_requires_base_head
const noHead: ServerDerivedRequest = {
    preflight_mode: 'authorize',
    derivation: 'server',
    // @ts-expect-error context.head is required on ServerDerivedRequest
    context: { repository: 'o/r', base: 'a' },
};
void noHead;

// missing repository → server 400 INVALID_INPUT (no parseable owner/repo)
const noRepo: ServerDerivedRequest = {
    preflight_mode: 'authorize',
    derivation: 'server',
    // @ts-expect-error context.repository is required on ServerDerivedRequest
    context: { base: 'a', head: 'b' },
};
void noRepo;

// derivation other than "server" → server 400 INVALID_INPUT
const badDerivation: ServerDerivedRequest = {
    preflight_mode: 'authorize',
    // @ts-expect-error only the literal 'server' is allowed
    derivation: 'client',
    context: { repository: 'o/r', base: 'a', head: 'b' },
};
void badDerivation;

// a caller-artifacts request may not carry derivation at all
const artifactsPlusDerivation: CallerArtifactsRequest = {
    preflight_mode: 'analyze',
    artifacts: [OPENAPI],
    // @ts-expect-error derivation is `never` on CallerArtifactsRequest
    derivation: 'server',
};
void artifactsPlusDerivation;

// ── state_nonce — a REQUEST input, not a server echo ─────────────────────────
// Consumed at coderifts-app src/change-set.js:1256 and copied into the signed grant.
const nonceOnModeA: CallerArtifactsRequest = {
    preflight_mode: 'authorize',
    artifacts: [OPENAPI],
    include_execution_grant: true,
    state_nonce: 'nonce-from-executor-state-challenge',
};
void nonceOnModeA;

const nonceOnModeB: ServerDerivedRequest = {
    preflight_mode: 'authorize',
    derivation: 'server',
    context: { repository: 'o/r', base: 'a', head: 'b' },
    include_execution_grant: true,
    state_nonce: 'nonce-from-executor-state-challenge',
};
void nonceOnModeB;

// Optional — absent means a BEARER grant (today's default).
const noNonce: CallerArtifactsRequest = {
    preflight_mode: 'authorize',
    artifacts: [OPENAPI],
    include_execution_grant: true,
};
void noNonce;

// state_nonce must be a string, not a number
const badNonce: CallerArtifactsRequest = {
    preflight_mode: 'authorize',
    artifacts: [OPENAPI],
    // @ts-expect-error state_nonce is string | undefined
    state_nonce: 42,
};
void badNonce;

// ── response typing ─────────────────────────────────────────────────────────
const derivation: DerivationEnvelope = {
    source: 'github_compare',
    base_sha: 'aaa',
    head_sha: 'bbb',
};
void derivation;

const serverDerived: CompletenessMode = 'SERVER_DERIVED';
void serverDerived;

// @ts-expect-error not a completeness mode the server authors
const notAMode: CompletenessMode = 'CALLER_DERIVED';
void notAMode;

const boundAuthority: AuthorityEnvelope = {
    audience: 'acme',
    tenant_scope: 'bound',
    binding_proven_at: '2026-08-24T00:00:00Z',
};
void boundAuthority;

const unboundAuthority: AuthorityEnvelope = { audience: null, tenant_scope: 'unbound' };
void unboundAuthority;

const badScope: AuthorityEnvelope = {
    audience: null,
    // @ts-expect-error tenant_scope is a closed set
    tenant_scope: 'partial',
};
void badScope;
