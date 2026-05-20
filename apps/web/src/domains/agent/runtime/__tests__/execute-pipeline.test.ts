import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePipelineStore } from "@hq/react/agent";
import { executeRecipe } from "@hq/react/defi/pipeline";
import { initPlatformDeps } from "@hq/react/platform";
import type { ExecutorCallbacks, RecipeAtom, StepDescriptor } from "@hq/core/defi/pipeline/types";
import { executePendingPipeline } from "../execute-pipeline";

vi.mock("@hq/react/defi/pipeline", () => ({
  executeRecipe: vi.fn(),
}));

const pipelineId = "pipeline-1";
const sessionId = "session-1";
const ownerAddress = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const txHash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const recipe = [{ atom: "mint", params: { chainId: 999 } }] as unknown as RecipeAtom[];

function seedPipeline() {
  usePipelineStore.setState({
    pipelines: {
      [pipelineId]: {
        pipelineId,
        recipe,
        summary: [{ stageId: "stage-1", label: "Mint LP" }],
        createdAt: Date.now(),
        previewedTick: null,
        status: "pending",
      },
    },
    resolvedPipelines: {},
    progress: {},
    pendingFeedbackQueue: [],
  });
}

describe("executePendingPipeline", () => {
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
    seedPipeline();
  });

  it("marks executing, collects tx hash, marks executed, and clears progress on success", async () => {
    const store = usePipelineStore.getState();
    const markExecuting = vi.spyOn(store, "markExecuting");
    const markExecuted = vi.spyOn(store, "markExecuted");
    const clearProgress = vi.spyOn(store, "clearProgress");

    vi.mocked(executeRecipe).mockImplementation(async (_recipe, _ownerAddress, callbacks: ExecutorCallbacks) => {
      callbacks.onInit([{ id: "step-1", type: "mint", label: "Mint LP", canRetry: false } as unknown as StepDescriptor]);
      callbacks.onStepComplete("step-1", txHash);
      callbacks.onComplete();
    });

    await executePendingPipeline(pipelineId, sessionId, ownerAddress);

    expect(markExecuting).toHaveBeenCalledTimes(1);
    expect(markExecuting).toHaveBeenCalledWith(sessionId, pipelineId);
    expect(markExecuted).toHaveBeenCalledTimes(1);
    expect(markExecuted).toHaveBeenCalledWith(sessionId, pipelineId, [txHash]);
    expect(clearProgress).toHaveBeenCalledTimes(1);
    expect(clearProgress).toHaveBeenCalledWith(pipelineId);
  });

  it("marks failed and clears progress when executeRecipe reports onError", async () => {
    const store = usePipelineStore.getState();
    const markFailed = vi.spyOn(store, "markFailed");
    const clearProgress = vi.spyOn(store, "clearProgress");
    const error = new Error("execution failed") as unknown as Parameters<ExecutorCallbacks["onError"]>[0];

    vi.mocked(executeRecipe).mockImplementation(async (_recipe, _ownerAddress, callbacks: ExecutorCallbacks) => {
      callbacks.onError(error);
    });

    await executePendingPipeline(pipelineId, sessionId, ownerAddress);

    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(markFailed).toHaveBeenCalledWith(sessionId, pipelineId, "execution failed");
    expect(clearProgress).toHaveBeenCalledTimes(1);
    expect(clearProgress).toHaveBeenCalledWith(pipelineId);
  });
});
