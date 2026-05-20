import { describe, expect, test } from "vitest";
import {
  composeBasketPlan,
  rangeForVariance,
  supportsRangeSplit,
  V3_RANGE_SPLIT,
  type BasketItem,
} from "../basket-composer";
import { catalogAll } from "../yields";

function findLending(chainId = 8453) {
  return catalogAll().find((p) => p.chainId === chainId && p.kind === "lending")!;
}
function findLp(chainId = 8453) {
  return catalogAll().find(
    (p) => p.chainId === chainId && (p.kind === "lp" || p.kind === "farm"),
  )!;
}

describe("composeBasketPlan", () => {
  test("empty basket throws", async () => {
    await expect(
      composeBasketPlan([], { tier: "balanced", intentRawText: "basket of 0" }),
    ).rejects.toThrow(/empty/i);
  });

  test("unknown productId throws", async () => {
    await expect(
      composeBasketPlan([{ productId: "9999:nope:none", amountUsd: 100 }], {
        tier: "balanced",
        intentRawText: "test",
      }),
    ).rejects.toThrow(/Unknown/i);
  });

  test("lending item yields 1 step with _capitalRole='lend'", async () => {
    const lend = findLending();
    const plan = await composeBasketPlan(
      [{ productId: lend.id, amountUsd: 1000 }],
      { tier: "balanced", intentRawText: "lend" },
    );
    expect(plan.steps).toHaveLength(1);
    const p = plan.steps[0].params as { _capitalRole?: string; _capitalUsd?: number };
    expect(p._capitalRole).toBe("lend");
    expect(p._capitalUsd).toBe(1000);
  });

  test("LP item yields swap + lp.add with lp-prep + lp roles, halved capital", async () => {
    const lp = findLp();
    const plan = await composeBasketPlan(
      [{ productId: lp.id, amountUsd: 2000 }],
      { tier: "balanced", intentRawText: "lp" },
    );
    expect(plan.steps).toHaveLength(2);
    const [swap, add] = plan.steps;
    expect((swap.params as { _capitalRole?: string })._capitalRole).toBe("lp-prep");
    expect((swap.params as { _capitalUsd?: number })._capitalUsd).toBe(1000);
    expect((add.params as { _capitalRole?: string })._capitalRole).toBe("lp");
    expect((add.params as { _capitalUsd?: number })._capitalUsd).toBe(1000);
  });

  test("$0 allocation items are skipped", async () => {
    const lend = findLending();
    const lp = findLp();
    const plan = await composeBasketPlan(
      [
        { productId: lend.id, amountUsd: 500 },
        { productId: lp.id, amountUsd: 0 },
      ],
      { tier: "balanced", intentRawText: "skip" },
    );
    expect(plan.steps).toHaveLength(1);
  });

  test("all $0 allocations throws", async () => {
    const lend = findLending();
    await expect(
      composeBasketPlan([{ productId: lend.id, amountUsd: 0 }], {
        tier: "balanced",
        intentRawText: "zero",
      }),
    ).rejects.toThrow(/\$0/i);
  });

  test(">8 steps throws", async () => {
    const lp = findLp();
    const items: BasketItem[] = Array.from({ length: 5 }, () => ({
      productId: lp.id,
      amountUsd: 100,
    }));
    // 5 LP items × 2 steps each = 10 steps > 8
    await expect(
      composeBasketPlan(items, { tier: "aggressive", intentRawText: "over" }),
    ).rejects.toThrow(/plan cap is 8/i);
  });

  test("intent metadata reflects the first item", async () => {
    const lend = findLending();
    const plan = await composeBasketPlan(
      [{ productId: lend.id, amountUsd: 1500 }],
      { tier: "balanced", intentRawText: "x" },
    );
    expect(plan.intent.asset.chainId).toBe(lend.chainId);
    expect(plan.intent.preferences).toContain("basket");
  });
});

// ---------------- C: variance-aware range ----------------

describe("rangeForVariance (C)", () => {
  test("low variance → tight ±2%", () => {
    expect(rangeForVariance(100)).toEqual({ rangePct: 2, label: "tight" });
  });
  test("mid variance → medium ±5%", () => {
    expect(rangeForVariance(250)).toEqual({ rangePct: 5, label: "medium" });
  });
  test("high variance → wide ±15%", () => {
    expect(rangeForVariance(800)).toEqual({ rangePct: 15, label: "wide" });
  });
  test("undefined falls back to medium", () => {
    expect(rangeForVariance(undefined)).toEqual({ rangePct: 5, label: "medium" });
  });
});

