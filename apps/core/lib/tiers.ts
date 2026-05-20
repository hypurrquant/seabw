import type {
  AgeBucket,
  Answers,
  AnswerScore,
  DefiExperienceCategory,
  Tier,
  TierResult,
} from "../types";

// 8 scored questions + 2 meta fields (1 meta step in the UI consent screen).
// Modelled on KOFIA 일반투자자 투자정보확인서 (Toss Invest 별지 제1호),
// adapted for DeFi product surfaces. derivativeExp is the 8th question and
// is gate-only — it is not summed into rawScore.

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
  preservation: "Preservation (안정형)",
  conservative: "Conservative (안정추구형)",
  balanced: "Balanced (위험중립형)",
  aggressive: "Aggressive (적극투자형)",
  degen: "Degen (공격투자형)",
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

// KOFIA Toss-Invest scoring adapted for DeFi:
// - Q1 horizon                : 1→1, 2→2, 3→3, 4→4
// - Q2 allocation             : 1→1, 2→2, 3→3, 4→4  (more allocation = need to be more cautious, so we invert)
// - Q3 experience (products)  : highest of {leverage/perp=5, lp=3, lending/swap=1}
// - Q3' experience (years)    : 1→0, 2→1, 3→3, 4→5
// - Q4 returnAttitude         : 1→1, 2→2, 3→3, 4→5
// - Q5 lossTolerance          : 1→1, 2→3, 3→4, 4→5
// - Q6 literacy               : 1→1, 2→2, 3→3, 4→4
// - Q8 derivativeExp          : NOT in sum; gates Degen only.
//
// Min/max:
// - Horizon 1..4, Allocation 1..4 (inverted via 5−x  so smaller alloc → safer),
//   Experience cat 1..5 + years 0..5 = 1..10,
//   Return 1..5, Loss 1..5, Literacy 1..4
// - Total = (1..4) + (1..4) + (0..5) + (0..5) + (1..5) + (1..5) + (1..4) = 5..32
//
// Vulnerable consumer (over65 OR firstTimeDefiPilot) downgrades one tier
// after band lookup. Derivative experience gate enforces Degen requirements.

function inverseAllocation(score: AnswerScore): number {
  // higher allocation% → smaller capacity-to-lose → lower score
  return 5 - score;
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
  return TIER_ORDER[i - 1];
}

export function isVulnerableConsumer(a: Pick<Answers, "ageBucket" | "firstTimeDefiPilot">): boolean {
  return a.ageBucket === "over65" || a.firstTimeDefiPilot;
}

export function deriveTier(answers: Answers): TierResult {
  const rawScore = scoreAnswers(answers);
  const naive = rawScoreToTier(rawScore);

  let tier: Tier = naive;
  let downgradedFromDegen = false;
  let vulnerableDowngrade = false;
  const reasons: string[] = [];

  // Derivative experience gate — Degen requires BOTH literacy=4 AND derivativeExp>=3 (1yr+).
  if (tier === "degen") {
    const hasLiteracy = answers.literacy === 4;
    const hasDerivative = answers.derivativeExp >= 3;
    if (!hasLiteracy || !hasDerivative) {
      tier = "aggressive";
      downgradedFromDegen = true;
      reasons.push(DEGEN_DOWNGRADE_REASON);
    }
  }

  // Vulnerable consumer downgrade — applies after the Degen gate. Each layer
  // (Degen gate, vulnerability) drops at most one tier *independently*, so a
  // user can be hit by both:
  //   over65 + fully-qualified Degen        → Aggressive (one drop, vulnerable)
  //   over65 + Degen-score but literacy<4    → Aggressive (gate) → Balanced (vulnerable)
  // Each layer is at most -1 tier; they compose additively when both fire.
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

// --- 24-month validity cache ---------------------------------------------

export const TIER_CACHE_KEY = "defipilot:tierResult";
export const TIER_CACHE_TTL_MS = 24 * 30 * 24 * 60 * 60 * 1000; // 24 months
// (Approximate as 24*30 days; refresh-prompt before exact expiry.)

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
