import { describe, expect, test, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as rehydratePOST } from "@/app/api/plan/rehydrate/route";
import { rememberPlan, recallPlan, forgetPlan } from "@/lib/planStore";
import type { PipelinePlan } from "@/types";

function req(body: unknown): NextRequest {
  return new NextRequest("http://test.local/api/plan/rehydrate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PREVIEW = "0x000000000000000000000000000000000000dEaD";
const REAL = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const TORNADO_OFAC = "0x8589427373d6d84e98730d7795d8f6f8731fda16";

function mkPlan(id: string, calldataData: `0x${string}`): PipelinePlan {
  return {
    planId: id,
    tier: "balanced",
    intent: { asset: { symbol: "USDC", chainId: 8453 }, amount: "100", rawText: "preview" },
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
          data: calldataData,
          value: "0",
        },
      },
    ],
    aggregate: { estimatedAprPct: 5, estimatedGasUsd: 0.1, riskFlags: [] },
    guardrails: { appliedRules: ["draft", "ops.sanctioned.block"] },
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  };
}

describe("POST /api/plan/rehydrate", () => {
  beforeEach(() => {
    delete process.env.DEFIPILOT_DISABLE_EXEC;
  });

  test("unknown planId returns 410", async () => {
    const res = await rehydratePOST(
      req({ planId: "nonexistent", signerAddress: REAL }),
    );
    expect(res.status).toBe(410);
  });

  test("kill switch returns 503", async () => {
    process.env.DEFIPILOT_DISABLE_EXEC = "true";
    const id = `rh-kill-${Math.random()}`;
    rememberPlan(mkPlan(id, "0xab"), PREVIEW);
    const res = await rehydratePOST(req({ planId: id, signerAddress: REAL }));
    expect(res.status).toBe(503);
    forgetPlan(id);
  });

  test("sanctioned signer returns 403 BEFORE binding", async () => {
    const id = `rh-ofac-${Math.random()}`;
    rememberPlan(mkPlan(id, "0xab"), PREVIEW);
    const res = await rehydratePOST(
      req({ planId: id, signerAddress: TORNADO_OFAC }),
    );
    expect(res.status).toBe(403);
    // planStore must still be bound to PREVIEW — sanctioned address never got recorded.
    expect(recallPlan(id)?.address).toBe(PREVIEW.toLowerCase());
    forgetPlan(id);
  });

  test("structural canary: unchanged calldata post-hydration rejected 502", async () => {
    // Flip the env so isFixtureMode() returns false (route invokes
    // tryHydrateCalldata) and isDefiCliAvailable() returns true (function
    // enters its body), then point the binary at /usr/bin/false so every
    // spawn rejects. tryHydrateCalldata's catch swallows the rejection and
    // returns each step UNCHANGED — exactly the silent-drop case the canary
    // must reject before rebinding planStore.
    const prev = {
      f: process.env.DEFIPILOT_USE_FIXTURES,
      c: process.env.DEFIPILOT_DEFI_CLI,
      b: process.env.DEFI_CLI_BIN,
    };
    process.env.DEFIPILOT_USE_FIXTURES = "false";
    process.env.DEFIPILOT_DEFI_CLI = "on";
    process.env.DEFI_CLI_BIN = "false";
    try {
      const id = `rh-struct-${Math.random()}`;
      rememberPlan(mkPlan(id, "0xab"), PREVIEW);
      const res = await rehydratePOST(req({ planId: id, signerAddress: REAL }));
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toMatch(/did not rebind step/i);
      expect(recallPlan(id)?.address).toBe(PREVIEW.toLowerCase());
      forgetPlan(id);
    } finally {
      process.env.DEFIPILOT_USE_FIXTURES = prev.f ?? "true";
      process.env.DEFIPILOT_DEFI_CLI = prev.c ?? "off";
      if (prev.b === undefined) delete process.env.DEFI_CLI_BIN;
      else process.env.DEFI_CLI_BIN = prev.b;
    }
  });

  test("happy path: rebinds signer, refreshes createdAt, tags rule", async () => {
    const id = `rh-ok-${Math.random()}`;
    const plan = mkPlan(id, "0xdeadbeef");
    rememberPlan(plan, PREVIEW);
    const before = recallPlan(id)!.plan.createdAt;
    const res = await rehydratePOST(req({ planId: id, signerAddress: REAL }));
    expect(res.status).toBe(200);
    const after = recallPlan(id)!;
    expect(after.address).toBe(REAL.toLowerCase());
    expect(new Date(after.plan.createdAt).getTime()).toBeGreaterThan(
      new Date(before).getTime(),
    );
    expect(after.plan.guardrails.appliedRules.some((r) => r.startsWith("rehydrate:0xd8da"))).toBe(true);
    forgetPlan(id);
  });

  test("idempotent rehydrate doesn't duplicate the marker", async () => {
    const id = `rh-idem-${Math.random()}`;
    rememberPlan(mkPlan(id, "0xab"), PREVIEW);
    await rehydratePOST(req({ planId: id, signerAddress: REAL }));
    await rehydratePOST(req({ planId: id, signerAddress: REAL }));
    const rules = recallPlan(id)!.plan.guardrails.appliedRules;
    const markers = rules.filter((r) => r.startsWith("rehydrate:"));
    expect(markers).toHaveLength(1);
    forgetPlan(id);
  });

  test("alreadyBound short-circuit: refresh createdAt, skip defi-cli", async () => {
    // Bind to REAL upfront, then rehydrate with the same REAL. Even with live
    // mode active and a failing binary, the route should short-circuit past
    // the defi-cli round-trip and just refresh the freshness window.
    process.env.DEFIPILOT_USE_FIXTURES = "false";
    process.env.DEFIPILOT_DEFI_CLI = "on";
    process.env.DEFI_CLI_BIN = "false";
    try {
      const id = `rh-bound-${Math.random()}`;
      rememberPlan(mkPlan(id, "0xabcd"), REAL);
      const before = recallPlan(id)!.plan.createdAt;
      const res = await rehydratePOST(req({ planId: id, signerAddress: REAL }));
      expect(res.status).toBe(200);
      const after = recallPlan(id)!.plan.createdAt;
      expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
      forgetPlan(id);
    } finally {
      process.env.DEFIPILOT_USE_FIXTURES = "true";
      process.env.DEFIPILOT_DEFI_CLI = "off";
      delete process.env.DEFI_CLI_BIN;
    }
  });

  test("non-hydratable kinds (lend.withdraw) rejected with 422 before spawn", async () => {
    process.env.DEFIPILOT_USE_FIXTURES = "false";
    process.env.DEFIPILOT_DEFI_CLI = "on";
    process.env.DEFI_CLI_BIN = "false";
    try {
      const id = `rh-withdraw-${Math.random()}`;
      const plan = mkPlan(id, "0xabcd");
      // lend.withdraw has no tryHydrateCalldata branch. Exempting it would
      // silently bind preview-owner calldata; refusing surfaces the gap.
      plan.steps[0].kind = "lend.withdraw";
      rememberPlan(plan, PREVIEW);
      const res = await rehydratePOST(req({ planId: id, signerAddress: REAL }));
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toMatch(/not yet wired through defi-cli/i);
      expect(body.error).toMatch(/lend\.withdraw/);
      expect(recallPlan(id)?.address).toBe(PREVIEW.toLowerCase());
      forgetPlan(id);
    } finally {
      process.env.DEFIPILOT_USE_FIXTURES = "true";
      process.env.DEFIPILOT_DEFI_CLI = "off";
      delete process.env.DEFI_CLI_BIN;
    }
  });
});
