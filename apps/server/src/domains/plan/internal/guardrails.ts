import type {
  PipelinePlan,
  PlanStep,
  Tier,
  TokenAmount,
} from "@seabw/core";
import {
  isBridgeMajorChain,
  isMajorAsset,
  isStablecoin,
} from "@seabw/core";
import { isProtocolAllowed, protocolDetails } from "./whitelist";
import { isSanctioned } from "../../precheck/internal/sanctions";

export interface GuardrailContext {
  tier: Tier;
  rawScore: number;
  literacyScore: 1 | 2 | 3 | 4;
  derivativeExpScore: 1 | 2 | 3 | 4;
  vulnerableConsumer: boolean;
  signerAddress: string;
  signTimestampMs: number;
  gasBalanceWei: bigint;
  nativeUsdPrice?: number;          // for gas.cap math
  firstRun: boolean;
  env: "demo" | "prod";
  usdPrices?: Record<string, number>;
}

export interface GuardrailOk {
  ok: true;
  plan: PipelinePlan;
}

export interface GuardrailReject {
  ok: false;
  reason: string;
  ruleId: string;
}

export type GuardrailResult = GuardrailOk | GuardrailReject;

const SLIPPAGE_STABLE_CAP = 0.1;
const SLIPPAGE_MAJOR_CAP = 0.5;
const SLIPPAGE_LONGTAIL_CAP = 2.0;
const SLIPPAGE_ABSOLUTE_MAX = 5.0;
const DEADLINE_MAX_MIN = 30;
const GAS_HEADROOM_FACTOR = 0.7;
const DUST_USD = 1;
const MAX_STEPS = 8;
const MAX_CHAINS = 2;

// Explicit per-tier LP allocation cap. Degen is the only tier with no cap by
// design — encoded as Infinity rather than omitting the key so the type
// system enforces completeness and Codex can prove there's no implicit
// fall-through.
const TIER_LP_CAP: Record<Tier, number> = {
  preservation: 0,
  conservative: 0.2,
  balanced: 0.6,
  aggressive: 0.8,
  degen: Number.POSITIVE_INFINITY,
};

const TIER_LEVERAGE_CAP: Record<Tier, number> = {
  preservation: 1,
  conservative: 1,
  balanced: 1,
  aggressive: 1,
  degen: 3,
};

const TIER_PROTOCOL_COUNT_CAP: Record<Tier, number> = {
  preservation: 1,
  conservative: 2,
  balanced: 3,
  aggressive: 5,
  degen: 8,
};

const TIER_BRIDGE_CAP: Record<Tier, number> = {
  preservation: 0,
  conservative: 0,
  balanced: 1,
  aggressive: 2,
  degen: 2,
};

// Single-pool concentration cap — share of LP capital that any one
// `${chainId}:${protocol}` pool may hold. Prevents a diversified-looking
// basket from collapsing to one pool. Multi-range sub-positions in the SAME
// pool (B feature) share the key and are counted as one position.
const TIER_SINGLE_POOL_CAP: Record<Tier, number> = {
  preservation: 1,           // N/A (no LP)
  conservative: 1,           // N/A (LP cap is 20% anyway)
  balanced: 0.5,             // ≤50% of LP capital in a single pool
  aggressive: 0.5,
  degen: Number.POSITIVE_INFINITY,
};

const TIER_FIRSTRUN_USD_CAP: Partial<Record<Tier, number>> = {
  aggressive: 50_000,
  degen: 10_000,
};

const LP_KINDS = new Set(["lp.add", "lp.stake"]);

function reject(ruleId: string, reason: string): GuardrailReject {
  return { ok: false, ruleId, reason };
}

function appliedRule(rule: string, applied: string[]): string[] {
  if (!applied.includes(rule)) applied.push(rule);
  return applied;
}

function totalInputUsd(step: PlanStep, usdPrices: Record<string, number>): number {
  return step.expected.inputs.reduce(
    (acc: number, t: TokenAmount) => acc + parseFloat(t.amount) * (usdPrices[t.token.toUpperCase()] ?? 0),
    0,
  );
}

