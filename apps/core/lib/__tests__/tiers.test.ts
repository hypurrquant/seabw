import { describe, expect, test } from "vitest";
import {
  DEGEN_DOWNGRADE_REASON,
  VULNERABLE_DOWNGRADE_REASON,
  deriveTier,
  downgradeOne,
  isVulnerableConsumer,
  rawScoreToTier,
  scoreAnswers,
  SURVEY_QUESTIONS,
  TIER_APR_RANGE,
  TIER_LABEL,
  TIER_ORDER,
  TIER_TAGLINE,
} from "@seabw/core";
import type { Answers } from "@seabw/core";

const SAFEST: Answers = {
  horizon: 1,
  allocation: 4,                  // big % of net worth → low capacity-to-lose score
  experienceProducts: [],
  experienceYears: 1,
  returnAttitude: 1,
  lossTolerance: 1,
  literacy: 1,
  derivativeExp: 1,
  ageBucket: "under65",
  firstTimeDefiPilot: false,
};

const MOST_AGGRESSIVE: Answers = {
  horizon: 4,
  allocation: 1,
  experienceProducts: ["leverage", "perp"],
  experienceYears: 4,
  returnAttitude: 4,
  lossTolerance: 4,
  literacy: 4,
  derivativeExp: 4,
  ageBucket: "under65",
  firstTimeDefiPilot: false,
};

describe("scoreAnswers", () => {
  test("safest answers map to single-digit total", () => {
    expect(scoreAnswers(SAFEST)).toBeLessThanOrEqual(10);
  });

  test("most aggressive answers map to high total", () => {
    expect(scoreAnswers(MOST_AGGRESSIVE)).toBeGreaterThanOrEqual(26);
  });

  test("multi-select leverage/perp dominates experience scoring", () => {
    const a: Answers = { ...SAFEST, experienceProducts: ["leverage"], experienceYears: 3 };
    const b: Answers = { ...SAFEST, experienceProducts: ["lending"], experienceYears: 3 };
    expect(scoreAnswers(a)).toBeGreaterThan(scoreAnswers(b));
  });
});

describe("rawScoreToTier band boundaries", () => {
  test("≤9 → preservation", () => {
    expect(rawScoreToTier(8)).toBe("preservation");
    expect(rawScoreToTier(9)).toBe("preservation");
  });
  test("10..14 → conservative", () => {
    expect(rawScoreToTier(10)).toBe("conservative");
    expect(rawScoreToTier(14)).toBe("conservative");
  });
  test("15..19 → balanced", () => {
    expect(rawScoreToTier(15)).toBe("balanced");
    expect(rawScoreToTier(19)).toBe("balanced");
  });
  test("20..25 → aggressive", () => {
    expect(rawScoreToTier(20)).toBe("aggressive");
    expect(rawScoreToTier(25)).toBe("aggressive");
  });
  test("≥26 → degen", () => {
    expect(rawScoreToTier(26)).toBe("degen");
    expect(rawScoreToTier(40)).toBe("degen");
  });
});

describe("deriveTier — Degen gate", () => {
  test("max scores + literacy=4 + derivativeExp>=3 stays Degen", () => {
    const r = deriveTier(MOST_AGGRESSIVE);
    expect(r.tier).toBe("degen");
    expect(r.downgradedFromDegen).toBe(false);
  });

  test("Degen-score profile with literacy<4 is downgraded to Aggressive", () => {
    const r = deriveTier({ ...MOST_AGGRESSIVE, literacy: 3 });
    expect(r.tier).toBe("aggressive");
    expect(r.downgradedFromDegen).toBe(true);
    expect(r.reason).toContain(DEGEN_DOWNGRADE_REASON);
  });

  test("Degen-score profile with derivativeExp<3 is downgraded", () => {
    const r = deriveTier({ ...MOST_AGGRESSIVE, derivativeExp: 2 });
    expect(r.tier).toBe("aggressive");
    expect(r.downgradedFromDegen).toBe(true);
  });
});

describe("deriveTier — vulnerable consumer downgrade", () => {
  test("over65 user one tier down", () => {
    const r = deriveTier({ ...MOST_AGGRESSIVE, ageBucket: "over65" });
    // MOST_AGGRESSIVE without downgrade = degen → over65 brings it to aggressive
    expect(r.vulnerableDowngrade).toBe(true);
    expect(r.tier).toBe("aggressive");
    expect(r.reason).toContain(VULNERABLE_DOWNGRADE_REASON);
  });

  test("firstTimeDefiPilot user one tier down", () => {
    const r = deriveTier({ ...MOST_AGGRESSIVE, firstTimeDefiPilot: true });
    expect(r.vulnerableDowngrade).toBe(true);
    expect(r.tier).toBe("aggressive");
  });

  test("preservation cannot downgrade further", () => {
    const r = deriveTier({ ...SAFEST, firstTimeDefiPilot: true });
    expect(r.tier).toBe("preservation");
    expect(r.vulnerableDowngrade).toBe(false);
  });
});

describe("isVulnerableConsumer", () => {
  test("over65 true", () => {
    expect(isVulnerableConsumer({ ageBucket: "over65", firstTimeDefiPilot: false })).toBe(true);
  });
  test("firstTimeDefiPilot true", () => {
    expect(isVulnerableConsumer({ ageBucket: "under65", firstTimeDefiPilot: true })).toBe(true);
  });
  test("neither false", () => {
    expect(isVulnerableConsumer({ ageBucket: "under65", firstTimeDefiPilot: false })).toBe(false);
  });
});

describe("downgradeOne", () => {
  test("steps one down in TIER_ORDER", () => {
    expect(downgradeOne("degen")).toBe("aggressive");
    expect(downgradeOne("balanced")).toBe("conservative");
    expect(downgradeOne("conservative")).toBe("preservation");
  });
  test("preservation stays preservation", () => {
    expect(downgradeOne("preservation")).toBe("preservation");
  });
});

describe("SURVEY_QUESTIONS shape", () => {
  test("8 scored questions (7 standard + derivative gate)", () => {
    expect(SURVEY_QUESTIONS).toHaveLength(8);
  });
  test("question ids match Answers keys (excluding meta)", () => {
    const ids = SURVEY_QUESTIONS.map((q) => q.id);
    expect(ids).toEqual([
      "horizon",
      "allocation",
      "experienceProducts",
      "experienceYears",
      "returnAttitude",
      "lossTolerance",
      "literacy",
      "derivativeExp",
    ]);
  });
});

describe("TIER copy invariants", () => {
  test("label + tagline + APR range exist for every tier", () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_LABEL[tier]).toBeTruthy();
      expect(TIER_TAGLINE[tier]).toBeTruthy();
      expect(TIER_APR_RANGE[tier]).toBeTruthy();
    }
  });
  test("TIER_ORDER has 5 entries from preservation to degen", () => {
    expect(TIER_ORDER).toEqual([
      "preservation",
      "conservative",
      "balanced",
      "aggressive",
      "degen",
    ]);
  });
});
