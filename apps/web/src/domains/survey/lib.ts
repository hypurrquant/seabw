import { z } from "zod";

// --- Types ---------------------------------------------------------------

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
  experienceProducts: DefiExperienceCategory[];
  experienceYears: AnswerScore;
  returnAttitude: AnswerScore;
  lossTolerance: AnswerScore;
  literacy: AnswerScore;
  derivativeExp: AnswerScore;
  ageBucket: AgeBucket;
  firstTimeDefiPilot: boolean;
}

export type Tier =
  | "preservation"
  | "conservative"
  | "balanced"
  | "aggressive"
  | "degen";

export interface TierResult {
  tier: Tier;
  rawScore: number;
  derivativeExpScore: AnswerScore;
  downgradedFromDegen: boolean;
  vulnerableDowngrade: boolean;
  reason?: string;
}

// --- Zod schemas ---------------------------------------------------------

export const AnswerScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const DefiExperienceCategorySchema = z.enum([
  "swap",
  "lending",
  "lp",
  "leverage",
  "perp",
]);

export const AgeBucketSchema = z.enum(["under65", "over65"]);

export const AnswersSchema = z.object({
  horizon: AnswerScoreSchema,
  allocation: AnswerScoreSchema,
  experienceProducts: z.array(DefiExperienceCategorySchema),
  experienceYears: AnswerScoreSchema,
  returnAttitude: AnswerScoreSchema,
  lossTolerance: AnswerScoreSchema,
  literacy: AnswerScoreSchema,
  derivativeExp: AnswerScoreSchema,
  ageBucket: AgeBucketSchema,
  firstTimeDefiPilot: z.boolean(),
});

export const TierSchema = z.enum([
  "preservation",
  "conservative",
  "balanced",
  "aggressive",
  "degen",
]);

// --- Survey questions ----------------------------------------------------

export type SurveyOption =
  | { kind: "single"; label: string; score: AnswerScore; description?: string }
  | { kind: "multi"; label: string; value: DefiExperienceCategory; description?: string }
  | { kind: "meta-age"; label: string; value: AgeBucket }
  | { kind: "meta-first"; label: string; value: boolean };

