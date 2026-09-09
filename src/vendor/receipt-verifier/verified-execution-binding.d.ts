/**
 * Types for the vendored `verified-execution-binding.js`, written HERE rather than in it.
 *
 * The same rule as `verify.d.ts` beside it: the vendored bytes stay byte-identical to
 * receipt-verifier's, because a pin that survives an edit is not a pin. The declaration lives
 * alongside, and `VENDOR.sha256` covers the .js only — that is deliberate, since this file is
 * ours and the .js is theirs.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────────────────────
 *
 * `authorize()` loaded the core with a call-time `require(...)`, which needs no declaration and
 * therefore never needed one — and which MEASURED as `ReferenceError: require is not defined` in
 * `dist/esm/authorize.js` for every ESM consumer of the published package. Replacing it with a
 * static import is what makes the compiler responsible for the module form, and a static import
 * needs types. So this file is the cost of moving the check from a consumer's runtime to our
 * build.
 *
 * Only what `authorize()` actually calls is declared. Declaring the rest would invite callers to
 * reach into the core through this package; the core is vendored for internal use, not re-exported
 * as an API this SDK then owns.
 */

/** The core's own result shape. Kept loose: this SDK maps it, it does not redefine it. */
export interface CoreBindingResult {
    state: string;
    authorized_and_committed: boolean;
    shortfalls: string[];
    [k: string]: unknown;
}

/**
 * The DEFAULT export — `module.exports` whole, destructured at runtime.
 *
 * Declared this way for the reason `verify.d.ts` records: node's cjs-module-lexer does not
 * reliably surface every name on a vendored CommonJS module to an ESM importer, and a named import
 * that type-checks can still throw "does not provide an export named" at load. Taking
 * `module.exports` whole is interop that does not depend on a lexer guessing right about bytes
 * this package is forbidden to edit.
 */
declare const core: {
    verifiedExecutionBinding(input: Record<string, unknown>): CoreBindingResult;
    STATE: Record<string, string>;
    AUTHORITY: Record<string, string>;
    PROFILE: Record<string, unknown>;
    PROFILE_NAMES: Record<string, string>;
};

export default core;
