import { executeRecipe } from "@hq/react/defi/pipeline";
import { usePipelineStore } from "@hq/react/agent";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function executePendingPipeline(
  pipelineId: string,
  sessionId: string,
  ownerAddress: `0x${string}`,
): Promise<void> {
  const store = usePipelineStore.getState();
  const entry = store.pipelines[pipelineId];
  if (!entry) throw new Error(`pipeline ${pipelineId} not found`);

  store.markExecuting(sessionId, pipelineId);

  const txHashes: `0x${string}`[] = [];
  let completedSteps = 0;

  try {
    await executeRecipe(
      entry.recipe,
      ownerAddress,
      {
        onInit: (steps) => {
          usePipelineStore.getState().initProgress(pipelineId, steps.length);
        },
        onStepStart: () => {},
        onStepComplete: (_stepId, txHash) => {
          if (txHash) txHashes.push(txHash);
          completedSteps += 1;
          usePipelineStore.getState().updateProgress(pipelineId, completedSteps);
        },
        onStepSkipped: () => {
          completedSteps += 1;
          usePipelineStore.getState().updateProgress(pipelineId, completedSteps);
        },
        onStepError: () => {},
        onStepsSkipped: (stepIds) => {
          completedSteps += stepIds.length;
          usePipelineStore.getState().updateProgress(pipelineId, completedSteps);
        },
        onStageSkipped: null,
        onComplete: () => {
          usePipelineStore.getState().markExecuted(sessionId, pipelineId, txHashes);
        },
        onError: (error) => {
          usePipelineStore.getState().markFailed(sessionId, pipelineId, toErrorMessage(error));
        },
      },
      null,
    );
  } catch (error) {
    usePipelineStore.getState().markFailed(sessionId, pipelineId, toErrorMessage(error));
    throw error;
  } finally {
    usePipelineStore.getState().clearProgress(pipelineId);
  }
}
