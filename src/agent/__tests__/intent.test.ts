import { describe, expect, test } from "vitest";
import { parseIntent, parseIntentHeuristic } from "@/agent/intent";

describe("parseIntentHeuristic", () => {
  test("extracts amount with dollar sign and comma", () => {
    const r = parseIntentHeuristic("$3,000 USDC, want yield");
    expect(r.amount).toBe("3000");
    expect(r.asset.symbol).toBe("USDC");
  });

  test("recognises k suffix as multiplier", () => {
    const r = parseIntentHeuristic("Park 10k USDC for a year");
    expect(r.amount).toBe("10000");
  });

  test("recognises m suffix as multiplier", () => {
    const r = parseIntentHeuristic("Stake 1m USDT please");
    expect(r.amount).toBe("1000000");
    expect(r.asset.symbol).toBe("USDT");
  });

  test("decimal amount preserved", () => {
    const r = parseIntentHeuristic("Put 1500.25 USDC in lending");
    expect(r.amount).toBe("1500.25");
  });

  test("default symbol is USDC when none mentioned", () => {
    const r = parseIntentHeuristic("Want yield");
    expect(r.asset.symbol).toBe("USDC");
  });

  test("ETH symbol detected", () => {
    const r = parseIntentHeuristic("0.5 ETH into a yield strategy");
    expect(r.asset.symbol).toBe("ETH");
  });

  test("horizon mid for months", () => {
    const r = parseIntentHeuristic("3,000 USDC for 6 months");
    expect(r.horizon).toBe("mid");
  });

  test("horizon long for years", () => {
    const r = parseIntentHeuristic("3,000 USDC for 3 years");
    expect(r.horizon).toBe("long");
  });

  test("horizon short for week", () => {
    const r = parseIntentHeuristic("3,000 USDC just a week");
    expect(r.horizon).toBe("short");
  });

  test("preferences: no-bridge / stable-only / auto-compound", () => {
    const r = parseIntentHeuristic("3,000 USDC stable-only no-bridge auto-compound");
    expect(r.preferences).toEqual(expect.arrayContaining(["no-bridge", "stable-only", "auto-compound"]));
  });

  test("rawText preserved", () => {
    const text = "literal raw text 123";
    expect(parseIntentHeuristic(text).rawText).toBe(text);
  });

  test("chainId defaults to env default", () => {
    const r = parseIntentHeuristic("$100 USDC", 8453);
    expect(r.asset.chainId).toBe(8453);
  });
});

describe("parseIntent (top-level)", () => {
  test("uses heuristic when ANTHROPIC_API_KEY missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await parseIntent("$5,000 USDC 6 months", 8453);
    expect(r.amount).toBe("5000");
    expect(r.horizon).toBe("mid");
  });
});
