import type { PipelinePlan, PlanStep, RiskTag, Tier } from "@seabw/core";
import type { YieldProduct } from "@seabw/core";
import { PipelinePlanSchema } from "@seabw/core";
import { aggregate } from "../../plan/internal/fixtures";
import { catalogAll, similarPools } from "./yields";
import { tryHydrateCalldata } from "../../plan/internal/composer";
import { isFixtureMode } from "../../../lib/defi-cli";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export interface BasketItem {
  productId: string;
  amountUsd: number;
  diversifyAcross?: number;     // A — split capital across top-N similar pools (default 1, max 3)
  splitRanges?: boolean;        // B — for V3 interface pools, split into tight/medium/wide ranges
}

export interface BasketComposeOptions {
  tier: Tier;
  intentRawText: string;
  fromAddress?: string;
  env?: "demo" | "prod";
}

function makePlanId(): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `plan_${Date.now().toString(36)}_${r}_b`;
}

function approxAmount(symbol: string, usd: number, prices: Record<string, number>): string {
  const price = prices[symbol.toUpperCase()] ?? 1;
  if (price <= 0) return "0";
  const amount = usd / price;
  return amount < 1 ? amount.toFixed(6) : amount.toFixed(2);
}

const APPROX_PRICES: Record<string, number> = {
  USDC: 1, USDT: 1, DAI: 1, USDS: 1,
  ETH: 3200, WETH: 3200, BTC: 96_000, WBTC: 96_000,
  HYPE: 12, BNB: 700, MNT: 0.8, MON: 1,
};

// C — variance-aware range selection. Maps 7d APR variance (bps) to a
// concentrated-LP range width. Tighter ranges earn more fees but rebalance
// out of band sooner; wider ranges are stickier but capture less per dollar.
export type RangeLabel = "tight" | "medium" | "wide";

export function rangeForVariance(varianceBps?: number): { rangePct: number; label: RangeLabel } {
  const v = varianceBps ?? 250;
  if (v < 200) return { rangePct: 2, label: "tight" };
  if (v < 400) return { rangePct: 5, label: "medium" };
  return { rangePct: 15, label: "wide" };
}

// B — multi-range split for V3-style concentrated-liquidity pools. Default
// 3-way split: 50% tight, 30% medium, 20% wide. Each sub-position becomes its
// own plan step; the DAG groups them visually under the same pool.
export const V3_RANGE_SPLIT: { label: RangeLabel; rangePct: number; weight: number }[] = [
  { label: "tight",  rangePct: 2,  weight: 0.5 },
  { label: "medium", rangePct: 5,  weight: 0.3 },
  { label: "wide",   rangePct: 15, weight: 0.2 },
];

const V3_INTERFACES = new Set(["uniswap_v3", "algebra_v3"]);

export function supportsRangeSplit(iface?: string): boolean {
  return iface ? V3_INTERFACES.has(iface) : false;
}

// Build the steps for ONE pool entry with ONE range. For lending/vault, this
// is a single supply step; for LP/farm, it's a swap + lp.add pair. The caller
// controls how many of these "entries" make up a basket item (A: across N
// pools; B: across N ranges in the same V3 pool).
function entryStepsForPool(
  product: YieldProduct,
  amountUsd: number,
  idBase: string,
  range?: { rangePct: number; label: RangeLabel; basketItem: string },
): PlanStep[] {
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
  if (product.kind === "lending" || product.kind === "vault") {
    const symbol = product.inputs[0];
    const amount = approxAmount(symbol, amountUsd, APPROX_PRICES);
    const role = product.kind === "vault" ? "vault" : "lend";
    return [
      {
        id: `${idBase}_supply`,
        kind: "lend.supply",
        chainId: product.chainId,
        protocol: product.protocolSlug,
        params: {
          token: symbol,
          amount,
          deadline,
          basketItem: range?.basketItem ?? product.id,
          _capitalRole: role,
          _capitalUsd: amountUsd,
        },
        expected: {
          inputs: [{ token: symbol, amount }],
          outputs: [{ token: product.outputs[0] ?? `a${symbol}`, amount }],
          feeUsd: 0.4,
          slippagePct: 0,
          aprPct: product.apr.totalPct,
        },
        risks: product.risks,
        calldata: { to: ZERO_ADDR, data: "0x" as `0x${string}`, value: "0" },
      },
    ];
  }
  // LP / farm pair (swap half + lp.add) for a single range
  const [tokenA, tokenB] = product.inputs;
  const halfUsd = amountUsd / 2;
  const amountInB = approxAmount(tokenB, halfUsd, APPROX_PRICES);
  const amountInA = approxAmount(tokenA, halfUsd, APPROX_PRICES);
  const risks: RiskTag[] = [...product.risks];
  if (!risks.includes("IL")) risks.push("IL");
  // C — pick rangePct from variance unless the caller forces a specific range
  const r = range ?? { ...rangeForVariance(product.apr.varianceBps), basketItem: product.id };
  const swap: PlanStep = {
    id: `${idBase}_swap`,
    kind: "swap",
    chainId: product.chainId,
    protocol: product.protocolSlug,
    params: {
      tokenIn: tokenB,
      tokenOut: tokenA,
      amountIn: amountInB,
      slippagePct: 0.4,
      deadline,
      basketItem: r.basketItem,
      _capitalRole: "lp-prep",
      _capitalUsd: halfUsd,
    },
    expected: {
      inputs: [{ token: tokenB, amount: amountInB }],
      outputs: [{ token: tokenA, amount: amountInA }],
      feeUsd: 0.6,
      slippagePct: 0.4,
    },
    risks: [],
    calldata: { to: ZERO_ADDR, data: "0x" as `0x${string}`, value: "0" },
  };
  const lpAdd: PlanStep = {
    id: `${idBase}_lp_${r.label}`,
    kind: "lp.add",
    chainId: product.chainId,
    protocol: product.protocolSlug,
    params: {
      pair: product.poolLabel,
      deadline,
      basketItem: r.basketItem,
      rangePct: r.rangePct,
      rangeLabel: r.label,
      _capitalRole: "lp",
      _capitalUsd: halfUsd,
    },
    expected: {
      inputs: [
        { token: tokenA, amount: amountInA },
        { token: tokenB, amount: amountInB },
      ],
      outputs: [{ token: product.outputs[0] ?? `${product.protocolSlug}-LP`, amount: "1" }],
      feeUsd: 0.6,
      slippagePct: 0.3,
      aprPct: product.apr.totalPct,
    },
    risks,
    calldata: { to: ZERO_ADDR, data: "0x" as `0x${string}`, value: "0" },
  };
  return [swap, lpAdd];
}

