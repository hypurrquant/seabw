import { describe, expect, test } from "vitest";
import { catalogAll, catalogForTier } from "../yields";
import { DEFI_CLI_CHAIN_IDS } from "@seabw/core";

describe("catalogAll", () => {
  test("exposes defi-cli protocols hydratable in live mode (38 - 2 morpho_blue - 5 slug blocks = 31)", () => {
    // Blocked by iface: morpho_blue (felix-morpho, morpho-blue-monad) — needs --market <id>
    // Blocked by slug: venus-bnb, venus-flux-bnb (compound_v2 revert), merchantmoe-mantle,
    //   traderjoe-monad (LB needs --pool), uniswap-v3-bnb (position manager not configured)
    const all = catalogAll();
    expect(all.length).toBe(31);
    expect(all.every((p) => p.iface !== "morpho_blue")).toBe(true);
  });

  test("every product belongs to a defi-cli chain", () => {
    const set = new Set<number>(DEFI_CLI_CHAIN_IDS);
    for (const p of catalogAll()) {
      expect(set.has(p.chainId)).toBe(true);
    }
  });

  test("APR is deterministic across calls (seeded by id)", () => {
    const a = catalogAll();
    const b = catalogAll();
    for (let i = 0; i < a.length; i++) {
      expect(a[i].apr.totalPct).toBe(b[i].apr.totalPct);
    }
  });
});

describe("catalogForTier", () => {
  test("Conservative is lending-only", () => {
    const c = catalogForTier("conservative");
    expect(c.length).toBeGreaterThan(0);
    for (const p of c) expect(p.kind).toBe("lending");
  });

  test("Conservative honors $100M TVL floor", () => {
    for (const p of catalogForTier("conservative")) {
      expect(p.tvlUsd).toBeGreaterThanOrEqual(100_000_000);
    }
  });

  test("Balanced excludes farm-only and unaudited", () => {
    const b = catalogForTier("balanced");
    expect(b.length).toBeGreaterThan(catalogForTier("conservative").length);
    for (const p of b) {
      expect(p.auditCount).toBeGreaterThan(0);
      expect(p.tvlUsd).toBeGreaterThanOrEqual(30_000_000);
    }
  });

  test("Degen has the widest set but still ≥ $10M TVL", () => {
    const d = catalogForTier("degen");
    expect(d.length).toBeGreaterThan(catalogForTier("aggressive").length);
    for (const p of d) expect(p.tvlUsd).toBeGreaterThanOrEqual(10_000_000);
  });

  test("inputs/outputs always present", () => {
    for (const p of catalogForTier("aggressive")) {
      expect(p.inputs.length).toBeGreaterThan(0);
      expect(p.outputs.length).toBeGreaterThan(0);
    }
  });
});
