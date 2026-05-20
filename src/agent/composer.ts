import type {
  PipelinePlan,
  PlanStep,
  Tier,
  ParsedIntent,
  TokenAmount,
} from "@/types";
import { PipelinePlanSchema } from "@/schemas";
import { aggregate, planForTier } from "@/lib/fixtures";
import {
  bestDexProtocol,
  bestLendingProtocol,
  bestLpProtocol,
  protocolDetails,
  whitelistFor,
} from "@/policy/whitelist";
import {
  asCalldata,
  isDefiCliAvailable,
  isFixtureMode,
  runDefiJson,
  type DefiCliCalldata,
} from "@/lib/defiCli";
import { assertToolAllowed } from "@/agent/tools";
import { defiCliKey, isStablecoin } from "@/config/chains";
import { priceMap } from "@/lib/prices";

// Native → wrapped translation for `defi lp add` and other commands that
// require ERC-20 inputs (cannot accept the chain's native gas token directly).
const WRAPPED_NATIVE_BY_CHAIN: Record<number, string> = {
  1: "WETH",
  8453: "WETH",
  84532: "WETH",
  56: "WBNB",
  5000: "WMNT",
  999: "WHYPE",
  143: "WMON",
};
function wrappedNative(chainId: number, symbol: string): string {
  const upper = symbol.toUpperCase();
  const wrap = WRAPPED_NATIVE_BY_CHAIN[chainId];
  if (!wrap) return upper;
  // Already wrapped, or a token that's neither the chain's native nor stable
  if (upper === wrap) return upper;
  if (upper === "ETH" || upper === "BNB" || upper === "MNT" || upper === "HYPE" || upper === "MON") {
    return wrap;
  }
  return upper;
}

function makePlanId(): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `plan_${Date.now().toString(36)}_${r}`;
}

const DUST_USD = 1;

export interface ComposeOptions {
  signTimestampMs?: number;
  signal?: AbortSignal;
  fromAddress?: string;
  env?: "demo" | "prod";
}

interface PreparedStep {
  step: PlanStep;
  hydrated: boolean;
}

export async function tryHydrateCalldata(
  step: PlanStep,
  fromAddress: string | undefined,
  signal?: AbortSignal,
): Promise<PlanStep> {
  if (!isDefiCliAvailable() || isFixtureMode()) return step;
  if (!fromAddress) return step;
  const chainKey = defiCliKey(step.chainId);
  if (!chainKey) return step;

  try {
    if (step.kind === "swap") {
      assertToolAllowed("defi.swap.quote");
      const inputs = step.expected.inputs[0];
      const outputs = step.expected.outputs[0];
      if (!inputs || !outputs) return step;
      // Native (ETH/BNB/MNT/HYPE/MON) → wrapped form so aggregators that
      // require ERC-20 symbols (KyberSwap especially) resolve a route.
      const fromToken = wrappedNative(step.chainId, inputs.token);
      const toToken = wrappedNative(step.chainId, outputs.token);
      const args = [
        "--chain",
        chainKey,
        "swap",
        "--from",
        fromToken,
        "--to",
        toToken,
        "--amount",
        toBaseUnits(inputs.amount, fromToken),
        // LI.FI bridges multiple aggregators and has the widest route coverage
        // across the 5 defi-cli chains. Composer can override per-step via
        // params.swapProvider if needed.
        "--provider",
        String((step.params as { swapProvider?: string }).swapProvider ?? "lifi"),
      ];
      if (typeof step.expected.slippagePct === "number") {
        args.push("--slippage", String(Math.round(step.expected.slippagePct * 100)));
      }
      const out = await runDefiJson(args, {
        signal,
        env: { DEFI_WALLET_ADDRESS: fromAddress } as unknown as NodeJS.ProcessEnv,
      });
      const cd = asCalldata(out);
      return { ...step, calldata: cd };
    }
    if (step.kind === "lend.supply") {
      assertToolAllowed("defi.lending.supply");
      const inputs = step.expected.inputs[0];
      if (!inputs) return step;
      const p = step.params as { market?: string };
      const args = [
        "--chain",
        chainKey,
        "lending",
        "supply",
        "--protocol",
        step.protocol,
        "--asset",
        inputs.token.toUpperCase(),
        "--amount",
        toBaseUnits(inputs.amount, inputs.token),
        "--on-behalf-of",
        fromAddress,
      ];
      // Morpho Blue markets require an explicit --market <marketId> (32-byte
      // hex). Aave/Compound ignore the flag. Pass through when present.
      if (p.market) args.push("--market", p.market);
      const out = await runDefiJson(args, { signal });
      return { ...step, calldata: asCalldata(out) };
    }
    if (step.kind === "lp.add") {
      assertToolAllowed("defi.lp.add");
      const p = step.params as {
        rangePct?: number;
        rangeLabel?: string;
        tickLower?: number;
        tickUpper?: number;
        numBins?: number;
        pool?: string;
      };
      const args = [
        "--chain",
        chainKey,
        "lp",
        "add",
        "--protocol",
        step.protocol,
        ...flattenLpInputs(step),
        "--recipient",
        fromAddress,
      ];
      if (p.pool) args.push("--pool", p.pool);
      if (typeof p.rangePct === "number") args.push("--range", String(p.rangePct));
      if (typeof p.tickLower === "number") args.push("--tick-lower", String(p.tickLower));
      if (typeof p.tickUpper === "number") args.push("--tick-upper", String(p.tickUpper));
      if (typeof p.numBins === "number") args.push("--num-bins", String(p.numBins));
      if (typeof step.expected.slippagePct === "number") {
        args.push("--slippage", String(Math.round(step.expected.slippagePct * 100)));
      }
      const out = await runDefiJson(args, { signal });
      return { ...step, calldata: asCalldata(out) };
    }
    if (step.kind === "lp.stake") {
      assertToolAllowed("defi.lp.farm");
      const args = [
        "--chain",
        chainKey,
        "lp",
        "farm",
        "--protocol",
        step.protocol,
        ...flattenLpInputs(step),
        "--recipient",
        fromAddress,
      ];
      const out = await runDefiJson(args, { signal });
      return { ...step, calldata: asCalldata(out) };
    }
  } catch (err) {
    // defi-cli not installed or call failed: keep the fixture calldata. The
    // guardrail engine still has `agent.dry-run.mandatory` (we keep the
    // existing `to` populated from fixtures), but downstream sign-flow will
    // recognize empty `data` and treat as demo-only.
    console.warn(
      `[composer] defi-cli hydration failed for ${step.id}: ${(err as Error).message}`,
    );
  }
  return step;
}

