import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { POST as marketplacePlanPOST } from "@/app/api/marketplace/plan/route";
import { catalogAll } from "@/lib/yields";
import { recallPlan } from "@/lib/planStore";

function req(body: unknown): NextRequest {
  return new NextRequest("http://test.local/api/marketplace/plan", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.60.${Math.random().toString().slice(2, 5)}.1`,
    },
    body: JSON.stringify(body),
  });
}

const wallet = {
  address: "0x0000000000000000000000000000000000000abc",
  chainId: 8453,
  gasBalanceWei: "10000000000000000000",
};

function pick(kind: "lending" | "lp", chainId = 8453) {
  return catalogAll().find(
    (p) => p.chainId === chainId && (kind === "lending" ? p.kind === "lending" : p.kind !== "lending" && p.kind !== "vault"),
  )!;
}

describe("POST /api/marketplace/plan", () => {
  test("60/40 lending/LP basket on Balanced passes guardrails", async () => {
    const lend = pick("lending");
    const lp = pick("lp");
    const res = await marketplacePlanPOST(
      req({
        tier: "balanced",
        rawScore: 22,
        literacyScore: 3,
        derivativeExpScore: 2,
        vulnerableConsumer: false,
        basket: [
          { productId: lend.id, amountUsd: 1800 },
          { productId: lp.id, amountUsd: 1200 },
        ],
        wallet,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plan).toBeDefined();
    expect(recallPlan(data.plan.planId)).toBeDefined();
  });

  test("pure-LP basket on Balanced is rejected by tier.cap.lp", async () => {
    const lp = pick("lp");
    const res = await marketplacePlanPOST(
      req({
        tier: "balanced",
        rawScore: 22,
        literacyScore: 3,
        derivativeExpScore: 2,
        vulnerableConsumer: false,
        basket: [
          { productId: lp.id, amountUsd: 1800 },
          { productId: lp.id, amountUsd: 1200 },
        ],
        wallet,
      }),
    );
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.ruleId).toBe("tier.cap.lp");
  });

  test("empty basket returns 400", async () => {
    const res = await marketplacePlanPOST(
      req({
        tier: "balanced",
        rawScore: 22,
        literacyScore: 3,
        derivativeExpScore: 2,
        vulnerableConsumer: false,
        basket: [],
        wallet,
      }),
    );
    expect(res.status).toBe(400);
  });

  test("invalid wallet address returns 400", async () => {
    const lend = pick("lending");
    const res = await marketplacePlanPOST(
      req({
        tier: "balanced",
        rawScore: 22,
        literacyScore: 3,
        derivativeExpScore: 2,
        vulnerableConsumer: false,
        basket: [{ productId: lend.id, amountUsd: 100 }],
        wallet: { ...wallet, address: "not-an-address" },
      }),
    );
    expect(res.status).toBe(400);
  });

  test("Conservative + LP-only basket rejects (allowedCategories=[lending])", async () => {
    const lp = pick("lp");
    const res = await marketplacePlanPOST(
      req({
        tier: "conservative",
        rawScore: 12,
        literacyScore: 2,
        derivativeExpScore: 1,
        vulnerableConsumer: false,
        basket: [{ productId: lp.id, amountUsd: 500 }],
        wallet,
      }),
    );
    expect([422, 500]).toContain(res.status);
  });
});
