import { beforeEach, describe, expect, it } from "vitest";
import type { LpProposal } from "../../tools/propose-lp-positions";
import { useLpProposalStore } from "../useLpProposalStore";

const proposal: LpProposal = {
  cards: [
    {
      id: "card-1",
      rank: 1,
      protocol: "KittenSwap",
      chainId: 999,
      pair: {
        base: { symbol: "USDC", address: "0x1111111111111111111111111111111111111111", decimals: 6 },
        quote: { symbol: "HYPE", address: "0x2222222222222222222222222222222222222222", decimals: 18 },
      },
      poolAddress: "0x3333333333333333333333333333333333333333",
      metrics: { apr: 12, tvlUsd: 1_000_000, ilRisk: "low" },
      position: { suggestedAmountUsd: 100, priceRange: { lower: -1200, upper: 1200, unit: "tick" }, tokenSplit: { base: 0.5, quote: 0.5 } },
      reasoning: {
        fitForTier: "Matches tier",
        pros: ["Low IL"],
        cons: ["Gas cost"],
        tierAlignment: "match",
      },
      recipe: [{ atom: "mint", params: { chainId: 999 } }],
    },
    {
      id: "card-2",
      rank: 2,
      protocol: "KittenSwap",
      chainId: 999,
      pair: {
        base: { symbol: "USDC", address: "0x1111111111111111111111111111111111111111", decimals: 6 },
        quote: { symbol: "HYPE", address: "0x2222222222222222222222222222222222222222", decimals: 18 },
      },
      poolAddress: "0x4444444444444444444444444444444444444444",
      metrics: { apr: 16, tvlUsd: 750_000, ilRisk: "medium" },
      position: { suggestedAmountUsd: 100, priceRange: { lower: -1200, upper: 1200, unit: "tick" }, tokenSplit: { base: 0.5, quote: 0.5 } },
      reasoning: {
        fitForTier: "Balanced stretch",
        pros: ["Higher APR"],
        cons: ["More volatility"],
        tierAlignment: "stretch",
      },
      recipe: [{ atom: "mint", params: { chainId: 999 } }],
    },
    {
      id: "card-3",
      rank: 3,
      protocol: "KittenSwap",
      chainId: 999,
      pair: {
        base: { symbol: "USDC", address: "0x1111111111111111111111111111111111111111", decimals: 6 },
        quote: { symbol: "HYPE", address: "0x2222222222222222222222222222222222222222", decimals: 18 },
      },
      poolAddress: "0x5555555555555555555555555555555555555555",
      metrics: { apr: 24, tvlUsd: 300_000, ilRisk: "high" },
      position: { suggestedAmountUsd: 75, priceRange: { lower: -1200, upper: 1200, unit: "tick" }, tokenSplit: { base: 0.5, quote: 0.5 } },
      reasoning: {
        fitForTier: "Opportunistic option",
        pros: ["Highest APR"],
        cons: ["Higher IL"],
        tierAlignment: "warning",
      },
      recipe: [{ atom: "mint", params: { chainId: 999 } }],
    },
  ],
  rationale: "Ranked LP choices.",
  generatedAt: "2026-05-20T00:00:00.000Z",
};

describe("useLpProposalStore", () => {
  beforeEach(() => {
    useLpProposalStore.setState({ current: null });
  });

  it("push updates current proposal", () => {
    useLpProposalStore.getState().push(proposal);

    expect(useLpProposalStore.getState().current).toBe(proposal);
  });

  it("clear resets current proposal", () => {
    useLpProposalStore.getState().push(proposal);
    useLpProposalStore.getState().clear();

    expect(useLpProposalStore.getState().current).toBeNull();
  });
});
