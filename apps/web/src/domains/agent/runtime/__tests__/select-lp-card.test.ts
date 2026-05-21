import { beforeEach, describe, expect, it, vi } from "vitest";
import { initPlatformDeps } from "@hq/react/platform";
import { usePipelineStore } from "@hq/react/agent";
import { previewRecipe } from "@hq/react/defi/pipeline";
import type { LpCard } from "../../tools/propose-lp-positions";
import { selectLpCard } from "../select-lp-card";

vi.mock("@hq/react/defi/pipeline", () => ({
  previewRecipe: vi.fn(),
}));

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
    position: { suggestedAmountUsd: 100, priceRange: { lower: -1200, upper: 1200, unit: "tick" }, tokenSplit: { base: 0.5, quote: 0.5 } },
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

describe("selectLpCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    initPlatformDeps(
      {
        execute: vi.fn(),
        signMessage: vi.fn(),
        storage: sessionStorage,
        showToast: vi.fn(),
        onBeforeUnload: vi.fn(() => vi.fn()),
        getSignDeps: () => null,
      },
      { allowOverwrite: true },
    );
    usePipelineStore.setState({ pipelines: {}, resolvedPipelines: {}, progress: {}, pendingFeedbackQueue: [] });
  });

  it("previews recipe, stores resolved pipeline, and returns pipelineId", async () => {
    vi.mocked(previewRecipe).mockResolvedValue({
      summary: [{ stageId: "stage-1", label: "Mint LP" }],
      previewedTick: null,
      resolved: { stages: [] },
    } as unknown as Awaited<ReturnType<typeof previewRecipe>>);

    const pipelineId = await selectLpCard(makeCard(), {
      ownerAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sessionId: "session-1",
    });

    expect(pipelineId).toMatch(/^lp-card-card-1-/);
    expect(previewRecipe).toHaveBeenCalledTimes(1);
    expect(usePipelineStore.getState().pipelines[pipelineId]).toMatchObject({
      pipelineId,
      status: "pending",
      summary: [{ stageId: "stage-1", label: "Mint LP" }],
    });
    expect(usePipelineStore.getState().resolvedPipelines[pipelineId]).toEqual({ stages: [] });
  });

  it("throws before preview when guard fails", async () => {
    await expect(
      selectLpCard(makeCard({ chainId: 1 }), {
        ownerAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        sessionId: "session-1",
      }),
    ).rejects.toThrow(/not allowed/);
    expect(previewRecipe).not.toHaveBeenCalled();
  });
});
