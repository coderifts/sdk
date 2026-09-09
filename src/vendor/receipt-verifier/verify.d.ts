/**
 * Types for the vendored `verify.js`, written HERE rather than in the vendored file.
 *
 * The vendored bytes must stay byte-identical to receipt-verifier's — a pin that survives an edit
 * is not a pin — so the declaration lives beside them instead of inside them.
 *
 * Only the two entry points this SDK uses are declared. Declaring the rest would invite callers to
 * reach into the core through this package, and the core is vendored for internal use, not
 * re-exported as an API this SDK then owns.
 */
export interface CoreReceiptVerdict {
    valid: boolean;
    status: string;
    reason?: string;
    payload?: Record<string, unknown>;
}
/**
 * The DEFAULT export — `module.exports` whole.
 *
 * Declared this way because node's cjs-module-lexer does not surface every name on this module to
 * an ESM importer (measured: `verifyReceipt` yes, `keyringFromDocument` no). Named declarations
 * here would type-check and then fail at load in the ESM build.
 */
declare const core: {
    verifyReceipt(
        token: string,
        opts: { ctx: { keyring: unknown; expectedKid: string | null }; now?: number },
    ): CoreReceiptVerdict;
    keyringFromDocument(doc: unknown): Map<string, unknown> | { byKid: Map<string, unknown> };
};
export default core;