export interface SurveyQuestion {
  id: keyof Answers;
  category: string;
  question: string;
  multi?: boolean;
  options: SurveyOption[];
  hint?: string;
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "horizon",
    category: "Time horizon",
    question: "How long can you lock this capital without needing it?",
    options: [
      { kind: "single", label: "Less than 1 year", score: 1 },
      { kind: "single", label: "1 – 3 years", score: 2 },
      { kind: "single", label: "3 – 5 years", score: 3 },
      { kind: "single", label: "5+ years", score: 4 },
    ],
  },
  {
    id: "allocation",
    category: "Share of financial assets",
    question: "What share of your total financial assets is this capital?",
    options: [
      { kind: "single", label: "5% or less", score: 1 },
      { kind: "single", label: "5% – 20%", score: 2 },
      { kind: "single", label: "20% – 50%", score: 3 },
      { kind: "single", label: "More than 50%", score: 4 },
    ],
  },
  {
    id: "experienceProducts",
    category: "DeFi product experience (select all)",
    question: "Which DeFi products have you used directly?",
    multi: true,
    options: [
      { kind: "multi", label: "DEX swap (Uniswap, KyberSwap…)", value: "swap" },
      { kind: "multi", label: "Lending / supply (Aave, Compound)", value: "lending" },
      { kind: "multi", label: "LP / farming positions", value: "lp" },
      { kind: "multi", label: "Leveraged farming / borrow loops", value: "leverage" },
      { kind: "multi", label: "Perpetual futures trading", value: "perp" },
    ],
    hint: "Leave empty if you have never used any of these.",
  },
  {
    id: "experienceYears",
    category: "Longest hands-on experience",
    question: "How long have you been using the most experienced product above?",
    options: [
      { kind: "single", label: "No experience", score: 1 },
      { kind: "single", label: "Less than 1 year", score: 2 },
      { kind: "single", label: "1 – 3 years", score: 3 },
      { kind: "single", label: "3+ years", score: 4 },
    ],
  },
  {
    id: "returnAttitude",
    category: "Return vs principal preservation",
    question: "Which describes your priority best?",
    options: [
      { kind: "single", label: "Principal preservation is overwhelmingly first", score: 1 },
      { kind: "single", label: "Mostly preserve, accept modest yield", score: 2 },
      { kind: "single", label: "Accept some loss potential to chase returns", score: 3 },
      { kind: "single", label: "Maximum return first, large drawdowns acceptable", score: 4 },
    ],
  },
  {
    id: "lossTolerance",
    category: "Loss tolerance limit",
    question: "Below which drawdown would you genuinely lose sleep?",
    options: [
      { kind: "single", label: "Cannot stand even -5%", score: 1 },
      { kind: "single", label: "Tolerable down to -15%", score: 2 },
      { kind: "single", label: "Tolerable down to -30%", score: 3 },
      { kind: "single", label: "-50%+ is still acceptable", score: 4 },
    ],
  },
  {
    id: "literacy",
    category: "DeFi risk literacy",
    question: "What is the most advanced DeFi risk you can actually explain?",
    options: [
      { kind: "single", label: "None of these", score: 1 },
      { kind: "single", label: "Smart-contract bug risk", score: 2 },
      { kind: "single", label: "+ Impermanent Loss", score: 3 },
      { kind: "single", label: "+ Rug pull + MEV", score: 4 },
    ],
  },
  {
    id: "derivativeExp",
    category: "Derivative / leverage experience (Degen gate)",
    question: "Combined hands-on time with leveraged farming · perpetuals · points farming",
    options: [
      { kind: "single", label: "No experience", score: 1 },
      { kind: "single", label: "Less than 1 year", score: 2 },
      { kind: "single", label: "1 – 3 years", score: 3 },
      { kind: "single", label: "3+ years", score: 4 },
    ],
    hint: "Degen tier requires literacy=4 AND this answer ≥ 1 year.",
  },
];

export const TIER_LABEL: Record<Tier, string> = {
  preservation: "Preservation",
  conservative: "Conservative",
  balanced: "Balanced",
  aggressive: "Aggressive",
  degen: "Degen",
};

export const TIER_TAGLINE: Record<Tier, string> = {
  preservation: "Principal first — single audited lending market only",
  conservative: "Principal-centred — lending + stable LP mix",
  balanced: "Balance of yield and safety — blue-chip LP + lending",
  aggressive: "Return-first — emission farms + multi-chain rotation",
  degen: "Maximum yield — leverage, points, fresh pools allowed",
};

export const TIER_APR_RANGE: Record<Tier, string> = {
  preservation: "~3–5%",
  conservative: "5–10%",
  balanced: "10–25%",
  aggressive: "25–60%",
  degen: "60%+",
};

export const TIER_ORDER: Tier[] = [
  "preservation",
  "conservative",
  "balanced",
  "aggressive",
  "degen",
];

export const DEGEN_DOWNGRADE_REASON =
  "Degen tier requires both (a) DeFi risk literacy score 4 AND (b) at least 1 year of leverage / perpetual experience. With either missing, the tier is adjusted to Aggressive.";

export const VULNERABLE_DOWNGRADE_REASON =
  "Vulnerable-consumer self-check (age 65+ or first-time DeFi user) triggered an automatic one-tier downgrade. We will not raise it again without your explicit re-confirmation.";

// --- Scoring -------------------------------------------------------------

function inverseAllocation(score: AnswerScore): number {
  return (5 - score) as number;
}

