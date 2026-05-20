import type {
  LpPosition,
  PortfolioLendingPosition,
  PortfolioShowResponse,
  PortfolioToken,
} from "../../../lib/defi-cli";

// --- Health classification thresholds -----------------------------------

export type Severity = "ok" | "watch" | "warn" | "danger";

export interface LendingHealth {
  protocol: string;
  collateralUsd: number;
  debtUsd: number;
  healthFactor: number | null;
  severity: Severity;
  note: string;
}

export interface LpHealth {
  protocol: string;
  tokenId?: string;
  pair: string;
  tickRange?: { lower: number; upper: number; width: number };
  liquidityRaw?: string;
  severity: Severity;
  note: string;
}

export interface TokenConcentration {
  symbol: string;
  valueUsd: number;
  sharePct: number;
  severity: Severity;
}

export interface PortfolioHealth {
  address: string;
  chainId: number;
  chainName: string;
  totalValueUsd: number;
  nativeBalance: number;
  nativeValueUsd: number;
  tokens: TokenConcentration[];
  lending: LendingHealth[];
  lp: LpHealth[];
  // Aggregate flags computed across all positions
  worstSeverity: Severity;
  flags: string[];
}

const HF_LIQUIDATION_RISK = 1.1;
const HF_DANGER = 1.2;
const HF_WATCH = 1.5;

const CONCENTRATION_WATCH = 0.6;   // >60% in one token
const CONCENTRATION_WARN = 0.85;   // >85% in one token

// Aerodrome/Uniswap V3 tickRange ± 887200 = effectively full-range
const FULL_RANGE_TICK_BOUND = 800_000;

export function classifyLending(p: PortfolioLendingPosition): LendingHealth {
  const collateral = parseFloat(p.collateral_usd) || 0;
  const debt = parseFloat(p.debt_usd) || 0;
  const hf = p.health_factor === null ? null : parseFloat(p.health_factor);

  if (debt === 0) {
    return {
      protocol: p.protocol,
      collateralUsd: collateral,
      debtUsd: 0,
      healthFactor: hf,
      severity: "ok",
      note: collateral > 0 ? "Supply-only, no borrow" : "No active position",
    };
  }
  if (hf === null) {
    return {
      protocol: p.protocol,
      collateralUsd: collateral,
      debtUsd: debt,
      healthFactor: null,
      severity: "watch",
      note: "Health factor unavailable — check on protocol UI",
    };
  }
  if (hf < HF_LIQUIDATION_RISK) {
    return {
      protocol: p.protocol,
      collateralUsd: collateral,
      debtUsd: debt,
      healthFactor: hf,
      severity: "danger",
      note: `Health factor ${hf.toFixed(2)} below ${HF_LIQUIDATION_RISK} — liquidation imminent`,
    };
  }
  if (hf < HF_DANGER) {
    return {
      protocol: p.protocol,
      collateralUsd: collateral,
      debtUsd: debt,
      healthFactor: hf,
      severity: "warn",
      note: `Health factor ${hf.toFixed(2)} below ${HF_DANGER} — repay or add collateral`,
    };
  }
  if (hf < HF_WATCH) {
    return {
      protocol: p.protocol,
      collateralUsd: collateral,
      debtUsd: debt,
      healthFactor: hf,
      severity: "watch",
      note: `Health factor ${hf.toFixed(2)} — monitor`,
    };
  }
  return {
    protocol: p.protocol,
    collateralUsd: collateral,
    debtUsd: debt,
    healthFactor: hf,
    severity: "ok",
    note: `Health factor ${hf.toFixed(2)} — comfortable`,
  };
}

function shortAddr(addr?: string): string {
  if (!addr) return "?";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function classifyLp(p: LpPosition): LpHealth {
  const t0 = shortAddr(p.token0);
  const t1 = shortAddr(p.token1);
  const pair = `${t0} / ${t1}`;

  if (p.type !== "v3_nft" || p.tickLower === undefined || p.tickUpper === undefined) {
    return {
      protocol: p.protocol,
      tokenId: p.token_id,
      pair,
      liquidityRaw: p.liquidity,
      severity: "ok",
      note: "V2-style LP — no tick range to monitor",
    };
  }
  const width = p.tickUpper - p.tickLower;
  const isFullRange =
    p.tickLower <= -FULL_RANGE_TICK_BOUND && p.tickUpper >= FULL_RANGE_TICK_BOUND;

  // Heuristic — we don't know current pool tick from defi-cli portfolio
  // output. We classify by range width: narrower ranges have higher
  // out-of-range risk in volatile pairs. Display copy makes this explicit.
  let severity: Severity = "ok";
  let note = `Range width ${width} ticks`;
  if (isFullRange) {
    note = "Full-range V3 position";
  } else if (width < 500) {
    severity = "watch";
    note = `Tight range (${width} ticks) — high rebalance risk`;
  } else if (width < 2000) {
    severity = "watch";
    note = `Narrow range (${width} ticks) — monitor`;
  }
  return {
    protocol: p.protocol,
    tokenId: p.token_id,
    pair,
    tickRange: { lower: p.tickLower, upper: p.tickUpper, width },
    liquidityRaw: p.liquidity,
    severity,
    note,
  };
}

export function classifyTokens(tokens: PortfolioToken[]): TokenConcentration[] {
  const total = tokens.reduce(
    (acc, t) => acc + (parseFloat(t.value_usd ?? "0") || 0),
    0,
  );
  if (total === 0) return [];
  return tokens
    .map((t) => {
      const v = parseFloat(t.value_usd ?? "0") || 0;
      const share = v / total;
      let severity: Severity = "ok";
      if (share > CONCENTRATION_WARN) severity = "warn";
      else if (share > CONCENTRATION_WATCH) severity = "watch";
      return {
        symbol: t.symbol,
        valueUsd: v,
        sharePct: share * 100,
        severity,
      };
    })
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

const SEVERITY_ORDER: Record<Severity, number> = { ok: 0, watch: 1, warn: 2, danger: 3 };
function worst(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER[b] > SEVERITY_ORDER[a] ? b : a;
}

export function classifyPortfolio(
  raw: PortfolioShowResponse,
  lpPositions: LpPosition[],
  chainId: number,
  chainName: string,
): PortfolioHealth {
  const lending = raw.lending_positions.map(classifyLending);
  const lp = lpPositions.map(classifyLp);
  const tokens = classifyTokens(raw.token_balances);

  const flags: string[] = [];
  let agg: Severity = "ok";
  for (const x of lending) agg = worst(agg, x.severity);
  for (const x of lp) agg = worst(agg, x.severity);
  for (const x of tokens) agg = worst(agg, x.severity);

  const topToken = tokens[0];
  if (topToken && topToken.sharePct > CONCENTRATION_WATCH * 100) {
    flags.push(
      `${topToken.symbol} is ${topToken.sharePct.toFixed(0)}% of token value`,
    );
  }
  const dangerLending = lending.filter((x) => x.severity === "danger");
  if (dangerLending.length > 0) {
    flags.push(`${dangerLending.length} lending position(s) near liquidation`);
  }
  const watchLp = lp.filter((x) => x.severity === "watch");
  if (watchLp.length > 0) {
    flags.push(`${watchLp.length} LP position(s) with narrow range`);
  }

  return {
    address: raw.address,
    chainId,
    chainName,
    totalValueUsd: parseFloat(raw.total_value_usd) || 0,
    nativeBalance: parseFloat(raw.native_balance) || 0,
    nativeValueUsd: parseFloat(raw.native_value_usd) || 0,
    tokens,
    lending,
    lp,
    worstSeverity: agg,
    flags,
  };
}
