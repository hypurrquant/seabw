// Wire types for /api/portfolio/health. Mirrors server's runtime classifier shape.
// Server's risk.ts owns the construction; this file exists so the web can render
// without importing server-only code.

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
  worstSeverity: Severity;
  flags: string[];
}
