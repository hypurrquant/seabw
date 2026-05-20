import type { PipelinePlan, Tier } from "../types";
import type { YieldProduct } from "../types/yield-product";
import type { PlanRequest } from "../schemas";

// --- /api/plan ----------------------------------------------------------
export type { PlanRequest };
export interface PlanResponse {
  plan: PipelinePlan;
}

// --- /api/plan/rehydrate ------------------------------------------------
export interface PlanRehydrateRequest {
  planId: string;
  signerAddress: `0x${string}`;
}
export interface PlanRehydrateResponse {
  plan: PipelinePlan;
}

// --- /api/marketplace/yields -------------------------------------------
export interface MarketplaceYieldsQuery {
  tier: Tier;
}
export interface MarketplaceYieldsResponse {
  tier: Tier;
  count: number;
  products: YieldProduct[];
}

// --- /api/marketplace/plan ---------------------------------------------
export interface BasketItem {
  productId: string;
  amountUsd: number;
  diversifyAcross?: number;
  splitRanges?: boolean;
}
export interface MarketplacePlanRequest {
  tier: Tier;
  rawScore: number;
  literacyScore: 1 | 2 | 3 | 4;
  derivativeExpScore: 1 | 2 | 3 | 4;
  vulnerableConsumer: boolean;
  basket: BasketItem[];
  wallet: {
    address: `0x${string}`;
    chainId: number;
    gasBalanceWei: string;
  };
}
export interface MarketplacePlanResponse {
  plan: PipelinePlan;
}

// --- /api/precheck -----------------------------------------------------
export interface PrecheckRequest {
  planId: string;
  stepId: string;
  signerAddress: `0x${string}`;
}
export type PrecheckResponse =
  | {
      ok: true;
      appliedRules: string[];
      canonicalCalldata: {
        to: `0x${string}`;
        data: `0x${string}`;
        value: string;
      };
    }
  | {
      ok: false;
      ruleId: string;
      reason: string;
    };

// --- /api/portfolio/health ---------------------------------------------
export interface PortfolioHealthQuery {
  address: `0x${string}`;
  chainId: number;
}
export interface PortfolioHealthResponse {
  health: unknown; // PortfolioHealth shape lives in server (risk.ts); web treats as opaque for now.
}

// --- /agent/chat (SSE) -------------------------------------------------
export interface AgentChatRequest {
  sessionId: string;
  message: string;
}

export type AgentSSEEvent =
  | { event: "typing" }
  | { event: "stream"; data: { delta: string } }
  | { event: "done"; data: { sessionId: string } }
  | { event: "error"; data: { code: string; message: string } };

// --- /agent/sessions ---------------------------------------------------
export interface AgentSessionDTO {
  sessionId: string;
  owner: string;
  title: string;
  createdAt: string;
}
export interface AgentSessionMessageDTO {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
}
