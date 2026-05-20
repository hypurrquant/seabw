import { describe, expect, test } from "vitest";
import {
  bestDexProtocol,
  bestLendingProtocol,
  bestLpProtocol,
  isProtocolAllowed,
  NAMED_AUDITORS,
  protocolDetails,
  PROTOCOLS,
  whitelistFor,
} from "@/policy/whitelist";

describe("PROTOCOLS catalog", () => {
  test("38 entries match defi-cli (nest-v1 removed as stale)", () => {
    expect(PROTOCOLS).toHaveLength(38);
  });

  test("every protocol has at least one chainId", () => {
    for (const p of PROTOCOLS) {
      expect(p.chainIds.length).toBeGreaterThan(0);
    }
  });
});

describe("NAMED_AUDITORS", () => {
  test("matches the spec list", () => {
    const expected = ["Trail of Bits", "OpenZeppelin", "Spearbit", "Code4rena", "Cantina", "Halborn", "Quantstamp"];
    for (const a of expected) expect(NAMED_AUDITORS.has(a)).toBe(true);
  });
});

describe("whitelistFor", () => {
  test("Conservative on Base is lending-only with named audits", () => {
    const list = whitelistFor("conservative", 8453);
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) {
      expect(p.category).toBe("lending");
      expect(p.audits.some((a) => NAMED_AUDITORS.has(a))).toBe(true);
      expect(p.tvlUsd).toBeGreaterThanOrEqual(100_000_000);
    }
  });

  test("Balanced on BNB excludes audit-less BabyDoge/BSCSwap", () => {
    const list = whitelistFor("balanced", 56);
    const slugs = list.map((p) => p.slug);
    expect(slugs).not.toContain("babydogeswap-bnb");
    expect(slugs).not.toContain("bscswap-bnb");
    expect(slugs).not.toContain("fstswap-bnb");
  });

  test("Degen drops named-audit requirement but keeps $10M TVL floor", () => {
    const list = whitelistFor("degen", 56);
    for (const p of list) expect(p.tvlUsd).toBeGreaterThanOrEqual(10_000_000);
  });
});

describe("isProtocolAllowed", () => {
  test("aave-v3-base allowed on Conservative", () => {
    expect(isProtocolAllowed("conservative", 8453, "aave-v3-base")).toBe(true);
  });
  test("aerodrome-base not allowed on Conservative (not lending)", () => {
    expect(isProtocolAllowed("conservative", 8453, "aerodrome-base")).toBe(false);
  });
  test("unknown protocol always rejected", () => {
    expect(isProtocolAllowed("degen", 8453, "non-existent")).toBe(false);
  });
});

describe("best* selectors", () => {
  test("bestLendingProtocol on Base returns aave-v3-base (highest TVL)", () => {
    const p = bestLendingProtocol("balanced", 8453);
    expect(p?.slug).toBe("aave-v3-base");
  });
  test("bestDexProtocol on Base returns uniswap-v3-base (highest TVL DEX)", () => {
    const p = bestDexProtocol("balanced", 8453);
    expect(p?.slug).toBe("uniswap-v3-base");
  });
  test("bestLpProtocol on Aggressive prefers emission farm", () => {
    const p = bestLpProtocol("aggressive", 8453);
    expect(["aerodrome-base", "aerodrome-cl"]).toContain(p?.slug);
  });
});

describe("protocolDetails", () => {
  test("case-insensitive slug lookup", () => {
    expect(protocolDetails("AAVE-V3-BASE")?.slug).toBe("aave-v3-base");
    expect(protocolDetails("aerodrome-base")?.name).toBe("Aerodrome");
  });
});