// Token decimals lookup for human → base-unit conversion. defi-cli's `lp add`
// expects amounts in wei. This is a coarse map; real production should query
// the token contract via viem `getContract({...abi: erc20Abi}).decimals()`.
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6, USDT: 6, "USDC.E": 6, USDBC: 6, PYUSD: 6,
  DAI: 18, FRAX: 18, LUSD: 18, USDS: 18, MUSD: 18, USDE: 18,
  WBTC: 8, CBBTC: 8, BTC: 8,
  // 18-decimal defaults for all natives + wrapped + LSDs + LP-NFT placeholders
};
function tokenDecimals(symbol: string): number {
  return TOKEN_DECIMALS[symbol.toUpperCase()] ?? 18;
}
function toBaseUnits(humanAmount: string, symbol: string): string {
  const decimals = tokenDecimals(symbol);
  const [whole, frac = ""] = humanAmount.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const out = (whole + padded).replace(/^0+/, "");
  return out === "" ? "0" : out;
}

function flattenLpInputs(step: PlanStep): string[] {
  const args: string[] = [];
  for (let i = 0; i < step.expected.inputs.length; i++) {
    const t = step.expected.inputs[i];
    const wrapped = wrappedNative(step.chainId, t.token);
    args.push(
      i === 0 ? "--token-a" : "--token-b",
      wrapped,
      i === 0 ? "--amount-a" : "--amount-b",
      toBaseUnits(t.amount, wrapped),
    );
  }
  return args;
}

function pruneDust(steps: PlanStep[], prices: Record<string, number>): { kept: PlanStep[]; dropped: string[] } {
  const dropped: string[] = [];
  const kept = steps.filter((s) => {
    const usd = s.expected.inputs.reduce(
      (acc: number, t: TokenAmount) =>
        acc + parseFloat(t.amount) * (prices[t.token.toUpperCase()] ?? 0),
      0,
    );
    if (usd > 0 && usd < DUST_USD) {
      dropped.push(s.id);
      return false;
    }
    return true;
  });
  return { kept, dropped };
}

