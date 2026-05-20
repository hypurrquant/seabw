import { describe, expect, test, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/plan/route";

function req(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://test.local/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  tier: "balanced",
  rawScore: 22,
  literacyScore: 3,
  derivativeExpScore: 2,
  vulnerableConsumer: false,
  intentText: "$3000 USDC, want yield",
  wallet: {
    address: "0x0000000000000000000000000000000000000abc",
    chainId: 8453,
    gasBalanceWei: "10000000000000000000",
    holdings: [],
  },
};

describe("POST /api/plan", () => {
  beforeEach(() => {
    delete process.env.DEFIPILOT_DISABLE_EXEC;
  });

  test("happy path returns a guardrail-evaluated plan", async () => {
    const res = await POST(req(baseBody, { "x-forwarded-for": `10.40.${Math.random().toString().slice(2, 5)}.1` }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plan).toBeDefined();
    expect(data.plan.tier).toBe("balanced");
    expect(data.plan.steps.length).toBeGreaterThan(0);
    expect(data.plan.guardrails.appliedRules.length).toBeGreaterThan(1);
  });

  test("kill switch returns 503", async () => {
    process.env.DEFIPILOT_DISABLE_EXEC = "true";
    const res = await POST(req(baseBody, { "x-forwarded-for": `10.41.${Math.random().toString().slice(2, 5)}.1` }));
    expect(res.status).toBe(503);
  });

  test("bad schema returns 400", async () => {
    const res = await POST(req({ tier: "invalid" }, { "x-forwarded-for": "10.42.0.1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid/i);
  });

  test("malformed JSON returns 400", async () => {
    const r = new NextRequest("http://test.local/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(r);
    expect(res.status).toBe(400);
  });

  test("rate limit triggers 429 after burst", async () => {
    const ip = `10.43.${Math.random().toString().slice(2, 5)}.1`;
    for (let i = 0; i < 10; i++) {
      const ok = await POST(req(baseBody, { "x-forwarded-for": ip }));
      expect(ok.status).not.toBe(429);
    }
    const blocked = await POST(req(baseBody, { "x-forwarded-for": ip }));
    expect(blocked.status).toBe(429);
  });
});
