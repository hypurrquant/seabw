import { describe, expect, test } from "vitest";
import { composePlan } from "../composer";

const intent = (chainId = 8453, amount = "3000") => ({
  asset: { symbol: "USDC", chainId },
  amount,
  rawText: "test intent",
});

describe("composePlan", () => {
  test("balanced on Base produces a plan with 1..8 steps", async () => {
    const plan = await composePlan("balanced", intent(8453, "3000"));
    expect(plan.steps.length).toBeGreaterThanOrEqual(1);
    expect(plan.steps.length).toBeLessThanOrEqual(8);
    expect(plan.tier).toBe("balanced");
  });

  test("conservative on Base picks only lending protocols", async () => {
    const plan = await composePlan("conservative", intent(8453, "2000"));
    expect(plan.steps.every((s) => s.kind === "lend.supply")).toBe(true);
  });

  test("balanced on a chain with no whitelist throws", async () => {
    // Chain 1 (Ethereum) is excluded from defi-cli; no whitelisted protocols
    await expect(composePlan("balanced", intent(1, "1000"))).rejects.toThrow(
      /No whitelisted protocols/i,
    );
  });

  test("aggregate.estimatedAprPct is positive for LP-included plan", async () => {
    const plan = await composePlan("balanced", intent(8453, "3000"));
    expect(plan.aggregate.estimatedAprPct).toBeGreaterThan(0);
  });

  test("guardrails.appliedRules is non-empty in draft (later filled by evaluatePlan)", async () => {
    const plan = await composePlan("balanced", intent(8453));
    expect(plan.guardrails.appliedRules.length).toBeGreaterThan(0);
  });

  test("every step has populated calldata.to (placeholder allowed in demo)", async () => {
    const plan = await composePlan("balanced", intent(8453));
    for (const s of plan.steps) {
      expect(s.calldata.to).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }
  });
});
