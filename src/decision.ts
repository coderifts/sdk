/**
 * @coderifts/sdk — Decision reading (guard helper)
 */

import type { DecisionResultEnvelope, DecisionReceipt, ExecutionAction } from './types.js';

/** Pure decision -> execution-action map (mirrors the server's deriveExecutionAction). */
const EXECUTION_ACTION: Record<string, ExecutionAction> = {
    ALLOW: 'CONTINUE',
    WARN: 'CONTINUE_WITH_MONITORING',
    REQUIRE_APPROVAL: 'REQUEST_APPROVAL',
    BLOCK: 'STOP',
};

export interface ReadDecisionResult {
    /** The action to take. Fail-closed to 'STOP' when the response is unreadable. */
    executionAction: ExecutionAction;
    /** The governance decision if present, else null. */
    decision: string | null;
    /** The decision-result.v1.1 envelope when the response carried one. */
    envelope?: DecisionResultEnvelope;
    /** The chain receipt block when the envelope carried one. */
    receipt?: DecisionReceipt;
    /** Set to 'UNREADABLE_DECISION' when falling closed. */
    reason?: string;
}

function isExecutionAction(v: unknown): v is ExecutionAction {
    return v === 'CONTINUE' || v === 'CONTINUE_WITH_MONITORING' || v === 'REQUEST_APPROVAL' || v === 'STOP';
}

/**
 * True when the response carries an EXPLICIT execution action — envelope-first,
 * then top-level — drawn from the closed set.
 *
 * This exists so a permission-shaped value is never granted by the legacy
 * `decision` -> action arm of {@link readDecision}. `decision` is the governance
 * explanation label; letting it grant permission is the branch-on-decision
 * pattern this SDK removes. Reading a decision may fall back to that arm;
 * GRANTING one may not.
 */
export function hasExplicitExecutionAction(response: unknown): boolean {
    if (!response || typeof response !== 'object') return false;
    const r = response as Record<string, unknown>;
    const env = r.decision_result as Record<string, unknown> | undefined;
    if (env && typeof env === 'object' && isExecutionAction(env.execution_action)) return true;
    return isExecutionAction(r.execution_action);
}

/**
 * v2 body: `decision_result` present, OR `decision_spec_version` starts "2.", OR
 * `preflight_mode` present. Mirrors @coderifts/agent-guard's isV2Response — the two
 * readers must not disagree about what "legacy" means.
 */
function isV2Response(r: Record<string, unknown>, envObj: Record<string, unknown> | null): boolean {
    if (envObj) return true;
    if (r.preflight_mode != null && r.preflight_mode !== '') return true;
    const ver = r.decision_spec_version;
    return typeof ver === 'string' && ver.startsWith('2.');
}

/**
 * The legacy `decision` -> action map is allowed ONLY on an explicit spec-1.0 body that is
 * not v2. A MISSING `decision_spec_version` is NOT legacy.
 *
 * 1565/1585, measured: before this gate the bare-legacy arm mapped `{decision:'ALLOW'}` to
 * CONTINUE for EVERY bare shape — a missing action, an unrecognised action, and a spec-2.0
 * body all resolved to permission. An agent branching on the result proceeded on a response
 * that never granted anything. The wrapped shape was already fail-closed; only the bare arm
 * leaked, which is why one measurement called this reader fail-closed and another called it
 * fail-open. Both were right about the shape they fed it.
 */
function allowLegacyDecisionMap(r: Record<string, unknown>, envObj: Record<string, unknown> | null): boolean {
    return r.decision_spec_version === '1.0' && !isV2Response(r, envObj);
}

/**
 * Read a governance decision from ANY CodeRifts response, fail-closed. Resolution order:
 *   1. envelope-first — `response.decision_result.execution_action` (+ receipt);
 *   2. top-level `execution_action` (legacy REST endpoints emit it directly);
 *   3. map a top-level `decision` via the ported deriveExecutionAction table — ONLY on an
 *      explicit spec-1.0, non-v2 body (see {@link allowLegacyDecisionMap});
 *   4. otherwise fail closed: `{ executionAction: 'STOP', reason: 'UNREADABLE_DECISION' }`.
 * Never throws — a guard can call this on any value (including error bodies / garbage).
 */
export function readDecision(response: unknown): ReadDecisionResult {
    if (!response || typeof response !== 'object') {
        return { executionAction: 'STOP', decision: null, reason: 'UNREADABLE_DECISION' };
    }
    const r = response as Record<string, unknown>;

    // 1. Envelope first.
    const env = r.decision_result as Record<string, unknown> | undefined;
    if (env && typeof env === 'object' && isExecutionAction(env.execution_action)) {
        const receipt = env.receipt;
        return {
            executionAction: env.execution_action,
            decision: typeof env.decision === 'string' ? env.decision : null,
            envelope: env as unknown as DecisionResultEnvelope,
            receipt: receipt && typeof receipt === 'object' ? (receipt as DecisionReceipt) : undefined,
        };
    }

    // 2. Top-level execution_action.
    if (isExecutionAction(r.execution_action)) {
        return {
            executionAction: r.execution_action,
            decision: typeof r.decision === 'string' ? r.decision : null,
        };
    }

    // 3. Legacy decision-only -> mapped action. Gated: explicit spec 1.0, non-v2 only.
    if (
        typeof r.decision === 'string' &&
        Object.prototype.hasOwnProperty.call(EXECUTION_ACTION, r.decision) &&
        allowLegacyDecisionMap(r, (env && typeof env === 'object' ? env : null))
    ) {
        return { executionAction: EXECUTION_ACTION[r.decision], decision: r.decision };
    }

    // 4. Fail closed.
    return {
        executionAction: 'STOP',
        decision: typeof r.decision === 'string' ? r.decision : null,
        reason: 'UNREADABLE_DECISION',
    };
}
