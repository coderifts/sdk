/**
 * I-1289 — compile-time contract test for the HAND-WRITTEN control_envelope mirror.
 *
 * Run by `npm run test:types` (tsc --noEmit -p tsconfig.typetest.json). Nothing here
 * executes; every assertion is a type error if the mirror stops meaning what
 * coderifts-app `schemas/control-envelope.v1.producer.json` says.
 *
 * These matter more than usual precisely BECAUSE this block is hand-written. The
 * generated union next door is protected by its generator; this one is protected only
 * by what is pinned here. Each `@ts-expect-error` is a live assertion in both
 * directions — if the error stops occurring, tsc fails with "Unused '@ts-expect-error'
 * directive", so a silently-passing test is not possible.
 */
import type {
    AuthorizeChangeSetResponse,
    AnalyzeChangeSetResponse,
    PreflightChangeSetResponse,
    ControlEnvelope,
    NextAgentStep,
    ReceiptView,
    RequiredActionObject,
} from '../../src/types.js';

/* ── 1. control_envelope is TYPED, not an unknown bag ───────────────────────────────── */

// Before this mirror the generated type was `{ [k: string]: unknown }` and this line
// could not compile without a cast. That it does is the whole point of the file.
export function branchKeyIsTyped(res: AuthorizeChangeSetResponse): boolean {
    return res.control_envelope?.execution_action === 'STOP';
}

// @ts-expect-error — 'CONTINUE_MAYBE' is not in the closed ExecutionAction set.
export const badAction: NonNullable<ControlEnvelope['execution_action']> = 'CONTINUE_MAYBE';

// @ts-expect-error — 'MAYBE' is not in the closed Decision set.
export const badDecision: NonNullable<ControlEnvelope['decision']> = 'MAYBE';

/* ── 2. The three fields the producer REQUIRES are required ─────────────────────────── */

// @ts-expect-error — control_version / receipt_view / enforcement are all required.
export const missingRequired: ControlEnvelope = {};

export function requiredFieldsAreNonOptional(c: ControlEnvelope): [string, ReceiptView, string] {
    // No optional chaining needed: the producer guarantees all three on both builders.
    return [c.control_version, c.receipt_view, c.enforcement.note];
}

/* ── 3. next_agent_step: closed action set, nullable on the allow class ─────────────── */

export function readsTheStep(c: ControlEnvelope): string | null {
    const step = c.next_agent_step;
    // `null` on CONTINUE / CONTINUE_WITH_MONITORING is a VALUE, so the null branch
    // must be reachable — this compiles only because the type admits it.
    if (step === null || step === undefined) return null;
    return step.action;
}

// @ts-expect-error — 'proceed' is not in the closed next_agent_step action set.
export const badStepAction: NextAgentStep['action'] = 'proceed';

// @ts-expect-error — then_call is a closed pair plus null, not any string.
export const badThenCall: NextAgentStep['then_call'] = 'run_anything';

export const goodStep: NextAgentStep = {
    action: 'revert',
    reason: 'remediate_or_revert',
    resume_condition: '',
    then_call: 'preflight_change_set',
};

/* ── 4. required_action stays a UNION — never collapsed to object-only ──────────────── */

export function acceptsEveryProducerShape(): Array<ControlEnvelope['required_action']> {
    const asObject: RequiredActionObject = {
        type: 'remediate_or_revert',
        reason_code: 'field_removed',
        recheck_required: true,
        // Fresh path emits objects; a stored core emits ids only. Both are legal.
        choices: ['revert', { id: 'migrate', label: 'Migrate consumers', outcome: 're_preflight' }],
    };
    return [asObject, 'legacy prose string', null];
}

// @ts-expect-error — 'reroute' is not in the closed required_action type set.
export const badRequiredActionType: RequiredActionObject['type'] = 'reroute';

/* ── 5. Nullability is the producer's, not a guess ──────────────────────────────────── */

export function nullsAreValues(v: ReceiptView): Array<boolean | null> {
    // `verified: null` = not evaluated here; distinct from `false` = evaluated, not verified.
    // `currently_authorized: null` = could not be evaluated. Both must stay reachable.
    return [v.present, v.verified, v.currently_authorized];
}

// @ts-expect-error — binds_to is nullable; reading through it without a guard is an error.
export const unguardedBindsTo: string | null | undefined = ({} as ReceiptView).binds_to.operation;

/* ── 6. control_envelope is AUTHORIZE-ONLY ──────────────────────────────────────────── */

// @ts-expect-error — the analyze branch structurally has no control_envelope
// (attachControlSurface emits analysis_control there instead).
export const analyzeHasNoControl = ({} as AnalyzeChangeSetResponse).control_envelope;

export function narrowFirst(res: PreflightChangeSetResponse): string | undefined {
    if (res.preflight_mode !== 'authorize') return undefined;
    return res.control_envelope?.control_version;
}
