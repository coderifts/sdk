/**
 * @coderifts/sdk — Main client class
 */
import type { CodeRiftsOptions, DiffRequest, DiffResponse, PreflightCheckRequest, PreflightCheckResponse, ExplainDecisionRequest, ExplainDecisionResponse, HowToUnblockRequest, HowToUnblockResponse, ScoreMcpRequest, ScoreMcpResponse, GetLedgerRequest, GetLedgerResponse, SimulatePolicyRequest, SimulatePolicyResponse, PreflightChangeSetRequest, PreflightChangeSetBody, PreflightChangeSetResponse, AnalyzeChangeSetResponse, AuthorizeChangeSetResponse, VerifyReceiptResponse, VerifyReceiptIntendedContext, DecisionLookupRequest, DecisionLookupResponse } from './types.js';
import { ApiError, AuthError, RateLimitError, TimeoutError } from './errors.js';
const DEFAULT_BASE_URL = 'https://app.coderifts.com';
const DEFAULT_TIMEOUT = 30_000;
export class CodeRifts {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly timeout: number;
    constructor(options: CodeRiftsOptions) {
        if (!options.apiKey) {
            throw new Error('apiKey is required');
        }
        this.apiKey = options.apiKey;
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.timeout = options.timeout || DEFAULT_TIMEOUT;
    }
    // ─── Internal HTTP helper ──────────────────────────────────────────────
    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            const json = (await res.json()) as T & { error?: string; message?: string };
            if (!res.ok) {
                const errorBody = {
                    error: json.error || 'unknown',
                    message: json.message || res.statusText,
                };
                if (res.status === 401)
                    throw new AuthError(errorBody);
                if (res.status === 429)
                    throw new RateLimitError(errorBody);
                throw new ApiError(res.status, errorBody);
            }
            return json;
        }
        catch (err: any) {
            if (err instanceof ApiError)
                throw err;
            if (err.name === 'AbortError') {
                throw new TimeoutError(this.timeout);
            }
            throw err;
        }
        finally {
            clearTimeout(timer);
        }
    }
    // ─── 1. preflightCheck ─────────────────────────────────────────────────
    /**
     * Check whether it is safe to proceed with a tool invocation.
     *
     * Accepts `old_spec` / `new_spec` (OpenAPI YAML strings) and a `tool_name`.
     * The SDK converts the specs to MCP tool arrays and calls POST /api/v1/agent/preflight.
     */
    async preflightCheck(req: PreflightCheckRequest): Promise<PreflightCheckResponse> {
        // Send old_spec / new_spec directly — the backend raw-spec mode runs the
        // full Ω_API governance pipeline on the OpenAPI specs.
        const raw = await this.request<Record<string, any>>('POST', '/api/v1/agent/preflight', {
            tool_name: req.tool_name,
            old_spec: req.old_spec,
            new_spec: req.new_spec,
        });
        const decision = raw.decision || 'ALLOW';
        return {
            decision,
            omega_api: raw.omega_api ?? 0,
            safe: decision === 'ALLOW' || decision === 'WARN',
            reflex_triggers: raw.reflex_triggers || [],
            affected_tools: raw.affected_tools || [],
            confidence_score: raw.confidence_score,
            reflex_override: raw.reflex_override,
            omega_components: raw.omega_components,
            breaking_changes: raw.breaking_changes,
            stats: raw.stats,
            mitigation_available: raw.mitigation_available,
        };
    }
    // ─── 2. diff ───────────────────────────────────────────────────────────
    /**
     * Full analysis of two OpenAPI specs.
     */
    async diff(req: DiffRequest): Promise<DiffResponse> {
        return this.request<DiffResponse>('POST', '/api/v1/diff', req);
    }
    // ─── 3. explainDecision ────────────────────────────────────────────────
    /**
     * Returns a human-readable explanation of why a decision was made.
     *
     * Computed client-side from the omega components and reflex triggers.
     */
    async explainDecision(req: ExplainDecisionRequest): Promise<ExplainDecisionResponse> {
        const components = [];
        if (req.omega_components) {
            for (const [name, value] of Object.entries(req.omega_components)) {
                if (typeof value === 'number') {
                    components.push({
                        name,
                        value,
                        description: describeComponent(name, value),
                    });
                }
            }
        }
        const triggers = req.reflex_triggers || [];
        let summary = `Decision: ${req.decision} (Ω_API = ${req.omega_api}).`;
        if (triggers.length > 0) {
            summary += ` ${triggers.length} reflex rule(s) triggered.`;
        }
        if (req.decision === 'BLOCK') {
            summary += ' This change is blocked due to high risk.';
        }
        else if (req.decision === 'REQUIRE_APPROVAL') {
            summary += ' This change requires manual approval before merging.';
        }
        else if (req.decision === 'WARN') {
            summary += ' This change has warnings but can proceed.';
        }
        else {
            summary += ' This change is safe to proceed.';
        }
        return { summary, components };
    }
    // ─── 4. howToUnblock ───────────────────────────────────────────────────
    /**
     * Returns actionable steps to resolve a BLOCK decision.
     *
     * Computed client-side from breaking changes and detected patterns.
     */
    async howToUnblock(req: HowToUnblockRequest): Promise<HowToUnblockResponse> {
        const actions = [];
        let step = 1;
        if (req.decision !== 'BLOCK') {
            actions.push({
                step: step++,
                description: `Current decision is "${req.decision}" — no unblock needed.`,
            });
            return { actions };
        }
        const bcs = req.breaking_changes || [];
        if (bcs.length > 0) {
            actions.push({
                step: step++,
                description: `Fix ${bcs.length} breaking change(s) in your spec.`,
                code_example: bcs
                    .slice(0, 3)
                    .map((bc) => `# ${bc.type} at ${bc.path}: ${bc.description}`)
                    .join('\n'),
            });
        }
        const triggers = req.reflex_triggers || [];
        for (const trigger of triggers) {
            actions.push({
                step: step++,
                description: `Resolve reflex rule: ${trigger.rule}`,
            });
        }
        actions.push({
            step: step++,
            description: 'Request a manual override via POST /api/v1/ledger/:id/override if this is an emergency.',
        });
        return { actions };
    }
    // ─── 5. scoreMcp ──────────────────────────────────────────────────────
    /**
     * Score an MCP manifest for agent safety.
     */
    async scoreMcp(req: ScoreMcpRequest): Promise<ScoreMcpResponse> {
        return this.request<ScoreMcpResponse>('POST', '/api/v1/agent-readiness-score', {
            spec: req.manifest,
            spec_type: 'mcp',
        });
    }
    // ─── 6. getLedger ─────────────────────────────────────────────────────
    /**
     * Query compliance ledger entries.
     */
    async getLedger(req: GetLedgerRequest = {}): Promise<GetLedgerResponse> {
        const params = new URLSearchParams();
        if (req.repo)
            params.set('repo', req.repo);
        if (req.decision)
            params.set('decision', req.decision);
        if (req.from)
            params.set('from', req.from);
        if (req.to)
            params.set('to', req.to);
        if (req.limit)
            params.set('limit', String(req.limit));
        const qs = params.toString();
        const path = `/api/v1/ledger${qs ? `?${qs}` : ''}`;
        return this.request<GetLedgerResponse>('GET', path);
    }
    // ─── 7. simulatePolicy ───────────────────────────────────────────────
    /**
     * Test a YAML policy against two OpenAPI specs.
     */
    async simulatePolicy(req: SimulatePolicyRequest): Promise<SimulatePolicyResponse> {
        return this.request<SimulatePolicyResponse>('POST', '/api/v1/policy-simulator', req);
    }
    // ─── 8. preflightChangeSet ─────────────────────────────────────────────
    /**
     * Preflight a multi-artifact change set (OpenAPI / GraphQL / gRPC / AsyncAPI / MCP manifest)
     * in one call. Requires top-level `preflight_mode: 'analyze' | 'authorize'` (Decision Spec v2;
     * server returns HTTP 400 if omitted). Prefer `analyzeChangeSet` / `authorizeChangeSet` so the
     * two authorization meanings cannot be mixed. POST /api/v1/preflight.
     *
     * Returns the mode-discriminated union: narrow on `preflight_mode` before reading
     * `decision` / `safe_for_agent` (authorize) or `analysis_outcome` (analyze). Call
     * `analyzeChangeSet` / `authorizeChangeSet` instead to get an already-narrowed type.
     */
    async preflightChangeSet(req: PreflightChangeSetRequest): Promise<PreflightChangeSetResponse> {
        return this.request<PreflightChangeSetResponse>('POST', '/api/v1/preflight', req);
    }
    /**
     * Risk-only preflight (`preflight_mode: 'analyze'`). Informational — not permission;
     * does not mint an operation-bound receipt. POST /api/v1/preflight.
     *
     * The mode is fixed by this method, so the analyze branch is returned directly — there is no
     * `decision` / `execution_action` / `safe_for_agent` on it, by protocol.
     */
    async analyzeChangeSet(req: PreflightChangeSetBody): Promise<AnalyzeChangeSetResponse> {
        // Delegation to the single I/O site is kept deliberately. The mode is fixed here, so the
        // server returns the analyze branch of the oneOf; TypeScript cannot prove that about a
        // value it did not construct, hence the assertion (it states the protocol guarantee, it
        // does not widen it).
        return this.preflightChangeSet({
            ...req,
            preflight_mode: 'analyze',
        }) as Promise<AnalyzeChangeSetResponse>;
    }
    /**
     * Operation-bound authorize preflight (`preflight_mode: 'authorize'`).
     * Requires a non-empty `context.operation` (e.g. merge | deploy | tool_call) — the server
     * returns HTTP 400 otherwise. May mint a signed receipt. POST /api/v1/preflight.
     *
     * The mode is fixed by this method, so the authorize branch is returned directly:
     * `decision`, `execution_action` and `safe_for_agent` are present without narrowing.
     */
    async authorizeChangeSet(req: PreflightChangeSetBody): Promise<AuthorizeChangeSetResponse> {
        // See analyzeChangeSet: delegation preserved, assertion states the fixed-mode guarantee.
        return this.preflightChangeSet({
            ...req,
            preflight_mode: 'authorize',
        }) as Promise<AuthorizeChangeSetResponse>;
    }
    // ─── 9. verifyReceipt ──────────────────────────────────────────────────
    /**
     * Verify a CodeRifts chain receipt. No API key is required — this is a public endpoint (the
     * Authorization header is sent for consistency but ignored server-side).
     * POST /api/v1/verify-receipt.
     *
     * Two questions, and which one you get depends on whether you pass `intended`:
     *
     * - `verifyReceipt(token)` — SIGNATURE only. `valid` / `status` answer authenticity and expiry;
     *   `currently_authorized` comes back **null**, meaning not evaluated. Null is not a pass.
     * - `verifyReceipt(token, { operation, environment, decision_result, … })` — AUTHORIZATION.
     *   The server binds the receipt against the stated intent and `currently_authorized` becomes a
     *   real `true` / `false`, with `authz_status` / `authz_reason` explaining a `false`.
     *
     * A valid signature is not authorization: only the second form can answer "does this receipt
     * authorize the action I am about to take?". Supply the context you are about to act under.
     *
     * @param token     the chain-receipt token
     * @param intended  optional intended context; any subset of its fields may be supplied
     */
    async verifyReceipt(
        token: string,
        intended?: VerifyReceiptIntendedContext,
    ): Promise<VerifyReceiptResponse> {
        // Only the fields the caller actually supplied are sent. An absent field must stay ABSENT,
        // not null: the server treats "no context" as signature-only, and a null would otherwise be
        // read as an intent the caller never stated.
        const body: Record<string, unknown> = { token };
        if (intended && typeof intended === 'object') {
            for (const [key, value] of Object.entries(intended)) {
                if (value !== undefined) body[key] = value;
            }
        }
        return this.request<VerifyReceiptResponse>('POST', '/api/v1/verify-receipt', body);
    }
    // ─── 10. getDecisionDetails ────────────────────────────────────────────
    /**
     * Look up a stored decision by decision_id or fingerprint; returns the stored
     * decision-result.v1.1 envelope + meta. POST /api/v1/decisions/lookup.
     */
    async getDecisionDetails(req: DecisionLookupRequest): Promise<DecisionLookupResponse> {
        return this.request<DecisionLookupResponse>('POST', '/api/v1/decisions/lookup', req);
    }
}
// ── Helpers ──────────────────────────────────────────────────────────────────
function describeComponent(name: string, value: number): string {
    const descriptions: Record<string, string> = {
        S_contract: 'Contract severity score — measures how severe the breaking changes are',
        P_break: 'Break probability — likelihood that downstream consumers will break',
        S_blast_eff: 'Blast radius — how many consumers are affected',
        S_agent: 'Agent safety score — risk to AI agent tool invocations',
        S_runtime: 'Runtime impact — risk of runtime failures',
        ECI: 'Ecosystem coupling index — how tightly coupled the API is',
        M_eff: 'Migration effort — estimated effort to migrate consumers',
        D_contract: 'Contract distance — semantic distance between old and new contracts',
        confidence_score: 'Confidence in the analysis result',
    };
    return descriptions[name] || `${name} = ${value}`;
}