function experienceProductScore(products: DefiExperienceCategory[]): number {
  if (products.includes("leverage") || products.includes("perp")) return 5;
  if (products.includes("lp")) return 3;
  if (products.includes("lending") || products.includes("swap")) return 1;
  return 0;
}

function experienceYearsScore(years: AnswerScore): number {
  return ({ 1: 0, 2: 1, 3: 3, 4: 5 } as const)[years];
}

function returnAttitudeScore(a: AnswerScore): number {
  return ({ 1: 1, 2: 2, 3: 3, 4: 5 } as const)[a];
}

function lossToleranceScore(a: AnswerScore): number {
  return ({ 1: 1, 2: 3, 3: 4, 4: 5 } as const)[a];
}

export function scoreAnswers(a: Answers): number {
  return (
    a.horizon +
    inverseAllocation(a.allocation) +
    experienceProductScore(a.experienceProducts) +
    experienceYearsScore(a.experienceYears) +
    returnAttitudeScore(a.returnAttitude) +
    lossToleranceScore(a.lossTolerance) +
    a.literacy
  );
}

export function rawScoreToTier(score: number): Tier {
  if (score <= 9) return "preservation";
  if (score <= 14) return "conservative";
  if (score <= 19) return "balanced";
  if (score <= 25) return "aggressive";
  return "degen";
}

export function downgradeOne(tier: Tier): Tier {
  const i = TIER_ORDER.indexOf(tier);
  if (i <= 0) return tier;
  return TIER_ORDER[i - 1]!;
}

export function isVulnerableConsumer(
  a: Pick<Answers, "ageBucket" | "firstTimeDefiPilot">,
): boolean {
  return a.ageBucket === "over65" || a.firstTimeDefiPilot;
}

export function deriveTier(answers: Answers): TierResult {
  const rawScore = scoreAnswers(answers);
  const naive = rawScoreToTier(rawScore);

  let tier: Tier = naive;
  let downgradedFromDegen = false;
  let vulnerableDowngrade = false;
  const reasons: string[] = [];

  if (tier === "degen") {
    const hasLiteracy = answers.literacy === 4;
    const hasDerivative = answers.derivativeExp >= 3;
    if (!hasLiteracy || !hasDerivative) {
      tier = "aggressive";
      downgradedFromDegen = true;
      reasons.push(DEGEN_DOWNGRADE_REASON);
    }
  }

  if (isVulnerableConsumer(answers)) {
    const dropped = downgradeOne(tier);
    if (dropped !== tier) {
      tier = dropped;
      vulnerableDowngrade = true;
      reasons.push(VULNERABLE_DOWNGRADE_REASON);
    }
  }

  return {
    tier,
    rawScore,
    derivativeExpScore: answers.derivativeExp,
    downgradedFromDegen,
    vulnerableDowngrade,
    reason: reasons.length > 0 ? reasons.join(" · ") : undefined,
  };
}

// --- 24-month validity cache (browser only) ------------------------------

export const TIER_CACHE_KEY = "defipilot:tierResult";
export const TIER_CACHE_TTL_MS = 24 * 30 * 24 * 60 * 60 * 1000;

export interface CachedTierEntry {
  result: TierResult;
  answers: Answers;
  savedAt: number;
}

export function cacheTier(entry: { result: TierResult; answers: Answers }): void {
  if (typeof window === "undefined") return;
  const payload: CachedTierEntry = {
    result: entry.result,
    answers: entry.answers,
    savedAt: Date.now(),
  };
  window.localStorage.setItem(TIER_CACHE_KEY, JSON.stringify(payload));
}

export function readCachedTier(): CachedTierEntry | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TIER_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedTierEntry;
    if (Date.now() - parsed.savedAt > TIER_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function tierCacheAgeDays(): number | null {
  const c = readCachedTier();
  if (!c) return null;
  return Math.floor((Date.now() - c.savedAt) / (24 * 60 * 60 * 1000));
}

export function clearCachedTier(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TIER_CACHE_KEY);
}
