import type { RiskTag } from "@/types";

export type YieldProductKind = "lending" | "lp" | "farm" | "vault";

export interface AprBreakdown {
  basePct: number;        // protocol base APR (e.g. supply rate)
  rewardPct: number;      // token emission rewards
  totalPct: number;       // basePct + rewardPct
  emissionExpiresAt?: string;  // ISO date when emission program ends (if known)
  varianceBps?: number;   // 7d stdev in bps; higher = wilder swings
}

export interface YieldProduct {
  id: string;                   // unique key: `${chainId}:${protocolSlug}:${poolKey}`
  protocolSlug: string;
  protocolName: string;
  iface: string;                // defi-cli interface family (uniswap_v3, aave_v3, …)
  chainId: number;
  kind: YieldProductKind;
  poolLabel: string;            // e.g. "USDC supply" / "ETH/USDC LP"
  inputs: string[];             // tokens user must hold to enter
  outputs: string[];            // representation tokens (aUSDC, LP-NFT)
  apr: AprBreakdown;
  tvlUsd: number;
  ageDays: number;
  auditCount: number;
  audits: string[];
  risks: RiskTag[];
  lockupDays: number;           // 0 = liquid
  minDepositUsd?: number;
}