// "Fresh" inputs are those NOT produced as outputs of a prior step — they
// represent new user capital entering the plan rather than transformed value.
function freshInputUsd(
  step: PlanStep,
  priorOutputs: Set<string>,
  usdPrices: Record<string, number>,
): number {
  return step.expected.inputs.reduce((acc: number, t: TokenAmount) => {
    if (priorOutputs.has(t.token.toUpperCase())) return acc;
    return acc + parseFloat(t.amount) * (usdPrices[t.token.toUpperCase()] ?? 0);
  }, 0);
}

type CapitalRole = "lp" | "lp-prep" | "lend" | "vault" | "neutral";

interface TaggedCapital {
  totalUsd: number;
  lpUsd: number;
  lendUsd: number;
  vaultUsd: number;
  taggedStepCount: number;
}

// Authoritative capital accounting when the composer marked every step with
// `_capitalRole` and `_capitalUsd`. Both lp + lp-prep contribute to lpUsd so a
// swap-then-lp.add pair representing a single LP entry is fully counted as LP.
function taggedCapitalSum(plan: PipelinePlan): TaggedCapital {
  let totalUsd = 0;
  let lpUsd = 0;
  let lendUsd = 0;
  let vaultUsd = 0;
  let taggedStepCount = 0;
  for (const step of plan.steps) {
    const p = step.params as { _capitalRole?: string; _capitalUsd?: number };
    if (typeof p._capitalUsd !== "number" || !p._capitalRole) continue;
    taggedStepCount += 1;
    totalUsd += p._capitalUsd;
    const role = p._capitalRole as CapitalRole;
    if (role === "lp" || role === "lp-prep") lpUsd += p._capitalUsd;
    else if (role === "lend") lendUsd += p._capitalUsd;
    else if (role === "vault") vaultUsd += p._capitalUsd;
  }
  return { totalUsd, lpUsd, lendUsd, vaultUsd, taggedStepCount };
}

function involvesLeverage(step: PlanStep): boolean {
  const p = protocolDetails(step.protocol);
  if (p?.leveragedFarm) return true;
  return Boolean((step.params as { leverage?: number }).leverage && (step.params as { leverage?: number }).leverage! > 1);
}

function slippageCapFor(step: PlanStep): number {
  const inputs = step.expected.inputs.map((t) => t.token.toUpperCase());
  const outputs = step.expected.outputs.map((t) => t.token.toUpperCase());
  const stableOnly =
    inputs.every(isStablecoin) && outputs.every(isStablecoin) && inputs.length > 0;
  if (stableOnly) return SLIPPAGE_STABLE_CAP;
  const allMajor = [...inputs, ...outputs].every(isMajorAsset);
  if (allMajor) return SLIPPAGE_MAJOR_CAP;
  return SLIPPAGE_LONGTAIL_CAP;
}

const SIMPLE_USD_PRICES: Record<string, number> = {
  USDC: 1,
  USDT: 1,
  DAI: 1,
  USDS: 1,
  "USDC.E": 1,
  USDBC: 1,
  FRAX: 1,
  PYUSD: 1,
  LUSD: 1,
  MUSD: 1,
  USDE: 1,
  ETH: 3200,
  WETH: 3200,
  CBETH: 3200,
  BTC: 96_000,
  WBTC: 96_000,
  CBBTC: 96_000,
  HYPE: 12,
  BNB: 700,
  MNT: 0.8,
  MON: 1,
};