describe("LP step adopts variance-derived range (C)", () => {
  test("LP item without splitRanges gets variance-driven rangePct + rangeLabel", async () => {
    const lp = findLp();
    const plan = await composeBasketPlan(
      [{ productId: lp.id, amountUsd: 1000 }],
      { tier: "balanced", intentRawText: "C" },
    );
    const lpStep = plan.steps.find((s) => s.kind === "lp.add")!;
    const params = lpStep.params as { rangePct?: number; rangeLabel?: string };
    expect([2, 5, 15]).toContain(params.rangePct);
    expect(["tight", "medium", "wide"]).toContain(params.rangeLabel);
  });
});

// ---------------- A: multi-pool diversification ----------------

describe("diversifyAcross (A)", () => {
  test("diversifyAcross=2 splits one LP item into 2 protocol-distinct LP groups", async () => {
    const lp = findLp();
    const plan = await composeBasketPlan(
      [{ productId: lp.id, amountUsd: 2000, diversifyAcross: 2 }],
      { tier: "aggressive", intentRawText: "A" },
    );
    const protocols = new Set(
      plan.steps.filter((s) => s.kind === "lp.add").map((s) => s.protocol),
    );
    expect(protocols.size).toBeGreaterThanOrEqual(2);
  });

  test("diversifyAcross is clamped to [1,3]", async () => {
    const lp = findLp();
    const plan = await composeBasketPlan(
      [{ productId: lp.id, amountUsd: 600, diversifyAcross: 99 }],
      { tier: "aggressive", intentRawText: "A clamp" },
    );
    const protocols = new Set(
      plan.steps.filter((s) => s.kind === "lp.add").map((s) => s.protocol),
    );
    expect(protocols.size).toBeLessThanOrEqual(3);
  });
});

// ---------------- B: V3 multi-range ----------------

describe("supportsRangeSplit (B)", () => {
  test("uniswap_v3 / algebra_v3 are V3-eligible", () => {
    expect(supportsRangeSplit("uniswap_v3")).toBe(true);
    expect(supportsRangeSplit("algebra_v3")).toBe(true);
  });
  test("non-V3 interfaces are not", () => {
    expect(supportsRangeSplit("solidly_v2")).toBe(false);
    expect(supportsRangeSplit("aave_v3")).toBe(false);
    expect(supportsRangeSplit(undefined)).toBe(false);
  });
});

describe("splitRanges (B)", () => {
  test("V3 pool + splitRanges=true yields 3 lp.add sub-steps with rangeLabel tight/medium/wide", async () => {
    const v3 = catalogAll().find(
      (p) => p.iface === "uniswap_v3" && (p.kind === "lp" || p.kind === "farm"),
    )!;
    const plan = await composeBasketPlan(
      [{ productId: v3.id, amountUsd: 1000, splitRanges: true }],
      { tier: "aggressive", intentRawText: "B" },
    );
    const lpAdds = plan.steps.filter((s) => s.kind === "lp.add");
    expect(lpAdds).toHaveLength(3);
    const labels = lpAdds.map((s) => (s.params as { rangeLabel?: string }).rangeLabel);
    expect(labels.sort()).toEqual(["medium", "tight", "wide"]);
  });

  test("non-V3 pool ignores splitRanges and falls back to single range", async () => {
    const nonV3 = catalogAll().find(
      (p) => p.iface === "solidly_v2" && (p.kind === "lp" || p.kind === "farm"),
    )!;
    const plan = await composeBasketPlan(
      [{ productId: nonV3.id, amountUsd: 1000, splitRanges: true }],
      { tier: "aggressive", intentRawText: "B-noop" },
    );
    const lpAdds = plan.steps.filter((s) => s.kind === "lp.add");
    expect(lpAdds).toHaveLength(1);
  });

  test("V3_RANGE_SPLIT weights sum to 1.0", () => {
    const sum = V3_RANGE_SPLIT.reduce((acc, x) => acc + x.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
  });
});
