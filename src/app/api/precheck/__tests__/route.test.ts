import { describe, expect, test, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as precheckPOST } from "@/app/api/precheck/route";
import { rememberPlan, forgetPlan } from "@/lib/planStore";
import type { PipelinePlan } from "@/types";

function req(body: unknown): NextRequest {
  return new NextRequest("http://test.local/api/precheck", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mkPlan(id: string, createdAt: string = new Date().toISOString()): PipelinePlan {
  return {
    planId: id,
    tier: "balanced",
    intent: { asset: { symbol: "USDC", chainId: 8453 }, amount: "100", rawText: "x" },
    steps: [
      {
        id: "s1",
        kind: "lend.supply",
        chainId: 8453,
        protocol: "aave-v3-base",
        params: {},
        expected: {
          inputs: [{ token: "USDC", amount: "100" }],
          outputs: [{ token: "aUSDC", amount: "100" }],
          feeUsd: 0.1,
          slippagePct: 0,
        },
        risks: [],
        calldata: {
          to: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
          data: "0xab",
          value: "0",
        },
      },
    ],
    aggregate: { estimatedAprPct: 5, estimatedGasUsd: 0.1, riskFlags: [] },
    guardrails: { appliedRules: ["draft", "ops.sanctioned.block"] },
    createdAt,
  };
}

const SIGNER = "0x0000000000000000000000000000000000000abc";

describe("POST /api/precheck", () => {
  beforeEach(() => {
    delete process.env.DEFIPILOT_DISABLE_EXEC;
  });

  test("happy path returns canonicalCalldata", async () => {
    const id = `pc-happy-${Math.random()}`;
    rememberPlan(mkPlan(id), SIGNER);
    const res = await precheckPOST(req({ planId: id, stepId: "s1", signerAddress: SIGNER }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.canonicalCalldata.to).toBe("0xA238Dd80C259a72e81d7e4664a9801593F98d1c5");
    expect(data.canonicalCalldata.data).toBe("0xab");
    forgetPlan(id);
  });

  test("kill switch returns 503", async () => {
    const id = `pc-kill-${Math.random()}`;
    rememberPlan(mkPlan(id), SIGNER);
    process.env.DEFIPILOT_DISABLE_EXEC = "true";
    const res = await precheckPOST(req({ planId: id, stepId: "s1", signerAddress: SIGNER }));
    expect(res.status).toBe(503);
    forgetPlan(id);
  });

  test("unknown plan returns 410", async () => {
    const res = await precheckPOST(
      req({ planId: "nonexistent-plan-id", stepId: "s1", signerAddress: SIGNER }),
    );
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.ruleId).toBe("calldata.revalidate");
  });

  test("wrong signer returns 403", async () => {
    const id = `pc-wrong-${Math.random()}`;
    rememberPlan(mkPlan(id), SIGNER);
    const other = "0x1111111111111111111111111111111111111111";
    const res = await precheckPOST(req({ planId: id, stepId: "s1", signerAddress: other }));
    expect(res.status).toBe(403);
    forgetPlan(id);
  });

  test("stale plan (>5min) returns 422", async () => {
    const id = `pc-stale-${Math.random()}`;
    const oldTs = new Date(Date.now() - 6 * 60_000).toISOString();
    rememberPlan(mkPlan(id, oldTs), SIGNER);
    const res = await precheckPOST(req({ planId: id, stepId: "s1", signerAddress: SIGNER }));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.ruleId).toBe("calldata.revalidate");
    forgetPlan(id);
  });

  test("unknown stepId returns 404", async () => {
    const id = `pc-step-${Math.random()}`;
    rememberPlan(mkPlan(id), SIGNER);
    const res = await precheckPOST(req({ planId: id, stepId: "unknown", signerAddress: SIGNER }));
    expect(res.status).toBe(404);
    forgetPlan(id);
  });

  test("malformed payload returns 400", async () => {
    const res = await precheckPOST(req({ planId: 1 }));
    expect(res.status).toBe(400);
  });
});
