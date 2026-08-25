/**
 * 3.8.0 — the PreflightCheckResponse / DiffResponse stubs must carry the
 * control field the live endpoints emit (`execution_action` top-level on
 * POST /api/v1/agent/preflight and POST /api/v1/diff).
 *
 * `HasField<T,'execution_action'> = true` fails to compile if the property is
 * removed. Run by `npm run test:types`.
 */
import type { DiffResponse, ExecutionAction, PreflightCheckResponse } from '../../src/types.js';

type HasField<T, K extends string> = K extends keyof T ? true : false;

const preflightCarriesExecutionAction: HasField<PreflightCheckResponse, 'execution_action'> = true;
const diffCarriesExecutionAction: HasField<DiffResponse, 'execution_action'> = true;
void preflightCarriesExecutionAction;
void diffCarriesExecutionAction;

export function readPreflightExecutionAction(res: PreflightCheckResponse): ExecutionAction | undefined {
    return res.execution_action;
}

export function readDiffExecutionAction(res: DiffResponse): ExecutionAction | undefined {
    return res.execution_action;
}
