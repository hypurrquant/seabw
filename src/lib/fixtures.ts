import type { PlanStep, Tier, TokenAmount } from "@/types";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

// Deterministic step builders used when defi-cli is not available locally
// (e.g. judging environment). Calldata `to` addresses below are the real
// deployment addresses for the protocols; calldata `data` is left as
// "0x" because broadcasting is intentionally disabled in demo mode.

const KYBER_AGGREGATOR_BASE = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5";
const AERODROME_ROUTER_BASE = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
const AERODROME_VOTER_BASE = "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5";
const AAVE_V3_POOL_BASE = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

const NOW = () => Math.floor(Date.now() / 1000);
const DEADLINE = () => NOW() + 20 * 60;

function step(
  s: Omit<PlanStep, "calldata"> & { calldata?: PlanStep["calldata"] },
): PlanStep {
  return {
    ...s,
    calldata: s.calldata ?? {
      to: ZERO_ADDR as `0x${string}`,
      data: "0x" as `0x${string}`,
      value: "0",
    },
  };
}

function tokens(...items: Array<[string, string]>): TokenAmount[] {
  return items.map(([token, amount]) => ({ token, amount }));
}

export interface FixtureContext {
  chainId: number;
  asset: { symbol: string; amount: string };
}

export function conservativeStablePlan(ctx: FixtureContext): PlanStep[] {
  return [
    step({
      id: "supply-aave",
      kind: "lend.supply",
      chainId: ctx.chainId,
      protocol: "aave-v3-base",
      params: {
        token: ctx.asset.symbol,
        amount: ctx.asset.amount,
        deadline: DEADLINE(),
      },
      expected: {
        inputs: tokens([ctx.asset.symbol, ctx.asset.amount]),
        outputs: tokens([`a${ctx.asset.symbol}`, ctx.asset.amount]),
        feeUsd: 0.4,
        slippagePct: 0,
        aprPct: 5.2,
      },
      risks: [],
      calldata: {
        to: AAVE_V3_POOL_BASE as `0x${string}`,
        data: "0x" as `0x${string}`,
        value: "0",
      },
    }),
  ];
}

export function balancedBlueChipLpPlan(ctx: FixtureContext): PlanStep[] {
  // Tier cap (§8.1 tier.cap.lp@60%): split deposit into 40% lending + 60% LP.
  const total = parseFloat(ctx.asset.amount) || 0;
  const lend = (total * 0.4).toFixed(2);
  const lp = (total * 0.6).toFixed(2);
  const swap = (parseFloat(lp) / 2).toFixed(2);
  return [
    step({
      id: "supply-aave",
      kind: "lend.supply",
      chainId: ctx.chainId,
      protocol: "aave-v3-base",
      params: { token: "USDC", amount: lend, deadline: DEADLINE() },
      expected: {
        inputs: tokens(["USDC", lend]),
        outputs: tokens(["aUSDC", lend]),
        feeUsd: 0.4,
        slippagePct: 0,
        aprPct: 5.2,
      },
      risks: [],
      calldata: {
        to: AAVE_V3_POOL_BASE as `0x${string}`,
        data: "0x" as `0x${string}`,
        value: "0",
      },
    }),
    step({
      id: "swap-usdc-eth",
      kind: "swap",
      chainId: ctx.chainId,
      protocol: "uniswap-v3-base",
      params: {
        tokenIn: "USDC",
        tokenOut: "ETH",
        amountIn: swap,
        slippagePct: 0.5,
        deadline: DEADLINE(),
      },
      expected: {
        inputs: tokens(["USDC", swap]),
        outputs: tokens(["ETH", (parseFloat(swap) / 3200).toFixed(6)]),
        feeUsd: 0.8,
        slippagePct: 0.5,
      },
      risks: [],
      calldata: {
        to: KYBER_AGGREGATOR_BASE as `0x${string}`,
        data: "0x" as `0x${string}`,
        value: "0",
      },
    }),
    step({
      id: "lp-add-eth-usdc",
      kind: "lp.add",
      chainId: ctx.chainId,
      protocol: "aerodrome-base",
      params: {
        pair: "ETH/USDC",
        amountA: (parseFloat(swap) / 3200).toFixed(6),
        amountB: swap,
        rangePct: 5,
        slippagePct: 0.4,
        deadline: DEADLINE(),
      },
      expected: {
        inputs: tokens(
          ["ETH", (parseFloat(swap) / 3200).toFixed(6)],
          ["USDC", swap],
        ),
        outputs: tokens(["ETH/USDC LP", "1"]),
        feeUsd: 0.6,
        slippagePct: 0.4,
        aprPct: 22.3,
      },
      risks: ["IL"],
      calldata: {
        to: AERODROME_ROUTER_BASE as `0x${string}`,
        data: "0x" as `0x${string}`,
        value: "0",
      },
    }),
    step({
      id: "lp-stake-gauge",
      kind: "lp.stake",
      chainId: ctx.chainId,
      protocol: "aerodrome-base",
      params: {
        gauge: "ETH/USDC",
        deadline: DEADLINE(),
      },
      expected: {
        inputs: tokens(["ETH/USDC LP", "1"]),
        outputs: tokens(["AERO emissions", "pending"]),
        feeUsd: 0.3,
        slippagePct: 0,
        aprPct: 22.3,
      },
      risks: ["IL"],
      calldata: {
        to: AERODROME_VOTER_BASE as `0x${string}`,
        data: "0x" as `0x${string}`,
        value: "0",
      },
    }),
  ];
}

