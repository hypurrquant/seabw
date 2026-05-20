import { describe, expect, test } from "vitest";
import { forgetPlan, recallPlan, rememberPlan } from "@/lib/planStore";
import type { PipelinePlan } from "@/types";

function mkPlan(id: string, createdAt: string = new Date().toISOString()): PipelinePlan {
  return {
    planId: id,
    tier: "balanced",
    intent: { asset: { symbol: "USDC", chainId: 8453 }, amount: "100", rawText: "x" },
    steps: [],
    aggregate: { estimatedAprPct: 0, estimatedGasUsd: 0, riskFlags: [] },
    guardrails: { appliedRules: ["draft"] },
    createdAt,
  };
}

describe("planStore", () => {
  test("recallPlan returns the same plan with lowercased address", () => {
    const id = `ps-${Math.random()}`;
    const plan = mkPlan(id);
    rememberPlan(plan, "0xAbCdEf0000000000000000000000000000000123");
    const got = recallPlan(id);
    expect(got).toBeDefined();
    expect(got?.address).toBe("0xabcdef0000000000000000000000000000000123");
    expect(got?.plan.planId).toBe(id);
  });

  test("recall returns undefined for unknown id", () => {
    expect(recallPlan("never-stored")).toBeUndefined();
  });

  test("forgetPlan removes the entry", () => {
    const id = `ps-forget-${Math.random()}`;
    rememberPlan(mkPlan(id), "0x" + "1".repeat(40));
    expect(recallPlan(id)).toBeDefined();
    forgetPlan(id);
    expect(recallPlan(id)).toBeUndefined();
  });

  test("rememberPlan twice keeps latest storedAt", async () => {
    const id = `ps-replace-${Math.random()}`;
    rememberPlan(mkPlan(id), "0xaa" + "00".repeat(19));
    const first = recallPlan(id)!.storedAt;
    await new Promise((r) => setTimeout(r, 5));
    rememberPlan(mkPlan(id), "0xbb" + "00".repeat(19));
    const second = recallPlan(id)!.storedAt;
    expect(second).toBeGreaterThanOrEqual(first);
    expect(recallPlan(id)!.address).toBe("0xbb" + "00".repeat(19));
  });
});
