/**
 * @coderifts/sdk — Type definitions
 */

// ---------------------------------------------------------------
// Client options
// ---------------------------------------------------------------

export interface CodeRiftsOptions {
  /** API key (cr_live_... or cr_test_...) */
  apiKey: string;
  /** Base URL override. Defaults to https://app.coderifts.com */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30000 */
  timeout?: number;
}

// ---------------------------------------------------------------
// Diff
// ---------------------------------------------------------------

export interface DiffRequest {
  old_spec: string;
  new_spec: string;
}

export interface BreakingChange {
  id: string;
  type: string;
  severity: string;
  path: string;
  method: string;
  description: string;
}

export interface DiffResponse {
  breaking_changes: BreakingChange[];
  breaking_changes_count: number;
  non_breaking_changes_count: number;
  risk_score: number;
  risk_level: string;
  semver_suggestion: string;
  should_block: boolean;
  omega_api?: number;
  omega_decision?: string;
  summary: string;
}

// ---------------------------------------------------------------
// Agent Readiness Score
// ---------------------------------------------------------------

export interface ReadinessSignal {
  signal: string;
  severity: string;
  deduction: number;
  detail: string;
}

export interface ReadinessResponse {
  name: string;
  score: number;
  band: string;
  label: string;
  signals: ReadinessSignal[];
  tool_count?: number;
  spec_type: 'openapi' | 'mcp';
}

export interface ReadinessRequest {
  spec: string | object;
  spec_type?: 'openapi' | 'mcp';
}

// ---------------------------------------------------------------
// MCP Score (public demo endpoint)
// ---------------------------------------------------------------

export interface McpScoreResponse {
  name: string;
  score: number;
  band: string;
  label: string;
  signals: ReadinessSignal[];
  tool_count: number;
  spec_type: 'mcp';
}

// ---------------------------------------------------------------
// Analytics / Stability
// ---------------------------------------------------------------

export interface StabilityRequest {
  repo: string;
  days?: 7 | 14 | 30 | 90;
}

export interface StabilitySummary {
  total_analyses: number;
  blocked_prs: number;
  block_rate: number;
  avg_omega_api: number;
  avg_breaking_changes: number;
  v_api_level: string;
}

export interface TrendPoint {
  date: string;
  analyses: number;
  blocked: number;
  avg_omega: number;
}

export interface PatternEntry {
  pattern: string;
  count: number;
  pct: number;
}

export interface OmegaDistribution {
  allow: number;
  warn: number;
  require_approval: number;
  block: number;
}

export interface StabilityResponse {
  repo: string;
  period_days: number;
  summary: StabilitySummary;
  trend: TrendPoint[];
  top_patterns: PatternEntry[];
  omega_distribution: OmegaDistribution;
}

// ---------------------------------------------------------------
// Agent Preflight
// ---------------------------------------------------------------

export interface PreflightRequest {
  spec: string | object;
}

export interface PreflightTool {
  name: string;
  description: string;
  input_schema: object;
  endpoint?: string;
  method?: string;
}

export interface PreflightResponse {
  tools: PreflightTool[];
  tool_count: number;
}

// ---------------------------------------------------------------
// Error response
// ---------------------------------------------------------------

export interface ApiErrorBody {
  error: string;
  message: string;
}
