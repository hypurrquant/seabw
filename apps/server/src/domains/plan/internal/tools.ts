// §8.4 agent.tools.allowlist — explicit allowlist of every external tool the
// agent is allowed to invoke. Any tool not in this list is forbidden; there
// is no escape hatch.

export const AGENT_TOOL_ALLOWLIST = [
  // Intent parsing (server-side Anthropic SDK)
  "anthropic.messages.create:emit_parsed_intent",

  // defi-cli read-only ops (quotes, scans, prices)
  "defi.status",
  "defi.schema",
  "defi.price",
  "defi.yield.scan",
  "defi.yield.compare",
  "defi.lending.rates",
  "defi.lp.discover",
  "defi.token.balance",
  "defi.token.allowance",
  "defi.portfolio",

  // defi-cli quote / preflight ops — must NEVER run with --broadcast
  "defi.swap.quote",
  "defi.lending.supply",
  "defi.lending.withdraw",
  "defi.lending.borrow",
  "defi.lending.repay",
  "defi.lp.add",
  "defi.lp.remove",
  "defi.lp.farm",
  "defi.lp.claim",
  "defi.bridge.quote",
] as const;

export type AgentTool = (typeof AGENT_TOOL_ALLOWLIST)[number];

const ALLOWED = new Set<string>(AGENT_TOOL_ALLOWLIST);

export class ForbiddenToolError extends Error {
  constructor(tool: string) {
    super(`Tool not in allowlist: ${tool}`);
    this.name = "ForbiddenToolError";
  }
}

export function assertToolAllowed(tool: string): asserts tool is AgentTool {
  if (!ALLOWED.has(tool)) throw new ForbiddenToolError(tool);
}

export function isToolAllowed(tool: string): tool is AgentTool {
  return ALLOWED.has(tool);
}