export function aggressiveLpRotationPlan(ctx: FixtureContext): PlanStep[] {
  const base = balancedBlueChipLpPlan(ctx);
  return base.map((s) =>
    s.expected.aprPct
      ? { ...s, expected: { ...s.expected, aprPct: s.expected.aprPct * 2.4 } }
      : s,
  );
}

export function degenLeveragedPlan(ctx: FixtureContext): PlanStep[] {
  return [
    step({
      id: "supply-collateral",
      kind: "lend.supply",
      chainId: ctx.chainId,
      protocol: "aave-v3-base",
      params: {
        token: ctx.asset.symbol,
        amount: ctx.asset.amount,
        deadline: DEADLINE(),
      },
      expected: {
        inputs: tokens([ctx.asset.symbol, ctx.asset.amount]),
        outputs: tokens([`m${ctx.asset.symbol}`, ctx.asset.amount]),
        feeUsd: 0.7,
        slippagePct: 0,
        aprPct: 6.1,
      },
      risks: [],
      calldata: {
        to: MORPHO_BLUE as `0x${string}`,
        data: "0x" as `0x${string}`,
        value: "0",
      },
    }),
    step({
      id: "borrow-leverage",
      kind: "lend.withdraw",
      chainId: ctx.chainId,
      protocol: "aave-v3-base",
      params: {
        token: "USDC",
        amount: (parseFloat(ctx.asset.amount) * 0.6).toFixed(2),
        leverage: 2,
        deadline: DEADLINE(),
      },
      expected: {
        inputs: tokens([`m${ctx.asset.symbol}`, ctx.asset.amount]),
        outputs: tokens(["USDC", (parseFloat(ctx.asset.amount) * 0.6).toFixed(2)]),
        feeUsd: 0.9,
        slippagePct: 0,
        aprPct: -4.5,
      },
      risks: ["leverage"],
      calldata: {
        to: MORPHO_BLUE as `0x${string}`,
        data: "0x" as `0x${string}`,
        value: "0",
      },
    }),
    ...balancedBlueChipLpPlan({
      chainId: ctx.chainId,
      asset: {
        symbol: "USDC",
        amount: (parseFloat(ctx.asset.amount) * 0.6).toFixed(2),
      },
    }),
  ];
}

// Preservation = the strictest tier: a single supply on the highest-TVL audited
// lending market. Same fixture as conservative for now; differentiation comes
// from the policy layer (Preservation requires a $500M+ TVL pool).
export function preservationPlan(ctx: FixtureContext): PlanStep[] {
  return conservativeStablePlan(ctx);
}

export function planForTier(tier: Tier, ctx: FixtureContext): PlanStep[] {
  switch (tier) {
    case "preservation":
      return preservationPlan(ctx);
    case "conservative":
      return conservativeStablePlan(ctx);
    case "balanced":
      return balancedBlueChipLpPlan(ctx);
    case "aggressive":
      return aggressiveLpRotationPlan(ctx);
    case "degen":
      return degenLeveragedPlan(ctx);
  }
}

export function aggregate(steps: PlanStep[]): {
  estimatedAprPct: number;
  estimatedGasUsd: number;
  riskFlags: string[];
} {
  const aprs = steps.map((s) => s.expected.aprPct).filter((v): v is number => typeof v === "number" && v > 0);
  const estimatedAprPct = aprs.length === 0 ? 0 : aprs[aprs.length - 1];
  const estimatedGasUsd = steps.reduce((acc, s) => acc + s.expected.feeUsd, 0);
  const riskFlags = Array.from(new Set(steps.flatMap((s) => s.risks)));
  return { estimatedAprPct, estimatedGasUsd, riskFlags };
}
