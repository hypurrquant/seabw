// Maps internal guardrail rule ids (e.g. "tier.cap.lp@60%:tagged") to
// human-readable labels + plain-English explanations for the Plan Review UI.
// The raw id is namespace@param[:variant]; we key off the namespace and surface
// the param as a value chip.

export interface GuardrailLabel {
  label: string;
  detail: string;
  value?: string;
}

const NAMESPACE_META: Record<string, { label: string; detail: string }> = {
  tier: {
    label: "Risk tier",
    detail: "The KOFIA tier your survey locked in. Everything below is derived from it.",
  },
  env: {
    label: "Environment",
    detail: "Demo runs against fixtures or dry-runs; prod requires real defi-cli calldata.",
  },
  "agent.steps.max": {
    label: "Step limit",
    detail: "The pipeline is capped at this many steps so a plan stays reviewable.",
  },
  "agent.chain.max": {
    label: "Chain limit",
    detail: "How many chains a single plan may touch.",
  },
  "tier.protocol.count": {
    label: "Protocol limit",
    detail: "Maximum distinct protocols allowed for your tier.",
  },
  "tier.bridge.allowed": {
    label: "Bridge policy",
    detail: "Whether (and where) cross-chain bridging is permitted for your tier.",
  },
  "tier.cap.leverage": {
    label: "Leverage ceiling",
    detail: "The most leverage your tier may take. Lower tiers are unleveraged (1x).",
  },
  "tier.cap.lp": {
    label: "LP capital cap",
    detail:
      "The share of your stablecoins allowed to leave stable lending and enter LP positions. The rest stays in stables.",
  },
  "tier.cap.single-pool": {
    label: "Single-pool cap",
    detail: "No more than this share of capital may sit in any one pool.",
  },
  "firstrun.cap": {
    label: "First-run cap",
    detail: "Your very first plan is size-limited as a safety rail.",
  },
  "gas.cap": {
    label: "Gas headroom",
    detail: "Estimated gas must stay within this multiple of the live base fee.",
  },
  whitelist: {
    label: "Protocol whitelist",
    detail: "Only protocols vetted for your tier (TVL, age, named auditors) are eligible.",
  },
  "slippage.cap": {
    label: "Slippage caps",
    detail: "Per-asset slippage ceilings — tightest for stables, loosest for long-tail tokens.",
  },
  "mev.private-rpc": {
    label: "MEV protection",
    detail: "Mainnet steps route through a private RPC to reduce sandwich risk.",
  },
  "ops.sanctioned.block": {
    label: "Sanctions screen",
    detail: "Your address is checked against the OFAC SDN list before any signature.",
  },
  "survey.derivative.gate": {
    label: "Derivative-experience gate",
    detail: "Degen tier requires prior derivative experience — otherwise you're stepped down.",
  },
  "survey.literacy.gate": {
    label: "Literacy gate",
    detail: "Degen tier requires top DeFi-literacy answers.",
  },
  "ux.consumer-protection.vulnerable": {
    label: "Vulnerable-consumer protection",
    detail: "Age 65+ or first-time self-checks trigger a one-tier protective downgrade.",
  },
  "ux.copy.honest": {
    label: "Honest-copy contract",
    detail: "APR is always labelled estimated, never guaranteed.",
  },
  "calldata.revalidate": {
    label: "Calldata re-check",
    detail: "Server re-verifies canonical calldata within this freshness window before each sign.",
  },
  rehydrate: {
    label: "Bound to your wallet",
    detail: "Calldata was rebuilt against your connected address before signing.",
  },
};

export function humanizeGuardrail(ruleId: string): GuardrailLabel {
  // Split "namespace@param:variant" → namespace, value.
  const atIdx = ruleId.indexOf("@");
  const namespace = atIdx === -1 ? ruleId : ruleId.slice(0, atIdx);
  const rawValue = atIdx === -1 ? "" : ruleId.slice(atIdx + 1);
  const value = rawValue.split(":")[0] || undefined;
  const meta = NAMESPACE_META[namespace];
  if (meta) {
    return { label: meta.label, detail: meta.detail, value };
  }
  // Unknown rule — degrade gracefully to a tidied version of the id.
  return {
    label: namespace.replace(/[._]/g, " "),
    detail: "Policy rule applied by the guardrail engine.",
    value,
  };
}
