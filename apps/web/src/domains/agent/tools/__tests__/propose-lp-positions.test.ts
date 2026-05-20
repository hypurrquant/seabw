import { describe, expect, it, vi } from "vitest";
import {
  createProposeLpPositionsHandler,
  type LpCard,
  type LpProposal,
} from "../propose-lp-positions";

const BASE_TOKEN = {
  symbol: "USDC",
  address: "0x1111111111111111111111111111111111111111",
  decimals: 6,
};

const QUOTE_TOKEN = {
  symbol: "HYPE",
  address: "0x2222222222222222222222222222222222222222",
  decimals: 18,
};

function makeCard(rank: 1 | 2 | 3): LpCard {
  return {
    id: `card-${rank}`,
    rank,
    protocol: "KittenSwap",
    chainId: 999,
    pair: { base: BASE_TOKEN, quote: QUOTE_TOKEN },
    poolAddress: "0x3333333333333333333333333333333333333333",
    metrics: {
      apr: 12.5 + rank,
      tvlUsd: 1_000_000,
      ilRisk: rank === 1 ? "low" : "medium",
    },
    position: {
      suggestedAmountUsd: 100,
    },
    reasoning: {
      fitForTier: "Matches balanced tier",
      pros: ["Deep liquidity", "Reasonable APR"],
      cons: ["Smart contract risk"],
      tierAlignment: "match",
    },
    recipe: [{ atom: "mint", params: { chainId: 999 } }],
  };
}

function makeProposal(): Omit<LpProposal, "generatedAt"> {
  return {
    cards: [makeCard(1), makeCard(2), makeCard(3)],
    rationale: "Three LP choices ranked by tier fit.",
  };
}

describe("createProposeLpPositionsHandler", () => {
  it("accepts exactly 3 cards, fills generatedAt, pushes proposal, and returns success", async () => {
    const pushProposal = vi.fn();
    const handler = createProposeLpPositionsHandler({ pushProposal });

    const result = await handler(makeProposal());

    expect(result).toEqual({ status: "success", data: { received: true, cardCount: 3 } });
    expect(pushProposal).toHaveBeenCalledTimes(1);
    const pushed = pushProposal.mock.calls[0]?.[0] as LpProposal;
    expect(pushed.cards).toHaveLength(3);
    expect(pushed.generatedAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(pushed.generatedAt!))).toBe(false);
  });

  it("returns INVALID_ARGS when cards has only 2 items", async () => {
    const handler = createProposeLpPositionsHandler({ pushProposal: vi.fn() });
    const proposal = { ...makeProposal(), cards: [makeCard(1), makeCard(2)] };

    const result = await handler(proposal);

    expect(result.status).toBe("error");
    if (result.status !== "error") throw new Error("expected error result");
    expect(result).toMatchObject({ code: "INVALID_ARGS" });
    expect(result.message).toContain("cards");
  });

  it("returns INVALID_ARGS when cards has 4 items", async () => {
    const handler = createProposeLpPositionsHandler({ pushProposal: vi.fn() });
    const proposal = { ...makeProposal(), cards: [makeCard(1), makeCard(2), makeCard(3), makeCard(3)] };

    const result = await handler(proposal);

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ code: "INVALID_ARGS" });
  });

  it("returns INVALID_ARGS when rank is outside 1..3", async () => {
    const handler = createProposeLpPositionsHandler({ pushProposal: vi.fn() });
    const proposal = makeProposal();
    proposal.cards[0] = { ...proposal.cards[0], rank: 4 as 1 };

    const result = await handler(proposal);

    expect(result.status).toBe("error");
    if (result.status !== "error") throw new Error("expected error result");
    expect(result).toMatchObject({ code: "INVALID_ARGS" });
    expect(result.message).toContain("rank");
  });

  it("returns INVALID_ARGS when recipe is empty", async () => {
    const handler = createProposeLpPositionsHandler({ pushProposal: vi.fn() });
    const proposal = makeProposal();
    proposal.cards[0] = { ...proposal.cards[0], recipe: [] };

    const result = await handler(proposal);

    expect(result.status).toBe("error");
    if (result.status !== "error") throw new Error("expected error result");
    expect(result).toMatchObject({ code: "INVALID_ARGS" });
    expect(result.message).toContain("recipe");
  });
});
