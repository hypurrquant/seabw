// --- Survey (KOFIA-style 8 scored questions + 1 meta consent step) -------

export type QuestionId =
  | "horizon"
  | "allocation"
  | "experienceProducts"
  | "experienceYears"
  | "returnAttitude"
  | "lossTolerance"
  | "literacy"
  | "derivativeExp";

export type AnswerScore = 1 | 2 | 3 | 4;

export type DefiExperienceCategory = "swap" | "lending" | "lp" | "leverage" | "perp";

export type AgeBucket = "under65" | "over65";

export interface Answers {
  horizon: AnswerScore;
  allocation: AnswerScore;
  experienceProducts: DefiExperienceCategory[];   // multi-select; empty array = none
  experienceYears: AnswerScore;                    // 1: <1y, 2: 1-3y, 3: >3y, 4: >5y
  returnAttitude: AnswerScore;                     // 1: preserve > all, 2: balanced, 3: return-first, 4: chase max
  lossTolerance: AnswerScore;                      // 1: -5%, 2: -15%, 3: -30%, 4: -50%+
  literacy: AnswerScore;                           // 1: none, 2: smart-contract bugs, 3: +IL, 4: +rug+MEV
  derivativeExp: AnswerScore;                      // 1: none/<1y, 2: 1-3y, 3: >3y, 4: prod-trader
  ageBucket: AgeBucket;
  firstTimeDefiPilot: boolean;
}

export type Tier =
  | "preservation"   // 안정형
  | "conservative"   // 안정추구형
  | "balanced"       // 위험중립형
  | "aggressive"     // 적극투자형
  | "degen";         // 공격투자형

export interface TierResult {
  tier: Tier;
  rawScore: number;            // 5..32 range (computed by scoreAnswers)
  derivativeExpScore: AnswerScore;
  downgradedFromDegen: boolean;
  vulnerableDowngrade: boolean;
  reason?: string;
}

// --- Intent ----------------------------------------------------------------

export interface ParsedIntent {
  asset: { symbol: string; chainId: number };
  amount: string;
  horizon?: "short" | "mid" | "long";
  preferences?: string[];
  rawText: string;
}

// --- Plan ------------------------------------------------------------------

export type ActionKind =
  | "swap"
  | "bridge"
  | "lend.supply"
  | "lend.withdraw"
  | "lp.add"
  | "lp.remove"
  | "lp.stake"
  | "lp.claim";

export type RiskTag = "IL" | "leverage" | "fresh-pool" | "non-audited" | "bridge";

export interface TokenAmount {
  token: string;
  amount: string;
}

export interface PlanStep {
  id: string;
  kind: ActionKind;
  chainId: number;
  protocol: string;
  params: Record<string, unknown>;
  expected: {
    inputs: TokenAmount[];
    outputs: TokenAmount[];
    feeUsd: number;
    slippagePct: number;
    aprPct?: number;
  };
  risks: RiskTag[];
  calldata: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;
  };
}

export interface PipelinePlan {
  planId: string;
  tier: Tier;
  intent: ParsedIntent;
  steps: PlanStep[];
  aggregate: {
    estimatedAprPct: number;
    estimatedGasUsd: number;
    riskFlags: string[];
  };
  guardrails: {
    appliedRules: string[];
    rejectedAlternatives?: string[];
  };
  createdAt: string;
}

export type StepStatus =
  | "pending"
  | "signed"
  | "broadcasted"
  | "confirmed"
  | "failed"
  | "skipped";

export interface ExecutionResult {
  planId: string;
  perStep: Array<{
    stepId: string;
    txHash?: `0x${string}`;
    status: StepStatus;
    error?: string;
  }>;
  finishedAt?: string;
}

export type { YieldProduct, YieldProductKind, AprBreakdown } from "./yield-product";
export type {
  Severity,
  LendingHealth,
  LpHealth,
  TokenConcentration,
  PortfolioHealth,
} from "./portfolio";
