import { describe, expect, it } from "vitest";
import type { LpCard } from "../../tools/propose-lp-positions";
import { guardRecipe } from "../recipe-guard";

function makeCard(overrides: Partial<LpCard> = {}): LpCard {
  return {
    id: "card-1",
    rank: 1,
    protocol: "KittenSwap",
    chainId: 999,
    pair: {
      base: { symbol: "USDC", address: "0x1111111111111111111111111111111111111111", decimals: 6 },
      quote: { symbol: "HYPE", address: "0x2222222222222222222222222222222222222222", decimals: 18 },
    },
    poolAddress: "0x3333333333333333333333333333333333333333",
    metrics: { apr: 10, tvlUsd: 1_000_000, ilRisk: "low" },
    position: { suggestedAmountUsd: 100 },
    reasoning: {
      fitForTier: "Matches tier",
      pros: ["Low IL"],
      cons: ["Gas"],
      tierAlignment: "match",
    },
    recipe: [{ atom: "mint", params: { chainId: 999 } }],
    ...overrides,
  };
}

describe("guardRecipe", () => {
  it("allows mint recipe on allowed chain under amount cap", () => {
    expect(() => guardRecipe(makeCard())).not.toThrow();
  });

  it("rejects disallowed atoms", () => {
    expect(() => guardRecipe(makeCard({ recipe: [{ atom: "swap", params: { chainId: 999 } }] }))).toThrow(
      /not allowed/,
    );
  });

  it("rejects disallowed card chain", () => {
    expect(() => guardRecipe(makeCard({ chainId: 1 }))).toThrow(/chain 1 not allowed/);
  });

  it("rejects suggested amount above cap", () => {
    expect(() => guardRecipe(makeCard({ position: { suggestedAmountUsd: 1001 } }))).toThrow(
      /exceeds \$1000 cap/,
    );
  });

  it("rejects recipe length above limit", () => {
    expect(() =>
      guardRecipe(
        makeCard({
          recipe: [
            { atom: "mint", params: { chainId: 999 } },
            { atom: "farm", params: { chainId: 999 } },
            { atom: "farm", params: { chainId: 999 } },
            { atom: "farm", params: { chainId: 999 } },
            { atom: "farm", params: { chainId: 999 } },
            { atom: "farm", params: { chainId: 999 } },
          ],
        }),
      ),
    ).toThrow(/recipe length 6/);
  });
});