// Expand ONE basket item into all of its plan steps. Handles:
//   A — diversifyAcross: split capital across N top-TVL similar pools
//   B — splitRanges    : for V3 pools, split into tight/medium/wide sub-positions
//   C — variance-aware range when neither A nor B is set
function expandBasketItem(item: BasketItem, idx: number): PlanStep[] {
  const all = catalogAll();
  const product = all.find((p) => p.id === item.productId);
  if (!product) throw new Error(`Unknown basket item: ${item.productId}`);
  if (item.amountUsd <= 0) return [];

  // A — diversify across pools
  const n = Math.max(1, Math.min(3, item.diversifyAcross ?? 1));
  const pools = n === 1 ? [product] : similarPools(product, n);
  const perPoolUsd = item.amountUsd / pools.length;

  const steps: PlanStep[] = [];
  pools.forEach((p, poolIdx) => {
    const idBase = `b${idx}_p${poolIdx}_${p.protocolSlug}`;
    const isLpKind = p.kind === "lp" || p.kind === "farm";
    // B — only V3-interface pools support range splitting
    if (isLpKind && item.splitRanges && supportsRangeSplit(p.iface)) {
      V3_RANGE_SPLIT.forEach((slice, sliceIdx) => {
        const sliceUsd = perPoolUsd * slice.weight;
        steps.push(
          ...entryStepsForPool(p, sliceUsd, `${idBase}_r${sliceIdx}`, {
            rangePct: slice.rangePct,
            label: slice.label,
            basketItem: item.productId,
          }),
        );
      });
    } else {
      steps.push(...entryStepsForPool(p, perPoolUsd, idBase));
    }
  });
  return steps;
}

export async function composeBasketPlan(
  items: BasketItem[],
  opts: BasketComposeOptions,
): Promise<PipelinePlan> {
  if (items.length === 0) {
    throw new Error("Basket is empty.");
  }
  const catalog = catalogAll();
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const steps: PlanStep[] = [];
  let totalDepositUsd = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!byId.has(item.productId)) {
      throw new Error(`Unknown basket item: ${item.productId}`);
    }
    if (item.amountUsd <= 0) continue;
    totalDepositUsd += item.amountUsd;
    steps.push(...expandBasketItem(item, i));
  }
  if (steps.length === 0) {
    throw new Error("All basket items have $0 allocation.");
  }
  if (steps.length > 8) {
    throw new Error(
      `Basket would produce ${steps.length} steps; plan cap is 8. Reduce diversification, ranges, or item count.`,
    );
  }

  // Hydrate calldata via defi-cli for each step when we have a signer + live
  // mode is active. Hydration failures fall back to fixture calldata; the
  // composer logs a warning and lets the guardrail / sign-flow surface the
  // "demo calldata" state to the user.
  let hydrated = steps;
  if (opts.fromAddress && !isFixtureMode()) {
    hydrated = await Promise.all(
      steps.map((s) => tryHydrateCalldata(s, opts.fromAddress)),
    );
  }

  // Pick the dominant intent asset (highest fresh-capital symbol). For the
  // marketplace we just pick the first item's first input.
  const firstProduct = byId.get(items[0].productId)!;
  const draft: PipelinePlan = {
    planId: makePlanId(),
    tier: opts.tier,
    intent: {
      asset: { symbol: firstProduct.inputs[0], chainId: firstProduct.chainId },
      amount: totalDepositUsd.toFixed(2),
      rawText: opts.intentRawText,
      preferences: ["basket"],
    },
    steps: hydrated,
    aggregate: aggregate(hydrated),
    guardrails: { appliedRules: ["draft", "source:basket"], rejectedAlternatives: [] },
    createdAt: new Date().toISOString(),
  };
  return PipelinePlanSchema.parse(draft);
}
