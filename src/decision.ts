/**
 * @coderifts/sdk — Decision reading (guard helper)
 */

import type { DecisionResultEnvelope, DecisionReceipt, ExecutionAction } from './types';

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
 * Read a governance decision from ANY CodeRifts response, fail-closed. Resolution order:
 *   1. envelope-first — `response.decision_result.execution_action` (+ receipt);
 *   2. top-level `execution_action` (legacy REST endpoints emit it directly);
 *   3. map a top-level `decision` via the ported deriveExecutionAction table;
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

    // 3. Legacy decision-only -> mapped action.
    if (typeof r.decision === 'string' && Object.prototype.hasOwnProperty.call(EXECUTION_ACTION, r.decision)) {
        return { executionAction: EXECUTION_ACTION[r.decision], decision: r.decision };
    }

    // 4. Fail closed.
    return {
        executionAction: 'STOP',
        decision: typeof r.decision === 'string' ? r.decision : null,
        reason: 'UNREADABLE_DECISION',
    };
}
