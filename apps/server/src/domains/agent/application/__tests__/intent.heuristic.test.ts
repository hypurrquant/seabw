import { describe, expect, test } from "vitest";
import { parseIntentHeuristic } from "../../../plan/internal/heuristic-intent";

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

  test("default symbol is USDC when none mentioned", () => {
    const r = parseIntentHeuristic("Want yield");
    expect(r.asset.symbol).toBe("USDC");
  });

  test("horizon mid for months", () => {
    const r = parseIntentHeuristic("3,000 USDC for 6 months");
    expect(r.horizon).toBe("mid");
  });

  test("preferences", () => {
    const r = parseIntentHeuristic("3,000 USDC stable-only no-bridge auto-compound");
    expect(r.preferences).toEqual(
      expect.arrayContaining(["no-bridge", "stable-only", "auto-compound"]),
    );
  });

  test("chainId override applied", () => {
    const r = parseIntentHeuristic("$100 USDC", 8453);
    expect(r.asset.chainId).toBe(8453);
  });
});