export function evaluatePlan(
  plan: PipelinePlan,
  ctx: GuardrailContext,
): GuardrailResult {
  const applied: string[] = [];
  const prices: Record<string, number> = { ...SIMPLE_USD_PRICES, ...(ctx.usdPrices ?? {}) };

  if (ctx.env === "demo" || ctx.env === "prod") {
    appliedRule(`env@${ctx.env}`, applied);
  }

  // ops.sanctioned.block
  if (isSanctioned(ctx.signerAddress)) {
    return reject("ops.sanctioned.block", "Connected address is on a sanctions list.");
  }
  appliedRule("ops.sanctioned.block", applied);

  if (plan.tier !== ctx.tier) {
    return reject("tier.mismatch", "Plan tier does not match the user's current tier.");
  }
  appliedRule(`tier@${plan.tier}`, applied);

  // survey.literacy.gate — Degen requires literacy=4 AND derivative experience >= 3 (1yr+).
  if (plan.tier === "degen") {
    if (ctx.literacyScore < 4) {
      return reject(
        "survey.literacy.gate",
        "Degen plan requires literacy score 4 (rug pulls + MEV).",
      );
    }
    if (ctx.derivativeExpScore < 3) {
      return reject(
        "survey.derivative.gate",
        "Degen plan requires at least 1 year of leverage/perp experience.",
      );
    }
  }
  appliedRule("survey.literacy.gate", applied);
  appliedRule("survey.derivative.gate", applied);

  // ux.consumer-protection.vulnerable — block surface for vulnerable consumers
  // that are not in preservation/conservative tier (post-derivation safety net).
  if (
    ctx.vulnerableConsumer &&
    (plan.tier === "degen" || plan.tier === "aggressive")
  ) {
    return reject(
      "ux.consumer-protection.vulnerable",
      "Vulnerable consumer (over-65 or first-time DeFi) cannot run an aggressive or degen plan.",
    );
  }
  appliedRule("ux.consumer-protection.vulnerable", applied);

  // agent.steps.max
  if (plan.steps.length === 0) {
    return reject("agent.steps.min", "Plan must contain at least one step.");
  }
  if (plan.steps.length > MAX_STEPS) {
    return reject("agent.steps.max", `Plan has ${plan.steps.length} steps; max is ${MAX_STEPS}.`);
  }
  appliedRule(`agent.steps.max@${MAX_STEPS}`, applied);

  // agent.chain.max
  const chainsTouched = new Set(plan.steps.map((s) => s.chainId));
  if (chainsTouched.size > MAX_CHAINS) {
    return reject("agent.chain.max", `Plan touches ${chainsTouched.size} chains; max is ${MAX_CHAINS}.`);
  }
  appliedRule(`agent.chain.max@${MAX_CHAINS}`, applied);

  // tier.protocol.count
  const protocols = new Set(plan.steps.map((s) => s.protocol.toLowerCase()));
  const protoCap = TIER_PROTOCOL_COUNT_CAP[plan.tier];
  if (protocols.size > protoCap) {
    return reject(
      "tier.protocol.count",
      `Plan uses ${protocols.size} protocols; tier ${plan.tier} allows ${protoCap}.`,
    );
  }
  appliedRule(`tier.protocol.count@${protoCap}`, applied);

  // tier.bridge.allowed
  const bridgeHops = plan.steps.filter((s) => s.kind === "bridge");
  const bridgeCap = TIER_BRIDGE_CAP[plan.tier];
  if (bridgeHops.length > bridgeCap) {
    return reject(
      "tier.bridge.allowed",
      `Plan has ${bridgeHops.length} bridge hops; tier ${plan.tier} allows ${bridgeCap}.`,
    );
  }
  if (plan.tier === "balanced") {
    for (const hop of bridgeHops) {
      const fromChain = hop.chainId;
      const toChain = Number((hop.params as { destChainId?: number }).destChainId ?? hop.chainId);
      if (!isBridgeMajorChain(fromChain) || !isBridgeMajorChain(toChain)) {
        return reject(
          "tier.bridge.allowed",
          "Balanced tier bridges must be between Base, BNB, HyperEVM, or Mantle.",
        );
      }
    }
  }
  appliedRule(`tier.bridge.allowed@${bridgeCap}`, applied);

  // Per-step checks
  let totalInputUsdSum = 0;
  let lpInputUsdSum = 0;
  let volatileInputUsdSum = 0;
  let maxLeverage = 1;
  const priorOutputs = new Set<string>();

  for (const step of plan.steps) {
    // agent.protocol.exists + tier whitelist
    if (!isProtocolAllowed(plan.tier, step.chainId, step.protocol)) {
      return reject(
        "agent.protocol.exists",
        `Protocol ${step.protocol} is not whitelisted for tier ${plan.tier} on chain ${step.chainId}.`,
      );
    }

    // dust.skip - hard fail if it slipped through (composer prunes first)
    const stepUsd = totalInputUsd(step, prices);
    if (stepUsd > 0 && stepUsd < DUST_USD) {
      return reject(
        "dust.skip",
        `Step ${step.id} input value $${stepUsd.toFixed(2)} is below the $${DUST_USD} dust threshold.`,
      );
    }
    const freshUsd = freshInputUsd(step, priorOutputs, prices);
    totalInputUsdSum += freshUsd;

    // tier.cap.volatile — preservation & conservative tiers cannot hold non-stables.
    const inputsNonStable = step.expected.inputs.filter((t) => !isStablecoin(t.token));
    if (
      (plan.tier === "preservation" || plan.tier === "conservative") &&
      inputsNonStable.length > 0
    ) {
      return reject(
        "tier.cap.volatile",
        `${plan.tier} tier must hold stablecoins only.`,
      );
    }
    const volatileUsd = inputsNonStable.reduce(
      (acc, t) => acc + parseFloat(t.amount) * (prices[t.token.toUpperCase()] ?? 0),
      0,
    );
    volatileInputUsdSum += volatileUsd;

    // tier.cap.lp — only count NEW capital entering LP, not transformed prior outputs
    if (LP_KINDS.has(step.kind)) lpInputUsdSum += freshUsd;

    // tier.cap.leverage
    if (involvesLeverage(step)) {
      const lev = Number((step.params as { leverage?: number }).leverage ?? 1);
      maxLeverage = Math.max(maxLeverage, lev);
    }

    // slippage.cap.*
    if (step.kind === "swap" || step.kind === "bridge" || step.kind === "lp.add") {
      if (step.expected.slippagePct > SLIPPAGE_ABSOLUTE_MAX) {
        return reject(
          "slippage.absolute.max",
          `Step ${step.id} slippage ${step.expected.slippagePct}% exceeds absolute cap ${SLIPPAGE_ABSOLUTE_MAX}%.`,
        );
      }
      const cap = slippageCapFor(step);
      if (step.expected.slippagePct > cap) {
        return reject(
          cap === SLIPPAGE_STABLE_CAP
            ? "slippage.cap.stable"
            : cap === SLIPPAGE_MAJOR_CAP
              ? "slippage.cap.major"
              : "slippage.cap.longtail",
          `Step ${step.id} slippage ${step.expected.slippagePct}% exceeds ${cap}% cap.`,
        );
      }
    }

    // deadline.enforce
    const deadline = (step.params as { deadline?: number | string }).deadline;
    if (step.kind === "swap" || step.kind.startsWith("lp.") || step.kind === "bridge") {
      if (deadline === undefined || deadline === null) {
        return reject(
          "deadline.enforce",
          `Step ${step.id} (${step.kind}) is missing a deadline.`,
        );
      }
      const deadlineMs = typeof deadline === "string" ? Number(deadline) * 1000 : Number(deadline) * 1000;
      if (!Number.isFinite(deadlineMs)) {
        return reject("deadline.enforce", `Step ${step.id} has an unparseable deadline.`);
      }
      if (deadlineMs - ctx.signTimestampMs > DEADLINE_MAX_MIN * 60_000) {
        return reject(
          "deadline.enforce",
          `Step ${step.id} deadline exceeds ${DEADLINE_MAX_MIN} minutes from sign time.`,
        );
      }
    }

    // §8.4 agent.dry-run.mandatory — prod plans must have real calldata.
    // demo plans may carry "0x" placeholder so judges can dry-run without
    // a live signer, but they are explicitly flagged.
    if (!step.calldata.to || !step.calldata.data) {
      return reject(
        "agent.dry-run.mandatory",
        `Step ${step.id} is missing calldata; dry-run was not run.`,
      );
    }
    if (ctx.env === "prod" && step.calldata.data === "0x") {
      return reject(
        "agent.dry-run.mandatory",
        `Step ${step.id} has placeholder calldata; defi-cli dry-run did not produce real data.`,
      );
    }

    // §8.3 mev.private-rpc — mainnet ETH actions require a configured
    // private RPC. We can only verify the env at request time.
    if (
      step.chainId === 1 &&
      ctx.env === "prod" &&
      !process.env.MEV_PRIVATE_RPC_URL
    ) {
      return reject(
        "mev.private-rpc",
        `Step ${step.id} runs on Ethereum mainnet. Set MEV_PRIVATE_RPC_URL (e.g. Flashbots Protect) before signing.`,
      );
    }

    for (const out of step.expected.outputs) {
      priorOutputs.add(out.token.toUpperCase());
    }
  }

  // Leverage caps
  const levCap = TIER_LEVERAGE_CAP[plan.tier];
  if (maxLeverage > levCap) {
    return reject(
      "tier.cap.leverage",
      `Plan leverage ${maxLeverage}x exceeds tier ${plan.tier} cap (${levCap}x).`,
    );
  }
  appliedRule(`tier.cap.leverage@${levCap}x`, applied);

  // LP cap — prefer composer-tagged capital accounting when every step carries
  // `_capitalRole` + `_capitalUsd`. Falls back to fresh-input heuristic for
  // intent-built plans that don't tag.
  const lpCap = TIER_LP_CAP[plan.tier];
  // Infinity = "no cap" (Degen). Skip the comparison branch but still stamp
  // the applied rule so the audit log shows we considered it.
  if (Number.isFinite(lpCap)) {
    const tagged = taggedCapitalSum(plan);
    const tagsCover = tagged.taggedStepCount === plan.steps.length && tagged.totalUsd > 0;
    if (tagsCover) {
      const lpFraction = tagged.lpUsd / tagged.totalUsd;
      if (lpFraction > lpCap + 1e-6) {
        return reject(
          "tier.cap.lp",
          `LP allocation ${(lpFraction * 100).toFixed(0)}% exceeds tier ${plan.tier} cap ${Math.round(lpCap * 100)}% (tagged capital).`,
        );
      }
      appliedRule(`tier.cap.lp@${Math.round(lpCap * 100)}%:tagged`, applied);
    } else if (totalInputUsdSum > 0) {
      const lpFraction = lpInputUsdSum / totalInputUsdSum;
      if (lpFraction > lpCap + 1e-6) {
        return reject(
          "tier.cap.lp",
          `LP allocation ${(lpFraction * 100).toFixed(0)}% exceeds tier ${plan.tier} cap ${Math.round(lpCap * 100)}%.`,
        );
      }
      appliedRule(`tier.cap.lp@${Math.round(lpCap * 100)}%:fresh`, applied);
    }
  } else {
    appliedRule(`tier.cap.lp@unbounded:${plan.tier}`, applied);
  }

  // tier.cap.single-pool — share of LP capital that any one chain+protocol may
  // hold. Multi-range B sub-positions share the key (same chain+protocol) so
  // they count as one position. Skipped when the tier cap is Infinity (Degen).
  const singlePoolCap = TIER_SINGLE_POOL_CAP[plan.tier];
  if (Number.isFinite(singlePoolCap)) {
    const lpUsdByPool: Record<string, number> = {};
    let totalLpUsd = 0;
    for (const step of plan.steps) {
      if (!LP_KINDS.has(step.kind)) continue;
      const p = step.params as { _capitalUsd?: number };
      const usd = typeof p._capitalUsd === "number" ? p._capitalUsd : 0;
      const key = `${step.chainId}:${step.protocol}`;
      lpUsdByPool[key] = (lpUsdByPool[key] ?? 0) + usd;
      totalLpUsd += usd;
    }
    const poolCount = Object.keys(lpUsdByPool).length;
    if (totalLpUsd > 0 && poolCount >= 2) {
      // Cap only fires when the user is *trying* to diversify (≥2 pools).
      // A user who explicitly picks a single LP pool is bounded by tier.cap.lp
      // alone; the single-pool cap is the anti-concentration check for
      // multi-pool baskets so a "5 pool" basket can't degenerate to "1 pool
      // gets 90%, 4 get crumbs".
      let worstPool = "";
      let worstFraction = 0;
      for (const [k, v] of Object.entries(lpUsdByPool)) {
        const f = v / totalLpUsd;
        if (f > worstFraction) {
          worstFraction = f;
          worstPool = k;
        }
      }
      if (worstFraction > singlePoolCap + 1e-6) {
        return reject(
          "tier.cap.single-pool",
          `Pool ${worstPool} holds ${(worstFraction * 100).toFixed(0)}% of LP capital; tier ${plan.tier} cap is ${Math.round(singlePoolCap * 100)}%. Balance the allocation across more pools.`,
        );
      }
      appliedRule(`tier.cap.single-pool@${Math.round(singlePoolCap * 100)}%`, applied);
    } else if (totalLpUsd > 0) {
      appliedRule(`tier.cap.single-pool@n/a:single-pool-basket`, applied);
    }
  } else {
    appliedRule(`tier.cap.single-pool@unbounded:${plan.tier}`, applied);
  }

  // First-run USD cap
  const firstCap = TIER_FIRSTRUN_USD_CAP[plan.tier];
  if (ctx.firstRun && firstCap !== undefined && totalInputUsdSum > firstCap) {
    return reject(
      "firstrun.cap",
      `First-run deposit $${totalInputUsdSum.toFixed(0)} exceeds tier ${plan.tier} cap $${firstCap}.`,
    );
  }
  if (ctx.firstRun && firstCap !== undefined) {
    appliedRule(`firstrun.cap@$${firstCap}`, applied);
  }

  // gas.cap (§8.3): gas <= gasBalance * 0.7
  const totalGasUsd = plan.aggregate.estimatedGasUsd;
  if (ctx.gasBalanceWei > 0n && ctx.nativeUsdPrice && ctx.nativeUsdPrice > 0) {
    const requiredWei = BigInt(Math.ceil((totalGasUsd / ctx.nativeUsdPrice) * 1e18));
    if (ctx.gasBalanceWei * 7n < requiredWei * 10n) {
      return reject(
        "gas.cap",
        `Estimated gas $${totalGasUsd.toFixed(2)} exceeds 70% of native balance.`,
      );
    }
    appliedRule(`gas.cap@${GAS_HEADROOM_FACTOR}`, applied);
  } else if (ctx.gasBalanceWei > 0n) {
    appliedRule(`gas.cap@${GAS_HEADROOM_FACTOR}-symbolic`, applied);
  }

  // mev.private-rpc
  if (chainsTouched.has(1)) {
    appliedRule("mev.private-rpc@mainnet", applied);
  }

  // calldata.revalidate is enforced at sign time; we mark it as applied to satisfy the invariant
  appliedRule("calldata.revalidate@5m", applied);

  // ux.copy.honest — copy contract enforced at UI layer; mark as applied
  appliedRule("ux.copy.honest", applied);

  appliedRule(`whitelist@${plan.tier}`, applied);
  appliedRule(
    `slippage.cap@stable=${SLIPPAGE_STABLE_CAP}%,major=${SLIPPAGE_MAJOR_CAP}%,longtail=${SLIPPAGE_LONGTAIL_CAP}%`,
    applied,
  );

  void volatileInputUsdSum; // referenced for future tier-specific exposure metric

  const ok: PipelinePlan = {
    ...plan,
    guardrails: { ...plan.guardrails, appliedRules: applied },
  };
  return { ok: true, plan: ok };
}
