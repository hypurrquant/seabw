import type { ToolResult } from "@hq/react/agent";
import { z } from "zod";

// Drift map with HQ apps/server/tools/hypurrquant-mcp-server.ts LpCardSchemaMcp:
// id -> LpCard.id
// rank -> LpCard.rank
// protocol -> LpCard.protocol
// chainId -> LpCard.chainId
// pair -> LpCard.pair
// poolAddress -> LpCard.poolAddress
// metrics -> LpCard.metrics
// position -> LpCard.position
// reasoning -> LpCard.reasoning
// recipe -> LpCard.recipe
// generatedAt is intentionally optional here; this browser handler fills it.
export const TokenRefSchema = z.object({
  symbol: z.string(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  decimals: z.number().int().min(0).max(36).optional(),
  logoUri: z.string().url().optional(),
});

export const LpCardSchema = z.object({
  id: z.string().min(1),
  rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  protocol: z.string(),
  chainId: z.number(),
  pair: z.object({ base: TokenRefSchema, quote: TokenRefSchema }),
  feeTier: z.number().optional(),
  poolAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  metrics: z.object({
    apr: z.number(),
    apr7dAvg: z.number().optional(),
    tvlUsd: z.number(),
    volume24hUsd: z.number().optional(),
    ilRisk: z.enum(["low", "medium", "high"]),
  }),
  position: z.object({
    suggestedAmountUsd: z.number().positive(),
    priceRange: z.object({ lower: z.number(), upper: z.number(), unit: z.enum(["price", "tick"]) }).optional(),
    tokenSplit: z.object({ base: z.number().min(0).max(1), quote: z.number().min(0).max(1) }).optional(),
  }),
  reasoning: z.object({
    fitForTier: z.string().min(1),
    pros: z.array(z.string()).max(3),
    cons: z.array(z.string()).max(3),
    tierAlignment: z.enum(["match", "stretch", "warning"]),
  }),
  recipe: z.array(z.object({ atom: z.string(), params: z.unknown() })).min(1),
  estimatedGasUsd: z.number().optional(),
});

export const LpProposalSchema = z.object({
  cards: z.tuple([LpCardSchema, LpCardSchema, LpCardSchema]),
  rationale: z.string().min(1),
  generatedAt: z.string().datetime().optional(),
});

export type LpCard = z.infer<typeof LpCardSchema>;
export type LpProposal = z.infer<typeof LpProposalSchema>;

type Deps = {
  pushProposal: (proposal: LpProposal) => void;
};

export function createProposeLpPositionsHandler(deps: Deps) {
  return async (args: unknown): Promise<ToolResult> => {
    const parsed = LpProposalSchema.safeParse(args);
    if (!parsed.success) {
      return {
        status: "error",
        code: "INVALID_ARGS",
        message: `LpProposal validation failed: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      };
    }

    const proposal: LpProposal = {
      ...parsed.data,
      generatedAt: parsed.data.generatedAt ?? new Date().toISOString(),
    };
    deps.pushProposal(proposal);

    return { status: "success", data: { received: true, cardCount: 3 } };
  };
}
