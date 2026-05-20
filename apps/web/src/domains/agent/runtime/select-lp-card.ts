import type { RecipeAtom } from "@hq/core/defi/pipeline/types";
import { usePipelineStore } from "@hq/react/agent";
import { previewRecipe } from "@hq/react/defi/pipeline";
import type { LpCard } from "../tools/propose-lp-positions";
import { guardRecipe } from "./recipe-guard";

export async function selectLpCard(
  card: LpCard,
  ctx: {
    ownerAddress: `0x${string}`;
    sessionId: string;
  },
): Promise<string> {
  guardRecipe(card);

  const recipe = card.recipe as RecipeAtom[];
  const preview = await previewRecipe(recipe, ctx.ownerAddress, null);
  const pipelineId = `lp-card-${card.id}-${Date.now()}`;

  usePipelineStore.getState().addPendingResolved(
    ctx.sessionId,
    {
      pipelineId,
      recipe,
      summary: preview.summary,
      createdAt: Date.now(),
      previewedTick: preview.previewedTick,
    },
    preview.resolved,
  );

  return pipelineId;
}