function ensureTierWhitelist(steps: PlanStep[], tier: Tier): PlanStep[] {
  return steps.filter((s) => {
    const allowed = whitelistFor(tier, s.chainId).some(
      (p) =>
        p.slug.toLowerCase() === s.protocol.toLowerCase() ||
        p.name.toLowerCase() === s.protocol.toLowerCase(),
    );
    return allowed;
  });
}

function rewriteProtocols(steps: PlanStep[], tier: Tier): PlanStep[] {
  // For each step, if the fixture's protocol isn't whitelisted for the chain,
  // swap in the highest-TVL whitelisted protocol with a matching role.
  return steps.map((s) => {
    const allowed = whitelistFor(tier, s.chainId);
    const ok = allowed.some(
      (p) =>
        p.slug.toLowerCase() === s.protocol.toLowerCase() ||
        p.name.toLowerCase() === s.protocol.toLowerCase(),
    );
    if (ok) return s;
    let replacement;
    if (s.kind === "lend.supply" || s.kind === "lend.withdraw") {
      replacement = bestLendingProtocol(tier, s.chainId);
    } else if (s.kind === "swap") {
      replacement = bestDexProtocol(tier, s.chainId);
    } else if (s.kind.startsWith("lp.")) {
      replacement = bestLpProtocol(tier, s.chainId);
    }
    if (!replacement) return s;
    const risks = [...s.risks];
    if (replacement.emissionFarm && !risks.includes("IL")) risks.push("IL");
    if (replacement.leveragedFarm && !risks.includes("leverage")) risks.push("leverage");
    if (replacement.freshPool && !risks.includes("fresh-pool")) risks.push("fresh-pool");
    if (replacement.audits.length === 0 && !risks.includes("non-audited")) risks.push("non-audited");
    return { ...s, protocol: replacement.slug, risks };
  });
}

export async function composePlan(
  tier: Tier,
  intent: ParsedIntent,
  opts: ComposeOptions = {},
): Promise<PipelinePlan> {
  const chainId = intent.asset.chainId;
  const allowed = whitelistFor(tier, chainId);
  if (allowed.length === 0) {
    throw new Error(
      `No whitelisted protocols for tier "${tier}" on chain ${chainId}. Try a different chain or retake the survey.`,
    );
  }

  let steps = planForTier(tier, {
    chainId,
    asset: { symbol: intent.asset.symbol || "USDC", amount: intent.amount || "0" },
  });
  steps = rewriteProtocols(steps, tier);
  steps = ensureTierWhitelist(steps, tier);
  if (steps.length === 0) {
    throw new Error(
      `Strategy template has no whitelisted protocols on chain ${chainId} for tier ${tier}. Try Base or BNB which have deeper coverage.`,
    );
  }

  // Real-price prune of dust steps (8.3 dust.skip — auto-strip rather than reject).
  const allSymbols = steps.flatMap((s) =>
    s.expected.inputs.concat(s.expected.outputs).map((t) => t.token),
  );
  const prices = await priceMap(allSymbols, chainId, opts.signal);
  const pruned = pruneDust(steps, prices);
  steps = pruned.kept;

  // §8.4 agent.dry-run.mandatory — hydrate every step's calldata from
  // defi-cli before returning. In prod env this is required; in demo it is
  // best-effort and steps may carry placeholder data for offline testing.
  const env = opts.env ?? ((process.env.DEFIPILOT_ENV ?? "demo") === "prod" ? "prod" : "demo");
  if (opts.fromAddress && !isFixtureMode()) {
    steps = await Promise.all(
      steps.map((s) => tryHydrateCalldata(s, opts.fromAddress, opts.signal)),
    );
    if (env === "prod") {
      const unhydrated = steps.filter((s) => s.calldata.data === "0x");
      if (unhydrated.length > 0) {
        throw new Error(
          `agent.dry-run.mandatory: ${unhydrated.length} step(s) lack real calldata from defi-cli; refusing to return a plan in prod.`,
        );
      }
    }
  }

  const agg = aggregate(steps);
  const rejectedAlternatives = pruned.dropped.map((id) => `dust.skip@${id}`);
  const draft: PipelinePlan = {
    planId: makePlanId(),
    tier,
    intent,
    steps,
    aggregate: agg,
    guardrails: { appliedRules: ["draft"], rejectedAlternatives },
    createdAt: new Date().toISOString(),
  };

  return PipelinePlanSchema.parse(draft);
}

export type { DefiCliCalldata };
