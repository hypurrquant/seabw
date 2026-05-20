import type { RecipeAtom } from "@hq/core/defi/pipeline/types";
import type { LpCard } from "../tools/propose-lp-positions";

const ALLOWED_ATOMS = new Set(["mint", "farm"]);
const CHAIN_ALLOWLIST = new Set([999, 8453]);
const MAX_AMOUNT_USD = 1000;
const MAX_RECIPE_LENGTH = 5;

export function guardRecipe(card: LpCard): void {
  if (card.position.suggestedAmountUsd > MAX_AMOUNT_USD) {
    throw new Error(
      `suggestedAmountUsd ${card.position.suggestedAmountUsd} exceeds $${MAX_AMOUNT_USD} cap`,
    );
  }

  if (!CHAIN_ALLOWLIST.has(card.chainId)) {
    throw new Error(`chain ${card.chainId} not allowed in P0`);
  }

  const atoms = card.recipe as RecipeAtom[];
  if (atoms.length === 0 || atoms.length > MAX_RECIPE_LENGTH) {
    throw new Error(`recipe length ${atoms.length} out of range`);
  }

  for (const atom of atoms) {
    if (!ALLOWED_ATOMS.has(atom.atom)) {
      throw new Error(`recipe atom '${atom.atom}' not allowed in P0`);
    }

    const chainId = (atom.params as { chainId?: number }).chainId;
    if (chainId != null && !CHAIN_ALLOWLIST.has(chainId)) {
      throw new Error(`atom chainId ${chainId} not allowed`);
    }
  }
}
