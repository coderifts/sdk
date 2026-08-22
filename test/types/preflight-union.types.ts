/**
 * ID819 — compile-time contract test for the GENERATED PreflightChangeSetResponse union.
 *
 * Run by `npm run test:types` (tsc --noEmit -p tsconfig.typetest.json). Nothing here executes;
 * every assertion is a type error if the generated union stops meaning what it means. The union
 * itself is generated from coderifts-app/schemas/preflight-response.v2.{producer,consumer}.json —
 * these assertions pin the CONSUMER-VISIBLE guarantees that generation must never quietly drop.
 *
 * Each `@ts-expect-error` is a live assertion in both directions: if the error stops occurring
 * (the union widened and analyze started offering authorization fields), tsc fails with
 * "Unused '@ts-expect-error' directive". A silently-passing test is not possible here.
 */
import type {
    Decision,
    ExecutionAction,
    DecisionResultEnvelope,
    DecisionEvidence,
    ChangeSetArtifactFinding,
    AnalysisOutcome,
    AuthorizeReceiptKind,
    AnalyzeChangeSetResponse,
    AuthorizeChangeSetResponse,
    PreflightChangeSetResponse,
    PreflightChangeSetContext,
    VerifyReceiptIntendedContext,
} from '../../src/types.js';

/* ── 1. The union narrows on preflight_mode ─────────────────────────────────────────────── */

export function narrowsToAuthorize(res: PreflightChangeSetResponse): string {
    if (res.preflight_mode === 'authorize') {
        const decision: Decision = res.decision;
        const action: ExecutionAction = res.execution_action;
        const safe: boolean = res.safe_for_agent;
        const receipt: string | undefined = res.chain_receipt;
        const kind: AuthorizeReceiptKind | undefined = res.receipt_kind;
        const envelope: DecisionResultEnvelope | undefined = res.decision_result;
        return `${decision}${action}${safe}${receipt ?? ''}${kind ?? ''}${envelope ? '1' : '0'}`;
    }
    const outcome: AnalysisOutcome = res.analysis_outcome;
    return outcome;
}

/* ── 2. analyze STRUCTURALLY omits the authorization vocabulary ─────────────────────────── */

export function analyzeHasNoAuthorizationFields(res: PreflightChangeSetResponse): void {
    if (res.preflight_mode === 'analyze') {
        // @ts-expect-error analyze never carries a decision (producer: not/anyOf required decision)
        res.decision;
        // @ts-expect-error analyze never carries an execution directive
        res.execution_action;
        // @ts-expect-error analyze never carries safe_for_agent
        res.safe_for_agent;
        // @ts-expect-error analyze never mints a receipt
        res.chain_receipt;
        // @ts-expect-error analyze never carries the decision-result envelope
        res.decision_result;
    }
}

/* ── 3. Reading a mode-specific field WITHOUT narrowing is an error ─────────────────────── */

export function unNarrowedAccessIsAnError(res: PreflightChangeSetResponse): void {
    // @ts-expect-error must narrow on preflight_mode before reading decision fields
    res.safe_for_agent;
    // @ts-expect-error must narrow on preflight_mode before reading analysis fields
    res.analysis_outcome;
}

/* ── 4. The analyze constants stay literal-typed (they are the "not permission" proof) ──── */

export function analyzeConstantsAreLiteral(res: AnalyzeChangeSetResponse): void {
    const effect: 'NONE' = res.authorization_effect;
    const mayExecute: false = res.may_execute;
    const receiptKind: 'NONE' = res.receipt_kind;
    void effect;
    void mayExecute;
    void receiptKind;
    // @ts-expect-error authorization_effect is pinned to 'NONE' — analyze cannot authorize
    const granted: AnalyzeChangeSetResponse['authorization_effect'] = 'GRANTED';
    void granted;
    // @ts-expect-error may_execute is pinned to false — analyze never grants execute
    const permitted: AnalyzeChangeSetResponse['may_execute'] = true;
    void permitted;
    // @ts-expect-error receipt_kind is pinned to 'NONE' — analyze never mints a receipt
    const minted: AnalyzeChangeSetResponse['receipt_kind'] = 'operation_authorization';
    void minted;
}

/* ── 5. Required-ness follows the CONSUMER schema, not the producer ─────────────────────── */

export const minimalAnalyze: AnalyzeChangeSetResponse = {
    preflight_mode: 'analyze',
    analysis_outcome: 'NO_BREAK_DETECTED',
    authorization_effect: 'NONE',
    may_execute: false,
    receipt_kind: 'NONE',
    decision_spec_version: '2.0',
    // risk_score / breaking_changes are producer-required but consumer-optional: a reader must
    // not be forced to assume the server sent them.
};

export const minimalAuthorize: AuthorizeChangeSetResponse = {
    preflight_mode: 'authorize',
    decision: 'ALLOW',
    execution_action: 'CONTINUE',
    safe_for_agent: true,
    receipt_kind: 'NONE',
    decision_spec_version: '2.0',
};

/* ── 6. The discriminating minimum really is required ───────────────────────────────────── */

// @ts-expect-error analysis_outcome is required on the analyze branch
export const missingOutcome: AnalyzeChangeSetResponse = {
    preflight_mode: 'analyze',
    authorization_effect: 'NONE',
    may_execute: false,
    receipt_kind: 'NONE',
    decision_spec_version: '2.0',
};

// @ts-expect-error decision is required on the authorize branch
export const missingDecision: AuthorizeChangeSetResponse = {
    preflight_mode: 'authorize',
    execution_action: 'CONTINUE',
    safe_for_agent: true,
    decision_spec_version: '2.0',
};

/* ── 7. Type bindings survive generation (schema leaves these nodes open) ───────────────── */

export function bindingsHold(res: AuthorizeChangeSetResponse): void {
    const findings: ChangeSetArtifactFinding[] | undefined = res.artifacts;
    const evidence: DecisionEvidence[] | undefined = res.evidence;
    // The per-artifact finding is a real shape, not unknown[].
    const first: Decision | undefined = findings?.[0]?.decision;
    void evidence;
    void first;
    // Open records stay indexable (schema `{ "type": "object" }` → Record<string, unknown>).
    const metaValue: unknown = res.meta?.anything;
    const controlValue: unknown = res.control_envelope?.anything;
    void metaValue;
    void controlValue;
}

/* ── 8. The branches are closed (additionalProperties:false on the producer) ────────────── */

export function branchesAreClosed(): void {
    const bad: AnalyzeChangeSetResponse = {
        preflight_mode: 'analyze',
        analysis_outcome: 'NO_BREAK_DETECTED',
        authorization_effect: 'NONE',
        may_execute: false,
        receipt_kind: 'NONE',
        decision_spec_version: '2.0',
        // @ts-expect-error the analyze branch is closed — invented keys are not part of the contract
        not_a_schema_field: true,
    };
    void bad;
}

/* ── 9. P0-5 base/head is typed on preflight context and verify intended-context ──────── */

export function preflightContextTypesBaseHead(ctx: PreflightChangeSetContext): string {
    const base: string | undefined = ctx.base;
    const head: string | undefined = ctx.head;
    return `${base ?? ''}${head ?? ''}`;
}

export function verifyIntendedContextTypesBaseHead(ctx: VerifyReceiptIntendedContext): string {
    const base: string | undefined = ctx.base;
    const head: string | undefined = ctx.head;
    return `${base ?? ''}${head ?? ''}`;
}

export const preflightContextWithSource: PreflightChangeSetContext = {
    operation: 'merge',
    base: 'base-sha',
    head: 'head-sha',
};

export const verifyIntendedWithSource: VerifyReceiptIntendedContext = {
    operation: 'merge',
    base: 'base-sha',
    head: 'head-sha',
};
